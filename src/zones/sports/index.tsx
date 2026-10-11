import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { Football } from './Football.tsx';
import { Ground } from './Ground.tsx';
import { Mock } from './Mock.tsx';
import { Pitch } from './Pitch.tsx';
import { SCOREBOARD, TABLE } from './plan.ts';
import { Scoreboard } from './Scoreboard.tsx';
import { TableTennis } from './TableTennis.tsx';
import { Track } from './Track.tsx';

// The sports park.
export function SportsZone() {
  return (
    <ZoneFrame zone="sports">
      <Ground />
      <Track />
      <Pitch />
      <Football />
      <Scoreboard position={[SCOREBOARD.x, 0, SCOREBOARD.z]} />
      <TableTennis position={[TABLE.x, 0, TABLE.z]} />
      <Mock />
    </ZoneFrame>
  );
}
