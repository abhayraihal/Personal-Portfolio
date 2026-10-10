import { useRef } from 'react';
import type { Group } from 'three';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { Floor } from './Floor.tsx';
import { useInspect } from './inspect.ts';
import { useStaticMerge } from './merge.tsx';
import { STATIONS } from './layout.ts';
import type { StationId } from './layout.ts';
import { Office } from './Office.tsx';
import { Parcels } from './Parcels.tsx';
import { NightPaper } from './parts.tsx';
import { Props } from './Props.tsx';
import { Station } from './Station.tsx';
import type { ToySpec } from './Station.tsx';
import { Trophy } from './Trophy.tsx';
import { connectorsToy } from './toys/Connectors.tsx';
import { migrationToy } from './toys/Migration.tsx';
import { oncallAgentToy } from './toys/OncallAgent.tsx';
import { oncallPeakToy } from './toys/OncallPeak.tsx';
import { retentionToy } from './toys/Retention.tsx';
import { rewardsToy } from './toys/Rewards.tsx';

const TOYS: Record<StationId, ToySpec> = {
  'amazon-rewards': rewardsToy,
  'amazon-oncall-agent': oncallAgentToy,
  'amazon-migration': migrationToy,
  'amazon-retention': retentionToy,
  'amazon-connectors': connectorsToy,
  'amazon-oncall': oncallPeakToy,
};

// Amazon plaza: the office at the back, the hackathon trophy in the middle and one exhibit per
// resume bullet around a promenade ring. See layout.ts for the plan.
export function AmazonZone() {
  useInspect();
  const root = useRef<Group>(null);
  useStaticMerge(root);
  return (
    <ZoneFrame zone="amazon">
      <group ref={root}>
        <NightPaper />
        <Floor />
        <Office />
        <Trophy />
        <Props />
        <Parcels />
        {STATIONS.map((def) => (
          <Station key={def.id} def={def} toy={TOYS[def.id]} />
        ))}
      </group>
    </ZoneFrame>
  );
}
