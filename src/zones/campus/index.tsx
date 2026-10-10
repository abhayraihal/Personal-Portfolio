import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';

// PLACEHOLDER (spine). The campus zone module replaces this.
export function CampusZone() {
  return (
    <ZoneFrame zone="campus">
      <Board title="IIT Mandi" lines={['Placeholder']} position={[0, 0, -6]} />
      <Pad id="campus-main" label="Open IIT Mandi" action={{ kind: 'panel', panel: 'education' }} position={[0, 0, 0]} />
    </ZoneFrame>
  );
}
