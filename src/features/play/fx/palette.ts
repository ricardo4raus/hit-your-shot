/**
 * Colors of the play field's effects (sparks, flash, fire trail, popup words, aim guide) in the "polished arcade" direction: warm and
 * saturated against the arena's deep blue. Kept here, next to the effects, until the theme grows an effects group (request to the
 * theme owner: move these into src/ui/theme.ts as `fx`).
 * Owner of this file: the "juice" agent.
 */
export const fx = {
  /** Specular dots and the hottest core of a flash. */
  white: '#FFFFFF',
  /** Spark yellow, the flash glow, the fire trail's core. */
  spark: '#FFD23F',
  /** Warm gold for confetti and the gradient bottom of a popup word. */
  gold: '#FFB21E',
  /** Hot orange of the fire trail's outer flame and some confetti. */
  flame: '#FF6A1F',
  /** Red-orange accent confetti. */
  ember: '#FF4A3D',
  /** Pale top of a popup word's gradient. */
  cream: '#FFF6C9',
  /** The shade of a white ball (football, golf): cool so it reads as round. */
  paleShade: '#B9B4C4',
  /** Golf dimples. */
  dimple: '#CFCAD6',
} as const;
