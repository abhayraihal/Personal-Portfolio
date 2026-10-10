import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { panels } from '../../data/profile.ts';
import { Sign } from '../career/kit/sign.tsx';
import { Football } from './Football.tsx';
import { Pitch } from './Pitch.tsx';
import { PAD, SCOREBOARD, SIGN, TABLE } from './plan.ts';
import { Scoreboard } from './Scoreboard.tsx';
import { TableTennis } from './TableTennis.tsx';

const GREEN = ZONE_BY_ID.sports.color;

// Short lines from the sports panel in profile.ts.
const SIGN_LINES = ['Football whenever there is a game', 'Table tennis since joining college'];

// The sports ground: a small pitch with a physics football, goal sensors and a scoreboard, and a
// table-tennis table that plays itself.
export function SportsZone() {
  return (
    <ZoneFrame zone="sports">
      <Pitch />
      <Football />
      <Scoreboard position={[SCOREBOARD.x, 0, SCOREBOARD.z]} />
      <TableTennis position={[TABLE.x, 0, TABLE.z]} />
      <Sign title={panels.sports.title} lines={SIGN_LINES} width={7.4} titleSize={0.6} lineSize={0.4} accent={GREEN}
        position={[SIGN.x, 0, SIGN.z]} />
      <Pad id="sports-ground" label="Read about sports" action={{ kind: 'panel', panel: 'sports' }} position={[PAD.x, 0, PAD.z]} color={GREEN} icon="Sports" />
    </ZoneFrame>
  );
}
