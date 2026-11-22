/**
 * Popup words on a hit ("SWISH!", "NICE!", streak words like "ON FIRE!"): Lilita One with a thick ink outline of the same width on every
 * side (no drop under it, owner 2026-11-22) and a warm gradient fill, popping in with a little overshoot, rising and fading. An ordinary word sits over the target; a streak
 * milestone word is bigger, gold and centered below the target. Drawn in the Skia canvas above everything else, from a fixed pool of
 * SLOTS text groups that show the most recent live popups; which hits get a word is decided by the planner (fx/hitPlan.ts), so a flood
 * of hits never floods the screen. Reduce Motion: no pop, no rise; the fade stays.
 * Owner of this file: the "juice" agent.
 */
import { Group, LinearGradient, Text, vec, type SkFont } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { SportDef } from '@/engine';
import { colors } from '@/ui/theme';

import { scaleAt, screenX, screenY, type Camera } from '../camera';
import { fx } from './palette';

/** The font is loaded at this size; slots scale it. */
export const POP_FONT_SIZE = 44;
/** A popup on the UI thread: when it appears (wall ms), its word and width at POP_FONT_SIZE, whether it is a milestone, the target's z. */
export interface PopRec {
  atMs: number;
  text: string;
  w: number;
  big: boolean;
  z: number;
}

const SLOTS = 3;
const POP_SEC = 0.85;
const BIG_SEC = 1.15;
const SMALL_SCALE = 0.7;
const MARGIN = 14;
/** Popups stay below the top bar (money pill, settings). */
const TOP_MIN = 120;
/** A streak word sits this far below the rim (points). */
const BIG_DROP = 96;

interface SlotState {
  text: string;
  x: number;
  y: number;
  left: number;
  scale: number;
  opacity: number;
  big: boolean;
}

const EMPTY: SlotState = { text: '', x: 0, y: 0, left: 0, scale: 1, opacity: 0, big: false };

export interface PopupsProps {
  font: SkFont | null;
  pops: SharedValue<PopRec[]>;
  clock: SharedValue<number>;
  cam: Camera;
  def: SportDef;
  width: number;
  reduced: boolean;
}

/** How long a popup is shown, seconds. */
export function popLife(big: boolean): number {
  'worklet';
  return big ? BIG_SEC : POP_SEC;
}

export function Popups({ font, pops, clock, cam, def, width, reduced }: PopupsProps) {
  const t = def.target;
  const cx = t.center.x;
  // Anchored to the rim (the crossbar, the flag top) and lifted a fixed amount, but never under the top bar.
  const top = t.kind === 'hoop' ? t.center.y : t.kind === 'goal' ? 2 * t.center.y : 1.6;
  const lift = t.kind === 'hoop' ? 0.55 * scaleAt(cam, cx) : 24;
  const slots = useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = pops.value;
    const out: SlotState[] = [];
    for (let i = list.length - 1; i >= 0 && out.length < SLOTS; i--) {
      const p = list[i]!;
      const life = popLife(p.big);
      const age = (nowMs - p.atMs) / 1000;
      if (age < 0 || age >= life) continue;
      const u = age / life;
      let scale = p.big ? 1 : SMALL_SCALE;
      if (!reduced) {
        // Pop: 0.3 → 1.18 in 110 ms, settle to 1 by 220 ms.
        if (age < 0.11) {
          const a = age / 0.11;
          scale *= 0.3 + 0.88 * (1 - (1 - a) * (1 - a));
        } else if (age < 0.22) {
          scale *= 1.18 - 0.18 * ((age - 0.11) / 0.11);
        }
      }
      const opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      const rise = reduced ? 0 : (p.big ? 14 : 26) * (1 - (1 - u) * (1 - u));
      const half = (p.w * (p.big ? 1 : SMALL_SCALE)) / 2;
      // An ordinary word sits over the target; a streak word sits centered below it, over the open court, so the two never collide.
      let x = p.big ? width / 2 : screenX(cam, cx, p.z);
      if (x - half < MARGIN) x = MARGIN + half;
      if (x + half > width - MARGIN) x = width - MARGIN - half;
      let y = p.big ? screenY(cam, cx, top, 0) + BIG_DROP : screenY(cam, cx, top, p.z) - lift;
      if (y < TOP_MIN) y = TOP_MIN;
      y -= rise;
      out.push({ text: p.text, x, y, left: x - p.w / 2, scale, opacity, big: p.big });
    }
    // Draw the oldest first, so the newest word sits on top.
    out.reverse();
    while (out.length < SLOTS) out.push(EMPTY);
    return out;
  });
  if (!font) return null;
  const items = [];
  for (let i = 0; i < SLOTS; i++) items.push(<PopSlot key={i} index={i} slots={slots} font={font} />);
  return <>{items}</>;
}

function PopSlot({ index, slots, font }: { index: number; slots: SharedValue<SlotState[]>; font: SkFont }) {
  const text = useDerivedValue(() => slots.value[index]!.text);
  const left = useDerivedValue(() => slots.value[index]!.left);
  // Text is drawn on its baseline: put the baseline so the cap height is centered on y.
  const base = useDerivedValue(() => slots.value[index]!.y + 0.36 * POP_FONT_SIZE);
  const opacity = useDerivedValue(() => slots.value[index]!.opacity);
  const transform = useDerivedValue(() => {
    const s = slots.value[index]!;
    return [{ translateX: s.x }, { translateY: s.y }, { scale: s.scale }, { translateX: -s.x }, { translateY: -s.y }];
  });
  const gStart = useDerivedValue(() => vec(0, slots.value[index]!.y - 0.4 * POP_FONT_SIZE));
  const gEnd = useDerivedValue(() => vec(0, slots.value[index]!.y + 0.4 * POP_FONT_SIZE));
  // Warm fills on any background: white into cash yellow for a word, cream into gold for a streak word.
  const gColors = useDerivedValue(() => (slots.value[index]!.big ? [fx.cream, fx.spark, fx.gold] : [fx.white, fx.white, colors.cash]));
  return (
    <Group transform={transform} opacity={opacity}>
      <Text text={text} font={font} x={left} y={base} color={colors.ink} style="stroke" strokeWidth={9} strokeJoin="round" />
      <Text text={text} font={font} x={left} y={base}>
        <LinearGradient start={gStart} end={gEnd} colors={gColors} />
      </Text>
    </Group>
  );
}
