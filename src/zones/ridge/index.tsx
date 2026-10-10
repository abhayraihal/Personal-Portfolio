import { Board } from '../../components/Board.tsx';
import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { contests } from '../../data/codeforces.ts';
import { RatingLabels, YearStones } from './Axis.tsx';
import { Dressing } from './Dressing.tsx';
import { Gates } from './Gates.tsx';
import { RANK_SHADE } from './geometry.ts';
import { Histogram } from './Histogram.tsx';
import { Platforms } from './Platforms.tsx';
import { DS, FRAME_OFFSET, N, monthYear } from './profile.ts';
import { RailPosts } from './Rails.tsx';
import { RidgeLand } from './RidgeLand.tsx';
import { RidgeLogic } from './RidgeLogic.tsx';
import { Summit } from './Summit.tsx';
import { TagSign } from './TagSign.tsx';

// The Codeforces rating ridge: a road whose height is the rating after each of the 84 rated
// contests, climbing from the end of the approach road to a summit plaza at 1719. The stats yard
// at its foot has the solved-by-rating histogram, the most-solved tags and the other platforms.
export function RidgeZone() {
  return (
    <ZoneFrame zone="ridge">
      <group position={FRAME_OFFSET}>
        <RidgeLand />
        <RailPosts />
        <Gates />
        <Summit />
        <YearStones />
        <RatingLabels />
        <Dressing />
        <Histogram />
        <TagSign position={[2.5, 0, 10.5]} />
        <Platforms position={[-58, 0, 10.2]} />
        <Pad id="ridge-codeforces" label="Open Codeforces stats" action={{ kind: 'panel', panel: 'codeforces' }} position={[-21, 0, 14.6]} icon="Codeforces" color={RANK_SHADE.Expert} />
        <Board
          title="Rating ridge"
          lines={['Height = rating after each contest', `${N} contests, ${monthYear(contests[0].date)} to ${monthYear(contests[N - 1].date)}`, `One contest every ${DS} m`]}
          width={7.6}
          titleSize={0.72}
          lineSize={0.38}
          accent={RANK_SHADE.Expert}
          position={[-4, 0, -9.5]}
        />
        <RidgeLogic />
      </group>
    </ZoneFrame>
  );
}
