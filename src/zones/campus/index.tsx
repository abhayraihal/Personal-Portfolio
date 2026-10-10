import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { Buildings } from './Buildings.tsx';
import { Easel } from './Easel.tsx';
import { Ground } from './Ground.tsx';
import { Lamps } from './Lamps.tsx';
import { Nature } from './Nature.tsx';
import { Podium } from './Podium.tsx';
import { Research } from './Research.tsx';
import { School } from './School.tsx';
import { Trail } from './Trail.tsx';

// IIT Mandi campus: a loop road round a lawn, with the institute blocks at the back and one
// station per part of Abhay's time there (degree, paper, hackathons, biking club, school).
export function CampusZone() {
  return (
    <ZoneFrame zone="campus">
      <Ground />
      <Buildings />
      <Nature />
      <Lamps />
      <Easel />
      <Research />
      <Podium />
      <School />
      <Trail />
    </ZoneFrame>
  );
}
