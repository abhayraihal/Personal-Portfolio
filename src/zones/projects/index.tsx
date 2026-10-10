import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { INSPECT } from '../../config/world.ts';
import type { PanelId } from '../../data/profile.ts';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { Arcade } from './Arcade.tsx';
import { Bay } from './Bay.tsx';
import { Entrance } from './Entrance.tsx';
import { GarageProps } from './GarageProps.tsx';
import { InspectTeleport } from './InspectTeleport.tsx';
import { ARCADE, BAYS, ROWS } from './layout.ts';
import { Plaza } from './Plaza.tsx';
import { Props } from './Props.tsx';
import { AstToy } from './toys/AstToy.tsx';
import { Scan2ScopeToy } from './toys/Scan2ScopeToy.tsx';
import { SelfDrivingToy } from './toys/SelfDrivingToy.tsx';
import { astSignal, scanSignal, setParked } from './toys/signals.ts';
import type { ToySignal } from './toys/signals.ts';
import { SignpostToy } from './toys/SignpostToy.tsx';
import { TurretToy } from './toys/TurretToy.tsx';
import { WeatherToy } from './toys/WeatherToy.tsx';

const SIGNALS: Partial<Record<PanelId, ToySignal>> = {
  'project-scan2scope': scanSignal,
  'project-rule-engine': astSignal,
};

// Parking on every project pad once in a session gets a toast and confetti.
const visited = new Set<PanelId>();
let celebrated = false;
function onBayParked(panel: PanelId, parked: boolean) {
  const signal = SIGNALS[panel];
  if (signal) setParked(signal, parked);
  if (!parked || celebrated) return;
  visited.add(panel);
  if (visited.size < BAYS.length) return;
  celebrated = true;
  useStore.getState().toast(`You have seen all ${BAYS.length} projects`, 'win');
  playSound('win');
  events.emit('confetti', { x: car.x, y: car.y + 1.2, z: car.z });
}

// The projects garage: six project bays in two rows, a toy beside each, and the early-projects
// arcade at the far end of the boulevard.
export function ProjectsZone() {
  return (
    <ZoneFrame zone="projects">
      <Plaza />
      <Entrance />
      {BAYS.map((b) => (
        <Bay key={b.project.panel} bay={b} onParked={(on) => onBayParked(b.project.panel, on)} />
      ))}
      <Scan2ScopeToy position={[-21.6, 0, -13.4]} pad={[BAYS[0].x, ROWS[BAYS[0].row].pad]} />
      <SelfDrivingToy />
      <AstToy position={[21, 0, -11]} />
      <SignpostToy position={[-18.6, 0, 14]} />
      <WeatherToy position={[7, 0, 10.5]} />
      <TurretToy position={[20.5, 0, 15.6]} />
      <Arcade x={ARCADE.x} z={ARCADE.z} padZ={ARCADE.padZ} />
      <Props />
      <GarageProps />
      {INSPECT && <InspectTeleport />}
    </ZoneFrame>
  );
}
