// Window design tokens. Every screen pulls colors, fonts and sizes from here
// so the whole app stays consistent with the design canvas.

export const colors = {
  ink: '#1D2240', // main text, tab bar
  mist: '#EEF1F6', // app background
  light: '#F2B84B', // "Window Light": main buttons
  lightShadow: '#C98F22', // bottom edge under main buttons
  dusk: '#5563B8', // selected chips, links, accents
  duskDeep: '#4652A8',
  postcard: '#FFFDF8', // frames and cards
  white: '#FFFFFF',
  lantern: '#D9573F', // illustrations only
  muted: '#5E6582', // secondary text
  line: '#D6DBE6', // borders
  hand: '#2F3570', // handwritten captions
  ok: '#1F7A45',
  okBg: '#DDF1E4',
  danger: '#B3261E',
  honey: '#FDF1D8', // soft yellow pills and travel notes
  honeyText: '#7A4F05',
  honeyDeep: '#8A5A08',
  chipBg: '#E6E9F7',
  chipText: '#3B4696',
  dash: '#9AA2BF',
  // dark screens (Capture, Matching, Passport card)
  night: '#14183A',
  nightCard: '#262C58',
  nightLine: '#2E3566',
  nightMuted: '#AEB4D6',
  nightSoft: '#C3C8E6',
};

// Font names come from the @expo-google-fonts packages loaded in src/app/_layout.tsx.
// Don't also set fontWeight on text that uses these: the weight is baked into the name.
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  hand: 'Caveat_500Medium',
  handBold: 'Caveat_700Bold',
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  soft: {
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};

// Side padding used by most screens
export const gutter = 22;
