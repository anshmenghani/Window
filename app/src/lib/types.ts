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
};
export type WindowProgress = { status: WindowStatus; steps: { safety?: boolean; transcribed?: boolean; translated?: boolean; voiced?: boolean }; caption_t?: string };
export type Knock = { id: string; from_user: string; to_user: string; source: 'window' | 'app'; pattern: number[]; created_at: string };
export type ItineraryStop = { day: number; place: string; tip: string };
export type SendWindowInput = {
  id: string; matchId: string; recipientId: string; photoUri: string; audioUri?: string;
  caption: string; spot?: string; localDate: string;
};

export type LocationCheck = { verified: boolean; distance_km: number };
