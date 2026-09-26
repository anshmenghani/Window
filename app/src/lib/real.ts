import * as Crypto from 'expo-crypto';
import { api } from './api';
import { getPushToken } from './notifications';
import { supabase } from './supabase';
import type { ItineraryStop, Knock, Match, MatchResult, Profile, SendWindowInput, WindowItem, WindowProgress, WindowStatus } from './types';

const fail = (error: { message?: string; code?: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback);
};

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Please sign in again.');
  return data.user.id;
}

export async function signUp(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new Error('That email is already registered.');
    fail(error, 'Could not create your account.');
  }
  if (!data.user) throw new Error('Could not create your account. Please try again.');
  const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id });
  if (profileError) fail(profileError, 'Your account was created, but your profile could not be set up. Please sign in.');
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login|invalid credentials/i.test(error.message)) throw new Error('That email and password do not match.');
    fail(error, 'Could not sign in. Please try again.');
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) fail(error, 'Could not sign out.');
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) fail(error, 'Could not load your profile.');
  return data as Profile | null;
}

export async function saveProfile(p: Partial<Profile>): Promise<void> {
  const id = await currentUserId();
  const { error } = await supabase.from('profiles').update(p).eq('id', id);
  if (error) fail(error, 'Could not save your profile.');
}

export async function registerPushToken(): Promise<void> {
  try {
    const token = await getPushToken();
    if (!token) return;
    const id = await currentUserId();
    // Stored in push_tokens (only you can read it), not on the profile your pen pal can see.
    await supabase.from('push_tokens').upsert({ user_id: id, token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } catch { /* Push is optional; sign-in and onboarding must continue. */ }
}

export async function findMatches(): Promise<MatchResult[]> {
  return api<MatchResult[]>('/match', {});
}

export async function getMatches(): Promise<Match[]> {
  const id = await currentUserId();
  const { data, error } = await supabase.from('matches').select('*').in('status', ['active', 'paused']).or(`user_a.eq.${id},user_b.eq.${id}`).order('created_at', { ascending: false });
  if (error) fail(error, 'Could not load your matches.');
  const matches = (data || []).slice(0, 1);
  const partnerIds = [...new Set(matches.map((m) => m.user_a === id ? m.user_b : m.user_a).filter(Boolean))] as string[];
  const profiles = partnerIds.length ? await supabase.from('profiles').select('*').in('id', partnerIds) : { data: [], error: null };
  if (profiles.error) fail(profiles.error, 'Could not load your match profiles.');
  const byId = new Map((profiles.data || []).map((p) => [p.id, p]));
  return matches.map((m) => ({ ...m, partner: byId.get(m.user_a === id ? m.user_b : m.user_a) })) as Match[];
}

export async function setMatchStatus(matchId: string, status: 'active' | 'paused' | 'ended'): Promise<void> {
  const { error } = await supabase.from('matches').update({ status }).eq('id', matchId);
  if (error) fail(error, 'Could not update this match.');
}

export const newWindowId = (): string => Crypto.randomUUID();

async function uploadLocalFile(uri: string, path: string, contentType: string): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read the selected media. Please try again.');
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) throw new Error('The selected media file is empty. Please choose it again.');
  const { error } = await supabase.storage.from('media').upload(path, buffer, { contentType, upsert: false });
  if (error) fail(error, 'Could not upload your window. Please try again.');
}

export async function sendWindow(input: SendWindowInput): Promise<void> {
  const senderId = await currentUserId();
  const photoPath = `${senderId}/${input.id}.jpg`;
  const audioPath = input.audioUri ? `${senderId}/${input.id}.m4a` : null;
  await uploadLocalFile(input.photoUri, photoPath, 'image/jpeg');
  if (input.audioUri && audioPath) await uploadLocalFile(input.audioUri, audioPath, 'audio/mp4');
  const { error } = await supabase.from('windows').insert({
    id: input.id, match_id: input.matchId, sender_id: senderId, recipient_id: input.recipientId,
    photo_path: photoPath, audio_path: audioPath, caption: input.caption, spot: input.spot || null,
    local_date: input.localDate,
  });
  if (error?.code === '23505') throw new Error("You already sent today's window.");
  if (error) fail(error, 'Could not send your window. Please try again.');
  // A retry is safe: the server verifies sender ownership and re-queues its pipeline.
  await api('/process-window', { window_id: input.id });
}

