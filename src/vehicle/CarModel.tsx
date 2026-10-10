import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, Color, FrontSide, MeshStandardMaterial, Object3D, SpriteMaterial } from 'three';
import type { Group, Mesh, MeshStandardMaterial as StdMat, Sprite, SpotLight, Texture } from 'three';
import { car } from '../state/car.ts';
import { useStore } from '../state/store.ts';
import { Flags } from './Flags.tsx';
import { repaintPalette, splitBody } from './paint.ts';
import { LEAN, LIGHTS, MODEL, PAINT, WHEELS } from './tuning.ts';

// public/models/car-kit/vehicle-jeep-suv.glb references Textures/colormap.png relative to itself.
// BASE_URL is vite.config `base` ('/portfolio/' unless BASE_PATH is set), in dev too.
const MODEL_URL = `${import.meta.env.BASE_URL}${MODEL.url}`;
// Second argument false: no DRACOLoader. drei would otherwise point it at www.gstatic.com.
const USE_DRACO = false;

const clampLean = (v: number) => Math.max(-LEAN.max, Math.min(LEAN.max, v));

function mesh(meshes: Record<string, Mesh>, name: string): Mesh {
  const m = meshes[name];
  if (!m) throw new Error(`jeep model has no mesh named "${name}"`);
  return m;
}

let glowTexture: CanvasTexture | null = null;
function glowMap(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new CanvasTexture(c);
  return glowTexture;
}

