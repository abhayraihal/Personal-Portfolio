import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DynamicDrawUsage, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { COLORS } from '../config/palette.ts';
import { events } from '../state/events.ts';
import { useStore } from '../state/store.ts';

const MAX = 600;
type P = { alive: boolean; life: number; pos: Vector3; vel: Vector3; rot: Quaternion; spin: Vector3 };

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _c = new Color();
const _axis = new Vector3();

// Global confetti: events.emit('confetti', { x, y, z }) anywhere. Skipped with reduced motion.
export function Confetti() {
  const mesh = useRef<InstancedMesh>(null);
  const parts = useMemo<P[]>(() => Array.from({ length: MAX }, () => ({ alive: false, life: 0, pos: new Vector3(), vel: new Vector3(), rot: new Quaternion(), spin: new Vector3() })), []);
  const cursor = useRef(0);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    m.instanceColor.setUsage(DynamicDrawUsage);
    _s.setScalar(0);
    for (let i = 0; i < MAX; i++) m.setMatrixAt(i, _m.compose(new Vector3(), _q.identity(), _s));
    m.instanceMatrix.needsUpdate = true;
    return events.on('confetti', ({ x, y, z, colors, count = 90 }) => {
      if (useStore.getState().reducedMotion) return;
      const palette = colors?.length ? colors : [COLORS.accent, ...COLORS.flags];
      for (let k = 0; k < count; k++) {
        const i = cursor.current++ % MAX;
        const p = parts[i];
        p.alive = true;
        p.life = 2.2 + Math.random() * 1.2;
        p.pos.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 5;
        p.vel.set(Math.cos(a) * sp * 0.5, 7 + Math.random() * 6, Math.sin(a) * sp * 0.5);
        p.rot.setFromAxisAngle(_axis.randomDirection(), Math.random() * Math.PI);
        p.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
        m.setColorAt(i, _c.set(palette[k % palette.length]));
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }, [parts]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    let any = false;
    for (let i = 0; i < MAX; i++) {
      const p = parts[i];
      if (!p.alive) continue;
      any = true;
      p.life -= dt;
      p.vel.y -= 9.8 * dt;
      p.vel.multiplyScalar(1 - 1.6 * dt);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.03) {
        p.pos.y = 0.03;
        p.vel.set(0, 0, 0);
      }
      _q.setFromAxisAngle(_axis.copy(p.spin).normalize(), p.spin.length() * dt);
      p.rot.multiply(_q);
      const scale = p.life <= 0 ? 0 : Math.min(1, p.life * 2);
      if (p.life <= 0) p.alive = false;
      _s.set(0.22 * scale, 0.14 * scale, 1);
      m.setMatrixAt(i, _m.compose(p.pos, p.rot, _s));
    }
    if (any) m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial side={2} toneMapped={false} />
    </instancedMesh>
  );
}
