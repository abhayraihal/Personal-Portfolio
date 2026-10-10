import { useMemo } from 'react';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { ContactPost } from './ContactPost.tsx';
import { Credits } from './Credits.tsx';
import { Decor } from './Decor.tsx';
import { FloorText } from './FloorText.tsx';
import { HomeGroup, useHomeGroup } from './homes.ts';
import { Keycaps } from './Keycaps.tsx';
import { TOUCH } from './layout.ts';
import { NameLetters } from './NameLetters.tsx';
import { PhotoBoard } from './PhotoBoard.tsx';
import { Roundabout } from './Roundabout.tsx';
import { SkillWall } from './SkillWall.tsx';

// The start area: name letters to knock over, painted controls, photo, skill wall, contact post,
// and the roundabout signposts.
export function HubZone() {
  const letters = useMemo(() => new HomeGroup({ idleSeconds: 4, carClear: 9 }), []);
  const bricks = useMemo(() => new HomeGroup({ idleSeconds: 4, carClear: 9 }), []);
  useHomeGroup(letters);
  useHomeGroup(bricks);
  return (
    <ZoneFrame zone="hub">
      <NameLetters group={letters} />
      <FloorText />
      {!TOUCH && <Keycaps />}
      <PhotoBoard />
      <SkillWall group={bricks} />
      <ContactPost />
      <Credits />
      <Roundabout />
      <Decor />
    </ZoneFrame>
  );
}