function statusOf(status?: string): WindowStatus {
  if (status === 'ready' || status === 'blocked' || status === 'failed' || status === 'processing') return status;
  return 'uploading';
}

export function watchWindow(id: string, cb: (progress: WindowProgress) => void): () => void {
  cb({ status: 'uploading', steps: {} });
  let stopped = false;
  const publish = (translation: any) => {
    if (!stopped) cb({ status: statusOf(translation?.status), steps: translation?.steps || {}, caption_t: translation?.caption_t || undefined });
  };
  const load = async () => {
    const { data } = await supabase.from('window_translations').select('status,steps,caption_t').eq('window_id', id).maybeSingle();
    if (data) publish(data);
  };
  const channel = supabase.channel(`window-progress-${id}-${Date.now()}`).on('postgres_changes', {
    event: '*', schema: 'public', table: 'window_translations', filter: `window_id=eq.${id}`,
  }, (payload) => publish(payload.new as any)).subscribe();
  const timer = setInterval(() => { void load(); }, 2000);
  void load();
  return () => { stopped = true; clearInterval(timer); void supabase.removeChannel(channel); };
}

type DbWindow = Record<string, any>;
async function getTranslation(id: string): Promise<Record<string, any> | null> {
  const { data, error } = await supabase.from('window_translations').select('*').eq('window_id', id).maybeSingle();
  if (error) fail(error, 'Could not load the window.');
  return data;
}

async function mapWindow(row: DbWindow, translation?: Record<string, any> | null): Promise<WindowItem> {
  const { data: photo } = supabase.storage.from('media').getPublicUrl(row.photo_path);
  const { data: audio } = row.audio_path ? supabase.storage.from('media').getPublicUrl(row.audio_path) : { data: { publicUrl: undefined } };
  const { data: dub } = translation?.dub_path ? supabase.storage.from('media').getPublicUrl(translation.dub_path) : { data: { publicUrl: undefined } };
  return {
    id: row.id, match_id: row.match_id, sender_id: row.sender_id, recipient_id: row.recipient_id,
    photo_url: photo.publicUrl, audio_url: audio.publicUrl, dub_url: dub.publicUrl,
    caption: row.caption || '', caption_t: translation?.caption_t || undefined,
    transcript: translation?.transcript || undefined, transcript_t: translation?.transcript_t || undefined,
    context_note: translation?.context_note || undefined, stickers: translation?.stickers || [],
    src_lang: translation?.src_lang || undefined, lang: translation?.lang || undefined,
    spot: row.spot || undefined, spot_lat: row.spot_lat ?? undefined, spot_lng: row.spot_lng ?? undefined,
    saved: Boolean(row.saved), local_date: row.local_date, created_at: row.created_at,
    status: statusOf(translation?.status),
  };
}

export async function getWindow(id: string): Promise<WindowItem> {
  const [{ data: row, error }, translation] = await Promise.all([
    supabase.from('windows').select('*').eq('id', id).single(), getTranslation(id),
  ]);
  if (error || !row) fail(error, 'Could not load this window.');
  return mapWindow(row, translation);
}

