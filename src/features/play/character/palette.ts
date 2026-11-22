/**
 * The player character's colors (docs/design-rules.md sections 3, 4 and 8): a basketball kit in one team color that stands out against
 * the deep blue arena wall, the warm wood floor and the orange ball. Every part has three tones lit by the one warm key light from the
 * upper left: a highlight (shifted toward yellow), a base, and a shade (shifted toward blue). Limbs anchored in front of the body are
 * drawn with the `far` skin set, a step darker, so the arms that reach around the torso read as farther away than the ones on the back.
 * Owner of this file: the "character" agent. World colors live with the layer that draws them, so they are not theme tokens.
 */
import { colors } from '@/ui/theme';

export interface Tones {
  light: string;
  base: string;
  shade: string;
}

/** Team color: jersey, shorts, headband, wristbands, sneaker soles. */
export const team: Tones = { light: '#FF6F7E', base: '#EE3B57', shade: '#A9234A' };
/** Trim, number, socks and sneaker uppers: warm off-white, never pure white on a large area. */
export const trim: Tones = { light: '#FFFDF6', base: '#FFF3DE', shade: '#D9CCC0' };
/** Skin of the limbs and neck nearest the camera. */
export const skin: Tones = { light: '#FBD2AA', base: '#EBAA80', shade: '#C27A5E' };
/** Skin of the limbs that reach around the front of the torso: one step darker (design rules section 8). */
export const skinFar: Tones = { light: '#EDBE97', base: '#D9976F', shade: '#AE6A55' };
/** Inner ear and the deepest skin creases. */
export const skinDeep = '#9E5A48';
export const hair: Tones = { light: '#7A5242', base: '#43291F', shade: '#26171A' };
/** Rim light from the arena's spotlights on the edges turned away from the key light (right side); drawn at partial opacity. A warm
 * white, because a blue rim on the red kit reads as purple, and purple is reserved. */
export const rim = '#FFE6CC';
/** The ground shadow's center color; it fades to transparent at the edge. */
export const groundShadow = 'rgba(14, 20, 40, 0.5)';
export const groundShadowEdge = 'rgba(14, 20, 40, 0)';
export const ink = colors.ink;
