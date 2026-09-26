// Window design tokens: a lived-in writing desk. Parchment and cream paper, walnut window
// frames, fountain-pen ink, with terracotta, moss and faded sky as quiet accents.
// Marigold is the one warm "wax seal" color, used for the main action only.
//
// Older key names (mist, light, dusk…) are kept so every screen picks up the new look;
// the comments say what each one is now.

export const colors = {
  ink: '#2E2A26', // warm charcoal: main text, footer
  mist: '#F3EADB', // parchment: app background
  paper: '#F3EADB',
  oldPaper: '#E5D2AE', // secondary paper: fields, highlighted regions, notes
  postcard: '#FFF9ED', // cream: cards, writing surfaces, frames' inner mat
  white: '#FFFCF4', // "white" is never pure white
  light: '#D59B42', // marigold: primary action only
  lightShadow: '#A9742A', // marigold's pressed/edge tone
  dusk: '#6F7B57', // moss: selected states, safety, "done"
  duskDeep: '#55603F', // deep moss: links
  walnut: '#6E4429', // wooden frames, dark warm details
  walnutDark: '#4A2D1B',
  terracotta: '#B9583D', // active state, notification accent, stamps
  lantern: '#B9583D',
  sky: '#A8BED0', // faded sky: time-of-day, distance
  muted: '#706A5D', // secondary text
  line: '#DCCDB2', // hairlines on paper
  hand: '#2F3A63', // fountain-pen blue-black for handwriting
  ok: '#5E6B45',
  okBg: '#E4E5D0',
  danger: '#9E3F28',
  dangerBg: '#F4DFD4',
  honey: '#EFE0C2', // old-paper note background
  honeyText: '#6E4429',
  honeyDeep: '#6E4429',
  chipBg: '#EFE0C2',
  chipText: '#6E4429',
  dash: '#B9A988', // stitched/dashed lines, placeholders
  // night scenes (Capture, Matching): deep ink with amber controls
  night: '#1E1C22',
  nightCard: '#2B2830',
  nightLine: '#3A3440',
  nightMuted: '#B5AA95',
  nightSoft: '#D9CEB8',
  amber: '#E0A955',
};

// Loaded in src/app/_layout.tsx. Don't also set fontWeight: the weight is in the name.
export const fonts = {
  // Newsreader: screen titles, names and a few editorial moments only. Everything else is DM Sans.
  display: 'Newsreader_600SemiBold',
  displayItalic: 'Newsreader_600SemiBold_Italic',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  hand: 'Caveat_500Medium', // ONLY personal captions, notes, "why you fit"
  handBold: 'Caveat_700Bold',
};

// Small, mostly-square corners: paper and card stock are cut, not molded.
export const radius = {
  tag: 3, // label tags, chips
  sm: 4,
  md: 6, // buttons, fields
  lg: 8,
  xl: 12,
  pill: 999, // rarely: only true toggles
};

// Low, directional shadows: paper lifted a few px off the desk, frames casting downward.
export const shadow = {
  card: {
    shadowColor: '#3B2A1A', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  soft: {
    shadowColor: '#3B2A1A', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  // a hard, shallow offset like a card sitting on the desk under a lamp (primary buttons)
  offset: {
    shadowColor: '#4A2D1B', shadowOpacity: 0.9, shadowRadius: 0, shadowOffset: { width: 2, height: 2 }, elevation: 2,
  },
  frame: {
    shadowColor: '#2A1A0E', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
};

// Motion tokens (ms). Physical and restrained: no endless bounces, nothing that delays the user.
export const motion = {
  press: 120,
  settle: 260, // paper settling, very low overshoot
  arrive: 550, // postcard / window arrival
  scene: 420,
  stagger: 55,
  spring: { damping: 18, stiffness: 180, mass: 0.9 }, // settle with a hint of give
};

// Textures (tileable PNGs generated for this app)
export const textures = {
  paper: require('../../assets/textures/paper.png'),
  walnut: require('../../assets/textures/walnut.png'),
  cork: require('../../assets/textures/cork.png'),
};

// Side padding used by most screens
export const gutter = 22;
