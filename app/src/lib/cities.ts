// Cities people can live in or dream of. A fixed list instead of a geocoder:
// no API keys, no rate limits, never breaks during the demo.
// lat/lng are CITY-LEVEL only (never someone's exact location).

export type City = {
  name: string;
  country: string;
  tz: string; // IANA time zone
  lat: number;
  lng: number;
  lang: string; // main local language (ISO 639-1)
};

export const CITIES: City[] = [
  { name: 'Atlanta', country: 'United States', tz: 'America/New_York', lat: 33.75, lng: -84.39, lang: 'en' },
  { name: 'New York', country: 'United States', tz: 'America/New_York', lat: 40.71, lng: -74.01, lang: 'en' },
  { name: 'Chicago', country: 'United States', tz: 'America/Chicago', lat: 41.88, lng: -87.63, lang: 'en' },
  { name: 'Los Angeles', country: 'United States', tz: 'America/Los_Angeles', lat: 34.05, lng: -118.24, lang: 'en' },
  { name: 'San Francisco', country: 'United States', tz: 'America/Los_Angeles', lat: 37.77, lng: -122.42, lang: 'en' },
  { name: 'Toronto', country: 'Canada', tz: 'America/Toronto', lat: 43.65, lng: -79.38, lang: 'en' },
  { name: 'Mexico City', country: 'Mexico', tz: 'America/Mexico_City', lat: 19.43, lng: -99.13, lang: 'es' },
  { name: 'São Paulo', country: 'Brazil', tz: 'America/Sao_Paulo', lat: -23.55, lng: -46.63, lang: 'pt' },
  { name: 'Buenos Aires', country: 'Argentina', tz: 'America/Argentina/Buenos_Aires', lat: -34.6, lng: -58.38, lang: 'es' },
  { name: 'London', country: 'United Kingdom', tz: 'Europe/London', lat: 51.51, lng: -0.13, lang: 'en' },
  { name: 'Paris', country: 'France', tz: 'Europe/Paris', lat: 48.86, lng: 2.35, lang: 'fr' },
  { name: 'Lisbon', country: 'Portugal', tz: 'Europe/Lisbon', lat: 38.72, lng: -9.14, lang: 'pt' },
  { name: 'Madrid', country: 'Spain', tz: 'Europe/Madrid', lat: 40.42, lng: -3.7, lang: 'es' },
  { name: 'Barcelona', country: 'Spain', tz: 'Europe/Madrid', lat: 41.39, lng: 2.17, lang: 'es' },
  { name: 'Rome', country: 'Italy', tz: 'Europe/Rome', lat: 41.9, lng: 12.5, lang: 'it' },
  { name: 'Berlin', country: 'Germany', tz: 'Europe/Berlin', lat: 52.52, lng: 13.4, lang: 'de' },
  { name: 'Amsterdam', country: 'Netherlands', tz: 'Europe/Amsterdam', lat: 52.37, lng: 4.9, lang: 'nl' },
  { name: 'Istanbul', country: 'Türkiye', tz: 'Europe/Istanbul', lat: 41.01, lng: 28.98, lang: 'tr' },
  { name: 'Cairo', country: 'Egypt', tz: 'Africa/Cairo', lat: 30.04, lng: 31.24, lang: 'ar' },
  { name: 'Lagos', country: 'Nigeria', tz: 'Africa/Lagos', lat: 6.52, lng: 3.38, lang: 'en' },
  { name: 'Nairobi', country: 'Kenya', tz: 'Africa/Nairobi', lat: -1.29, lng: 36.82, lang: 'sw' },
  { name: 'Cape Town', country: 'South Africa', tz: 'Africa/Johannesburg', lat: -33.92, lng: 18.42, lang: 'en' },
  { name: 'Dubai', country: 'UAE', tz: 'Asia/Dubai', lat: 25.2, lng: 55.27, lang: 'ar' },
  { name: 'Mumbai', country: 'India', tz: 'Asia/Kolkata', lat: 19.08, lng: 72.88, lang: 'hi' },
  { name: 'Delhi', country: 'India', tz: 'Asia/Kolkata', lat: 28.61, lng: 77.21, lang: 'hi' },
  { name: 'Bangkok', country: 'Thailand', tz: 'Asia/Bangkok', lat: 13.76, lng: 100.5, lang: 'th' },
  { name: 'Hanoi', country: 'Vietnam', tz: 'Asia/Bangkok', lat: 21.03, lng: 105.85, lang: 'vi' },
  { name: 'Singapore', country: 'Singapore', tz: 'Asia/Singapore', lat: 1.35, lng: 103.82, lang: 'en' },
  { name: 'Bali', country: 'Indonesia', tz: 'Asia/Makassar', lat: -8.65, lng: 115.22, lang: 'id' },
  { name: 'Hong Kong', country: 'China', tz: 'Asia/Hong_Kong', lat: 22.32, lng: 114.17, lang: 'zh' },
  { name: 'Shanghai', country: 'China', tz: 'Asia/Shanghai', lat: 31.23, lng: 121.47, lang: 'zh' },
  { name: 'Taipei', country: 'Taiwan', tz: 'Asia/Taipei', lat: 25.03, lng: 121.57, lang: 'zh' },
  { name: 'Seoul', country: 'South Korea', tz: 'Asia/Seoul', lat: 37.57, lng: 126.98, lang: 'ko' },
  { name: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo', lat: 35.68, lng: 139.69, lang: 'ja' },
  { name: 'Kyoto', country: 'Japan', tz: 'Asia/Tokyo', lat: 35.01, lng: 135.77, lang: 'ja' },
  { name: 'Sydney', country: 'Australia', tz: 'Australia/Sydney', lat: -33.87, lng: 151.21, lang: 'en' },
];

export function findCity(name: string | undefined): City | undefined {
  if (!name) return undefined;
  return CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function searchCities(query: string, exclude: string[] = []): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CITIES.filter(
    (c) =>
      !exclude.includes(c.name) &&
      (c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)),
  ).slice(0, 5);
}

