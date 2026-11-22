/**
 * The character's rigid parts as static paths, drawn once and moved every frame by a group transform (CharacterLayer.tsx), so the
 * per-frame work stays a handful of numbers. Two local spaces:
 *   - torso space: centimeters, origin at the center of the shoulder line, x to the character's right, y down (screen convention).
 *     The hips sit 52.5 cm below the shoulder line at rest; the jersey hem 6 cm below them.
 *   - head space: the head radius is 100 units, origin at the head's center, same axes.
 * Seen from behind, lit from the upper left. Shapes are SVG path strings so they read like a drawing; built inside components (useMemo),
 * never at module scope, because Skia on the web is only ready once the app runs.
 * Owner of this file: the "character" agent.
 */
import { Skia, type SkPath } from '@shopify/react-native-skia';

function svg(d: string): SkPath {
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
}

function translated(d: string, dx: number, dy: number, s = 1): SkPath {
  const m = Skia.Matrix();
  m.translate(dx, dy);
  m.scale(s, s);
  return Skia.PathBuilder.MakeFromPath(svg(d)).transform(m).detach();
}

// ---------- Torso (centimeters) ----------

/** Skin of the upper back and shoulder caps: the jersey covers most of it, the straps leave the shoulders out. */
const YOKE =
  'M -7 -8 C -12 -7.5 -19 -4.5 -23.5 0 C -28.5 4.5 -29.5 12 -26.5 19 L 26.5 19 C 29.5 12 28.5 4.5 23.5 0 C 19 -4.5 12 -7.5 7 -8 Z';

/** The tank top from behind: a shallow back neckline, two straps, deep arm holes, a little waist, a straight hem. */
const JERSEY =
  'M -7.5 -5 C -6 1.5 6 1.5 7.5 -5 L 14.5 -3 C 13.5 6 16.5 13 21.5 17 C 20.5 28 19.5 36 20 46 C 20.5 52 21.5 56 21.5 59 ' +
  'C 10 61.5 -10 61.5 -21.5 59 C -21.5 56 -20.5 52 -20 46 C -19.5 36 -20.5 28 -21.5 17 C -16.5 13 -13.5 6 -14.5 -3 Z';

/** Trim along the neckline and arm holes, stroked on the edge and clipped to the jersey so only the inner half shows. */
const TRIM =
  'M -7.5 -5 C -6 1.5 6 1.5 7.5 -5 M 14.5 -3 C 13.5 6 16.5 13 21.5 17 M -14.5 -3 C -13.5 6 -16.5 13 -21.5 17 ' +
  'M -21.5 59 C -10 61.5 10 61.5 21.5 59';

/** Cloth folds and the shoulder blades, in the jersey's shade. */
const FOLDS =
  'M -15 14 C -12 20 -8 23.5 -3.5 24.5 M 15 14 C 12 20 8 23.5 3.5 24.5 ' +
  'M 0.5 44 C 1 48 0.5 52 -0.5 56 M -13 59 C -12 54 -10 51 -7 48.5 M 11 59 C 10.5 55 11.5 52 14 49 ' +
  'M 17 22 C 15.5 30 16 38 17.5 44';

/** Lit edges on the upper left. */
const SHEEN = 'M -18 21 C -18.5 28 -18 35 -17 41 M -12.5 -1.5 C -11.5 4 -9 8 -6 10';

export interface TorsoShapes {
  yoke: SkPath;
  yokeLit: SkPath;
  jersey: SkPath;
  /** The jersey moved toward the light: the lit part; what it leaves uncovered on the lower right is the form shadow. */
  jerseyLit: SkPath;
  /** The jersey moved away from the right edge: what it leaves uncovered gets the cool rim light. */
  jerseyRimCut: SkPath;
  trim: SkPath;
  folds: SkPath;
  sheen: SkPath;
}

export function makeTorsoShapes(): TorsoShapes {
  return {
    yoke: svg(YOKE),
    yokeLit: translated(YOKE, -2.2, -2, 0.93),
    jersey: svg(JERSEY),
    jerseyLit: translated(JERSEY, -3.2, -2.2),
    jerseyRimCut: translated(JERSEY, -2.2, 0),
    trim: svg(TRIM),
    folds: svg(FOLDS),
    sheen: svg(SHEEN),
  };
}

