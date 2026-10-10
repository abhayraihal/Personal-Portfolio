import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { otherPlatforms } from '../../data/codeforces.ts';

// LeetCode and CodeChef, with a pad that opens the 'cp-platforms' panel.
export function Platforms({ position }: { position: [number, number, number] }) {
  const [x, y, z] = position;
  const lines = otherPlatforms.flatMap((p) => [`${p.platform} · ${p.handle}`, p.stat]);
  return (
    <>
      <Board title="Other platforms" lines={lines} width={9} titleSize={0.62} lineSize={0.37} accent={COLORS.accent} lift={1.0} position={position} />
      <Pad id="ridge-platforms" label="Read about LeetCode and CodeChef" action={{ kind: 'panel', panel: 'cp-platforms' }} position={[x, y, z + 4.4]} icon="LeetCode · CodeChef" />
    </>
  );
}
