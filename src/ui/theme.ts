/**
 * Design tokens from docs/design-rules.md sections 4 to 6 and 9. Never hard-code a color, size, font or duration in a screen.
 * Saturated colors are fills with ink text on them; on paper, colored text uses the two safe tints only.
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
  /** The character: skin, shirt, trousers. */
  skin: '#E8B890',
  skinShade: '#C9A27A',
  trousers: '#4A5E8A',
  /** Upgrade card fills: accuracy, fire rate, income. */
  cardAccuracy: '#6FB7F0',
  cardFireRate: '#FF8A3D',
  cardIncome: '#5CC96A',
} as const;

export const sportColors = {
  basketball: { floor: '#E9D8B8', sky: '#C9DCE8', target: '#FF6B3D', ball: '#F0893F' },
  football: { floor: '#86C96F', sky: '#B8C2CC', target: '#FFF7E8', ball: '#FFF7E8' },
  golf: { floor: '#9BD47A', sky: '#C7E6B0', target: '#E8564B', ball: '#FFF7E8' },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { card: 20, button: 16, pill: 999, well: 12 } as const;

export const border = { width: 3, thin: 2 } as const;

/** Hard offset shadow, no blur: 0 right, 4 down, same hue darker. */
export const shadow = { offset: 4, pressedOffset: 0 } as const;

export const font = {
  family: {
    display: 'LilitaOne_400Regular',
    body: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
  },
  size: {
    display: 40,
    displaySm: 28,
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
  spring: { damping: 14, stiffness: 220, mass: 0.8 },
} as const;

export type SportColorKey = keyof typeof sportColors;