// ---------- Head (head radius = 100) ----------

/** The skull: a little narrower than tall. Mostly hidden by the hair; it shows at the nape and behind the ears. */
const SKULL = 'M 0 -100 C 52 -100 92 -60 92 -2 C 92 46 58 84 0 88 C -58 84 -92 46 -92 -2 C -92 -60 -52 -100 0 -100 Z';

/** Ears stick out at the sides, a little below the middle. */
function ear(side: 1 | -1): string {
  const x = side * 88;
  const o = side * 24;
  return `M ${x} -14 C ${x + o} -22 ${x + o * 1.25} 4 ${x + o * 0.9} 22 C ${x + o * 0.6} 38 ${x} 40 ${x - side * 4} 34 Z`;
}

function earInner(side: 1 | -1): string {
  const x = side * 92;
  const o = side * 12;
  return `M ${x} -6 C ${x + o} -10 ${x + o * 1.3} 6 ${x + o} 18 C ${x + o * 0.6} 26 ${x} 26 ${x - side * 2} 22 Z`;
}

/** Short hair with volume: it sits above the skull, with soft bumps on top and a clean, slightly curved hairline at the nape. */
const HAIR =
  'M -95 14 C -104 -18 -98 -52 -76 -76 C -74 -92 -58 -100 -46 -98 C -40 -112 -18 -118 -6 -108 C 6 -122 30 -120 38 -106 ' +
  'C 54 -108 72 -96 78 -80 C 96 -62 102 -30 95 18 C 84 40 72 52 54 58 C 28 64 -28 64 -54 58 C -72 52 -86 40 -95 14 Z';

/** Strands between the tufts and down the back, in the hair's shade. */
const HAIR_LINES =
  'M -46 -98 C -42 -90 -40 -82 -40 -74 M -6 -108 C -3 -100 -1 -92 -1 -84 M 38 -106 C 41 -98 42 -90 40 -82 ' +
  'M 60 6 C 66 18 66 32 60 44 M -40 30 C -36 40 -30 48 -22 52 M 20 20 C 24 32 24 42 20 52';

/** Highlights on the upper left, where the key light hits the curve of the head. */
const HAIR_SHINE = 'M -64 -66 C -58 -78 -48 -86 -36 -90 M -20 -96 C -12 -102 -2 -104 8 -102 M -82 -6 C -82 -18 -80 -28 -76 -36';

/** A sweatband around the head, curving with it. */
const HEADBAND = 'M -98 -42 C -60 -28 60 -28 98 -42 L 100 -18 C 60 -4 -60 -4 -100 -18 Z';
const HEADBAND_STRIPE = 'M -99 -30 C -60 -16 60 -16 99 -30';

/** The neck below the hairline, wider at the base; it tucks under the jersey's neckline. */
const NECK = 'M -44 40 C -46 70 -50 96 -58 118 L 58 118 C 50 96 46 70 44 40 Z';
/** The shadow the head throws on the neck. */
const NECK_SHADOW = 'M -46 40 L 46 40 L 47 74 C 20 82 -20 82 -47 74 Z';

export interface HeadShapes {
  skull: SkPath;
  ears: SkPath;
  earsInner: SkPath;
  hair: SkPath;
  hairLit: SkPath;
  hairRimCut: SkPath;
  hairLines: SkPath;
  hairShine: SkPath;
  headband: SkPath;
  headbandLit: SkPath;
  headbandStripe: SkPath;
  neck: SkPath;
  neckShadow: SkPath;
}

export function makeHeadShapes(): HeadShapes {
  return {
    skull: svg(SKULL),
    ears: svg(`${ear(-1)} ${ear(1)}`),
    earsInner: svg(`${earInner(-1)} ${earInner(1)}`),
    hair: svg(HAIR),
    hairLit: translated(HAIR, -9, -10, 0.9),
    hairRimCut: translated(HAIR, -8, 2),
    hairLines: svg(HAIR_LINES),
    hairShine: svg(HAIR_SHINE),
    headband: svg(HEADBAND),
    headbandLit: translated(HEADBAND, -2, -3, 0.97),
    headbandStripe: svg(HEADBAND_STRIPE),
    neck: svg(NECK),
    neckShadow: svg(NECK_SHADOW),
  };
}
