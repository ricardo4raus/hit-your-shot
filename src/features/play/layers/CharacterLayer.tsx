/**
 * The character, posed by the rig every frame in its own frame (x forward from the shot origin, y up, z right), then projected.
 * Seen from behind, the arms anchored on the back are nearest to the camera and are drawn over the torso; the others under it.
 * Owner of this file: the "character" agent. Props are fixed by layers/shared.ts.
 */
import { Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import { border, colors } from '@/ui/theme';

import { scaleAt, screenX, screenY } from '../camera';
import { BODY_H, HEAD_R, TORSO_HALF, poseBody, tauFor, type ArmTiming, type Vec } from '../rig';
import { addBall, BallPaint, ballColors, detachBall, makeBall } from './ballLook';
import { oval, type CharacterLayerProps } from './shared';

export function CharacterLayer({ def, sportId, cam, clock, anchors, aim, round: roundSV, schedule: scheduleSV, offsets: offsetsSV }: CharacterLayerProps) {
  const ox = def.field.origin.x;
  const oy = def.field.origin.y;
  const dx = def.target.center.x - ox;
  const look = useMemo(() => ballColors(sportId), [sportId]);

  const bodyScale = scaleAt(cam, ox);
  const armStroke = Math.max(6, 0.06 * BODY_H * bodyScale);
  const legStroke = Math.max(8, 0.1 * BODY_H * bodyScale);
  const bodyPaths = useDerivedValue(() => {
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

    const chestArms = Skia.PathBuilder.Make();
    const chestHands = Skia.PathBuilder.Make();
    const backArms = Skia.PathBuilder.Make();
    const backHands = Skia.PathBuilder.Make();
    const heldChest = makeBall();
    const heldBack = makeBall();
    for (let i = 0; i < pose.arms.length; i++) {
      const arm = pose.arms[i]!;
      const arms = arm.behind ? backArms : chestArms;
      const hands = arm.behind ? backHands : chestHands;
      const held = arm.behind ? heldBack : heldChest;
      arms.moveTo(sx(arm.shoulder), sy(arm.shoulder));
      arms.lineTo(sx(arm.elbow), sy(arm.elbow));
      arms.lineTo(sx(arm.wrist), sy(arm.wrist));
      hands.moveTo(sx(arm.wrist), sy(arm.wrist));
      hands.lineTo(sx(arm.tip), sy(arm.tip));
      if (arm.holding > 0) {
        const r = sched.radii[i] ?? 0.1;
        // The ball sits just past the fingertips.
        const dxh = arm.tip.x - arm.wrist.x;
        const dyh = arm.tip.y - arm.wrist.y;
        const dzh = arm.tip.z - arm.wrist.z;
        const l = Math.sqrt(dxh * dxh + dyh * dyh + dzh * dzh) || 1;
        const c = { x: arm.tip.x + (dxh / l) * r * 0.9, y: arm.tip.y + (dyh / l) * r * 0.9, z: arm.tip.z + (dzh / l) * r * 0.9 };
        addBall(held, sx(c), sy(c), r * scaleAt(cam, ox + c.x, c.z));
      }
    }

    const legs = Skia.PathBuilder.Make();
    const feet = Skia.PathBuilder.Make();
    for (const leg of pose.legs) {
      legs.moveTo(sx(leg.hip), sy(leg.hip));
      legs.lineTo(sx(leg.knee), sy(leg.knee));
      legs.lineTo(sx(leg.ankle), sy(leg.ankle));
      feet.moveTo(sx(leg.ankle), sy(leg.ankle));
      feet.lineTo(sx(leg.toe), sy(leg.toe));
    }

    // Torso: a trapezoid from the hips up to wider shoulders, leaning with them. Filled, then stroked with round joins for the
    // outline, so the corners come out rounded.
    const torso = Skia.PathBuilder.Make();
    const b = border.width;
    const shoulderTop = pose.shoulders.y - 0.01 * BODY_H;
    const hipBottom = pose.hips.y - 0.03 * BODY_H;
    const sl = { x: pose.shoulders.x, y: shoulderTop, z: -TORSO_HALF * BODY_H };
    const sr = { x: pose.shoulders.x, y: shoulderTop, z: TORSO_HALF * BODY_H };
    const hipL = { x: pose.hips.x, y: hipBottom, z: -0.8 * TORSO_HALF * BODY_H };
    const hipR = { x: pose.hips.x, y: hipBottom, z: 0.8 * TORSO_HALF * BODY_H };
    torso.moveTo(sx(sl), sy(sl));
    torso.lineTo(sx(sr), sy(sr));
    torso.lineTo(sx(hipR), sy(hipR));
    torso.lineTo(sx(hipL), sy(hipL));
    torso.close();
    const torsoShape = torso.detach();

    const neck = Skia.PathBuilder.Make();
    const nl = screenX(cam, ox + pose.shoulders.x, -0.05 * BODY_H);
    const nr = screenX(cam, ox + pose.shoulders.x, 0.05 * BODY_H);
    const nt = screenY(cam, ox + pose.shoulders.x, pose.shoulders.y + 0.08 * BODY_H);
    const nb = screenY(cam, ox + pose.shoulders.x, pose.shoulders.y);
    neck.addRect({ x: nl, y: nt, width: nr - nl, height: nb - nt });

    const head = Skia.PathBuilder.Make();
    const headInk = Skia.PathBuilder.Make();
    const ears = Skia.PathBuilder.Make();
    const hr = HEAD_R * BODY_H * scaleAt(cam, ox + pose.head.x);
    headInk.addCircle(sx(pose.head), sy(pose.head), hr + b);
    head.addCircle(sx(pose.head), sy(pose.head), hr);
    for (const side of [-1, 1]) {
      const e = { x: pose.head.x, y: pose.head.y - 0.01 * BODY_H, z: side * HEAD_R * BODY_H * 0.98 };
      ears.addCircle(sx(e), sy(e), 0.025 * BODY_H * bodyScale);
    }

    return {
      chestArms: chestArms.detach(),
      chestHands: chestHands.detach(),
      backArms: backArms.detach(),
      backHands: backHands.detach(),
      heldChest: detachBall(heldChest),
      heldBack: detachBall(heldBack),
      legs: legs.detach(),
      feet: feet.detach(),
      torso: torsoShape,
      neck: neck.detach(),
      head: head.detach(),
      headInk: headInk.detach(),
      ears: ears.detach(),
    };
  });
  const chestArms = useDerivedValue(() => bodyPaths.value.chestArms);
  const chestHands = useDerivedValue(() => bodyPaths.value.chestHands);
  const backArms = useDerivedValue(() => bodyPaths.value.backArms);
  const backHands = useDerivedValue(() => bodyPaths.value.backHands);
  const hcInk = useDerivedValue(() => bodyPaths.value.heldChest.ink);
  const hcShade = useDerivedValue(() => bodyPaths.value.heldChest.shade);
  const hcBody = useDerivedValue(() => bodyPaths.value.heldChest.body);
  const hcLight = useDerivedValue(() => bodyPaths.value.heldChest.light);
  const hbInk = useDerivedValue(() => bodyPaths.value.heldBack.ink);
  const hbShade = useDerivedValue(() => bodyPaths.value.heldBack.shade);
  const hbBody = useDerivedValue(() => bodyPaths.value.heldBack.body);
  const hbLight = useDerivedValue(() => bodyPaths.value.heldBack.light);
  const legsPath = useDerivedValue(() => bodyPaths.value.legs);
  const feetPath = useDerivedValue(() => bodyPaths.value.feet);
  const torsoPath = useDerivedValue(() => bodyPaths.value.torso);
  const neckPath = useDerivedValue(() => bodyPaths.value.neck);
  const headPath = useDerivedValue(() => bodyPaths.value.head);
  const headInkPath = useDerivedValue(() => bodyPaths.value.headInk);
  const earsPath = useDerivedValue(() => bodyPaths.value.ears);

  const bodyShadow = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.addOval(oval(cam, ox, 0, 0, 0.5));
    return p.detach();
  }, [cam, ox]);

  return (
    <>
      <Path path={bodyShadow} color={colors.ink} opacity={0.22} />
      <Path path={chestArms} color={colors.ink} style="stroke" strokeWidth={armStroke + 2 * border.width} strokeCap="round" strokeJoin="round" />
      <Path path={chestArms} color={colors.skinShade} style="stroke" strokeWidth={armStroke} strokeCap="round" strokeJoin="round" />
      <Path path={chestHands} color={colors.ink} style="stroke" strokeWidth={armStroke * 1.1 + 2 * border.width} strokeCap="round" />
      <Path path={chestHands} color={colors.skinShade} style="stroke" strokeWidth={armStroke * 1.1} strokeCap="round" />
      <BallPaint ink={hcInk} shade={hcShade} body={hcBody} light={hcLight} look={look} />
      <Path path={legsPath} color={colors.ink} style="stroke" strokeWidth={legStroke + 2 * border.width} strokeCap="round" strokeJoin="round" />
      <Path path={legsPath} color={colors.trousers} style="stroke" strokeWidth={legStroke} strokeCap="round" strokeJoin="round" />
      <Path path={feetPath} color={colors.ink} style="stroke" strokeWidth={legStroke * 0.8} strokeCap="round" />
      <Path path={torsoPath} color={colors.ink} style="stroke" strokeWidth={2 * border.width + 0.05 * BODY_H * bodyScale} strokeJoin="round" />
      <Path path={torsoPath} color={colors.paper} />
      <Path path={torsoPath} color={colors.paper} style="stroke" strokeWidth={0.05 * BODY_H * bodyScale} strokeJoin="round" />
      <Path path={backArms} color={colors.ink} style="stroke" strokeWidth={armStroke + 2 * border.width} strokeCap="round" strokeJoin="round" />
      <Path path={backArms} color={colors.skin} style="stroke" strokeWidth={armStroke} strokeCap="round" strokeJoin="round" />
      <Path path={backHands} color={colors.ink} style="stroke" strokeWidth={armStroke * 1.1 + 2 * border.width} strokeCap="round" />
      <Path path={backHands} color={colors.skin} style="stroke" strokeWidth={armStroke * 1.1} strokeCap="round" />
      <Path path={neckPath} color={colors.skin} />
      <Path path={headInkPath} color={colors.ink} />
      <Path path={headPath} color={colors.hair} />
      <Path path={earsPath} color={colors.skin} />
      <BallPaint ink={hbInk} shade={hbShade} body={hbBody} light={hbLight} look={look} />
    </>
  );
}
