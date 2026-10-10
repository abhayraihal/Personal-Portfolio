import { useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { ConeCollider, CuboidCollider, CylinderCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { InstancedRigidBodyProps, RapierRigidBody } from '@react-three/rapier';
import { AdditiveBlending, BoxGeometry, CanvasTexture, Color, ConeGeometry, DoubleSide, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Board } from '../../components/Board.tsx';
import { Label } from '../../components/Label.tsx';
import { Model, modelScale, useMerged } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { Resettable } from '../../components/Resettable.tsx';
import { COLORS } from '../../config/palette.ts';
import { paper, profile } from '../../data/profile.ts';
import { playSound } from '../../state/events.ts';
import { cylinder, mergeParts, roundedBox } from './boxes.ts';
import { glowTexture, ordinal, wrap } from './geometry.ts';
import { Y } from './Ground.tsx';
import { RESEARCH } from './layout.ts';
import { BoardNightWash, boardFace, NightWash } from './Night.tsx';
import { useHomeReset } from './useHomeReset.ts';

// Board text, all derived from profile.ts.
const VENUE = paper.venue.split(',')[0]; // 'ICPR 2024 · Springer LNCS'
const AUTHOR_POS = paper.authors.indexOf(profile.name) + 1;
const CO_AUTHOR = `Co-author, ${ordinal(AUTHOR_POS)} of ${paper.authors.length}`;
const RESULT = wrap(paper.result, 37);
const BOARD_LINES = [VENUE, CO_AUTHOR, ...RESULT];
const BOARD_W = 7.4;
const BOARD_LIFT = 0.9; // low, so its top edge stays under the photo easel behind it
const BOARD_FACE = boardFace({ width: BOARD_W, lines: BOARD_LINES.length, lift: BOARD_LIFT });

const F = RESEARCH.field;
const HALF = ((F.n - 1) * F.step) / 2;
const cell = (row: number, col: number): [number, number] => [-HALF + col * F.step, -HALF + row * F.step];
// Serpentine scan order over the grid.
const SCAN: [number, number][] = Array.from({ length: F.n * F.n }, (_, k) => {
  const row = Math.floor(k / F.n);
  const col = row % 2 === 0 ? k % F.n : F.n - 1 - (k % F.n);
  return [row, col];
});

const CONE_S = 1.4;
const BARREL_S = 1;
const CELL_SECONDS = 0.3;
const LOCK_SECONDS = 5;
const MAST: [number, number, number] = [RESEARCH.mast[0] - F.cx, 5.9, RESEARCH.mast[1] - F.cz];
const SCAN_COLOR = new Color('#bfe8ff');
const LOCK_COLOR = new Color('#ff3d5a');
const OK_GREEN = '#2e8b57';
const ALERT_RED = '#d6334f';

// Corner brackets of a box, merged into one geometry: what a detector draws around a find.
function bracketGeometry(w: number, h: number, d: number, arm: number, t: number) {
  const parts: BoxGeometry[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = (sx * w) / 2, cy = (sy * h) / 2, cz = (sz * d) / 2;
    const bx = new BoxGeometry(arm, t, t);
    bx.translate(cx - (sx * arm) / 2, cy, cz);
    const by = new BoxGeometry(t, arm, t);
    by.translate(cx, cy - (sy * arm) / 2, cz);
    const bz = new BoxGeometry(t, t, arm);
    bz.translate(cx, cy, cz - (sz * arm) / 2);
    parts.push(bx, by, bz);
  }
  return mergeGeometries(parts);
}

// Vertical fade for the light beam: bright at the ground, clear at the lamp.
let beamTex: CanvasTexture | null = null;
function beamTexture() {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  beamTex = new CanvasTexture(c);
  beamTex.colorSpace = SRGBColorSpace;
  return beamTex;
}

const _v = new Vector3();
const _head = new Vector3();
const _dir = new Vector3();
const _down = new Vector3(0, -1, 0);
const _q = new Quaternion();
const _inv = new Matrix4();
const _c = new Color();

function AnomalyField() {
  const cone = useMerged('traffic-cone');
  const coneGeo = useMemo(() => {
    const k = modelScale('traffic-cone') * CONE_S;
    return cone.geometry.clone().scale(k, k, k);
  }, [cone.geometry]);
  const instances = useMemo<InstancedRigidBodyProps[]>(() => {
    const list: InstancedRigidBodyProps[] = [];
    for (let r = 0; r < F.n; r++) for (let c = 0; c < F.n; c++) {
      if (r === F.odd[0] && c === F.odd[1]) continue;
      const [x, z] = cell(r, c);
      list.push({ key: `cone-${r}-${c}`, position: [x, 0, z] });
    }
    return list;
  }, []);
  const bodies = useRef<(RapierRigidBody | null)[]>(null);
  useHomeReset(bodies);

  const field = useRef<Group>(null);
  const barrel = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const spot = useRef<Mesh>(null);
  const box = useRef<Group>(null);
  const found = useRef<Group>(null);
  const clear = useRef<Group>(null);
  const brackets = useMemo(() => bracketGeometry(1.35, 1.7, 1.35, 0.38, 0.08), []);
  const mastGeo = useMemo(() => mergeParts([
    { geo: cylinder(0.11, 0.16, MAST[1] - 0.3), color: COLORS.inkSoft, position: [MAST[0], (MAST[1] - 0.3) / 2, MAST[2]] },
    { geo: cylinder(0.45, 0.55, 0.3, 12), color: '#9aa0ad', position: [MAST[0], 0.15, MAST[2]] },
  ]), []);
  const glow = useMemo(glowTexture, []);
  const fade = useMemo(beamTexture, []);
  const st = useRef({ mode: 'scan' as 'scan' | 'lock', t: 0, lockT: 0, inGrid: true, flip: 0, target: new Vector3(-HALF, 0, -HALF), mix: 0, boxS: 0, ready: false });

  useLayoutEffect(() => {
    const g = field.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    _inv.copy(g.matrixWorld).invert();
    st.current.ready = true;
  }, []);

  useFrame((_, delta) => {
    const s = st.current;
    const b = barrel.current;
    if (!s.ready || !b) return;
    const dt = Math.min(delta, 0.1);
    // Barrel position in the field frame.
    b.getWorldPosition(_v).applyMatrix4(_inv);
    const bx = _v.x, by = _v.y, bz = _v.z;
    const margin = F.step * 0.6;
    const nowIn = Math.abs(bx) < HALF + margin && Math.abs(bz) < HALF + margin && by < 1.2;
    // Debounced, so a barrel rocking on the edge of the grid does not flicker the sign.
    s.flip = nowIn === s.inGrid ? 0 : s.flip + dt;
    if (s.flip > 0.35) {
      s.flip = 0;
      s.inGrid = nowIn;
      if (found.current) found.current.visible = nowIn;
      if (clear.current) clear.current.visible = !nowIn;
      if (!nowIn) {
        s.mode = 'scan';
        playSound('coin', 0.6);
      }
    }
    const inGrid = s.inGrid;
    const nearRow = Math.round((bz + HALF) / F.step);
    const nearCol = Math.round((bx + HALF) / F.step);

    if (s.mode === 'scan') {
      const prev = Math.floor(s.t);
      s.t += dt / CELL_SECONDS;
      const k = Math.floor(s.t) % SCAN.length;
      const [r0, c0] = SCAN[k];
      const [r1, c1] = SCAN[(k + 1) % SCAN.length];
      const f = s.t - Math.floor(s.t);
      const e = f * f * (3 - 2 * f);
      const [x0, z0] = cell(r0, c0);
      const [x1, z1] = cell(r1, c1);
      const follow = 1 - Math.exp(-dt * 14);
      s.target.x += (x0 + (x1 - x0) * e - s.target.x) * follow;
      s.target.z += (z0 + (z1 - z0) * e - s.target.z) * follow;
      if (Math.floor(s.t) !== prev && inGrid && r0 === nearRow && c0 === nearCol) {
        s.mode = 'lock';
        s.lockT = 0;
      }
    } else {
      s.lockT += dt;
      s.target.x += (bx - s.target.x) * (1 - Math.exp(-dt * 10));
      s.target.z += (bz - s.target.z) * (1 - Math.exp(-dt * 10));
      if (s.lockT > LOCK_SECONDS) {
        s.mode = 'scan';
        s.t = Math.floor(s.t) + 1;
      }
    }
    const locked = s.mode === 'lock';
    s.mix += ((locked ? 1 : 0) - s.mix) * (1 - Math.exp(-dt * 6));
    _c.copy(SCAN_COLOR).lerp(LOCK_COLOR, s.mix);

    // Aim the lamp head and stretch the beam cone from the lamp to the target.
    _head.set(MAST[0], MAST[1], MAST[2]);
    _dir.subVectors(s.target, _head);
    const dist = _dir.length();
    _dir.normalize();
    if (pivot.current) pivot.current.lookAt(_v.copy(s.target).applyMatrix4(field.current!.matrixWorld));
    if (beam.current) {
      _q.setFromUnitVectors(_down, _dir);
      beam.current.quaternion.copy(_q);
      const r = 0.75 + 0.15 * s.mix;
      beam.current.scale.set(r, dist, r);
      (beam.current.material as MeshBasicMaterial).color.copy(_c).multiplyScalar(0.55);
    }
    if (spot.current) {
      spot.current.position.set(s.target.x, 0.075, s.target.z);
      (spot.current.material as MeshBasicMaterial).color.copy(_c);
    }
    if (box.current) {
      s.boxS += ((locked ? 1 : 0) - s.boxS) * (1 - Math.exp(-dt * 9));
      box.current.visible = s.boxS > 0.02;
      box.current.position.set(bx, Math.max(0, by), bz);
      const pulse = 1 + 0.04 * Math.sin(performance.now() / 160);
      box.current.scale.setScalar((1 + (1 - s.boxS) * 0.9) * pulse);
    }
  });

  const [ox, oz] = cell(F.odd[0], F.odd[1]);
  const beamGeo = useMemo(() => {
    const g = new ConeGeometry(1, 1, 28, 1, true);
    g.translate(0, -0.5, 0); // apex at the origin, base one unit down
    return g;
  }, []);

  return (
    <group ref={field} position={[F.cx, 0, F.cz]}>
      <InstancedRigidBodies
        ref={bodies}
        instances={instances}
        colliders={false}
        linearDamping={0.4}
        angularDamping={0.6}
        colliderNodes={[
          <CuboidCollider key="base" args={[0.5, 0.065, 0.5]} position={[0, 0.065, 0]} density={9} friction={0.8} />,
          <ConeCollider key="cone" args={[0.56, 0.38]} position={[0, 0.69, 0]} density={9} friction={0.8} />,
        ]}
      >
        <instancedMesh args={[coneGeo, cone.material, instances.length]} castShadow receiveShadow frustumCulled={false} />
      </InstancedRigidBodies>

      <Resettable position={[ox, 0, oz]} colliders={false} linearDamping={0.3} angularDamping={0.5}>
        <group ref={barrel}>
          <Model name="barrel-drum" scale={BARREL_S} />
        </group>
        <CylinderCollider args={[0.67, 0.46]} position={[0, 0.67, 0]} density={11} friction={0.7} />
      </Resettable>

      {/* Detector: a mast with a lamp head that sweeps the grid. */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[MAST[1] / 2, 0.2]} position={[MAST[0], MAST[1] / 2, MAST[2]]} />
      </RigidBody>
      <mesh geometry={mastGeo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      <group ref={pivot} position={MAST}>
        {/* lookAt points +Z at the target, so the housing faces +Z. */}
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.5, 0.8]} />
          <meshStandardMaterial color="#e8e2d6" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 16]} />
          <meshBasicMaterial color="#fff6d8" toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={beam} position={MAST} geometry={beamGeo} frustumCulled={false} renderOrder={2}>
        <meshBasicMaterial map={fade} transparent blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} opacity={0.5} />
      </mesh>
      <mesh ref={spot} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[2.1, 2.1]} />
        <meshBasicMaterial map={glow} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={box} visible={false}>
        <mesh geometry={brackets} position={[0, 0.82, 0]}>
          <meshBasicMaterial color={ALERT_RED} toneMapped={false} />
        </mesh>
        <Label font="bodyBold" size={0.42} color={ALERT_RED} outlineWidth={0.035} outlineColor={COLORS.paper} position={[0, 2.05, 0]}>
          anomaly
        </Label>
      </group>

      <StatusSign foundRef={found} clearRef={clear} />
    </group>
  );
}

