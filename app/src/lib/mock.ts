// Fake backend so every screen can be built and tested before the real one exists.
// Same functions as real.ts (see data.ts). Edit freely: only Sid uses this file.
import * as Crypto from 'expo-crypto';
import type {
  Profile, Match, MatchResult, WindowItem, WindowProgress, Knock, ItineraryStop, SendWindowInput,
} from './types';

// Start the app already logged in as the demo Sid (skips Welcome + onboarding)?
const START_SIGNED_IN = false;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// ---------- fake people ----------
const demoMe: Profile = {
  id: 'me', name: 'Sid', languages: ['en', 'hi'],
  home_city: 'Atlanta', country: 'United States', tz: 'America/New_York', lat: 33.75, lng: -84.39,
  interests: ['Film photography', 'Ramen', 'Coffee'], dream_places: ['Kyoto', 'Lisbon', 'Seoul'],
  mutual_dreams: true, hide_contact: true, onboarded: true,
};

const blankMe: Profile = {
  id: 'me', name: '', languages: [], home_city: '', country: '', tz: 'America/New_York', lat: 0, lng: 0,
  interests: [], dream_places: [], mutual_dreams: true, hide_contact: true, onboarded: false,
};

let signedIn = START_SIGNED_IN;
let me: Profile = { ...demoMe };

const aiko: Profile = {
  id: 'aiko', name: 'Aiko', languages: ['ja'],
  home_city: 'Kyoto', country: 'Japan', tz: 'Asia/Tokyo', lat: 35.01, lng: 135.77,
  interests: ['Film photography', 'Ramen', 'Coffee', 'Cycling'], dream_places: ['Atlanta', 'Paris'],
  mutual_dreams: true, hide_contact: true, onboarded: true,
};
const ines: Profile = {
  id: 'ines', name: 'Inês', languages: ['pt'],
  home_city: 'Lisbon', country: 'Portugal', tz: 'Europe/Lisbon', lat: 38.72, lng: -9.14,
  interests: ['Coffee', 'Architecture', 'Music'], dream_places: ['Atlanta'],
  mutual_dreams: true, hide_contact: true, onboarded: true,
};
const minjun: Profile = {
  id: 'minjun', name: 'Minjun', languages: ['ko'],
  home_city: 'Seoul', country: 'South Korea', tz: 'Asia/Seoul', lat: 37.57, lng: 126.98,
  interests: ['Gaming', 'Street food', 'Film photography'], dream_places: ['New York', 'Atlanta'],
  mutual_dreams: true, hide_contact: true, onboarded: true,
};

// Locals who could become your pen pal
const personas: Profile[] = [aiko, ines, minjun];

// You start with Aiko as your one pen pal (demo). End the window on the You tab to get matched again.
const matches: Match[] = [
  {
    id: 'm-aiko', city: 'Kyoto', status: 'active', created_at: daysAgo(5), partner: aiko,
    reason: 'You both shoot on film, love ramen, and Aiko has always wanted to see Atlanta.',
  },
];

// ---------- fake windows from Aiko ----------
function fromAiko(n: number, extra: Partial<WindowItem>): WindowItem {
  return {
    id: `w${n}`, match_id: 'm-aiko', sender_id: 'aiko', recipient_id: 'me',
    photo_url: `https://picsum.photos/seed/kyoto${n}/900/1200`,
    caption: '', stickers: [], saved: false, status: 'ready',
    local_date: daysAgo(n).slice(0, 10), created_at: new Date(Date.now() - n * 86400000 - 120000).toISOString(),
    src_lang: 'ja', lang: 'en',
    ...extra,
  };
}

