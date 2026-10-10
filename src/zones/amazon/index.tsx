import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';

// PLACEHOLDER (spine). The amazon zone module replaces this.
export function AmazonZone() {
  return (
    <ZoneFrame zone="amazon">
      <Board title="Amazon" lines={['Placeholder']} position={[0, 0, -6]} />
      <Pad id="amazon-main" label="Open Amazon" action={{ kind: 'panel', panel: 'amazon' }} position={[0, 0, 0]} />
    </ZoneFrame>
  );
}
