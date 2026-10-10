import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Euler, InstancedBufferAttribute, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { Group, InstancedMesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { modelScale, modelSize, useMerged } from '../../../components/Model.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { TOY_TEXT } from '../copy.ts';
import { M } from '../materials.ts';
import { Static } from '../merge.tsx';
import { Plaque, StationBoard } from '../parts.tsx';
import { useBoxes } from '../geo.ts';
import type { BoxSpec } from '../geo.ts';
import { easeInCubic, easeOutBack, fixBounds, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// A block of 100 crates labelled "stored data". A sweep crosses it and dissolves 96 of them,
// leaving the 4 at the front of the bottom layer.

const NX = 4;
const NZ = 5;
const NY = 5;
const N = NX * NZ * NY; // 100
const S = 0.42; // grid pitch
const CRATE = 0.4; // crate edge, a little under the pitch so neighbours never share a face
const BLOCK = { x: -1.6, z: 0.95 };
const X0 = BLOCK.x - ((NX - 1) * S) / 2;
const Z0 = BLOCK.z - ((NZ - 1) * S) / 2;
const SWEEP_X0 = X0 - 0.6;
const SWEEP_X1 = X0 + (NX - 1) * S + 0.6;
const T_IN = 0.2;
const T_SWEEP = 0.45;
const SWEEP_S = 2.3;
const T_OUT = T_SWEEP + SWEEP_S;
const POP = 0.34;

type Crate = { x: number; y: number; z: number; keep: boolean; t0: number; spin: number };

const OW = NX * S + 0.2;
const OD = NZ * S + 0.2;
const OUTLINE: BoxSpec[] = [
  [0.06, 0.02, OD + 0.06, -OW / 2, 0, 0],
  [0.06, 0.02, OD + 0.06, OW / 2, 0, 0],
  [OW + 0.06, 0.02, 0.06, 0, 0, -OD / 2],
  [OW + 0.06, 0.02, 0.06, 0, 0, OD / 2],
];
const SIGN_LEGS: BoxSpec[] = [
  [0.1, 0.6, 0.1, -1.75, 0.3, -0.06],
  [0.1, 0.6, 0.1, 1.75, 0.3, -0.06],
];

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _c = new Color();
const WHITE = new Color('#ffffff');
const FLASH = new Color('#ffb347');

function RetentionToy({ clock }: ToyProps) {
  const { geometry, material } = useMerged('crate-wood');
  const mesh = useRef<InstancedMesh>(null);
  const sweep = useRef<Group>(null);
  const sign = useRef<Group>(null);
  const fired = useRef(false);
  const sweepMat = useMemo(() => new MeshBasicMaterial({ color: COLORS.amazon, transparent: true, opacity: 0.42, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), []);
  const edgeMat = useMemo(() => new MeshBasicMaterial({ color: '#fff1c9', toneMapped: false }), []);
  useEffect(() => () => {
    sweepMat.dispose();
    edgeMat.dispose();
  }, [sweepMat, edgeMat]);
  const scale = modelScale('crate-wood') * (CRATE / modelSize('crate-wood')[0]);
  const outline = useBoxes(OUTLINE);
  const legs = useBoxes(SIGN_LEGS);

  const crates = useMemo<Crate[]>(() => {
    const list: Crate[] = [];
    for (let iy = 0; iy < NY; iy++)
      for (let iz = 0; iz < NZ; iz++)
        for (let ix = 0; ix < NX; ix++) {
          const x = X0 + ix * S;
          const keep = iy === 0 && iz === NZ - 1; // front row of the bottom layer
          // When the sweep reaches this column, top crates go first, back rows a beat later.
          const reach = T_SWEEP + ((x - SWEEP_X0) / (SWEEP_X1 - SWEEP_X0)) * SWEEP_S;
          list.push({ x, y: iy * S, z: Z0 + iz * S, keep, t0: reach + (NY - 1 - iy) * 0.045 + (NZ - 1 - iz) * 0.02, spin: ((ix * 7 + iz * 3 + iy) % 5) - 2 });
        }
    return list;
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.instanceColor = new InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3);
    fixBounds(m, 3.2, BLOCK.x, 1.2, BLOCK.z);
  }, []);

  useFrame((_, delta) => {
    const dt = frameDt(delta);
    clock.step(dt);
    const t = clock.time;
    const phase = clock.phase;
    if (phase === 'idle') fired.current = false;
    if (phase === 'play' && t >= T_SWEEP && !fired.current) {
      fired.current = true;
      playSound('whoosh', 0.6);
    }
    const m = mesh.current;
    if (m) {
      for (let i = 0; i < N; i++) {
        const c = crates[i];
        let s = 1;
        let lift = 0;
        let spin = 0;
        let flash = 0;
        if (phase === 'rewind') {
          // Crates come back from the bottom up.
          const k = seg(clock.r, (c.y / (NY * S)) * 0.6, (c.y / (NY * S)) * 0.6 + 0.4);
          s = c.keep ? 1 : easeOutBack(k);
        } else if (phase !== 'idle' && !c.keep) {
          const k = seg(t, c.t0, c.t0 + POP);
          s = k < 0.25 ? 1 + k * 0.5 : (1 - easeInCubic((k - 0.25) / 0.75)) * 1.125;
          lift = k * 0.35;
          spin = k * c.spin;
          flash = k > 0 && k < 1 ? 1 - k : 0;
        } else if (phase !== 'idle' && c.keep) {
          flash = Math.sin(Math.PI * seg(t, T_OUT + 0.3, T_OUT + 0.9)) * 0.6;
        }
        const hs = (CRATE / 2) * (1 - s); // shrink about the crate centre
        _p.set(c.x, c.y + hs + lift, c.z);
        _q.setFromEuler(_e.set(0, spin, 0));
        m.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(scale * Math.max(s, 0.0001))));
        m.setColorAt(i, _c.copy(WHITE).lerp(FLASH, flash));
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    const g = sweep.current;
    if (g) {
      const fadeIn = seg(t, T_IN, T_SWEEP);
      const fadeOut = 1 - seg(t, T_OUT, T_OUT + 0.3);
      const on = phase === 'play' ? fadeIn * fadeOut : 0;
      g.visible = on > 0.001;
      g.position.x = SWEEP_X0 + (SWEEP_X1 - SWEEP_X0) * seg(t, T_SWEEP, T_OUT);
      g.scale.set(1, Math.max(0.0001, on), 1);
    }

    const sg = sign.current;
    if (sg) {
      const k = phase === 'play' || phase === 'hold' ? Math.sin(Math.PI * seg(t, T_OUT + 0.2, T_OUT + 0.75)) : 0;
      sg.scale.setScalar(1 + 0.07 * k);
    }
  });

  const sweepH = NY * S + 0.5;
  const sweepD = NZ * S + 0.5;
  return (
    <>
      <StationBoard id="amazon-retention" position={[0, 0, -2.45]} lift={1.0} />
      {/* Outline of the full block, so the 4 left over read against what was there. */}
      <Static>
        <mesh geometry={outline} position={[BLOCK.x, 0.012, BLOCK.z]} material={M.orange} />
      </Static>
      <instancedMesh ref={mesh} args={[geometry, material, N]} castShadow receiveShadow />
      <group ref={sweep} position={[SWEEP_X0, 0, BLOCK.z]} visible={false}>
        {/* A slab, not a plane: the camera looks along -Z, so a plane across X would be edge-on. */}
        <mesh position={[0, sweepH / 2, 0]} material={sweepMat}>
          <boxGeometry args={[0.28, sweepH, sweepD]} />
        </mesh>
        <mesh position={[0, sweepH / 2, sweepD / 2]} material={edgeMat}>
          <boxGeometry args={[0.07, sweepH, 0.05]} />
        </mesh>
        <mesh position={[0, sweepH / 2, -sweepD / 2]} material={edgeMat}>
          <boxGeometry args={[0.07, sweepH, 0.05]} />
        </mesh>
        <mesh position={[0, sweepH, 0]} material={edgeMat}>
          <boxGeometry args={[0.07, 0.07, sweepD + 0.05]} />
        </mesh>
      </group>
      <Static>
        <Plaque text={TOY_TEXT.storedData} size={0.3} position={[BLOCK.x, 0.38, 2.6]} legs={0.16} />
      </Static>

      {/* Result sign: the three numbers from the panel, one per line. */}
      <group ref={sign} position={[1.85, 0, 0.9]}>
        <mesh geometry={legs} material={M.slate} />
        <mesh position={[0, 1.42, -0.06]} material={M.paper}>
          <boxGeometry args={[4.2, 1.68, 0.1]} />
        </mesh>
        <mesh position={[0, 2.2, 0]} material={M.accent}>
          <boxGeometry args={[4.1, 0.08, 0.01]} />
        </mesh>
        <Label size={0.35} color={COLORS.ink} lineHeight={0.47 / 0.35} textAlign="center" position={[0, 1.9 - 0.47 / 2, 0.005]}>
          {TOY_TEXT.retention.slice(0, 2).join('\n')}
        </Label>
        <Label font="bodyBold" size={0.35} color={COLORS.ink} position={[0, 1.9 - 2 * 0.47, 0.005]}>
          {TOY_TEXT.retention[2]}
        </Label>
      </group>
    </>
  );
}

export const retentionToy: ToySpec = { Component: RetentionToy, length: T_OUT + 1.2 };