// Languages people can pick. `speech` is the voice used to read words out loud.
export const LANGUAGES: { code: string; name: string; speech: string }[] = [
  { code: 'en', name: 'English', speech: 'en-US' },
  { code: 'hi', name: 'Hindi', speech: 'hi-IN' },
  { code: 'es', name: 'Spanish', speech: 'es-MX' },
  { code: 'ja', name: 'Japanese', speech: 'ja-JP' },
  { code: 'ko', name: 'Korean', speech: 'ko-KR' },
  { code: 'pt', name: 'Portuguese', speech: 'pt-PT' },
  { code: 'fr', name: 'French', speech: 'fr-FR' },
  { code: 'zh', name: 'Mandarin', speech: 'zh-CN' },
  { code: 'de', name: 'German', speech: 'de-DE' },
  { code: 'it', name: 'Italian', speech: 'it-IT' },
  { code: 'ar', name: 'Arabic', speech: 'ar-SA' },
  { code: 'tr', name: 'Turkish', speech: 'tr-TR' },
  { code: 'th', name: 'Thai', speech: 'th-TH' },
  { code: 'vi', name: 'Vietnamese', speech: 'vi-VN' },
  { code: 'id', name: 'Indonesian', speech: 'id-ID' },
  { code: 'nl', name: 'Dutch', speech: 'nl-NL' },
  { code: 'sw', name: 'Swahili', speech: 'sw-KE' },
  { code: 'bn', name: 'Bengali', speech: 'bn-IN' },
  { code: 'ta', name: 'Tamil', speech: 'ta-IN' },
  { code: 'ur', name: 'Urdu', speech: 'ur-PK' },
];

export function languageName(code: string | undefined): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? 'their language';
}

export function speechLocale(code: string | undefined): string {
  return LANGUAGES.find((l) => l.code === code)?.speech ?? 'en-US';
}

export const INTERESTS = [
  'Film photography', 'Ramen', 'Street food', 'Architecture', 'Music', 'Soccer',
  'Anime', 'Coffee', 'Hiking', 'Fashion', 'Art museums', 'Gaming', 'Cooking',
  'Night markets', 'Cycling', 'K-pop', 'Skateboarding', 'Books', 'Basketball', 'Dance',
];
