/**
 * Raked stands full of people behind the far wall, shared by the arena (basketball) and the stadium (football). Static: built once per
 * camera into a handful of paths batched by color (risers, lips, one path per shirt color, hair, one path per skin tone), so hundreds of
 * people cost about twenty draws a frame. Shirts are drawn before all heads, so a near head always sits on top of the shoulders of the
 * row behind it. Atmospheric depth (farther rows bluer and darker) is an overlay drawn by the caller, not baked into each color.
 */
import { Skia, type SkPath } from '@shopify/react-native-skia';

import { scaleAt, screenX, screenY, type Camera } from '../../camera';
import { addPoly, seeded, visibleZ, wallRect } from './geometry';

export interface CrowdSpec {
  /** Depth of the first riser and how much each row steps back and up. */
  firstX: number;
  rowDx: number;
  rowDy: number;
  /** Bottom of the first riser and the first row's seat height. */
  bottomY: number;
  firstSeatY: number;
  /** Rows stop once a row's heads would rise above this screen y. */
  stopScreenY: number;
  maxRows: number;
  width: number;
  shirts: readonly string[];
  brightShirts: readonly string[];
  heads: readonly string[];
  /** Fraction of empty seats and of people cheering with raised arms. */
  empty: number;
  cheer: number;
  seed: number;
}

export interface Crowd {
  risers: SkPath;
  lips: SkPath;
  shirts: { color: string; path: SkPath }[];
  hair: SkPath;
  heads: { color: string; path: SkPath }[];
  /** Depth and seat height of the last row built, and the screen y of its head tops (z = 0). */
  lastX: number;
  lastSeatY: number;
  topScreenY: number;
}

const PERSON_GAP = 0.5;
const SHOULDER_W = 0.42;
const SHOULDER_H = 0.31;
const HEAD_R = 0.105;

export function buildCrowd(cam: Camera, spec: CrowdSpec): Crowd {
  const rand = seeded(spec.seed);
  const risers = Skia.PathBuilder.Make();
  const lips = Skia.PathBuilder.Make();
  const hair = Skia.PathBuilder.Make();
  const shirtColors = [...spec.shirts, ...spec.brightShirts];
  const shirts = shirtColors.map(() => Skia.PathBuilder.Make());
  const heads = spec.heads.map(() => Skia.PathBuilder.Make());

  let lastX = spec.firstX;
  let lastSeatY = spec.firstSeatY;
  let topScreenY = screenY(cam, spec.firstX, spec.firstSeatY);
  for (let r = 0; r < spec.maxRows; r++) {
    const x = spec.firstX + r * spec.rowDx;
    const seatY = spec.firstSeatY + r * spec.rowDy;
    const riserBottom = r === 0 ? spec.bottomY : seatY - spec.rowDy;
    const [z0, z1] = visibleZ(cam, x, spec.width, 60);
    addPoly(risers, cam, wallRect(x, z0, z1, riserBottom, seatY));
    addPoly(lips, cam, wallRect(x, z0, z1, seatY - 0.07, seatY));

    // People sit on the tread just behind this riser, facing the court.
    const px = x + 0.3;
    const offset = rand() * PERSON_GAP;
    for (let z = z0 + offset; z < z1; z += PERSON_GAP * (0.9 + 0.2 * rand())) {
      if (rand() < spec.empty) continue;
      const s = scaleAt(cam, px, z);
      const cx = screenX(cam, px, z);
      const base = screenY(cam, px, seatY, z);
      const w = SHOULDER_W * s * (0.85 + 0.3 * rand());
      const h = SHOULDER_H * s * (0.85 + 0.3 * rand());
      const bright = rand() < 0.1;
      const ci = bright ? spec.shirts.length + Math.floor(rand() * spec.brightShirts.length) : Math.floor(rand() * spec.shirts.length);
      const shirt = shirts[ci]!;
      shirt.addRRect({ rect: { x: cx - w / 2, y: base - h, width: w, height: h + 0.1 * s }, rx: w * 0.42, ry: h * 0.6 });
      const hr = HEAD_R * s * (0.9 + 0.2 * rand());
      const hy = base - h - hr * 0.75;
      if (rand() < spec.cheer) {
        // Both arms up.
        const aw = 0.09 * s;
        const ah = 0.42 * s;
        shirt.addRRect({ rect: { x: cx - w / 2 - aw * 0.2, y: base - h - ah * 0.8, width: aw, height: ah }, rx: aw / 2, ry: aw / 2 });
        shirt.addRRect({ rect: { x: cx + w / 2 - aw * 0.8, y: base - h - ah * 0.8, width: aw, height: ah }, rx: aw / 2, ry: aw / 2 });
      }
      if (rand() < 0.65) hair.addCircle(cx, hy - hr * 0.28, hr * 1.04);
      heads[Math.floor(rand() * heads.length)]!.addCircle(cx, hy, hr);
    }
    lastX = x;
    lastSeatY = seatY;
    topScreenY = screenY(cam, px, seatY + SHOULDER_H + 2 * HEAD_R);
    if (topScreenY < spec.stopScreenY) break;
  }
  return {
    risers: risers.detach(),
    lips: lips.detach(),
    shirts: shirts.map((b, i) => ({ color: shirtColors[i]!, path: b.detach() })),
    hair: hair.detach(),
    heads: heads.map((b, i) => ({ color: spec.heads[i]!, path: b.detach() })),
    lastX,
    lastSeatY,
    topScreenY,
  };
}
