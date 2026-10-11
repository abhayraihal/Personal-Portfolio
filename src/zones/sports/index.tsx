import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { Entrance } from './Entrance.tsx';
import { Football } from './Football.tsx';
import { Ground } from './Ground.tsx';
import { Pitch } from './Pitch.tsx';
import { Bowling } from './Bowling.tsx';
import { Dressing } from './Dressing.tsx';
import { Gaming } from './Gaming.tsx';
import { Mountain } from './Mountain.tsx';
import { BIKE_RACK, BOWL_PAD, FOOTBALL_PAD, POOL, POOL_PAD, PUMP, PUMP_PAD, RUNNING_PAD, SCOREBOARD, TABLE, TABLE_PAD, TENNIS, TENNIS_PAD, TENNIS_SIGN, TREK_PAD, VOLLEY, VOLLEY_PAD } from './plan.ts';
import { PumpTrack } from './PumpTrack.tsx';
import { Pool } from './Pool.tsx';
import { Tennis } from './Tennis.tsx';
import { Volleyball } from './Volleyball.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import { TableTennis } from './TableTennis.tsx';
import { Track } from './Track.tsx';
import { Typing } from './Typing.tsx';
import { VenueSign } from './Venue.tsx';

// The sports park.
export function SportsZone() {
  return (
    <ZoneFrame zone="sports">
      <Ground />
      <Dressing />
      <Entrance />
      <Track />
      <Pitch />
      <Football />
      <Scoreboard position={[SCOREBOARD.x, 0, SCOREBOARD.z]} />
      <VenueSign id="sports-football" title="Football" lines={['Whenever there is a game']} sign={[FOOTBALL_PAD.x, FOOTBALL_PAD.z - 3.4]}
        pad={[FOOTBALL_PAD.x, FOOTBALL_PAD.z]} label="Read about football" icon="Football" />
      <VenueSign id="sports-running" title="Running" lines={['Laps start at the white line']} sign={[RUNNING_PAD.x, RUNNING_PAD.z - 3.4]}
        pad={[RUNNING_PAD.x, RUNNING_PAD.z]} label="Read about running" icon="Running" />
      <TableTennis position={[TABLE.x, 0, TABLE.z]} />
      <VenueSign id="sports-table-tennis" title="Table tennis" lines={['Since joining college']} sign={[TABLE.x, TABLE.z - 3.3]} pad={[TABLE_PAD.x, TABLE_PAD.z]}
        label="Read about table tennis" icon="Table tennis" lift={0.6} />
      <Gaming />
      <Typing />
      <Tennis position={[TENNIS.x, 0, TENNIS.z]} />
      <VenueSign id="sports-tennis" title="Lawn tennis" sign={[TENNIS_SIGN.x, TENNIS_SIGN.z]} pad={[TENNIS_PAD.x, TENNIS_PAD.z]}
        label="Read about lawn tennis" icon="Tennis" />
      <Volleyball position={[VOLLEY.x, 0, VOLLEY.z]} />
      <VenueSign id="sports-volleyball" title="Volleyball" sign={[VOLLEY_PAD.x, VOLLEY_PAD.z - 3.6]} pad={[VOLLEY_PAD.x, VOLLEY_PAD.z]}
        label="Read about volleyball" icon="Volleyball" />
      <PumpTrack position={[PUMP.x, 0, PUMP.z]} rack={[BIKE_RACK.x, 0, BIKE_RACK.z]} yaw={Math.PI / 2} />
      <VenueSign id="sports-cycling" title="Cycling" sign={[PUMP_PAD.x, PUMP_PAD.z - 3.6]} pad={[PUMP_PAD.x, PUMP_PAD.z]}
        label="Read about cycling" icon="Cycling" />
      <Bowling />
      <VenueSign id="sports-bowling" title="Bowling" lines={['Push the ball up the lane']} sign={[BOWL_PAD.x, BOWL_PAD.z - 3.5]} pad={[BOWL_PAD.x, BOWL_PAD.z]}
        label="Read about bowling" icon="Bowling" />
      <Mountain />
      <VenueSign id="sports-trekking" title="Trekking" sign={[TREK_PAD.x, TREK_PAD.z - 3.5]} pad={[TREK_PAD.x, TREK_PAD.z]}
        label="Read about trekking" icon="Trekking" />
      <Pool position={[POOL.x, 0, POOL.z]} />
      <VenueSign id="sports-swimming" title="Swimming" sign={[POOL_PAD.x, POOL_PAD.z - 3.6]} pad={[POOL_PAD.x, POOL_PAD.z]}
        label="Read about swimming" icon="Swimming" />
    </ZoneFrame>
  );
}
