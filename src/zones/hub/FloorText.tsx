import { MeshStandardMaterial } from 'three';
import { Label } from '../../components/Label.tsx';
import type { LabelProps } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { profile } from '../../data/profile.ts';
import { hubAt, SPOT, TOUCH } from './layout.ts';
import { glowAtNight } from './nightGlow.ts';
import { textWidth } from './textWidth.ts';

// Road-paint text, sized to stay inside the 8 m spine. Lit, so the car and the letters shade it
// like the road under it, and glowing faintly in its own colours at night.
const paint = glowAtNight(new MeshStandardMaterial({ roughness: 1, metalness: 0 }), 0.38);

const PAINT_Y = 0.06; // above any road decal
const TEXT_WIDTH = 6.8; // the asphalt between the kerbs is about 7.3 m

// Largest font size (up to max) at which every line fits TEXT_WIDTH.
function fitSize(lines: string[], max: number) {
  const widest = Math.max(...lines.map((l) => textWidth(l, 'display', 1)));
  return Math.min(max, TEXT_WIDTH / widest);
}

// The job title on two lines, split where the longer half is shortest, then 'at <place>':
// 'Software' / 'Development Engineer' / 'at Amazon, Bengaluru'.
function roleLines(): string[] {
  const [title, place] = profile.roleLine.split(' at ');
  const words = title.split(' ');
  let best = [title];
  let bestW = textWidth(title, 'display', 1);
  for (let i = 1; i < words.length; i++) {
    const halves = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const w = Math.max(...halves.map((h) => textWidth(h, 'display', 1)));
    if (w < bestW) [best, bestW] = [halves, w];
  }
  return place ? [...best, `at ${place}`] : best;
}
const ROLE_LINES = roleLines();
const ROLE_SIZE = fitSize(ROLE_LINES, 0.75);

// Key names are painted pink, the rest cream.
export const CONTROL_LINES: { text: string; keys: string[] }[] = [
  { text: 'W A S D or arrows to drive', keys: ['W A S D', 'arrows'] },
  { text: 'Space brake · Shift boost · R reset', keys: ['Space', 'Shift', 'R '] },
  { text: 'Enter to read · 1–7 jump to a zone', keys: ['Enter', '1–7'] },
];
const CONTROL_SIZE = fitSize(CONTROL_LINES.map((l) => l.text), 0.52);
const CONTROL_PITCH = CONTROL_SIZE * 1.58;

// troika's colorRanges (character index -> colour from there on). drei passes unknown props through
// to the troika mesh, but its types leave this one out.
function keyColors(text: string, keys: string[]): Partial<LabelProps> {
  const ranges: Record<number, string> = { 0: COLORS.paper };
  for (const k of keys) {
    const at = text.indexOf(k);
    if (at < 0) continue;
    ranges[at] = COLORS.accent;
    ranges[at + k.trim().length] = COLORS.paper;
  }
  return { colorRanges: ranges } as unknown as Partial<LabelProps>;
}

export function FloorText() {
  return (
    <group>
      <Label
        flat
        font="display"
        size={ROLE_SIZE}
        maxWidth={TEXT_WIDTH + 0.3}
        textAlign="center"
        lineHeight={1.08}
        color={COLORS.paper}
        material={paint}
        receiveShadow
        depthOffset={-2}
        position={hubAt(0, SPOT.roleV, PAINT_Y)}
      >
        {ROLE_LINES.join('\n')}
      </Label>
      {!TOUCH && CONTROL_LINES.map((line, i) => (
        <Label
          key={line.text}
          flat
          font="display"
          size={CONTROL_SIZE}
          maxWidth={TEXT_WIDTH + 0.3}
          color={COLORS.paper}
          {...keyColors(line.text, line.keys)}
          material={paint}
          receiveShadow
          depthOffset={-2}
          position={hubAt(0, SPOT.controlsV - i * CONTROL_PITCH, PAINT_Y)}
        >
          {line.text}
        </Label>
      ))}
    </group>
  );
}