async function localDateToday(): Promise<string> {
  const me = await getMyProfile();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: me?.tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function getToday(matchId: string): Promise<{ theirs?: WindowItem; mine?: WindowItem; sentToday: boolean }> {
  const id = await currentUserId();
  const { data: matchRow, error: matchError } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (matchError || !matchRow) fail(matchError, 'Could not load this match.');
  const date = await localDateToday();
  const { data: windows, error } = await supabase.from('windows').select('*').eq('match_id', matchId).order('created_at', { ascending: false });
  if (error) fail(error, 'Could not load today’s windows.');
  const all = windows || [];
  const partnerId = matchRow.user_a === id ? matchRow.user_b : matchRow.user_a;
  const mineRow = all.find((w) => w.sender_id === id && w.local_date === date);
  const translations = await Promise.all(all.map((w) => getTranslation(w.id)));
  const theirsIndex = all.findIndex((w, i) => w.sender_id === partnerId && translations[i]?.status === 'ready');
  return {
    mine: mineRow ? await mapWindow(mineRow, await getTranslation(mineRow.id)) : undefined,
    theirs: theirsIndex >= 0 ? await mapWindow(all[theirsIndex], translations[theirsIndex]) : undefined,
    sentToday: Boolean(mineRow),
  };
}

export async function saveWindow(id: string, saved: boolean): Promise<void> {
  const { error } = await supabase.from('windows').update({ saved }).eq('id', id);
  if (error) fail(error, 'Could not update your saved window.');
}

export async function getWall(matchId: string): Promise<WindowItem[]> {
  const id = await currentUserId();
  const { data: matchRow, error: matchError } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (matchError || !matchRow) fail(matchError, 'Could not load this match.');
  const partnerId = matchRow.user_a === id ? matchRow.user_b : matchRow.user_a;
  const { data, error } = await supabase.from('windows').select('*').eq('match_id', matchId).eq('sender_id', partnerId).order('created_at', { ascending: false });
  if (error) fail(error, 'Could not load the wall.');
  const output: WindowItem[] = [];
  for (const row of data || []) {
    const translation = await getTranslation(row.id);
    if (translation?.status === 'ready') output.push(await mapWindow(row, translation));
  }
  return output;
}

export function watchInbox(handlers: { onWindow: (window: WindowItem) => void; onKnock: (knock: Knock) => void }): () => void {
  let stopped = false;
  let channel: ReturnType<typeof supabase.channel> | undefined;
  // Realtime can't tell us the previous status on RLS tables, so remember what we've already announced.
  const delivered = new Set<string>();
  void supabase.auth.getUser().then(({ data, error }) => {
    const id = data.user?.id;
    if (stopped || error || !id) return;
    channel = supabase.channel(`inbox-${id}-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'window_translations', filter: `recipient_id=eq.${id}` }, (payload) => {
        const next = payload.new as any;
        if (next.status !== 'ready' || delivered.has(next.window_id)) return;
        delivered.add(next.window_id);
        void getWindow(next.window_id).then(handlers.onWindow).catch(() => delivered.delete(next.window_id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'knocks', filter: `to_user=eq.${id}` }, (payload) => {
        const knock = payload.new as Knock;
        void supabase.from('matches').select('id').eq('status', 'active').or(`and(user_a.eq.${id},user_b.eq.${knock.from_user}),and(user_a.eq.${knock.from_user},user_b.eq.${id})`).limit(1)
          .then(({ data: active }) => { if (active?.length) handlers.onKnock(knock); });
      })
      .subscribe();
  });
  return () => { stopped = true; if (channel) void supabase.removeChannel(channel); };
}

export async function sendKnock(toUser: string, pattern: number[]): Promise<void> {
  const from_user = await currentUserId();
  const { data: active, error: matchError } = await supabase.from('matches').select('id').eq('status', 'active').or(`and(user_a.eq.${from_user},user_b.eq.${toUser}),and(user_a.eq.${toUser},user_b.eq.${from_user})`).limit(1);
  if (matchError) fail(matchError, 'Could not check this pen pal.');
  if (!active?.length) throw new Error('Knocks are available when your pen pal window is active.');
  const { error } = await supabase.from('knocks').insert({ from_user, to_user: toUser, source: 'app', pattern });
  if (error) fail(error, 'Could not send your knock.');
}

export async function getItinerary(matchId: string): Promise<ItineraryStop[]> {
  const { data, error } = await supabase.from('matches').select('itinerary').eq('id', matchId).single();
  if (error) fail(error, 'Could not load the itinerary.');
  if (data?.itinerary) return data.itinerary as ItineraryStop[];
  return api<ItineraryStop[]>('/itinerary', { match_id: matchId });
}

export async function reportUser(userId: string, reason: string, windowId?: string): Promise<void> {
  const reporter_id = await currentUserId();
  const { error: reportError } = await supabase.from('reports').insert({ reporter_id, target_id: userId, window_id: windowId || null, reason });
  if (reportError) fail(reportError, 'Could not send your report.');
  const { error: blockError } = await supabase.from('blocks').upsert({ blocker_id: reporter_id, blocked_id: userId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (blockError) fail(blockError, 'Your report was sent, but this person could not be blocked.');
  const { error: matchError } = await supabase.from('matches').update({ status: 'ended' }).or(`and(user_a.eq.${reporter_id},user_b.eq.${userId}),and(user_a.eq.${userId},user_b.eq.${reporter_id})`);
  if (matchError) fail(matchError, 'Your report was sent, but the match could not be ended.');
}
