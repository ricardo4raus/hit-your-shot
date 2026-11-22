/**
 * Design tokens (docs/design-rules.md, "polished arcade" art direction, 2026-11-22). Never hard-code a color, size, font or duration in a
 * screen. One warm key light from the upper left: every surface has a lighter top, its base color and a darker lip under it; `shade` and
 * `vgrad` derive those tones from one base color so every shape stays 2 to 3 tones of itself. The thick ink outline is the brand.
 */

export const colors = {
  /** Every outline, every text on a fill, hard shadows. */
  ink: '#1F2430',
  /** Cards, result panel, speech bubbles. */
  paper: '#FFF7E8',
  /** Wells, tracks, disabled fills. */
  paper2: '#F1E6CF',
  /** Default world background top. */
  sky: '#C9DCE8',
  /** Far silhouettes. */
  haze: '#A9C2D4',
  /** The one action button, the aiming line, "press this". */
  accent: '#FF8A3D',
  /** Money and only money. */
  cash: '#FFC83D',
  good: '#5CC96A',
  bad: '#E8564B',
  /** Reserved for characters and limbs, so the reveal has its own color. */
  arm: '#B07CF0',
  /** Safe colored text on paper. */
  goodText: '#2F8A3C',
  badText: '#B83A31',
  /** The character: skin, shirt, trousers, hair (seen from behind, the hair is most of the head). */
  skin: '#E8B890',
  skinShade: '#C9A27A',
  trousers: '#4A5E8A',
  hair: '#4A3328',
  /** Upgrade card fills: accuracy, fire rate, income. */
  cardAccuracy: '#3FA2F0',
  cardFireRate: '#FF7A2E',
  cardIncome: '#FFB21F',
  /** Interface panels in the arena: deep navy trays with a lit top edge (cards panel, sheets, settings). */
  panel: '#22417A',
  panelDeep: '#142849',
  panelEdge: '#5A86D6',
  /** Inset wells on a navy panel: rows in the shop and settings, the progress track. */
  well: '#16305C',
  /** Secondary buttons on a navy panel. */
  blue: '#3E8CF0',
  /** Disabled button face: cool grey, full-contrast text on it. */
  muted: '#9AA6BA',
  /** Text on navy. */
  onPanel: '#FFF7E8',
  /** Quiet text on navy. */
  onPanelSoft: '#B9C8E6',
} as const;

export const sportColors = {
  basketball: { floor: '#E9D8B8', sky: '#C9DCE8', target: '#FF6B3D', ball: '#F0893F' },
  football: { floor: '#86C96F', sky: '#B8C2CC', target: '#FFF7E8', ball: '#FFF7E8' },
  golf: { floor: '#9BD47A', sky: '#C7E6B0', target: '#E8564B', ball: '#FFF7E8' },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { card: 20, button: 16, pill: 999, well: 12 } as const;

export const border = { width: 3, thin: 2 } as const;

/** Kept for callers. The 3D lip under buttons, pills and cards is `depth`. */
export const shadow = { offset: 4, pressedOffset: 0 } as const;

/** The darker lip under a 3D surface, in pt, and how far a press pushes the face down onto it. */
export const depth = { lip: 6, lipSm: 4, press: 4 } as const;

/** A hard drop shadow of a surface onto the scene behind it (no blur: the key light is a sharp lamp). */
export const drop = {
  button: '0px 3px 0px rgba(20, 24, 34, 0.35)',
  card: '0px 4px 0px rgba(20, 24, 34, 0.30)',
  panel: '0px -3px 0px rgba(20, 24, 34, 0.25)',
} as const;

export const font = {
  family: {
    display: 'LilitaOne_400Regular',
    body: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
  },
  size: {
    display: 40,
    displaySm: 28,
    /** Lilita on buttons, card titles and tags. */
    button: 22,
    buttonSm: 17,
    tag: 14,
    title: 20,
    label: 16,
    body: 14,
    caption: 12,
  },
} as const;

export const touch = { min: 48 } as const;

/** Durations in ms and spring settings from the motion table (design rules section 9). */
export const motion = {
  pressDown: 90,
  pressUp: 160,
  pop: 240,
  panelIn: 280,
  flyText: 500,
  /** One sweep of the first-round drag hint. */
  hint: 900,
  spring: { damping: 14, stiffness: 220, mass: 0.8 },
} as const;

export type SportColorKey = keyof typeof sportColors;

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(c: number): string {
  return Math.round(Math.min(255, Math.max(0, c)))
    .toString(16)
    .padStart(2, '0');
}

/** A tone of a color: positive amounts mix toward white (the lit side), negative ones darken and keep the hue (the side away from the light). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = channels(hex);
  const f = (c: number) => (amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `#${toHex(f(r))}${toHex(f(g))}${toHex(f(b))}`;
}

/** Perceived lightness 0..1, to pick ink or paper text on a fill. */
export function lightness(hex: string): number {
  const [r, g, b] = channels(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A vertical gradient for `backgroundImage`: lit top to base. */
export function vgrad(top: string, bottom: string, mid?: string): string {
  return mid ? `linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${bottom} 100%)` : `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
}

/** The three tones of a 3D surface from one base color. */
export function tones(base: string): { top: string; face: string; lip: string; gloss: string } {
  return { top: shade(base, 0.28), face: base, lip: shade(base, -0.32), gloss: 'rgba(255, 255, 255, 0.28)' };
}
