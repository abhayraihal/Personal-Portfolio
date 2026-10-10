import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';

// PLACEHOLDER (spine). The hub zone module replaces this.
export function HubZone() {
  return (
    <ZoneFrame zone="hub">
      <Board title="Start" lines={['Placeholder']} position={[0, 0, -6]} />
      <Pad id="hub-main" label="Open Start" action={{ kind: 'panel', panel: 'about' }} position={[0, 0, 0]} />
    </ZoneFrame>
  );
}
