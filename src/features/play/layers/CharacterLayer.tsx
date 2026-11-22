/**
 * The character: a chunky basketball player seen from behind, posed by the rig every frame in its own frame (x forward from the shot
 * origin, y up, z right), then projected. Polished arcade look (2026-11-22): every part has a shade, a base moved toward the key light
 * (upper left) and a highlight, all under the thick ink outline; tank top with trim and a number, shorts with side stripes, socks,
 * chunky sneakers, a headband, wristbands and mitten hands that hold the ball.
 *
 * How it stays cheap: rigid parts (torso, head) are static paths (character/shapes.ts) moved by a group transform; the limbs are tapered
 * capsules batched into a few paths per frame (character/limbDraw.ts); the shoes and the ground shadow never move and are built once.
 * Draw order, back to front: ground shadow, balls held in front of the body, the arms that reach around the front (under the torso),
 * legs, sneakers, shorts, upper back skin, neck, jersey, balls held by the back arms, head, then the arms anchored on the back (nearest
 * the camera). Arms on the same side alternate between two batches, so neighbours keep an outline between them at any arm count.
 * Owner of this file: the "character" agent. Props are fixed by layers/shared.ts.
 */
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { Circle, Group, LinearGradient, Path, RadialGradient, Skia, Text, useFont, vec, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { border } from '@/ui/theme';

import { flatRatio, scaleAt, screenX, screenY } from '../camera';
import { bandSegment, detachLit, litSegment, makeLit, tubeBand, type LitBuilders, type LitPaths } from '../character/limbDraw';
import { groundShadow, groundShadowEdge, hair, ink, rim, skin, skinDeep, skinFar, team, trim, type Tones } from '../character/palette';
import { makeHeadShapes, makeTorsoShapes } from '../character/shapes';
import { BODY_H, HEAD_R, poseBody, tauFor, type ArmPose, type ArmTiming, type Vec } from '../rig';
import { addBall, BallPaint, ballColors, detachBall, makeBall } from './ballLook';
import type { CharacterLayerProps } from './shared';

/** Limb radii in meters: shoulder, elbow, wrist; palm and fingertips; thigh, knee, calf, ankle. Chunky on purpose. */
const R_SHOULDER = 0.068;
const R_ELBOW = 0.05;
const R_WRIST = 0.04;
const R_PALM = 0.054;
const R_FINGERS = 0.04;
const R_THIGH = 0.094;
const R_KNEE = 0.073;
const R_CALF = 0.086;
const R_ANKLE = 0.054;
/** How far down the thigh the shorts reach: long, loose basketball shorts. */
const SHORTS_HEM = 0.84;
/** The drawn head is bigger than the rig's and sits a little higher: a chunky, friendly proportion that keeps the neck in view. */
const HEAD_DRAW = 1.24;
const HEAD_LIFT = 0.025;
/** The jersey number and the invented name above it. */
const NUMBER = '7';
const NAME = 'SWISH';

type Builder = ReturnType<typeof Skia.PathBuilder.Make>;

interface Frame {
  front: LitPaths;
  around: [LitPaths, LitPaths];
  back: [LitPaths, LitPaths];
  legs: LitPaths;
  sockStripes: SkPath;
  heldChest: ReturnType<typeof detachBall>;
  heldBack: ReturnType<typeof detachBall>;
  shorts: SkPath;
  shortsDetail: SkPath;
  shortsStripes: SkPath;
  torsoT: { translateX: number; translateY: number; scaleX: number; scaleY: number };
  headT: { translateX: number; translateY: number; scale: number };
}

export function CharacterLayer({ def, sportId, cam, clock, anchors, aim, round: roundSV, schedule: scheduleSV, offsets: offsetsSV }: CharacterLayerProps) {
  const ox = def.field.origin.x;
  const oy = def.field.origin.y;
  const dx = def.target.center.x - ox;
  const look = useMemo(() => ballColors(sportId), [sportId]);
  const ballKind = look.kind;
  const torsoShapes = useMemo(() => makeTorsoShapes(), []);
  const headShapes = useMemo(() => makeHeadShapes(), []);
  const font = useFont(LilitaOne_400Regular, 100);

  const bodyScale = scaleAt(cam, ox);
  const inkW = border.width;
  /** Outline width in torso space (centimeters) and head space (head radius = 100). */
  const inkCm = inkW / (bodyScale / 100);
  const headR = HEAD_DRAW * HEAD_R * BODY_H * bodyScale;
  const inkHead = inkW / (headR / 100);

  // Which batch each arm goes to: the two shoulder arms together, then arms on the same side alternate between two batches.
  const batchOf = useMemo(() => {
    const out: number[] = new Array(anchors.length);
    const rank: Record<string, number> = {};
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i]!;
      if (i < 2) {
        out[i] = 0;
        continue;
      }
      const key = `${a.behind ? 'b' : 'f'}${a.side}`;
      const r = rank[key] ?? 0;
      rank[key] = r + 1;
      out[i] = r % 2;
    }
    return out;
  }, [anchors]);

  const frame = useDerivedValue<Frame>(() => {
    clock.value;
    const nowMs = Date.now();
    const round = roundSV.value;
    const sched = scheduleSV.value;
    const offs = offsetsSV.value;
    const aimZ = dx * Math.tan(aim.value);
    const t = (nowMs - round.startMs) / 1000;
    const timings: (ArmTiming | null)[] = new Array(anchors.length);
    for (let i = 0; i < anchors.length; i++) {
      const off = offs[i] ?? 0;
      const yaw = Math.atan2(aimZ - off, dx);
      if (round.playing) {
        const period = sched.period[i] ?? Number.POSITIVE_INFINITY;
        timings[i] = { tau: tauFor(t, sched.first[i] ?? 0, period), period, yaw, offset: off };
      } else {
        timings[i] = { tau: -10, period: Number.POSITIVE_INFINITY, yaw, offset: off };
      }
    }
    const pose = poseBody({ anchors, timings, releaseY: oy, time: nowMs / 1000 });

    const sx = (v: Vec) => screenX(cam, ox + v.x, v.z);
    const sy = (v: Vec) => screenY(cam, ox + v.x, v.y, v.z);
    const sc = (v: Vec) => scaleAt(cam, ox + v.x, v.z);
    const lerpV = (a: Vec, b: Vec, f: number): Vec => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
    const seg = (L: LitBuilders, a: Vec, ra: number, b: Vec, rb: number, stripe: boolean) => {
      litSegment(L, sx(a), sy(a), ra * sc(a), sx(b), sy(b), rb * sc(b), inkW, stripe);
    };
    const centerX = sx(pose.shoulders);

    // ---------- Arms ----------
    const front = makeLit();
    const around: [LitBuilders, LitBuilders] = [makeLit(), makeLit()];
    const back: [LitBuilders, LitBuilders] = [makeLit(), makeLit()];
    const heldChest = makeBall();
    const heldBack = makeBall();
    const drawArm = (L: LitBuilders, arm: ArmPose) => {
      // Arms that reach around the front start a little inside the torso edge, so the jersey's arm hole covers the joint.
      if (!arm.behind) {
        const root = { x: arm.shoulder.x, y: arm.shoulder.y + 0.01, z: arm.shoulder.z * 0.7 };
        seg(L, root, R_SHOULDER, arm.shoulder, R_SHOULDER, false);
      }
      seg(L, arm.shoulder, R_SHOULDER, arm.elbow, R_ELBOW, true);
      seg(L, arm.elbow, R_ELBOW * 0.96, arm.wrist, R_WRIST, true);
      // Wristband: a flat ring a little thicker than the wrist, a fifth of the way up the forearm.
      const ew = R_ELBOW * 0.96 * 1.16 * sc(arm.elbow);
      const ww = R_WRIST * 1.16 * sc(arm.wrist);
      tubeBand(L.cuff, sx(arm.wrist), sy(arm.wrist), ww, sx(arm.elbow), sy(arm.elbow), ew, 0.05, 0.24);
      // Mitten hand: palm, fingers, and a thumb on the side toward the body.
      const mid = lerpV(arm.wrist, arm.tip, 0.5);
      seg(L, arm.wrist, R_PALM * 0.9, mid, R_PALM, false);
      seg(L, mid, R_PALM * 0.96, arm.tip, R_FINGERS, false);
      const wx = sx(arm.wrist);
      const wy = sy(arm.wrist);
      const hx = sx(arm.tip) - wx;
      const hy = sy(arm.tip) - wy;
      const hl = Math.sqrt(hx * hx + hy * hy) || 1;
      let px = -hy / hl;
      let py = hx / hl;
      if (px * (centerX - wx) < 0) {
        px = -px;
        py = -py;
      }
      const pr = R_PALM * sc(arm.wrist);
      const t0x = wx + hx * 0.3 + px * pr * 0.55;
      const t0y = wy + hy * 0.3 + py * pr * 0.55;
      const t1x = wx + hx * 0.62 + px * pr * 1.25;
      const t1y = wy + hy * 0.62 + py * pr * 1.25;
      litSegment(L, t0x, t0y, pr * 0.5, t1x, t1y, pr * 0.4, inkW, false);
    };
    for (let i = 0; i < pose.arms.length; i++) {
      const arm = pose.arms[i]!;
      const k = batchOf[i] ?? 0;
      const L = arm.behind ? back[k]! : i < 2 ? front : around[k]!;
      drawArm(L, arm);
      if (arm.holding > 0) {
        const r = sched.radii[i] ?? 0.1;
        // The ball sits on the fingers; the hand is drawn over it, so the fingers wrap the near side.
        const dxh = arm.tip.x - arm.wrist.x;
        const dyh = arm.tip.y - arm.wrist.y;
        const dzh = arm.tip.z - arm.wrist.z;
        const l = Math.sqrt(dxh * dxh + dyh * dyh + dzh * dzh) || 1;
        const c = { x: arm.tip.x + (dxh / l) * r * 0.55, y: arm.tip.y + (dyh / l) * r * 0.55, z: arm.tip.z + (dzh / l) * r * 0.55 };
        addBall(arm.behind ? heldBack : heldChest, sx(c), sy(c), r * sc(c), 0.35, ballKind);
      }
    }

    // ---------- Legs: lower thigh, knee, calf, socks ----------
    const legs = makeLit();
    const stripes = Skia.PathBuilder.Make();
    for (const leg of pose.legs) {
      const th = lerpV(leg.hip, leg.knee, 0.45);
      seg(legs, th, R_THIGH, leg.knee, R_KNEE, true);
      const calf = lerpV(leg.knee, leg.ankle, 0.3);
      seg(legs, leg.knee, R_KNEE, calf, R_CALF, true);
      seg(legs, calf, R_CALF, leg.ankle, R_ANKLE, true);
      const s0 = lerpV(leg.ankle, leg.knee, -0.02);
      const s1 = lerpV(leg.ankle, leg.knee, 0.4);
      const rs0 = R_ANKLE * 1.12 * sc(s0);
      const rs1 = (R_ANKLE + (R_CALF - R_ANKLE) * 0.6) * 1.08 * sc(s1);
      bandSegment(legs, sx(s0), sy(s0), rs0, sx(s1), sy(s1), rs1, inkW);
      // Two team stripes near the top of the sock.
      tubeBand(stripes, sx(s0), sy(s0), rs0 * 0.98, sx(s1), sy(s1), rs1 * 0.98, 0.62, 0.72);
      tubeBand(stripes, sx(s0), sy(s0), rs0 * 0.98, sx(s1), sy(s1), rs1 * 0.98, 0.8, 0.9);
    }

    // ---------- Shorts: one outline from the waist to two flared hems ----------
    const shorts = Skia.PathBuilder.Make();
    const detail = Skia.PathBuilder.Make();
    const sstripes = Skia.PathBuilder.Make();
    const hips = pose.hips;
    const legL = pose.legs[0];
    const legR = pose.legs[1];
    const hemL = lerpV(legL.hip, legL.knee, SHORTS_HEM);
    const hemR = lerpV(legR.hip, legR.knee, SHORTS_HEM);
    const p = (x: number, y: number, z: number) => ({ x, y, z });
    const waistL = p(hips.x, hips.y + 0.05, -0.2);
    const waistR = p(hips.x, hips.y + 0.05, 0.2);
    const hemOL = p(hemL.x, hemL.y - 0.01, hemL.z - 0.125);
    const hemIL = p(hemL.x, hemL.y - 0.03, hemL.z + 0.1);
    const hemOR = p(hemR.x, hemR.y - 0.01, hemR.z + 0.125);
    const hemIR = p(hemR.x, hemR.y - 0.03, hemR.z - 0.1);
    const crotch = p(hips.x, hips.y - 0.17, 0);
    shorts.moveTo(sx(waistL), sy(waistL));
    shorts.lineTo(sx(waistR), sy(waistR));
    shorts.lineTo(sx(hemOR), sy(hemOR));
    shorts.lineTo(sx(hemIR), sy(hemIR));
    shorts.lineTo(sx(crotch), sy(crotch));
    shorts.lineTo(sx(hemIL), sy(hemIL));
    shorts.lineTo(sx(hemOL), sy(hemOL));
    shorts.close();
    // Folds: from the crotch up and out, and a crease above each hem.
    const c0 = p(hips.x, hips.y - 0.15, 0);
    const c1 = p(hips.x, hips.y - 0.07, 0.035);
    detail.moveTo(sx(c0), sy(c0));
    detail.lineTo(sx(c1), sy(c1));
    for (const s of [-1, 1]) {
      const hem = s < 0 ? hemL : hemR;
      const f0 = p(hem.x, hem.y + 0.04, hem.z - s * 0.04);
      const f1 = p(hem.x, hem.y + 0.1, hem.z - s * 0.065);
      detail.moveTo(sx(f0), sy(f0));
      detail.lineTo(sx(f1), sy(f1));
      // Side stripe: from the waist down the outside of each leg.
      const a = p(hips.x, hips.y + 0.05, s * 0.183);
      const b = p(hem.x, hem.y - 0.01, hem.z + s * 0.1);
      sstripes.moveTo(sx(a), sy(a));
      sstripes.lineTo(sx(b), sy(b));
    }

    // ---------- Torso and head transforms ----------
    const S = pose.shoulders;
    const st = sc({ x: S.x, y: S.y, z: 0 }) / 100;
    const wide = 1 / Math.sqrt(pose.torso);
    const hr = HEAD_DRAW * HEAD_R * BODY_H * sc(pose.head);

    return {
      front: detachLit(front),
      around: [detachLit(around[0]), detachLit(around[1])],
      back: [detachLit(back[0]), detachLit(back[1])],
      legs: detachLit(legs),
      sockStripes: stripes.detach(),
      heldChest: detachBall(heldChest),
      heldBack: detachBall(heldBack),
      shorts: shorts.detach(),
      shortsDetail: detail.detach(),
      shortsStripes: sstripes.detach(),
      torsoT: { translateX: sx(S), translateY: sy({ x: S.x, y: S.y, z: 0 }), scaleX: st * wide, scaleY: st * pose.torso },
      headT: { translateX: sx(pose.head), translateY: sy({ x: pose.head.x, y: pose.head.y + HEAD_LIFT, z: pose.head.z }), scale: hr / 100 },
    };
  });

  const front = useDerivedValue(() => frame.value.front);
  const around0 = useDerivedValue(() => frame.value.around[0]);
  const around1 = useDerivedValue(() => frame.value.around[1]);
  const back0 = useDerivedValue(() => frame.value.back[0]);
  const back1 = useDerivedValue(() => frame.value.back[1]);
  const legs = useDerivedValue(() => frame.value.legs);
  const sockStripes = useDerivedValue(() => frame.value.sockStripes);
  const shorts = useDerivedValue(() => frame.value.shorts);
  const shortsDetail = useDerivedValue(() => frame.value.shortsDetail);
  const shortsStripes = useDerivedValue(() => frame.value.shortsStripes);
  const hcInk = useDerivedValue(() => frame.value.heldChest.ink);
  const hcShade = useDerivedValue(() => frame.value.heldChest.shade);
  const hcBody = useDerivedValue(() => frame.value.heldChest.body);
  const hcLight = useDerivedValue(() => frame.value.heldChest.light);
  const hcSpec = useDerivedValue(() => frame.value.heldChest.spec);
  const hcSeam = useDerivedValue(() => frame.value.heldChest.seam);
  const hcPatch = useDerivedValue(() => frame.value.heldChest.patch);
  const hbInk = useDerivedValue(() => frame.value.heldBack.ink);
  const hbShade = useDerivedValue(() => frame.value.heldBack.shade);
  const hbBody = useDerivedValue(() => frame.value.heldBack.body);
  const hbLight = useDerivedValue(() => frame.value.heldBack.light);
  const hbSpec = useDerivedValue(() => frame.value.heldBack.spec);
  const hbSeam = useDerivedValue(() => frame.value.heldBack.seam);
  const hbPatch = useDerivedValue(() => frame.value.heldBack.patch);
  const torsoT = useDerivedValue(() => {
    const m = frame.value.torsoT;
    return [{ translateX: m.translateX }, { translateY: m.translateY }, { scaleX: m.scaleX }, { scaleY: m.scaleY }];
  });
  const headT = useDerivedValue(() => {
    const m = frame.value.headT;
    return [{ translateX: m.translateX }, { translateY: m.translateY }, { scale: m.scale }];
  });

  // ---------- Static: ground shadow, sneakers, shorts gradient ----------
  const statics = useMemo(() => {
    const rest = poseBody({ anchors: [], timings: [], releaseY: oy, time: 0 });
    const sx = (v: Vec) => screenX(cam, ox + v.x, v.z);
    const sy = (v: Vec) => screenY(cam, ox + v.x, v.y, v.z);
    const sc = (v: Vec) => scaleAt(cam, ox + v.x, v.z);
    const shoe = makeLit();
    const sole = makeLit();
    const contacts: { x: number; y: number; rx: number; k: number }[] = [];
    for (const leg of rest.legs) {
      const z = leg.ankle.z;
      // A thick team-colored sole under a rounded off-white upper.
      const heel = { x: -0.005, y: 0.082, z };
      const toe = { x: 0.16, y: 0.064, z: z + Math.sign(z) * 0.01 };
      const sh = { x: -0.018, y: 0.032, z };
      const st = { x: 0.19, y: 0.028, z: z + Math.sign(z) * 0.01 };
      litSegment(sole, sx(sh), sy(sh), 0.06 * sc(sh), sx(st), sy(st), 0.05 * sc(st), inkW, false);
      litSegment(shoe, sx(heel), sy(heel), 0.07 * sc(heel), sx(toe), sy(toe), 0.06 * sc(toe), inkW, true);
      const g = { x: 0.08, y: 0, z };
      contacts.push({ x: sx(g), y: sy(g), rx: 0.17 * sc(g), k: flatRatio(cam, ox + g.x, 0, g.z) });
    }
    const g = { x: 0.06, y: 0, z: 0 };
    const ground = { x: sx(g), y: sy(g), rx: 0.6 * sc(g), k: flatRatio(cam, ox + g.x, 0, g.z) };
    const hipL = sx({ x: 0, y: rest.hips.y, z: -0.3 });
    const hipR = sx({ x: 0, y: rest.hips.y, z: 0.3 });
    return { shoe: detachLit(shoe), sole: detachLit(sole), contacts, ground, hipL, hipR };
  }, [cam, ox, oy, inkW]);

  // The number and the name on the back, placed in torso space (centimeters) once the display font has loaded. Skia text, not text
  // paths: the web build has no Path.MakeFromText.
  const lettering = useMemo(() => {
    if (!font) return null;
    const place = (text: string, height: number, cy: number) => {
      const b = font.measureText(text);
      const k = height / (b.height || 1);
      return { text, k, transform: [{ translateX: -(b.x + b.width / 2) * k }, { translateY: cy - (b.y + b.height / 2) * k }, { scale: k }] };
    };
    return { number: place(NUMBER, 19, 33), name: place(NAME, 3.6, 13) };
  }, [font]);

  const sockShade = trim.shade;
  return (
    <>
      {/* Ground shadow: a soft radial falloff, plus darker contact under each sneaker. */}
      <Group transform={[{ translateX: statics.ground.x }, { translateY: statics.ground.y }, { scaleY: statics.ground.k }]}>
        <Circle cx={0} cy={0} r={statics.ground.rx}>
          <RadialGradient c={vec(0, 0)} r={statics.ground.rx} colors={[groundShadow, groundShadow, groundShadowEdge]} positions={[0, 0.45, 1]} />
        </Circle>
      </Group>
      {statics.contacts.map((c, i) => (
        <Group key={i} transform={[{ translateX: c.x }, { translateY: c.y }, { scaleY: c.k }]}>
          <Circle cx={0} cy={0} r={c.rx}>
            <RadialGradient c={vec(0, 0)} r={c.rx} colors={[groundShadow, groundShadowEdge]} />
          </Circle>
        </Group>
      ))}

      <BallPaint ink={hcInk} shade={hcShade} body={hcBody} light={hcLight} spec={hcSpec} seam={hcSeam} patch={hcPatch} look={look} />

      {/* Upper back outline first, so the shoulder arms merge into it without a seam once its fill goes on top. */}
      <Group transform={torsoT}>
        <Path path={torsoShapes.yoke} color={ink} style="stroke" strokeWidth={2 * inkCm} strokeJoin="round" />
        <Path path={torsoShapes.yoke} color={ink} />
      </Group>
      <LitBatch paths={around1} tones={skinFar} band={team} />
      <LitBatch paths={around0} tones={skinFar} band={team} />
      <LitBatch paths={front} tones={skin} band={team} />

      <LitBatch paths={legs} tones={skin} band={{ light: trim.light, base: trim.base, shade: sockShade }} />
      <Path path={sockStripes} color={team.base} />
      <Path path={statics.sole.ink} color={ink} />
      <Path path={statics.shoe.ink} color={ink} />
      <Path path={statics.sole.shade} color={team.shade} />
      <Path path={statics.sole.base} color={team.base} />
      <Path path={statics.shoe.shade} color={trim.shade} />
      <Path path={statics.shoe.base} color={trim.base} />
      <Path path={statics.shoe.light} color={trim.light} />

      {/* Shorts: outline grown with round joins so the corners come out soft, then the fill, stripes and folds. */}
      <Path path={shorts} color={ink} style="stroke" strokeWidth={2 * inkW + 0.02 * bodyScale} strokeJoin="round" />
      <Path path={shorts} style="stroke" strokeWidth={0.02 * bodyScale} strokeJoin="round">
        <LinearGradient start={vec(statics.hipL, 0)} end={vec(statics.hipR, 0)} colors={[team.light, team.base, team.shade]} />
      </Path>
      <Path path={shorts}>
        <LinearGradient start={vec(statics.hipL, 0)} end={vec(statics.hipR, 0)} colors={[team.light, team.base, team.shade]} />
      </Path>
      <Path path={shortsStripes} color={trim.base} style="stroke" strokeWidth={0.026 * bodyScale} strokeCap="round" />
      <Path path={shortsDetail} color={team.shade} style="stroke" strokeWidth={0.012 * bodyScale} strokeCap="round" />

      <Group transform={torsoT}>
        {/* Upper back skin, lit from the upper left. */}
        <Path path={torsoShapes.yoke} color={skin.shade} />
        <Group clip={torsoShapes.yoke}>
          <Path path={torsoShapes.yokeLit} color={skin.base} />
        </Group>
      </Group>
      <Group transform={headT}>
        <Path path={headShapes.neck} color={ink} style="stroke" strokeWidth={2 * inkHead} strokeJoin="round" />
        <Path path={headShapes.neck} color={skin.base} />
        <Group clip={headShapes.neck}>
          <Path path={headShapes.neckShadow} color={skin.shade} />
        </Group>
      </Group>

      {/* Jersey: shade base, lit body clipped to it, folds, trim, lettering, outline on top. */}
      <Group transform={torsoT}>
        <Path path={torsoShapes.jersey} color={team.shade} />
        <Group clip={torsoShapes.jersey}>
          <Path path={torsoShapes.jerseyLit}>
            <LinearGradient start={vec(-24, -4)} end={vec(14, 40)} colors={[team.light, team.base]} />
          </Path>
          <Path path={torsoShapes.folds} color={team.shade} style="stroke" strokeWidth={1.3} strokeCap="round" />
          <Path path={torsoShapes.sheen} color={team.light} style="stroke" strokeWidth={1.4} strokeCap="round" />
          <Group clip={torsoShapes.jerseyRimCut} invertClip>
            <Path path={torsoShapes.jersey} color={rim} opacity={0.45} />
          </Group>
          <Path path={torsoShapes.trim} color={trim.base} style="stroke" strokeWidth={5.4} />
        </Group>
        {font && lettering ? (
          <>
            <Group transform={lettering.number.transform}>
              <Text x={1 / lettering.number.k} y={1.2 / lettering.number.k} text={NUMBER} font={font} color={team.shade} />
              <Text x={0} y={0} text={NUMBER} font={font} color={ink} style="stroke" strokeWidth={(1.7 * inkCm) / lettering.number.k} strokeJoin="round" />
              <Text x={0} y={0} text={NUMBER} font={font} color={trim.base} />
            </Group>
            <Group transform={lettering.name.transform}>
              <Text x={0} y={0} text={NAME} font={font} color={trim.base} />
            </Group>
          </>
        ) : null}
        <Path path={torsoShapes.jersey} color={ink} style="stroke" strokeWidth={inkCm} strokeJoin="round" />
      </Group>

      <BallPaint ink={hbInk} shade={hbShade} body={hbBody} light={hbLight} spec={hbSpec} seam={hbSeam} patch={hbPatch} look={look} />

      {/* Head from behind: ears, hair with volume and shine, headband. */}
      <Group transform={headT}>
        <Path path={headShapes.ears} color={ink} style="stroke" strokeWidth={2 * inkHead} strokeJoin="round" />
        <Path path={headShapes.ears} color={skin.base} />
        <Path path={headShapes.earsInner} color={skinDeep} />
        <Path path={headShapes.hair} color={ink} style="stroke" strokeWidth={2 * inkHead} strokeJoin="round" />
        <Path path={headShapes.hair} color={hair.shade} />
        <Group clip={headShapes.hair}>
          <Path path={headShapes.hairLit} color={hair.base} />
          <Path path={headShapes.hairLines} color={hair.shade} style="stroke" strokeWidth={5} strokeCap="round" />
          <Path path={headShapes.hairShine} color={hair.light} style="stroke" strokeWidth={9} strokeCap="round" />
          <Group clip={headShapes.hairRimCut} invertClip>
            <Path path={headShapes.hair} color={rim} opacity={0.4} />
          </Group>
        </Group>
        <Path path={headShapes.headband} color={ink} style="stroke" strokeWidth={2 * inkHead} strokeJoin="round" />
        <Path path={headShapes.headband} color={team.shade} />
        <Group clip={headShapes.headband}>
          <Path path={headShapes.headbandLit} color={team.base} />
          <Path path={headShapes.headbandStripe} color={trim.base} style="stroke" strokeWidth={6} />
        </Group>
      </Group>

      <LitBatch paths={back1} tones={skin} band={team} />
      <LitBatch paths={back0} tones={skin} band={team} />
    </>
  );
}

/** One batch of lit limbs: outline, shade, lit body, highlight, then the cloth bands over them. */
function LitBatch({ paths, tones, band }: { paths: SharedValue<LitPaths>; tones: Tones; band: Tones }) {
  const inkP = useDerivedValue(() => paths.value.ink);
  const shade = useDerivedValue(() => paths.value.shade);
  const base = useDerivedValue(() => paths.value.base);
  const light = useDerivedValue(() => paths.value.light);
  const bandP = useDerivedValue(() => paths.value.band);
  const bandShade = useDerivedValue(() => paths.value.bandShade);
  const cuff = useDerivedValue(() => paths.value.cuff);
  return (
    <>
      <Path path={inkP} color={ink} />
      <Path path={shade} color={tones.shade} />
      <Path path={base} color={tones.base} />
      <Path path={light} color={tones.light} />
      <Path path={bandShade} color={band.shade} />
      <Path path={bandP} color={band.base} />
      <Path path={cuff} color={band.base} />
      <Path path={cuff} color={ink} style="stroke" strokeWidth={border.thin} strokeJoin="round" />
    </>
  );
}