function useCarParts(body: Mesh) {
  const parts = useMemo(() => {
    const src = body.material as StdMat;
    const map = repaintPalette(src.map as Texture, { panels: PAINT.panels, hardtop: PAINT.hardtop });
    const paint = new MeshStandardMaterial({ map, roughness: PAINT.roughness, metalness: 0, side: FrontSide });
    paint.name = 'jeep-paint';
    const tail = new MeshStandardMaterial({ map, roughness: 0.4, metalness: 0, emissive: new Color(LIGHTS.tailColor), emissiveIntensity: 0 });
    tail.name = 'jeep-tail';
    const head = new MeshStandardMaterial({ map, roughness: 0.3, metalness: 0, emissive: new Color(LIGHTS.headColor), emissiveIntensity: 0 });
    head.name = 'jeep-head';
    const split = splitBody(body.geometry, !!PAINT.hardtop);
    const tailGlow = new SpriteMaterial({ map: glowMap(), color: LIGHTS.tailColor, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    const headGlow = new SpriteMaterial({ map: glowMap(), color: LIGHTS.headColor, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    return { map, paint, tail, head, split, tailGlow, headGlow };
  }, [body]);

  useEffect(() => () => {
    parts.map.dispose();
    parts.paint.dispose();
    parts.tail.dispose();
    parts.head.dispose();
    parts.tailGlow.dispose();
    parts.headGlow.dispose();
    parts.split.rest.dispose();
    parts.split.tail.dispose();
    parts.split.head.dispose();
  }, [parts]);
  return parts;
}

export function CarModel({ wheelRefs }: { wheelRefs: RefObject<(Group | null)[]> }) {
  const { meshes } = useGLTF(MODEL_URL, USE_DRACO);
  const body = mesh(meshes, 'body');
  const spare = mesh(meshes, 'wheel-back');
  const parts = useCarParts(body);
  const spot = useRef<SpotLight>(null);
  const sprites = useRef<(Sprite | null)[]>([]);
  const target = useMemo(() => new Object3D(), []);
  const level = useRef({ brake: 0, head: 0 });
  const bodyRef = useRef<Group>(null);
  const lean = useRef({ speed: 0, yaw: 0, accel: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0, init: false });
  // The beam costs a light in every lit shader, so the low tier keeps only the lamp glow.
  const beam = useStore((s) => s.quality) === 'high';


  // Lamp glow eases towards its goal so the lights fade instead of blinking.
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = useStore.getState();
    const night = s.night;
    const l = level.current;
    const brakeGoal = car.brakeLight ? 1 : 0;
    const headGoal = night ? 1 : 0;
    l.brake += (brakeGoal - l.brake) * (1 - Math.exp(-dt * (brakeGoal > l.brake ? 30 : 10)));
    l.head += (headGoal - l.head) * (1 - Math.exp(-dt * 4));
    // Tail lamps: dim running light at night, bright when braking.
    const tail = Math.max(l.brake * LIGHTS.brakeIntensity, l.head * LIGHTS.tailNightIntensity);
    parts.tail.emissiveIntensity = tail;
    parts.head.emissiveIntensity = l.head * LIGHTS.headIntensity;
    parts.tailGlow.opacity = Math.min(1, tail / LIGHTS.brakeIntensity) * (night ? 0.9 : 0.55);
    parts.headGlow.opacity = l.head * 0.85;
    for (const sp of sprites.current) if (sp) sp.visible = (sp.material === parts.tailGlow ? parts.tailGlow.opacity : parts.headGlow.opacity) > 0.01;
    if (spot.current) spot.current.intensity = l.head * LIGHTS.spotIntensity;

    // Body lean from the car's acceleration, on a damped spring so it settles with a small bounce.
    const b = bodyRef.current;
    const ln = lean.current;
    if (b && dt > 0) {
      // Ground speed along the heading: vertical bounce on landing must not read as acceleration.
      const speed = car.vx * Math.cos(car.yaw) - car.vz * Math.sin(car.yaw);
      // Teleports and resets jump speed and heading in one step: start over instead of kicking the spring.
      const jump = Math.abs(speed - ln.speed) > 5 || Math.abs(Math.atan2(Math.sin(car.yaw - ln.yaw), Math.cos(car.yaw - ln.yaw))) > 0.5;
      if (!ln.init || car.recovering || jump) {
        ln.init = true;
        ln.speed = speed;
        ln.yaw = car.yaw;
        ln.accel = 0;
        if (jump) ln.pitch = ln.pitchV = ln.roll = ln.rollV = 0;
      }
      const accel = (speed - ln.speed) / dt;
      const yawRate = Math.atan2(Math.sin(car.yaw - ln.yaw), Math.cos(car.yaw - ln.yaw)) / dt;
      ln.speed = speed;
      ln.yaw = car.yaw;
      ln.accel += (accel - ln.accel) * (1 - Math.exp(-dt * 8));
      const grounded = car.contacts > 1 && !car.recovering;
      const pitchGoal = grounded ? clampLean(-ln.accel * LEAN.pitch) : 0; // nose up (negative about model X) when speeding up
      const rollGoal = grounded ? clampLean(speed * yawRate * LEAN.roll) : 0; // left side up in a left turn
      const k = LEAN.stiffness;
      const c = 2 * Math.sqrt(k) * LEAN.damping;
      ln.pitchV += (-(ln.pitch - pitchGoal) * k - ln.pitchV * c) * dt;
      ln.pitch += ln.pitchV * dt;
      ln.rollV += (-(ln.roll - rollGoal) * k - ln.rollV * c) * dt;
      ln.roll += ln.rollV * dt;
      b.rotation.set(ln.pitch, 0, ln.roll);
    }
  });

  const { split } = parts;
  const s = 1 / MODEL.scale;
  return (
    <group
      rotation-y={MODEL.rotationY}
      scale={MODEL.scale}
      position={[MODEL.offset.x, MODEL.offset.y, MODEL.offset.z]}
    >
      <group position={body.position} ref={bodyRef}>
        <mesh geometry={split.rest} material={parts.paint} castShadow receiveShadow>
          <mesh geometry={spare.geometry} material={parts.paint} position={spare.position} castShadow />
        </mesh>
        <Flags />
        <mesh geometry={split.tail} material={parts.tail} />
        <mesh geometry={split.head} material={parts.head} />
        {split.tailCenters.map((c, i) => (
          <sprite
            key={`t${i}`}
            ref={(el) => { sprites.current[i] = el; }}
            material={parts.tailGlow}
            position={[c.x, c.y, c.z - 0.06]}
            scale={LIGHTS.tailGlowSize * s}
            visible={false}
          />
        ))}
        {split.headCenters.map((c, i) => (
          <sprite
            key={`h${i}`}
            ref={(el) => { sprites.current[split.tailCenters.length + i] = el; }}
            material={parts.headGlow}
            position={[c.x, c.y, c.z + 0.06]}
            scale={LIGHTS.headGlowSize * s}
            visible={false}
          />
        ))}
        {/* One headlight beam, no shadows. Kept mounted at intensity 0 by day so night mode does not recompile shaders. */}
        {beam && <spotLight
          ref={(el) => {
            spot.current = el;
            if (el) el.target = target;
          }}
          position={LIGHTS.spotFrom}
          color={LIGHTS.beamColor}
          intensity={0}
          distance={LIGHTS.spotDistance}
          angle={LIGHTS.spotAngle}
          penumbra={LIGHTS.spotPenumbra}
          decay={LIGHTS.spotDecay}
          castShadow={false}
        />}
        <primitive object={target} position={LIGHTS.spotAim} />
      </group>
      {WHEELS.map((w, i) => {
        const wheel = mesh(meshes, w.node);
        return (
          <group
            key={w.node}
            position={wheel.position}
            ref={(el) => {
              // Steer (Y) first, then spin about the steered axle (X).
              if (el) el.rotation.order = 'YXZ';
              wheelRefs.current[i] = el;
            }}
          >
            <mesh geometry={wheel.geometry} material={parts.paint} castShadow />
          </group>
        );
      })}
    </group>
  );
}

useGLTF.preload(MODEL_URL, USE_DRACO);
