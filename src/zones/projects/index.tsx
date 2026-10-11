import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { INSPECT } from '../../config/world.ts';
import type { PanelId } from '../../data/profile.ts';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { Bay } from './Bay.tsx';
import { Entrance } from './Entrance.tsx';
import { GarageProps } from './GarageProps.tsx';
import { InspectTeleport } from './InspectTeleport.tsx';
import { BAYS, ROWS, TOYS_2022 } from './layout.ts';
import { Plaza } from './Plaza.tsx';
import { Props } from './Props.tsx';
import { StreetSign } from './StreetSign.tsx';
import { AstToy } from './toys/AstToy.tsx';
import { CovidToy } from './toys/CovidToy.tsx';
import { DriveInToy } from './toys/DriveInToy.tsx';
import { HitTheBallToy } from './toys/HitTheBallToy.tsx';
import { Scan2ScopeToy } from './toys/Scan2ScopeToy.tsx';
import { SelfDrivingToy } from './toys/SelfDrivingToy.tsx';
import { astSignal, ballSignal, cinemaSignal, covidSignal, scanSignal, setParked, shootersSignal } from './toys/signals.ts';
import type { ToySignal } from './toys/signals.ts';
import { SignpostToy } from './toys/SignpostToy.tsx';
import { SpaceShootersToy } from './toys/SpaceShootersToy.tsx';
import { TurretToy } from './toys/TurretToy.tsx';
import { WeatherToy } from './toys/WeatherToy.tsx';

const SIGNALS: Partial<Record<PanelId, ToySignal>> = {
  'project-scan2scope': scanSignal,
  'project-rule-engine': astSignal,
  'project-space-shooters': shootersSignal,
  'project-hit-the-ball': ballSignal,
  'project-lightsout': cinemaSignal,
  'project-covid': covidSignal,
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

// The projects garage: ten project bays with a toy beside each. Six sit in two rows on either side
// of the boulevard; the four 2022 projects have a row of their own along the 2022 street.
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
      <SpaceShootersToy position={[TOYS_2022.shooters.x, 0, TOYS_2022.shooters.z]} />
      <HitTheBallToy position={[TOYS_2022.ball.x, 0, TOYS_2022.ball.z]} />
      <DriveInToy position={[TOYS_2022.cinema.x, 0, TOYS_2022.cinema.z]} />
      <CovidToy position={[TOYS_2022.covid.x, 0, TOYS_2022.covid.z]} />
      <StreetSign position={[23.0, 0, -20.3]} text="2022" />
      <StreetSign position={[-28.4, 0, -20.3]} text="2022" />
      <Props />
      <GarageProps />
      {INSPECT && <InspectTeleport />}
    </ZoneFrame>
  );
}