const windows: WindowItem[] = [
  fromAiko(0, {
    caption: '学校までの道。コンビニのたまごサンドが毎朝の儀式',
    caption_t: 'my walk to class. the konbini egg sandwich is my every-morning ritual',
    context_note:
      'Konbini are open all day and night across Japan, and their egg sandwiches have a cult following. Grabbing breakfast there on the way to class is a normal morning for students.',
    stickers: [
      { word: 'コンビニ', reading: 'konbini', meaning: 'corner store', x: 0.62, y: 0.58 },
      { word: '提灯', reading: 'chōchin', meaning: 'lantern', x: 0.22, y: 0.7 },
      { word: '自転車', reading: 'jitensha', meaning: 'bicycle', x: 0.42, y: 0.38 },
    ],
    spot: 'Demachiyanagi', spot_lat: 35.03, spot_lng: 135.772,
  }),
  fromAiko(1, {
    caption: '夕方はみんな鴨川の石段に座る', caption_t: 'everyone sits on the steps by the river at sunset',
    context_note: 'The Kamo River banks are Kyoto\'s living room. Students and couples line the stone steps every evening, spaced out almost perfectly.',
    spot: 'Kamo River', spot_lat: 35.015, spot_lng: 135.771, saved: true,
  }),
  fromAiko(3, {
    caption: '人が来る前の伏見稲荷', caption_t: 'fushimi inari before the crowds',
    context_note: 'Fushimi Inari has thousands of orange torii gates. Locals go at sunrise, before tour groups arrive.',
    spot: 'Fushimi Inari', spot_lat: 34.967, spot_lng: 135.773, saved: true,
  }),
  fromAiko(4, {
    caption: 'いちばん好きなラーメン屋', caption_t: 'my favorite ramen counter',
    context_note: 'Many ramen shops seat fewer than ten people at a counter. You buy a ticket from a machine by the door, then hand it to the cook.',
    spot: 'Ichijoji', spot_lat: 35.045, spot_lng: 135.79,
  }),
];

const sent: WindowItem[] = [];

