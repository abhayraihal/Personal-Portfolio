import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';

// PLACEHOLDER (spine). The projects zone module replaces this.
export function ProjectsZone() {
  return (
    <ZoneFrame zone="projects">
      <Board title="Projects" lines={['Placeholder']} position={[0, 0, -6]} />
      <Pad id="projects-main" label="Open Projects" action={{ kind: 'panel', panel: 'projects' }} position={[0, 0, 0]} />
    </ZoneFrame>
  );
}
