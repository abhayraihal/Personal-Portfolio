// Shared colours and font files. In-world text must only use glyphs the fonts contain
// (see src/config/glyphs.ts): troika fetches fallback fonts from a CDN for missing glyphs.

const BASE = import.meta.env.BASE_URL;

export const COLORS = {
  accent: '#e2557f', // the pink polo in Abhay's IIT Mandi photo; car paint, UI accent
  accentDark: '#b83a62',
  ink: '#23262d',
  inkSoft: '#4a4f5c',
  paper: '#fff6e8',
  paperShade: '#f1e4cf',
  // Ground gradient: warm meadow in the middle of the valley, deeper green towards the edges.
  groundCenter: '#d9c98f',
  groundMid: '#a9c47f',
  groundEdge: '#6f9a5a',
  road: '#5b5f6e',
  roadLine: '#f2efe6',
  dirt: '#b58b5e',
  water: '#3fa7b5',
  waterDeep: '#1f5f7a',
  pine: '#2f6b55',
  rock: '#8c8fa3',
  snow: '#f3f6f8',
  fog: '#cfe2dc',
  sky: '#bfe0ee',
  sun: '#fff1dc',
  // Prayer flags, in their traditional order.
  flags: ['#2f6fd6', '#f4f4f0', '#d94141', '#3fa65a', '#f2c230'],
  // Companies
  amazon: '#ff9900',
  razorpay: '#3395ff',
  limeroad: '#e9435d',
  iit: '#2f6b55',
};

export const FONTS = {
  // three.js typeface JSON for drei <Text3D> (extruded letters).
  display3d: `${BASE}fonts/LilitaOne-Regular.typeface.json`,
  // WOFF1 files for drei <Text> (troika cannot read WOFF2).
  display: `${BASE}fonts/lilita-one-latin-400-normal.woff`,
  body: `${BASE}fonts/rubik-latin-400-normal.woff`,
  bodyBold: `${BASE}fonts/rubik-latin-700-normal.woff`,
};

export type FontName = keyof Omit<typeof FONTS, 'display3d'>;