// ---------- auth + profile ----------
export async function signUp(email: string, password: string): Promise<void> {
  await wait(600);
  if (!email.includes('@')) throw new Error('That email doesn\'t look right.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  me = { ...blankMe };
  signedIn = true;
}
export async function signIn(email: string, password: string): Promise<void> {
  await wait(600);
  if (!email.includes('@')) throw new Error('That email doesn\'t look right.');
  me = { ...demoMe };
  signedIn = true;
}
export async function signOut(): Promise<void> {
  signedIn = false;
}
export async function getMyProfile(): Promise<Profile | null> {
  await wait(150);
  return signedIn ? { ...me } : null;
}
export async function saveProfile(p: Partial<Profile>): Promise<void> {
  await wait(200);
  me = { ...me, ...p };
}
export async function registerPushToken(): Promise<void> {}

// ---------- matching (ONE pen pal at a time) ----------
export async function findMatches(): Promise<MatchResult[]> {
  await wait(3500); // long enough to see the Matching animation
  // Already have a pen pal? Return them.
  const current = matches.find((m) => m.status !== 'ended');
  if (current) return [{ city: current.city, status: 'matched', match: { ...current } }];
  // Otherwise pick the best free local across all dream cities (here: the first persona in one of them)
  for (const city of me.dream_places) {
    const local = personas.find((p) => p.home_city === city && !matches.some((m) => m.partner.id === p.id));
    if (local) {
      const match: Match = {
        id: `m-${local.id}`, city, status: 'active', created_at: new Date().toISOString(), partner: local,
        reason: `You both love ${local.interests[0].toLowerCase()}, and ${local.name} has always wanted to see ${me.home_city || 'your city'}.`,
      };
      matches.push(match);
      return [{ city, status: 'matched', match: { ...match } }];
    }
  }
  return me.dream_places.map((city) => ({ city, status: 'waiting' as const }));
}
export async function getMatches(): Promise<Match[]> {
  await wait(150);
  // At most one non-ended match
  return matches.filter((m) => m.status !== 'ended').slice(0, 1).map((m) => ({ ...m }));
}
export async function setMatchStatus(matchId: string, status: Match['status']): Promise<void> {
  const m = matches.find((x) => x.id === matchId);
  if (m) m.status = status;
}

// ---------- windows ----------
export function newWindowId(): string {
  return Crypto.randomUUID();
}

export async function sendWindow(input: SendWindowInput): Promise<void> {
  await wait(800);
  if (sent.some((w) => w.match_id === input.matchId && w.local_date === input.localDate)) {
    throw new Error("You already sent today's window.");
  }
  sent.push({
    id: input.id, match_id: input.matchId, sender_id: 'me', recipient_id: input.recipientId,
    photo_url: input.photoUri, audio_url: input.audioUri, caption: input.caption, spot: input.spot,
    stickers: [], saved: false, status: 'ready', local_date: input.localDate, created_at: new Date().toISOString(),
    src_lang: 'en', lang: 'ja',
  });
}

export function watchWindow(id: string, cb: (p: WindowProgress) => void): () => void {
  const caption_t = '今夜はクラウスでハッキング中。初めてのハッカソン！';
  const steps: WindowProgress[] = [
    { status: 'uploading', steps: {} },
    { status: 'processing', steps: { safety: true } },
    { status: 'processing', steps: { safety: true, transcribed: true } },
    { status: 'processing', steps: { safety: true, transcribed: true, translated: true }, caption_t },
    { status: 'ready', steps: { safety: true, transcribed: true, translated: true, voiced: true }, caption_t },
  ];
  const timers = steps.map((s, i) => setTimeout(() => cb(s), i * 1200));
  return () => timers.forEach(clearTimeout);
}

export async function getToday(
  matchId: string,
): Promise<{ theirs?: WindowItem; mine?: WindowItem; sentToday: boolean }> {
  await wait(300);
  const theirs = windows.find((w) => w.match_id === matchId);
  const today = new Date().toISOString().slice(0, 10);
  const mine = sent.filter((w) => w.match_id === matchId).pop();
  const sentToday = !!mine && mine.local_date >= today.slice(0, 8) + '00' && Date.now() - new Date(mine.created_at).getTime() < 86400000;
  return { theirs, mine: sentToday ? mine : undefined, sentToday };
}
export async function getWindow(id: string): Promise<WindowItem> {
  await wait(250);
  return windows.find((w) => w.id === id) ?? sent.find((w) => w.id === id) ?? windows[0];
}
export async function saveWindow(id: string, saved: boolean): Promise<void> {
  const w = windows.find((x) => x.id === id);
  if (w) w.saved = saved;
}
export async function getWall(matchId: string): Promise<WindowItem[]> {
  await wait(250);
  return windows.filter((w) => w.match_id === matchId);
}

// ---------- live updates + knocks ----------
let fakeKnockDone = false;
export function watchInbox(h: { onWindow: (w: WindowItem) => void; onKnock: (k: Knock) => void }): () => void {
  if (fakeKnockDone) return () => {};
  // Pretend Aiko knocks on your window 20 s after you reach the main app (once per launch)
  const t = setTimeout(() => {
    fakeKnockDone = true;
    h.onKnock({
      id: 'k1', from_user: 'aiko', to_user: 'me', source: 'window',
      pattern: [0, 220, 440, 880, 1100], created_at: new Date().toISOString(),
    });
  }, 20000);
  return () => clearTimeout(t);
}
export async function sendKnock(toUser: string, pattern: number[]): Promise<void> {
  await wait(200);
  // Same rule as the real backend: no knocks while the window is paused
  if (!matches.some((m) => m.partner.id === toUser && m.status === 'active')) {
    throw new Error('Knocks are available when your pen pal window is active.');
  }
}

// ---------- passport + safety ----------
export async function getItinerary(matchId: string): Promise<ItineraryStop[]> {
  await wait(900);
  if (matchId !== 'm-aiko') return [];
  return [
    { day: 1, place: 'Fushimi Inari at 6 AM', tip: "go before 7 or it's packed!" },
    { day: 1, place: 'The ramen counter in Ichijoji', tip: 'order the chashu, trust me' },
    { day: 2, place: 'Kamo River at sunset', tip: 'everyone sits on the steps' },
    { day: 2, place: 'Konbini breakfast near Demachiyanagi', tip: 'the egg sandwich. every time.' },
  ];
}
export async function reportUser(userId: string, reason: string, windowId?: string): Promise<void> {
  await wait(400);
  matches.forEach((m) => {
    if (m.partner.id === userId) m.status = 'ended';
  });
}
