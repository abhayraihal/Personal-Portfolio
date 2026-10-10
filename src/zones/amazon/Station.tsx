import { useEffect, useMemo } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Pad } from '../../components/Pad.tsx';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { INSPECT, screenToWorld } from '../../config/world.ts';
import { panels } from '../../data/profile.ts';
import type { PanelId } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { FLOOR_Y } from './Floor.tsx';
import { PAD_COLOR, PLINTH_H } from './layout.ts';
import type { StationDef } from './layout.ts';
import { at, ToyClock } from './shared.ts';
import { inspectClocks } from './inspect.ts';
import { M } from './materials.ts';

export type ToyProps = { clock: ToyClock; def: StationDef };
export type ToySpec = { Component: ComponentType<ToyProps>; length: number; minHold?: number };

// Camera framing while the car is parked on a pad: look at a point between the car and the exhibit
// (plaza u, v and an optional height). Skipped with reduced motion, so the camera never moves on
// its own.
export function frameCamera(id: string, frame: readonly number[] | null) {
  const s = useStore.getState();
  if (!frame) {
    s.clearCameraOverride(id);
    return;
  }
  if (s.reducedMotion) return;
  const [cu, cv] = ZONE_BY_ID.amazon.center;
  const [x, z] = screenToWorld(cu + frame[0], cv + frame[1]);
  s.setCameraOverride({ id, target: [x, frame[2] ?? 0.8, z], blend: 1.1 });
}

// Raised platform with a tall invisible collider: the car bumps into the kerb instead of driving
// over the toys. Top surface at y = PLINTH_H.
export function Plinth({ w, d, color = M.plinthSide }: { w: number; d: number; color?: typeof M.plinthSide }) {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w / 2, 0.75, d / 2]} position={[0, 0.75, 0]} />
      </RigidBody>
      <RoundedBox args={[w, PLINTH_H - 0.05, d]} radius={0.14} smoothness={2} position={[0, (PLINTH_H - 0.05) / 2, 0]} material={color} receiveShadow castShadow />
      <RoundedBox args={[w - 0.22, 0.1, d - 0.22]} radius={0.04} smoothness={1} position={[0, PLINTH_H - 0.05, 0]} material={M.plinthTop} receiveShadow />
    </>
  );
}

export function Station({ def, toy, children }: { def: StationDef; toy: ToySpec; children?: ReactNode }) {
  const clock = useMemo(() => new ToyClock(toy.length, toy.minHold), [toy.length, toy.minHold]);
  const camId = `amazon-cam-${def.id}`;
  useEffect(() => () => useStore.getState().clearCameraOverride(camId), [camId]);
  useEffect(() => {
    if (!INSPECT) return;
    inspectClocks.set(def.id, clock);
    return () => {
      inspectClocks.delete(def.id);
    };
  }, [clock, def.id]);
  const [w, d] = def.size;
  const panel = def.id as PanelId;
  const Toy = toy.Component;
  return (
    <>
      <group position={at(def.center[0], def.center[1])}>
        <Plinth w={w} d={d} />
        <group position={[0, PLINTH_H, 0]}>
          <Toy clock={clock} def={def} />
          {children}
        </group>
      </group>
      <Pad
        id={def.id}
        label={panels[panel].title}
        action={{ kind: 'panel', panel }}
        position={at(def.pad[0], def.pad[1], FLOOR_Y)}
        radius={2.4}
        color={PAD_COLOR}
        icon={def.icon}
        onEnter={() => {
          clock.enter();
          frameCamera(camId, def.frame);
        }}
        onLeave={() => {
          clock.leave();
          frameCamera(camId, null);
        }}
      />
    </>
  );
}
