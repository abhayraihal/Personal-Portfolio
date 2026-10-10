import { MeshStandardMaterial } from 'three';
import { Label } from '../../components/Label.tsx';
import type { LabelProps } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { profile } from '../../data/profile.ts';
import { hubAt, SPOT, TOUCH } from './layout.ts';

// Road-paint text, sized to stay inside the 8 m spine. Lit, so the car and the letters shade it
// like the road under it.
const paint = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
const PAINT_Y = 0.06; // above any road decal
const ROAD_TEXT_WIDTH = 7.5;

// Key names are painted pink, the rest cream.
export const CONTROL_LINES: { text: string; keys: string[] }[] = [
  { text: 'W A S D or arrows to drive', keys: ['W A S D', 'arrows'] },
  { text: 'Space brake · Shift boost · R reset', keys: ['Space', 'Shift', 'R '] },
  { text: 'Enter to read · 1-7 jump to a zone', keys: ['Enter', '1-7'] },
];

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
        size={0.75}
        maxWidth={ROAD_TEXT_WIDTH}
        textAlign="center"
        lineHeight={1.02}
        color={COLORS.paper}
        material={paint}
        receiveShadow
        depthOffset={-2}
        position={hubAt(0, SPOT.roleV, PAINT_Y)}
      >
        {profile.roleLine.replace(' at ', '\nat ')}
      </Label>
      {!TOUCH && CONTROL_LINES.map((line, i) => (
        <Label
          key={line.text}
          flat
          font="display"
          size={0.52}
          maxWidth={ROAD_TEXT_WIDTH + 0.4}
          color={COLORS.paper}
          {...keyColors(line.text, line.keys)}
          material={paint}
          receiveShadow
          depthOffset={-2}
          position={hubAt(0, SPOT.controlsV - i * 0.82, PAINT_Y)}
        >
          {line.text}
        </Label>
      ))}
    </group>
  );
}
