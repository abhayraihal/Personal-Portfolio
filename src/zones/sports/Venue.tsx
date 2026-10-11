import { Pad } from '../../components/Pad.tsx';
import { ZONE_BY_ID } from '../../config/layout.ts';
import type { PanelId } from '../../data/profile.ts';
import { Sign } from '../career/kit/sign.tsx';

const GREEN = ZONE_BY_ID.sports.color;

export type VenueSignProps = {
  id: string; // pad id, unique in the world
  title: string;
  lines?: string[];
  sign: [number, number]; // x, z of the sign
  pad: [number, number];
  panel?: PanelId;
  label: string; // pad prompt
  icon: string; // painted on the pad
  accent?: string;
  width?: number;
  padRadius?: number;
  lift?: number;
};

// A venue's name board on two posts, and the pad in front of it that opens a panel.
export function VenueSign({ id, title, lines = [], sign, pad, panel = 'sports', label, icon, accent = GREEN, width, padRadius = 2.3, lift = 1.0 }: VenueSignProps) {
  const longest = Math.max(title.length * 0.36, ...lines.map((l) => l.length * 0.2));
  return (
    <>
      <Sign title={title} lines={lines} width={width ?? Math.max(3.2, longest + 1)} titleSize={0.62} lineSize={0.36} accent={accent} lift={lift}
        position={[sign[0], 0, sign[1]]} />
      <Pad id={id} label={label} icon={icon} action={{ kind: 'panel', panel }} position={[pad[0], 0, pad[1]]} radius={padRadius} color={accent} />
    </>
  );
}
