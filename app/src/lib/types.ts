export type Lang = string;

export type Profile = {
  id: string; name: string; languages: Lang[];
  home_city: string; country: string; tz: string; lat: number; lng: number;
  interests: string[]; dream_places: string[];
  mutual_dreams: boolean; hide_contact: boolean; onboarded: boolean;
  location_verified?: boolean; // set only by the server after a one-time location check
};

export type Match = {
  id: string; city: string; reason: string;
  status: 'active' | 'paused' | 'ended'; created_at: string; partner: Profile;
};
export type MatchResult = { city: string; status: 'matched' | 'waiting'; match?: Match };
export type Sticker = { word: string; reading: string; meaning: string; x: number; y: number };
export type WindowStatus = 'uploading' | 'processing' | 'ready' | 'blocked' | 'failed';
export type WindowItem = {
  id: string; match_id: string; sender_id: string; recipient_id: string;
  photo_url: string; audio_url?: string; dub_url?: string; caption: string;
  caption_t?: string; transcript?: string; transcript_t?: string; context_note?: string;
  stickers: Sticker[]; src_lang?: Lang; lang?: Lang; spot?: string;
  spot_lat?: number; spot_lng?: number; saved: boolean; local_date: string;
  created_at: string; status: WindowStatus;
  /** AI: one line in the reader's language suggesting how to answer with your own world */
  reply_prompt?: string;
  /** the daily prompt this window answers, if any */
  prompt_id?: string;
};
export type WindowProgress = { status: WindowStatus; steps: { safety?: boolean; transcribed?: boolean; translated?: boolean; voiced?: boolean }; caption_t?: string };
export type Knock = { id: string; from_user: string; to_user: string; source: 'window' | 'app'; pattern: number[]; created_at: string };
export type ItineraryStop = { day: number; place: string; tip: string };
export type SendWindowInput = {
  id: string; matchId: string; recipientId: string; photoUri: string; audioUri?: string;
  caption: string; spot?: string; localDate: string;
  /** set when this window answers today's shared prompt */
  promptId?: string;
};

export type LocationCheck = { verified: boolean; distance_km: number };

/** Today's shared prompt: the same idea for both pen pals, in each person's own language. */
export type DailyPrompt = {
  id: string; match_id: string; prompt_date: string;
  text: string; // "Show each other your coffee today."
  why: string; // "You both love coffee."
  level: BondLevel;
  answered_by_me: boolean; answered_by_them: boolean;
};

/** How close two pen pals have become, worked out from what they've actually shared. */
export type BondLevel = 1 | 2 | 3 | 4;
export type Bond = {
  level: BondLevel; name: string; next?: string;
  progress: number; // 0..1 toward the next level
  letters: number; // windows exchanged (both directions)
  together: number; // daily prompts you both answered
  voices: number; // windows with a voice note
  days: number;
};

/** A passport stamp that marks a real moment in your letters. */
export type MemoryStamp = {
  id: string; title: string; sub: string;
  kind: 'first' | 'voice' | 'together' | 'place' | 'moment';
  window_id?: string; created_at: string;
};

/** "Aiko's Kyoto, as you know it": a short portrait built only from what they've shown you. */
export type Portrait = { text: string; letters: number; updated_at: string };

/** The physical window (Raspberry Pi) linked to your account, and your pen pal's. */
export type PhysicalWindow = {
  linked: boolean; side?: 'A' | 'B';
  online?: boolean; last_seen?: string | null;
  light_timezone?: string | null; // the time zone your window's light is showing (your pen pal's)
  partner_linked?: boolean; partner_online?: boolean; partner_last_seen?: string | null;
  pen_pals_active?: boolean;
};
