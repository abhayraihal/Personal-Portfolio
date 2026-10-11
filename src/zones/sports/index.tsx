import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { Entrance } from './Entrance.tsx';
import { Football } from './Football.tsx';
import { Ground } from './Ground.tsx';
import { Mock } from './Mock.tsx';
import { Pitch } from './Pitch.tsx';
import { FOOTBALL_PAD, POOL, POOL_PAD, RUNNING_PAD, SCOREBOARD, TABLE, TENNIS, TENNIS_PAD, VOLLEY, VOLLEY_PAD } from './plan.ts';
import { Pool } from './Pool.tsx';
import { Tennis } from './Tennis.tsx';
import { Volleyball } from './Volleyball.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import { TableTennis } from './TableTennis.tsx';
import { Track } from './Track.tsx';
import { VenueSign } from './Venue.tsx';

// The sports park.
export function SportsZone() {
  return (
    <ZoneFrame zone="sports">
      <Ground />
      <Entrance />
      <Track />
      <Pitch />
      <Football />
      <Scoreboard position={[SCOREBOARD.x, 0, SCOREBOARD.z]} />
      <VenueSign id="sports-football" title="Football" lines={['Whenever there is a game']} sign={[FOOTBALL_PAD.x, FOOTBALL_PAD.z - 3.4]}
        pad={[FOOTBALL_PAD.x, FOOTBALL_PAD.z]} label="Read about football" icon="Football" />
      <VenueSign id="sports-running" title="Running" lines={['The clock starts at the white line']} sign={[RUNNING_PAD.x, RUNNING_PAD.z - 3.4]}
        pad={[RUNNING_PAD.x, RUNNING_PAD.z]} label="Read about running" icon="Running" />
      <TableTennis position={[TABLE.x, 0, TABLE.z]} />
      <Tennis position={[TENNIS.x, 0, TENNIS.z]} />
      <VenueSign id="sports-tennis" title="Lawn tennis" sign={[TENNIS_PAD.x, TENNIS_PAD.z - 3.6]} pad={[TENNIS_PAD.x, TENNIS_PAD.z]}
        label="Read about lawn tennis" icon="Tennis" />
      <Volleyball position={[VOLLEY.x, 0, VOLLEY.z]} />
      <VenueSign id="sports-volleyball" title="Volleyball" sign={[VOLLEY_PAD.x, VOLLEY_PAD.z - 3.6]} pad={[VOLLEY_PAD.x, VOLLEY_PAD.z]}
        label="Read about volleyball" icon="Volleyball" />
      <Pool position={[POOL.x, 0, POOL.z]} />
      <VenueSign id="sports-swimming" title="Swimming" sign={[POOL_PAD.x, POOL_PAD.z - 3.6]} pad={[POOL_PAD.x, POOL_PAD.z]}
        label="Read about swimming" icon="Swimming" />
      <Mock />
    </ZoneFrame>
  );
}
