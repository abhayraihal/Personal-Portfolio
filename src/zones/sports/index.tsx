import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';

// PLACEHOLDER (spine). The sports zone module replaces this.
export function SportsZone() {
  return (
    <ZoneFrame zone="sports">
      <Board title="Sports ground" lines={['Placeholder']} position={[0, 0, -6]} />
      <Pad id="sports-main" label="Open Sports ground" action={{ kind: 'panel', panel: 'sports' }} position={[0, 0, 0]} />
    </ZoneFrame>
  );
}
