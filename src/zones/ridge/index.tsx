import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';

// PLACEHOLDER (spine). The ridge zone module replaces this.
export function RidgeZone() {
  return (
    <ZoneFrame zone="ridge">
      <Board title="Rating ridge" lines={['Placeholder']} position={[0, 0, -6]} />
      <Pad id="ridge-main" label="Open Rating ridge" action={{ kind: 'panel', panel: 'codeforces' }} position={[0, 0, 0]} />
    </ZoneFrame>
  );
}
