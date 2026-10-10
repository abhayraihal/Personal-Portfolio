import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three';
import { modelScale, useMerged } from '../../components/Model.tsx';
import type { ModelName } from '../../config/models.ts';
import { useStore } from '../../state/store.ts';

// Night lighting for the campus signs and blocks. Everything here is unlit and only shown when
// store.night is on.

// Text that lies on unlit ground switches to this at night (with a dark outline).
export const NIGHT_TEXT = { color: '#ffe2a0', outline: '#2a2312' };

// Label colour props: `day` by day, NIGHT_TEXT with an outline `outline` m wide at night.
export const nightLabel = (night: boolean, day: string, outline: number) => ({
  color: night ? NIGHT_TEXT.color : day,
  outlineWidth: night ? outline : 0,
  outlineColor: NIGHT_TEXT.outline,
});

const WASH_BOTTOM = [0.9, 0.74, 0.5]; // linear RGB: warm near the ground lights
const WASH_TOP = [0.62, 0.5, 0.34];

// A floodlit sign face: an unlit plane just in front of the face, brighter at the bottom.
export function NightWash({ width, height, position }: { width: number; height: number; position: [number, number, number] }) {
  const night = useStore((s) => s.night);
  const geo = useMemo(() => {
    const g = new PlaneGeometry(width, height);
    g.setAttribute('color', new Float32BufferAttribute([...WASH_TOP, ...WASH_TOP, ...WASH_BOTTOM, ...WASH_BOTTOM], 3));
    return g;
  }, [width, height]);
  return (
    <mesh geometry={geo} position={position} visible={night}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  );
}

// Face of a <Board> without an image, from the same constants as components/Board.tsx.
export function boardFace({ width, lines, title = true, titleSize = 0.7, lineSize = 0.38, lift = 1.2 }: {
  width: number; lines: number; title?: boolean; titleSize?: number; lineSize?: number; lift?: number;
}) {
  const height = 0.8 + (title ? titleSize * 1.3 : 0) + lines * lineSize * 1.45;
  return { width, height, centreY: lift + height / 2, front: 0.11 };
}

// Wash for a board face, kept clear of the rounded edges and the accent strip along the top.
export function BoardNightWash({ face, x = 0, z = 0 }: { face: ReturnType<typeof boardFace>; x?: number; z?: number }) {
  return <NightWash width={face.width - 0.22} height={face.height - 0.26} position={[x, face.centreY - 0.03, z + face.front + 0.003]} />;
}

// Glass panes of a city-kit-suburban building (the light blue cell of the kit's colormap).
const GLASS = { u0: 0.6875, u1: 0.75, v0: 0.25, v1: 0.5 };
const PUSH = 0.003; // native units off the glass, so the lit pane never z-fights it

function glassGeometry(src: BufferGeometry): BufferGeometry {
  const pos = src.getAttribute('position');
  const nrm = src.getAttribute('normal');
  const uv = src.getAttribute('uv');
  const out: number[] = [];
  for (let t = 0; t + 2 < pos.count; t += 3) {
    const u = (uv.getX(t) + uv.getX(t + 1) + uv.getX(t + 2)) / 3;
    const v = (uv.getY(t) + uv.getY(t + 1) + uv.getY(t + 2)) / 3;
    if (u < GLASS.u0 || u >= GLASS.u1 || v < GLASS.v0 || v >= GLASS.v1) continue;
    for (let k = t; k < t + 3; k++) out.push(pos.getX(k) + nrm.getX(k) * PUSH, pos.getY(k) + nrm.getY(k) * PUSH, pos.getZ(k) + nrm.getZ(k) * PUSH);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out, 3));
  g.computeBoundingSphere();
  return g;
}

// Lit windows for a building drawn with <Model name={name} scale={...}> at the same origin.
export function NightWindows({ name, scale }: { name: ModelName; scale: number }) {
  const night = useStore((s) => s.night);
  const { geometry } = useMerged(name);
  const glass = useMemo(() => glassGeometry(geometry), [geometry]);
  return (
    <mesh geometry={glass} scale={modelScale(name) * scale} visible={night}>
      <meshBasicMaterial color="#ffc96b" toneMapped={false} />
    </mesh>
  );
}
