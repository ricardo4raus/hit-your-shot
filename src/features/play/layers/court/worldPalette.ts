/**
 * Colors of the play field's world and targets (art direction "polished arcade": saturated, warm, one key light from the upper left,
 * every shape in two or three tones). Only the court files (WorldLayer, TargetLayer, layers/court/) read these; UI tokens stay in
 * src/ui/theme.ts. Also a tiny color mixer for atmospheric depth (farther = bluer, darker, less contrast), used at build time only.
 */

/** Basketball: indoor arena at night, deep blue around a warm wooden court. */
export const arena = {
  /** Rafters at the top of the screen down to the back of the stands. */
  roofTop: '#070D24',
  roofBottom: '#10204E',
  /** What far rows and the roof fade toward. */
  haze: '#13275C',
  /** Tier risers and the wall under the stands. */
  tier: '#1C3672',
  tierLip: '#2D4E96',
  wall: '#14285A',
  /** LED boards along the far wall. */
  ledBase: '#0E1A3F',
  ledA: '#FF8A3D',
  ledB: '#FFC83D',
  ledC: '#3FC1FF',
  rail: '#D9E2F2',
  /** Crowd: muted shirts and a few bright ones, then skin and hair. */
  shirts: ['#3A5A9C', '#4E6FA8', '#6B4552', '#8A6A3A', '#3F6B5E', '#5A6380', '#2E4A80', '#7A5340'],
  brightShirts: ['#FF8A3D', '#FFC83D', '#E8564B', '#FFF7E8', '#3FC1FF'],
  heads: ['#C99A72', '#8E6448', '#E2B48C', '#5E4033', '#3A2A24'],
  /** Ceiling lights and their glow. */
  lamp: '#FFF6DC',
  glow: '#FFE3A3',
  bannerA: '#E8564B',
  bannerB: '#FF8A3D',
  bannerC: '#FFC83D',
  bannerShade: '#00000040',
  /** Wood: lit near the key light, base, shadow toward the lower right. */
  woodLight: '#F6C88C',
  wood: '#E3A25E',
  woodDark: '#B87336',
  plank: '#A9652C',
  /** The key is stained a deeper amber (the wood still shows), the out-of-bounds apron is painted blue. */
  paint: '#D0803C',
  paintDark: '#A85E28',
  apron: '#1E4FAE',
  line: '#FFF7E8',
  shine: '#FFF4DE',
  vignette: '#050A1E',
} as const;

/** The hoop. */
export const hoop = {
  frame: '#2A3550',
  frameLight: '#46557A',
  glassTop: '#FFFFFF',
  glassBottom: '#D3E2F2',
  glassShine: '#FFFFFF',
  square: '#FF5A36',
  pad: '#2F6FE0',
  padLight: '#5C93F2',
  padDark: '#1E4FAE',
  /** The stanchion recedes into the dark arena so the board and rim pop. */
  post: '#22407F',
  postLight: '#35589E',
  postDark: '#152955',
  steel: '#3A4560',
  steelLight: '#5A6888',
  steelDark: '#232B42',
  rim: '#FF6B3D',
  rimLight: '#FFC08F',
  rimDark: '#C2401F',
  netFront: '#FFFFFF',
  netBack: '#B3C0D6',
  flash: '#FFE9A8',
  shadow: '#0A0F2A',
} as const;

/** Football: a day stadium on striped grass. */
export const stadium = {
  skyTop: '#2F86E8',
  skyBottom: '#A9DBFF',
  haze: '#7FA6D6',
  roof: '#2A3550',
  roofLight: '#46557A',
  tier: '#33539A',
  tierLip: '#4A6CB4',
  seatA: '#E8564B',
  seatB: '#2F6FE0',
  wall: '#24407E',
  grassLight: '#5FC24E',
  grass: '#4DAE3F',
  grassDark: '#3A8F31',
  line: '#FFFFFF',
  post: '#FFFFFF',
  postShade: '#B9C6D8',
  net: '#FFFFFF',
  keeper: '#FFC83D',
  keeperShade: '#E09A1F',
  keeperShorts: '#2A3550',
  gloves: '#5CC96A',
  lamp: '#FFF6DC',
} as const;

/** Golf: open sky, rolling hills, mowed fairway, a putting green. */
export const course = {
  skyTop: '#2E9BF0',
  skyBottom: '#C4ECFF',
  sun: '#FFF1C2',
  cloud: '#FFFFFF',
  cloudShade: '#CFE6F7',
  hillFar: '#8FC4C8',
  hillMid: '#6FB46A',
  treeDark: '#2F7A43',
  tree: '#3F9550',
  rough: '#4E9E3E',
  roughDark: '#3D8432',
  fairwayLight: '#7FCB55',
  fairway: '#68B845',
  green: '#A9E681',
  greenLight: '#D2F7A8',
  fringe: '#57A83C',
  cup: '#141821',
  cupLip: '#F4F7F0',
  pole: '#FFFFFF',
  poleShade: '#B9C6D8',
  flag: '#E8564B',
  flagShade: '#B83A31',
  flagLight: '#FF8A7A',
  shadow: '#0F2A14',
} as const;

/** Mixes two #RRGGBB colors; t = 0 gives a, t = 1 gives b. Build time only. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16);
  const pb = parseInt(b.slice(1, 7), 16);
  const ch = (shift: number) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  const v = (ch(16) << 16) | (ch(8) << 8) | ch(0);
  return `#${v.toString(16).padStart(6, '0')}`;
}

/** #RRGGBB with an alpha 0..1 as #RRGGBBAA. */
export function alpha(hex: string, a: number): string {
  const v = Math.max(0, Math.min(255, Math.round(a * 255)));
  return `${hex.slice(0, 7)}${v.toString(16).padStart(2, '0')}`;
}
