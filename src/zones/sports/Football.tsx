import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BallCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import type { IntersectionEnterPayload, RapierRigidBody } from '@react-three/rapier';
import { BufferAttribute, Color, IcosahedronGeometry, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { INSPECT } from '../../config/world.ts';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { localToWorld } from '../career/kit/frame.ts';
import { impactReporter } from '../career/kit/impact.ts';
import { paintMaterial } from '../career/kit/paint.ts';
import { BALL_RADIUS, CENTRE_SPOT, GOAL, PITCH, ZONE, goalLineX } from './plan.ts';

// Low-poly football: a twice-subdivided icosahedron whose 60 triangles around the 12 original
// vertices are black, which draws the 12 pentagons of a real ball.
function footballGeometry(r: number): BufferGeometry {
  const geo = new IcosahedronGeometry(r, 2);
  const pos = geo.attributes.position;
  const base = new IcosahedronGeometry(1, 0);
  const dirs: Vector3[] = [];
  for (let i = 0; i < base.attributes.position.count; i++) {
    const v = new Vector3().fromBufferAttribute(base.attributes.position, i).normalize();
    if (!dirs.some((d) => d.distanceTo(v) < 1e-3)) dirs.push(v);
  }
  base.dispose();
  const white = new Color('#f7f7f3');
  const black = new Color('#25282f');
  const colors = new Float32Array(pos.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    const centre = a.add(b).add(c).normalize();
    let best = -1;
    for (const d of dirs) best = Math.max(best, d.dot(centre));
    const col = best > 0.95 ? black : white;
    for (let k = 0; k < 3; k++) col.toArray(colors, (t + k) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.deleteAttribute('uv');
  return geo;
}

// Sensor inside each goal, behind the line: the ball has to be most of the way in.
const SENSOR_FROM = 1.2; // m behind the goal line
const SENSOR_TO = GOAL.depth - 0.05;
const RESET_AFTER_GOAL = 3; // s

const [SPOT_X, SPOT_Z] = localToWorld(ZONE, CENTRE_SPOT[0], CENTRE_SPOT[1]);

declare global {
  interface Window {
    __football?: { at: () => { x: number; y: number; z: number } | null; kick: (x: number, z: number) => void };
  }
}

export function Football() {
  const geometry = useMemo(() => footballGeometry(BALL_RADIUS), []);
  const onImpact = useMemo(() => impactReporter('soft', 2), []);
  const ball = useRef<RapierRigidBody>(null);
  const st = useRef({ scored: false, timer: 0, idle: 0, check: 0 });

  const reset = () => {
    const b = ball.current;
    if (!b) return;
    b.setTranslation({ x: SPOT_X, y: BALL_RADIUS + 1.2, z: SPOT_Z }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  // ?inspect only: lets the screenshot harness read and kick the ball.
  useEffect(() => {
    if (!INSPECT) return;
    window.__football = {
      at: () => (ball.current ? { ...ball.current.translation() } : null),
      kick: (x, z) => ball.current?.applyImpulse({ x, y: 0, z }, true),
    };
    return () => {
      delete window.__football;
    };
  }, []);

  const onSensor = (side: -1 | 1) => (e: IntersectionEnterPayload) => {
    const s = st.current;
    if (s.scored || !ball.current || e.other.rigidBody?.handle !== ball.current.handle) return;
    s.scored = true;
    s.timer = 0;
    const store = useStore.getState();
    store.addGoal();
    store.toast('Goal!', 'win');
    store.announce(`Goal! ${useStore.getState().goals} scored here so far.`);
    playSound('goal');
    const [x, z] = localToWorld(ZONE, goalLineX(side) + side * 1.0, PITCH.z);
    events.emit('confetti', { x, y: 2.2, z, count: 110 });
  };

  useFrame((_, delta) => {
    const s = st.current;
    const b = ball.current;
    if (!b) return;
    if (s.scored) {
      s.timer += delta;
      if (s.timer > RESET_AFTER_GOAL) {
        s.scored = false;
        reset();
      }
      return;
    }
    s.check += delta;
    if (s.check < 0.5) return;
    const dt = s.check;
    s.check = 0;
    const t = b.translation();
    if (t.y < -5) {
      reset();
      return;
    }
    // Kicked far off the ground and left there: bring it back once the car has gone.
    const far = Math.hypot(t.x - SPOT_X, t.z - SPOT_Z) > 22;
    const carAway = Math.hypot(car.x - t.x, car.z - t.z) > 16;
    const v = b.linvel();
    if (far && carAway && Math.hypot(v.x, v.y, v.z) < 0.5) s.idle += dt;
    else s.idle = 0;
    if (s.idle > 6) {
      s.idle = 0;
      reset();
    }
  });

  const sensorDepth = (SENSOR_TO - SENSOR_FROM) / 2;
  const sensorX = (side: -1 | 1) => goalLineX(side) + side * (SENSOR_FROM + sensorDepth);
  return (
    <>
      <RigidBody ref={ball} name="football" colliders={false} position={[CENTRE_SPOT[0], BALL_RADIUS + 0.02, CENTRE_SPOT[1]]}
        ccd linearDamping={0.45} angularDamping={0.6} onCollisionEnter={onImpact}>
        <BallCollider args={[BALL_RADIUS]} mass={9} restitution={0.6} friction={0.7} />
        <mesh geometry={geometry} material={paintMaterial} castShadow receiveShadow />
      </RigidBody>
      {([-1, 1] as const).map((side) => (
        <RigidBody key={side} type="fixed" colliders={false}>
          <CuboidCollider sensor args={[sensorDepth, GOAL.height / 2 - 0.1, GOAL.width / 2 - 0.15]}
            position={[sensorX(side), GOAL.height / 2 - 0.1, PITCH.z]} onIntersectionEnter={onSensor(side)} />
        </RigidBody>
      ))}
    </>
  );
}
