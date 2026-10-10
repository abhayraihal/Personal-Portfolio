import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';

// PLACEHOLDER (spine). The career zone module replaces this.
export function CareerZone() {
  return (
    <ZoneFrame zone="career">
      <Board title="Career road" lines={['Placeholder']} position={[0, 0, -6]} />
      <Pad id="career-main" label="Open Career road" action={{ kind: 'panel', panel: 'career' }} position={[0, 0, 0]} />
    </ZoneFrame>
  );
}
