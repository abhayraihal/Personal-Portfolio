import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BallCollider, CuboidCollider, CylinderCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload, InstancedRigidBodyProps, RapierRigidBody } from '@react-three/rapier';
import { BufferAttribute, Color, LatheGeometry, PlaneGeometry, Vector2 } from 'three';
import type { BufferGeometry } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { localToWorld } from '../career/kit/frame.ts';
import type { V3 } from '../career/kit/frame.ts';
import { box, flatMaterial, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { bowlingBallGeometry } from './balls.ts';
import { fixWinding, flatGeometry, rect } from './geom.ts';
import { BOWL, ZONE } from './plan.ts';

// A bowling lane bowled up the screen, with bumper rails, ten physics pins and a big ball for the car
// to push. When the ball reaches the pins the lane waits for them to settle and counts: all ten is
// a strike (confetti, a toast and the win sound) and the strike count on the header goes up (kept in
// localStorage). Pins and ball go back once the car is clear of them.

const PIN = { h: 1.45, r: 0.2, mass: 2.4 };
const BALL_R = 0.62;
const SPACING = 1.12;
const ROW = SPACING * Math.sin(Math.PI / 3);
const SPAWN: V3 = [BOWL.x, BALL_R + 0.02, BOWL.foulZ + 2.6];
const HALF = BOWL.width / 2;
const RAIL = { w: 0.32, h: 0.48 };
const HEADER = { z: BOWL.backZ + 0.75, y: 2.75, w: BOWL.width + 2.1, h: 1.35 };
const STRIKES_KEY = 'sports-strikes';

const PINS: V3[] = [];
for (let k = 0; k < 4; k++) for (let j = 0; j <= k; j++) PINS.push([BOWL.x + (j - k / 2) * SPACING, 0.004, BOWL.headZ - k * ROW]);

function pinGeometry(): BufferGeometry {
  const prof: [number, number][] = [
    [0.0, 0], [0.12, 0], [0.16, 0.08], [0.21, 0.32], [0.22, 0.46], [0.2, 0.62], [0.14, 0.82], [0.095, 0.95], [0.1, 1.04],
    [0.13, 1.17], [0.13, 1.28], [0.1, 1.39], [0.04, 1.45], [0.0, 1.45],
  ];
  const g = new LatheGeometry(prof.map(([r, y]) => new Vector2(r, y)), 16).toNonIndexed();
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const white = new Color('#f7f6f1');
  const red = new Color('#d6313a');
  for (let t = 0; t < pos.count; t += 3) {
    const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
    const c = (y > 0.86 && y < 0.92) || (y > 0.98 && y < 1.04) ? red : white;
    for (let k = 0; k < 3; k++) c.toArray(col, (t + k) * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

function laneGeometry(): BufferGeometry {
  const parts: Part[] = [];
  const len = BOWL.approachZ - BOWL.backZ;
  const mid = (BOWL.approachZ + BOWL.backZ) / 2;
  // Gutters, lane boards, approach, pin deck.
  parts.push(rect(BOWL.x, mid, BOWL.width + 0.9, len, 0.016, '#3b3f48'));
  parts.push(rect(BOWL.x, (BOWL.foulZ + BOWL.backZ + 1.2) / 2, BOWL.width - 0.3, BOWL.foulZ - BOWL.backZ - 1.2, 0.022, '#dcb27c'));
  parts.push(rect(BOWL.x, (BOWL.approachZ + BOWL.foulZ) / 2, BOWL.width + 0.2, BOWL.approachZ - BOWL.foulZ, 0.022, '#e8c995'));
  parts.push(rect(BOWL.x, BOWL.headZ - 1.6, BOWL.width - 0.3, 4.2, 0.024, '#e9cf9e'));
  for (let i = 1; i < 15; i++) {
    const x = BOWL.x - (BOWL.width - 0.3) / 2 + ((BOWL.width - 0.3) * i) / 15;
    parts.push(rect(x, (BOWL.foulZ + BOWL.headZ) / 2, 0.02, BOWL.foulZ - BOWL.headZ, 0.026, '#c99d66'));
  }
  // Foul line, approach dots and the seven aiming arrows.
  parts.push(rect(BOWL.x, BOWL.foulZ, BOWL.width - 0.3, 0.09, 0.028, '#7a1f24'));
  const arrowZ = BOWL.foulZ - 5.2;
  for (let i = -3; i <= 3; i++) {
    const x = BOWL.x + i * 0.55;
    const z = arrowZ + Math.abs(i) * 0.45;
    const tris = [x, z - 0.32, x - 0.12, z + 0.12, x + 0.12, z + 0.12];
    fixWinding(tris);
    parts.push({ geo: flatGeometry(tris, 0.029), color: '#6a3b1e' });
    parts.push({ geo: flatGeometry((() => { const d = [x - 0.05, BOWL.foulZ + 1.1, x + 0.05, BOWL.foulZ + 1.1, x, BOWL.foulZ + 1.2]; fixWinding(d); return d; })(), 0.029), color: '#6a3b1e' });
  }
  // Bumper rails, rounded and striped.
  for (const s of [-1, 1]) {
    const x = BOWL.x + s * (HALF + RAIL.w / 2);
    const railLen = BOWL.foulZ + 1.2 - BOWL.backZ;
    parts.push({ geo: box(RAIL.w, RAIL.h, railLen, 0.12, 2), color: '#2f6fd6', at: [x, RAIL.h / 2, BOWL.backZ + railLen / 2] });
    for (let z = BOWL.backZ + 1.5; z < BOWL.foulZ; z += 2.4) {
      parts.push({ geo: box(RAIL.w + 0.02, RAIL.h + 0.02, 0.5, 0.1, 2), color: '#f2c230', at: [x, RAIL.h / 2, z] });
    }
  }
  // Pit: back cushion, dark backdrop, side towers and the header that hides the pinsetter.
  const W = BOWL.width + 0.9;
  parts.push({ geo: box(W + 1.2, 2.5, 0.3, 0.05), color: '#23262d', at: [BOWL.x, 1.25, BOWL.backZ - 0.15] });
  parts.push({ geo: box(W, 0.9, 0.35, 0.08), color: '#3a2f45', at: [BOWL.x, 0.45, BOWL.backZ + 0.1] });
  for (const s of [-1, 1]) {
    parts.push({ geo: box(0.55, HEADER.y + HEADER.h, 2.4, 0.08), color: '#4a2f8a', at: [BOWL.x + s * (W / 2 + 0.3), (HEADER.y + HEADER.h) / 2, BOWL.backZ + 0.9] });
  }
  parts.push({ geo: box(HEADER.w + 0.3, HEADER.h + 0.2, 0.3, 0.08), color: '#4a2f8a', at: [BOWL.x, HEADER.y + HEADER.h / 2, HEADER.z] });
  return paint(parts);
}

type Phase = 'ready' | 'rolling' | 'settle' | 'show';

function loadStrikes(): number {
  try {
    return Number(localStorage.getItem(STRIKES_KEY)) || 0;
  } catch {
    return 0;
  }
}

type TextMesh = { text: string; sync: () => void };

export function Bowling() {
  const low = useStore((s) => s.quality === 'low');
  const lane = useMemo(laneGeometry, []);
  const pinGeo = useMemo(pinGeometry, []);
  const ballGeo = useMemo(() => bowlingBallGeometry(BALL_R), []);
  const headerFace = useMemo(() => paint([
    { geo: new PlaneGeometry(HEADER.w - 0.1, HEADER.h - 0.12), color: '#2b1d4f', at: [BOWL.x, HEADER.y + HEADER.h / 2, HEADER.z + 0.155] },
    { geo: new PlaneGeometry(HEADER.w - 0.1, 0.1), color: '#f2c230', at: [BOWL.x, HEADER.y + 0.12, HEADER.z + 0.16] },
  ]), []);
  const pins = useRef<(RapierRigidBody | null)[]>([]);
  const ball = useRef<RapierRigidBody>(null);
  const strikesText = useRef<TextMesh | null>(null);
  const instances = useMemo<InstancedRigidBodyProps[]>(() => PINS.map((p, i) => ({ key: i, position: p })), []);
  const st = useRef({
    phase: 'ready' as Phase, t: 0, check: 0, idle: 0, ballHit: false, strikes: loadStrikes(),
    home: null as { x: number; y: number; z: number }[] | null, ballHome: null as { x: number; y: number; z: number } | null,
  });
  const [deckX, deckZ] = useMemo(() => localToWorld(ZONE, BOWL.x, BOWL.headZ - ROW * 1.5), []);
  const [foulWX, foulWZ] = useMemo(() => localToWorld(ZONE, BOWL.x, BOWL.foulZ), []);
  // Unit vector up the lane, in world space.
  const [upX, upZ] = useMemo(() => {
    const l = Math.hypot(deckX - foulWX, deckZ - foulWZ);
    return [(deckX - foulWX) / l, (deckZ - foulWZ) / l];
  }, [deckX, deckZ, foulWX, foulWZ]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const s = st.current;
      s.home = pins.current.map((b) => (b ? { ...b.translation() } : { x: 0, y: 0, z: 0 }));
      s.ballHome = ball.current ? { ...ball.current.translation() } : null;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const onPinHit = useMemo(() => {
    let last = 0;
    return (e: CollisionEnterPayload) => {
      const b = e.target.rigidBody;
      if (!b) return;
      const t = b.translation();
      if (Math.hypot(car.x - t.x, car.z - t.z) > 34) return;
      const v = b.linvel();
      const strength = Math.hypot(v.x, v.y, v.z);
      const now = performance.now();
      if (strength < 1.5 || now - last < 90) return;
      last = now;
      events.emit('impact', { strength: strength * 0.7, x: t.x, y: t.y, z: t.z, material: 'wood' });
    };
  }, []);
  const onBallHit = (e: CollisionEnterPayload) => {
    const other = e.other.rigidBody;
    if (other && pins.current.some((p) => p && p.handle === other.handle)) st.current.ballHit = true;
  };

  // Pin and ball helpers; they only read refs, so one set lives for the component's life.
  const api = useMemo(() => {
    const pinDown = (i: number) => {
      const b = pins.current[i];
      const h = st.current.home?.[i];
      if (!b || !h) return false;
      const q = b.rotation();
      const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
      const t = b.translation();
      return upY < 0.7 || t.y < h.y - 0.6 || Math.hypot(t.x - h.x, t.z - h.z) > 0.9;
    };
    const anyMoved = () => {
      const s = st.current;
      for (let i = 0; i < pins.current.length; i++) {
        const b = pins.current[i];
        const h = s.home?.[i];
        if (!b || !h) continue;
        const t = b.translation();
        if (Math.hypot(t.x - h.x, t.z - h.z) > 0.15 || pinDown(i)) return true;
      }
      return false;
    };
    const resetPins = () => {
      const s = st.current;
      pins.current.forEach((b, i) => {
        const h = s.home?.[i];
        if (!b || !h) return;
        b.setTranslation(h, false);
        b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, false);
        b.setLinvel({ x: 0, y: 0, z: 0 }, false);
        b.setAngvel({ x: 0, y: 0, z: 0 }, false);
        b.sleep();
      });
    };
    const resetBall = () => {
      const b = ball.current;
      const h = st.current.ballHome;
      if (!b || !h) return;
      b.setTranslation(h, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };
    return { pinDown, anyMoved, resetPins, resetBall };
  }, []);

  useEffect(() => events.on('teleported', () => {
    const s = st.current;
    // A teleport cuts the camera: put everything back where nobody sees it move.
    if (s.phase !== 'ready' || api.anyMoved()) {
      api.resetPins();
      api.resetBall();
      s.phase = 'ready';
      s.ballHit = false;
    }
  }), [api]);

  useFrame((_, delta) => {
    const { pinDown, anyMoved, resetPins, resetBall } = api;
    const s = st.current;
    s.check += delta;
    if (s.check < 0.1) return;
    const dt = s.check;
    s.check = 0;
    const b = ball.current;
    if (!b || !s.home || !s.ballHome) return;
    const bt = b.translation();
    const carDeck = Math.hypot(car.x - deckX, car.z - deckZ);
    const ballFromFoul = (bt.x - foulWX) * upX + (bt.z - foulWZ) * upZ; // metres past the foul line
    if (s.phase === 'ready') {
      if (ballFromFoul > 0.8) {
        s.phase = 'rolling';
        s.t = 0;
        s.ballHit = false;
      } else if (anyMoved()) {
        // Knocked over by the car: stand them up again once it has gone.
        s.idle = carDeck > 6.5 ? s.idle + dt : 0;
        if (s.idle > 3) {
          s.idle = 0;
          resetPins();
        }
      } else {
        // A ball pushed off the approach and left there goes back to the rack.
        const away = Math.hypot(bt.x - s.ballHome.x, bt.z - s.ballHome.z) > 1.5;
        const carBall = Math.hypot(car.x - bt.x, car.z - bt.z);
        s.idle = away && carBall > 10 ? s.idle + dt : 0;
        if (s.idle > 6 || bt.y < -5) {
          s.idle = 0;
          resetBall();
        }
      }
      return;
    }
    s.t += dt;
    if (s.phase === 'rolling') {
      const v = b.linvel();
      const stalled = Math.hypot(v.x, v.z) < 0.25 && s.t > 2;
      if (s.ballHit || anyMoved() || stalled || s.t > 12) {
        s.phase = 'settle';
        s.t = 0;
      }
      return;
    }
    if (s.phase === 'settle') {
      if (s.t < 3.2) return;
      let down = 0;
      for (let i = 0; i < PINS.length; i++) if (pinDown(i)) down++;
      const store = useStore.getState();
      if (down === PINS.length && s.ballHit) {
        s.strikes++;
        try {
          localStorage.setItem(STRIKES_KEY, String(s.strikes));
        } catch {
          // private mode: the count lasts for this visit only
        }
        if (strikesText.current) {
          strikesText.current.text = `Strikes: ${s.strikes}`;
          strikesText.current.sync();
        }
        store.toast('Strike!', 'win');
        store.announce(`Strike! ${s.strikes} so far.`);
        playSound('win');
        events.emit('confetti', { x: deckX, y: 1.6, z: deckZ, count: 140 });
      } else if (down > 0) {
        store.toast(down === 1 ? '1 pin down' : `${down} pins down`);
        store.announce(`${down} of 10 pins down.`);
      }
      s.phase = 'show';
      s.t = 0;
      return;
    }
    // show: wait, then reset what is clear of the car.
    if (s.t < 2.4) return;
    const carBall = Math.hypot(car.x - s.ballHome.x, car.z - s.ballHome.z);
    if (carDeck > 4.8 && carBall > 3.2) {
      resetPins();
      resetBall();
      s.phase = 'ready';
      s.ballHit = false;
    }
  });

  const strikesLabel = `Strikes: ${st.current.strikes}`;
  return (
    <group>
      <mesh geometry={lane} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={headerFace} material={flatMaterial} />
      <Label font="display" size={0.62} color="#f2c230" position={[BOWL.x, HEADER.y + HEADER.h - 0.42, HEADER.z + 0.17]}>
        Bowling
      </Label>
      <Label ref={(m: unknown) => { strikesText.current = m as TextMesh | null; }} font="bodyBold" size={0.34} color={COLORS.paper}
        position={[BOWL.x, HEADER.y + 0.42, HEADER.z + 0.17]}>
        {strikesLabel}
      </Label>
      <InstancedRigidBodies ref={pins} instances={instances} colliders={false} linearDamping={0.3} angularDamping={0.5} onCollisionEnter={onPinHit}
        colliderNodes={[
          <CylinderCollider key="c" args={[PIN.h / 2, PIN.r]} position={[0, PIN.h / 2, 0]} friction={0.45} restitution={0.25}
            massProperties={{ mass: PIN.mass, centerOfMass: { x: 0, y: 0.48, z: 0 }, principalAngularInertia: { x: 0.46, y: 0.05, z: 0.46 }, angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 } }} />,
        ]}>
        <instancedMesh args={[pinGeo, paintMaterial, PINS.length]} castShadow={!low} receiveShadow frustumCulled={false} />
      </InstancedRigidBodies>
      <RigidBody ref={ball} position={SPAWN} colliders={false} ccd linearDamping={0.06} angularDamping={0.12} onCollisionEnter={onBallHit}>
        <BallCollider args={[BALL_R]} mass={26} friction={0.5} restitution={0.15} />
        <mesh geometry={ballGeo} material={paintMaterial} castShadow />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[RAIL.w / 2, RAIL.h / 2, (BOWL.foulZ + 1.2 - BOWL.backZ) / 2]}
            position={[BOWL.x + s * (HALF + RAIL.w / 2), RAIL.h / 2, (BOWL.foulZ + 1.2 + BOWL.backZ) / 2]} friction={0.2} restitution={0.3} />
        ))}
        <CuboidCollider args={[(BOWL.width + 2.1) / 2, 1.25, 0.25]} position={[BOWL.x, 1.25, BOWL.backZ - 0.1]} restitution={0.1} />
        {[-1, 1].map((s) => (
          <CuboidCollider key={`t${s}`} args={[0.3, (HEADER.y + HEADER.h) / 2, 1.2]} position={[BOWL.x + s * ((BOWL.width + 0.9) / 2 + 0.3), (HEADER.y + HEADER.h) / 2, BOWL.backZ + 0.9]} />
        ))}
      </RigidBody>
    </group>
  );
}
