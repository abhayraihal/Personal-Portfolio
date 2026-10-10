import { useEffect, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { BOUNDS, ROADS, ROUNDABOUT, STREAM, ZONES } from '../../config/layout.ts';
import type { ZoneDef } from '../../config/layout.ts';
import { COLORS } from '../../config/palette.ts';
import { screenDirForYaw } from '../../config/world.ts';
import { car } from '../../state/car.ts';
import { useStore } from '../../state/store.ts';
import { ChevronIcon, MapIcon } from '../icons.tsx';
import { COARSE, WIDE, blurAfterPointer, useMediaQuery } from '../lib.ts';
import { teleportTo } from '../teleport.ts';
import { useUi } from '../uiStore.ts';

// The layout in screen space maps straight onto the SVG: u to the right, v up (SVG y = -v).
const VIEW = `${BOUNDS.u0} ${-BOUNDS.v1} ${BOUNDS.u1 - BOUNDS.u0} ${BOUNDS.v1 - BOUNDS.v0}`;
const points = (list: [number, number][]) => list.map(([u, v]) => `${u},${-v}`).join(' ');
const RAD2DEG = 180 / Math.PI;

// Label anchor per zone (screen metres from the centre), nudged off roads and the spawn point.
const LABEL_NUDGE: Partial<Record<ZoneDef['id'], [number, number]>> = {
  hub: [28, -2],
  career: [0, 4],
  ridge: [-30, 12],
};

function ZoneMark({ zone, visited, current, onPick }: { zone: ZoneDef; visited: boolean; current: boolean; onPick: (z: ZoneDef) => void }) {
  const a = zone.area;
  const [nu, nv] = LABEL_NUDGE[zone.id] ?? [0, 0];
  const cx = zone.center[0] + nu;
  const cy = -(zone.center[1] + nv);
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(zone);
    }
  };
  return (
    <g
      className="mm-zone"
      data-current={current || undefined}
      role="button"
      tabIndex={0}
      aria-label={`Go to ${zone.title}, key ${zone.key}${visited ? ', visited' : ''}`}
      onClick={() => onPick(zone)}
      onKeyDown={onKey}
      style={{ '--zone': zone.color } as CSSProperties}
    >
      {a.kind === 'circle' ? (
        <circle className="mm-zone__area" cx={a.u} cy={-a.v} r={a.r} />
      ) : (
        <rect className="mm-zone__area" x={a.u0} y={-a.v1} width={a.u1 - a.u0} height={a.v1 - a.v0} rx="8" />
      )}
      <g className="mm-zone__badge" transform={`translate(${cx} ${cy - 11})`}>
        <circle r="10" />
        <text y="0.5" dominantBaseline="middle" textAnchor="middle">
          {zone.key}
        </text>
        {visited && (
          <g className="mm-zone__tick" transform="translate(9.5 -8.5)">
            <circle r="6" />
            <path d="M-2.9 0.2 L-0.8 2.3 L3.1 -2" />
          </g>
        )}
      </g>
      <text className="mm-zone__label" x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle">
        {zone.title}
      </text>
    </g>
  );
}

// Expanded by default on wide, tall enough screens with a mouse; a pill button on phones, tablets
// and narrow or short windows, where the open map would cover too much of the valley.
const ROOMY = '(min-width: 1000px) and (min-height: 700px)';

export function useMapOpen(): boolean {
  const coarse = useMediaQuery(COARSE);
  const roomy = useMediaQuery(ROOMY);
  const choice = useUi((s) => s.map);
  return choice ?? (roomy && !coarse);
}

export function Minimap() {
  const coarse = useMediaQuery(COARSE);
  const wide = useMediaQuery(WIDE);
  const open = useMapOpen();
  const visited = useStore((s) => s.visited);
  const zone = useStore((s) => s.zone);
  const carRef = useRef<SVGGElement>(null);

  // The car arrow follows the telemetry every animation frame (every third on the low quality
  // tier), without React renders.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let frame = 0;
    let lastU = NaN;
    let lastV = NaN;
    let lastYaw = NaN;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const g = carRef.current;
      if (!g) return;
      if (useStore.getState().quality === 'low' && frame++ % 3 !== 0) return;
      if (!car.ready) {
        g.setAttribute('visibility', 'hidden');
        return;
      }
      if (Math.abs(car.u - lastU) < 0.05 && Math.abs(car.v - lastV) < 0.05 && Math.abs(car.yaw - lastYaw) < 0.005) return;
      lastU = car.u;
      lastV = car.v;
      lastYaw = car.yaw;
      const [du, dv] = screenDirForYaw(car.yaw);
      const angle = Math.atan2(-dv, du) * RAD2DEG;
      g.setAttribute('visibility', 'visible');
      g.setAttribute('transform', `translate(${car.u.toFixed(2)} ${(-car.v).toFixed(2)}) rotate(${angle.toFixed(1)})`);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const pick = (z: ZoneDef) => {
    teleportTo(z.id);
    if (coarse || !wide) useUi.getState().setMap(false, false);
  };

  return (
    <section className="minimap" data-open={open} aria-label="Map">
      <button
        type="button"
        className="minimap__toggle"
        aria-expanded={open}
        aria-controls="minimap-body"
        onClick={(e) => {
          useUi.getState().setMap(!open);
          blurAfterPointer(e);
        }}
      >
        <MapIcon />
        <span className="minimap__title">Map</span>
        <span className="minimap__keys">{open ? 'Click a zone or press 1 to 7' : '1 to 7'}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="minimap__body" id="minimap-body">
          <svg className="minimap__svg" viewBox={VIEW} role="group" aria-label="Zones. Choose one to drive there.">
            <rect className="mm-ground" x={BOUNDS.u0} y={-BOUNDS.v1} width={BOUNDS.u1 - BOUNDS.u0} height={BOUNDS.v1 - BOUNDS.v0} rx="14" />
            <polyline className="mm-stream" points={points(STREAM.points)} strokeWidth={STREAM.width} stroke={COLORS.water} />
            {ROADS.map((r) => (
              <polyline key={r.id} className="mm-road" points={points(r.points)} strokeWidth={r.width} stroke={r.kind === 'asphalt' ? COLORS.road : COLORS.dirt} />
            ))}
            <circle className="mm-road" cx={ROUNDABOUT.u} cy={-ROUNDABOUT.v} r={ROUNDABOUT.r} strokeWidth={ROUNDABOUT.width} stroke={COLORS.road} />
            {ZONES.map((z) => (
              <ZoneMark key={z.id} zone={z} visited={visited.includes(z.id)} current={zone === z.id} onPick={pick} />
            ))}
            <g ref={carRef} className="mm-car" visibility="hidden">
              <circle r="9" />
              <path d="M8.4 0 L-5.5 -6 L-2.6 0 L-5.5 6 Z" />
            </g>
          </svg>
        </div>
      )}
    </section>
  );
}