// Small sign at the front of the field: 'Anomaly found' while the barrel is in the grid.
function StatusSign({ foundRef, clearRef }: { foundRef: RefObject<Group | null>; clearRef: RefObject<Group | null> }) {
  const x = RESEARCH.status[0] - F.cx;
  const z = RESEARCH.status[1] - F.cz;
  const w = 4.1;
  const h = 1.3;
  const lift = 0.75;
  const geo = useMemo(() => mergeParts([
    ...[-1, 1].map((sx) => ({ geo: cylinder(0.07, 0.08, lift, 8), color: COLORS.inkSoft, position: [sx * (w / 2 - 0.3), lift / 2, -0.02] as [number, number, number] })),
    { geo: roundedBox(w, h, 0.16, 0.06), color: COLORS.paper, position: [0, lift + h / 2, 0] },
  ]), []);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w / 2, (h + lift) / 2, 0.12]} position={[0, (h + lift) / 2, 0]} />
      </RigidBody>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <NightWash width={w - 0.16} height={h - 0.16} position={[0, lift + h / 2, 0.083]} />
      <group position={[0, lift + h / 2, 0.09]}>
        <Label size={0.28} color={COLORS.inkSoft} position={[0, 0.3, 0]}>
          Detector
        </Label>
        <group ref={foundRef}>
          <Label font="bodyBold" size={0.48} color={ALERT_RED} position={[0, -0.17, 0]}>
            Anomaly found
          </Label>
        </group>
        <group ref={clearRef} visible={false}>
          <Label font="bodyBold" size={0.48} color={OK_GREEN} position={[0, -0.17, 0]}>
            No anomaly
          </Label>
        </group>
      </group>
    </group>
  );
}

export function Research() {
  return (
    <group name="campus-research">
      <Board
        title={paper.short}
        lines={BOARD_LINES}
        width={BOARD_W}
        titleSize={0.7}
        lineSize={0.38}
        accent={COLORS.iit}
        lift={BOARD_LIFT}
        position={[RESEARCH.board[0], 0, RESEARCH.board[1]]}
      />
      <BoardNightWash face={BOARD_FACE} x={RESEARCH.board[0]} z={RESEARCH.board[1]} />
      <AnomalyField />
      <Pad
        id="campus-paper"
        label="Read the ICPR 2024 paper"
        action={{ kind: 'panel', panel: 'paper' }}
        position={[RESEARCH.pad[0], Y.pad, RESEARCH.pad[1]]}
        radius={2.3}
        icon="Paper"
      />
    </group>
  );
}
