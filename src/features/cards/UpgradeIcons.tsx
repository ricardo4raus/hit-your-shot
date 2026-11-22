/**
 * The three upgrade icons as shaded vector drawings (art direction "polished arcade", 2026-11-22): every shape has a lit top, its base
 * tone and the ink outline, under one warm key light from the upper left. The owner found the old scenes unreadable, so each icon is now
 * the symbol a player already knows. Accuracy: a target with crosshair ticks. Fire rate: a lightning bolt with speed lines. Income: two
 * stacks of the game's green coins. Drawn with Skia, one small canvas per card; decorative (the card carries the label).
 */
import { Canvas, Circle, Group, LinearGradient, Line, Oval, Path, Rect, vec } from '@shopify/react-native-skia';
import { View } from 'react-native';

import type { UpgradeId } from '@/engine';
import { colors, shade } from '@/ui/theme';

export const ICON_WIDTH = 64;
export const ICON_HEIGHT = 50;

const INK = colors.ink;
const STROKE = 2.5;
const SHADOW = 'rgba(20, 24, 34, 0.28)';

export interface UpgradeIconProps {
  id: UpgradeId;
}

export function UpgradeIcon({ id }: UpgradeIconProps) {
  return (
    <View style={{ width: ICON_WIDTH, height: ICON_HEIGHT }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
      <Canvas style={{ width: ICON_WIDTH, height: ICON_HEIGHT }}>
        {id === 'accuracy' ? <Target /> : id === 'fireRate' ? <Bolt /> : <Coins />}
      </Canvas>
    </View>
  );
}

/** A filled circle lit from the top with an ink rim. */
function LitCircle({ cx, cy, r, color, stroke = STROKE }: { cx: number; cy: number; r: number; color: string; stroke?: number }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r}>
        <LinearGradient start={vec(cx, cy - r)} end={vec(cx, cy + r)} colors={[shade(color, 0.3), color, shade(color, -0.18)]} />
      </Circle>
      <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={stroke} color={INK} />
    </>
  );
}

function Target() {
  const cx = 32;
  const cy = 24;
  const red = '#E8453B';
  const tick = (x1: number, y1: number, x2: number, y2: number) => (
    <Line p1={vec(x1, y1)} p2={vec(x2, y2)} color={INK} strokeWidth={4} strokeCap="round" />
  );
  return (
    <Group>
      <Oval x={cx - 18} y={44} width={36} height={6} color={SHADOW} />
      <LitCircle cx={cx} cy={cy} r={20} color={red} stroke={3} />
      <LitCircle cx={cx} cy={cy} r={14} color={colors.paper} />
      <LitCircle cx={cx} cy={cy} r={8.5} color={red} />
      <Circle cx={cx} cy={cy} r={3.2} color={colors.paper} />
      <Circle cx={cx} cy={cy} r={3.2} style="stroke" strokeWidth={2} color={INK} />
      {tick(cx, 0.5, cx, 9)}
      {tick(cx, 39, cx, 47.5)}
      {tick(8, cy, 16.5, cy)}
      {tick(47.5, cy, 56, cy)}
      <Oval x={cx - 13} y={cy - 16} width={9} height={5} color="rgba(255,255,255,0.6)" />
    </Group>
  );
}

const BOLT = 'M 38 2 L 17 28 L 29.5 28 L 23 48 L 47 19 L 34 19 L 42 2 Z';

function Bolt() {
  const yellow = '#FFD23D';
  const line = (x1: number, x2: number, y: number) => <Line p1={vec(x1, y)} p2={vec(x2, y)} color={INK} strokeWidth={3.5} strokeCap="round" />;
  return (
    <Group>
      <Oval x={16} y={44} width={34} height={6} color={SHADOW} />
      {line(4, 13, 14)}
      {line(1, 12, 23)}
      {line(5, 11, 32)}
      <Path path={BOLT}>
        <LinearGradient start={vec(32, 2)} end={vec(32, 48)} colors={['#FFF1A8', yellow, '#F2A516']} />
      </Path>
      <Path path="M 38 2 L 17 28 L 21 28 L 41 4 Z" color="rgba(255,255,255,0.55)" />
      <Path path={BOLT} style="stroke" strokeWidth={3} strokeJoin="round" color={INK} />
    </Group>
  );
}

/** One coin seen from slightly above: the edge band under the face, the face lit from the top, an inner ring. */
function Coin({ cx, cy, rx = 14, ry = 6, edge = 5 }: { cx: number; cy: number; rx?: number; ry?: number; edge?: number }) {
  const face = colors.good;
  const dark = shade(face, -0.42);
  return (
    <Group>
      <Oval x={cx - rx} y={cy - ry + edge} width={rx * 2} height={ry * 2} color={dark} />
      <Rect x={cx - rx} y={cy} width={rx * 2} height={edge} color={dark} />
      <Oval x={cx - rx} y={cy - ry + edge} width={rx * 2} height={ry * 2} style="stroke" strokeWidth={STROKE} color={INK} />
      <Rect x={cx - rx} y={cy} width={rx * 2} height={edge} color={dark} />
      <Line p1={vec(cx - rx, cy)} p2={vec(cx - rx, cy + edge)} color={INK} strokeWidth={STROKE} />
      <Line p1={vec(cx + rx, cy)} p2={vec(cx + rx, cy + edge)} color={INK} strokeWidth={STROKE} />
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2}>
        <LinearGradient start={vec(cx, cy - ry)} end={vec(cx, cy + ry)} colors={[shade(face, 0.4), face]} />
      </Oval>
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} style="stroke" strokeWidth={STROKE} color={INK} />
      <Oval x={cx - rx * 0.6} y={cy - ry * 0.55} width={rx * 1.2} height={ry * 1.1} style="stroke" strokeWidth={1.5} color={shade(face, -0.45)} />
    </Group>
  );
}

function Coins() {
  return (
    <Group>
      <Oval x={8} y={44} width={50} height={6} color={SHADOW} />
      <Coin cx={43} cy={39} />
      <Coin cx={43} cy={32} />
      <Coin cx={22} cy={40} />
      <Coin cx={22} cy={33} />
      <Coin cx={22} cy={26} />
      <Coin cx={22} cy={19} />
      <Path path="M 51 4 L 53 10 L 59 12 L 53 14 L 51 20 L 49 14 L 43 12 L 49 10 Z" color={colors.paper} />
      <Path path="M 51 4 L 53 10 L 59 12 L 53 14 L 51 20 L 49 14 L 43 12 L 49 10 Z" style="stroke" strokeWidth={2} strokeJoin="round" color={INK} />
    </Group>
  );
}
