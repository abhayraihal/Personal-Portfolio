import { Pad } from '../../components/Pad.tsx';
import { ZoneFrame } from '../../components/ZoneFrame.tsx';
import { COLORS } from '../../config/palette.ts';
import { jobs, panels } from '../../data/profile.ts';
import { AmazonGate } from './AmazonGate.tsx';
import { DeliveryLoop } from './DeliveryLoop.tsx';
import { Gantry } from './Gantry.tsx';
import { Sign } from './kit/sign.tsx';
import { Milestone } from './Milestone.tsx';
import { PLAN, p } from './plan.ts';
import { RedisRace } from './RedisRace.tsx';
import { Roadside } from './Roadside.tsx';

const job = (company: string) => {
  const j = jobs.find((x) => x.company === company);
  if (!j) throw new Error(`career: no job "${company}" in profile.ts`);
  return j;
};
const razorpay = job('Razorpay');
const limeroad = job('Limeroad');
const amazon = job('Amazon');

// Oldest first, in the order you drive past them.
const roadOrder = jobs.toReversed();

// Short lines from the razorpay and limeroad panels in profile.ts.
const RAZORPAY_LINES = ['Admin actions for payouts', 'Mapped the payout code flow', 'Faster data retrieval with Redis', 'Authorization checks'];
const LIMEROAD_LINES = ['mcout: abandoned-cart leads', 'Reworked its edge cases', 'BlueDart logistics integration', 'Create, cancel, track waybills'];

// Milestone, from the education panel: 'B.Tech, ...', 'IIT Mandi', '2020 – 2024'.
const edu = panels.education;
const degree = (edu.kicker ?? '').split(',')[0];
const gradYear = (edu.meta?.[0] ?? '').split('–').pop()?.trim() ?? '';

const HIGHWAY_GREEN = '#1f6b45';

// The career road: Razorpay, a graduation milestone, Limeroad, then the gate into the Amazon plaza.
export function CareerZone() {
  const { start, razorpay: rp, limeroad: lr } = PLAN;
  return (
    <ZoneFrame zone="career">
      <Roadside />

      <Sign title="Career road" lines={roadOrder.map((j) => `${j.company} · ${j.dates}`)} width={7.4} titleSize={0.78} lineSize={0.42}
        color={HIGHWAY_GREEN} textColor="#ffffff" accent="#ffffff" position={p(...start.board)} lift={1.1} />
      <Pad id="career-road" label="Read about my career" action={{ kind: 'panel', panel: 'career' }} position={p(...start.pad)} color={COLORS.accent} icon="Career" />

      <Gantry position={p(0, rp.v)} title={razorpay.company.toUpperCase()} subtitle={`SDE Intern · X Payouts · ${razorpay.dates}`} color={COLORS.razorpay} />
      <Sign title="Razorpay" lines={RAZORPAY_LINES} width={6.8} lineSize={0.4} accent={COLORS.razorpay} position={p(...rp.board)} />
      <Pad id="career-razorpay" label="Read about Razorpay" action={{ kind: 'panel', panel: 'razorpay' }} position={p(...rp.pad)} color={COLORS.razorpay} icon="Razorpay" />
      <RedisRace />

      <Milestone position={p(...PLAN.milestone)} cap={degree} place={edu.title} year={gradYear} />

      <Gantry position={p(0, lr.v)} title={limeroad.company.toUpperCase()} subtitle={`SDE · ${limeroad.dates} · ${limeroad.place}`} color={COLORS.limeroad} />
      <Sign title="Limeroad" lines={LIMEROAD_LINES} width={6.8} lineSize={0.4} accent={COLORS.limeroad} position={p(...lr.board)} />
      <Pad id="career-limeroad" label="Read about Limeroad" action={{ kind: 'panel', panel: 'limeroad' }} position={p(...lr.pad)} color={COLORS.limeroad} icon="Limeroad" />
      <DeliveryLoop />

      <AmazonGate position={p(0, PLAN.amazon.v)} title={amazon.company.toUpperCase()} dates={amazon.dates} />
    </ZoneFrame>
  );
}
