import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { AdditiveBlending, CanvasTexture, InstancedMesh, Matrix4, MeshStandardMaterial, NearestFilter, PlaneGeometry, Quaternion, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import { modelScale, useMerged } from '../components/Model.tsx';
import type { ModelName } from '../config/models.ts';
import { env, LAMP_COLOR } from './env.ts';
import type { Lamp, Plan } from './plan.ts';

// Street lamps on the asphalt roads and lanterns on the dirt roads. At night their bulbs glow
// (an emissive map lights only the bulb's palette swatch), a soft halo sits on each head and the
// ground shader paints a warm pool under them.

const MODEL: Record<Lamp['kind'], ModelName> = { street: 'lamp-post-street', lantern: 'lamp-post-lantern' };
// Palette swatch (column of 16, row of 4) used by the bulb faces of each model.
const BULB: Record<Lamp['kind'], [number, number]> = { street: [8, 2], lantern: [13, 2] };

const materials = new Map<string, MeshStandardMaterial>();
function lampMaterial(kind: Lamp['kind'], base: MeshStandardMaterial) {
  const hit = materials.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 4;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 16, 4);
  g.fillStyle = '#fff';
  g.fillRect(BULB[kind][0], BULB[kind][1], 1, 1);
  const map = new CanvasTexture(c);
  map.flipY = false; // glTF UVs
  map.magFilter = NearestFilter;
  map.minFilter = NearestFilter;
  map.generateMipmaps = false;
  map.colorSpace = SRGBColorSpace;
  const m = new MeshStandardMaterial({ map: base.map, roughness: 1, metalness: 0, emissive: LAMP_COLOR, emissiveMap: map, emissiveIntensity: 0 });
  m.name = `valley-lamp-${kind}`;
  materials.set(kind, m);
  return m;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

function LampPosts({ kind, lamps }: { kind: Lamp['kind']; lamps: Lamp[] }) {
  const { geometry, material } = useMerged(MODEL[kind]);
  const mat = useMemo(() => lampMaterial(kind, material), [kind, material]);
  const mesh = useMemo(() => {
    const m = new InstancedMesh(geometry, mat, lamps.length);
    const s = modelScale(MODEL[kind]);
    lamps.forEach((l, i) => {
      _p.set(l.u, 0, -l.v);
      _q.setFromAxisAngle(_up, l.ry);
      _s.setScalar(s);
      m.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `valley-lamps-${kind}`;
    return m;
  }, [geometry, mat, lamps, kind]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  useFrame(() => {
    mat.emissiveIntensity = env.night.value * 2.4;
  });
  return <primitive object={mesh} />;
}

const HALO_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xyz += vec3(position.xy * uSize, 0.4);
  gl_Position = projectionMatrix * c;
}
`;
const HALO_FRAG = /* glsl */ `
uniform float uNight;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.2) * uNight;
  gl_FragColor = vec4(uColor * a * 0.9, 1.0);
}
`;

function Halos({ lamps }: { lamps: Lamp[] }) {
  const mesh = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    const mat = new ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uNight: env.night, uSize: { value: 2.6 }, uColor: { value: LAMP_COLOR } },
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const m = new InstancedMesh(geo, mat, lamps.length);
    lamps.forEach((l, i) => {
      _p.set(l.head[0], l.head[2] - (l.kind === 'street' ? 0.15 : 0), -l.head[1]);
      m.setMatrixAt(i, _m.makeTranslation(_p));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.frustumCulled = false;
    m.renderOrder = 2;
    m.name = 'valley-lamp-halos';
    return m;
  }, [lamps]);
  useEffect(
    () => () => {
      mesh.dispose();
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );
  useFrame(() => {
    mesh.visible = env.night.value > 0.01;
  });
  return <primitive object={mesh} />;
}

export function Lamps({ plan }: { plan: Plan }) {
  const street = useMemo(() => plan.lamps.filter((l) => l.kind === 'street'), [plan]);
  const lanterns = useMemo(() => plan.lamps.filter((l) => l.kind === 'lantern'), [plan]);
  return (
    <group name="valley-lamps">
      <LampPosts kind="street" lamps={street} />
      <LampPosts kind="lantern" lamps={lanterns} />
      <Halos lamps={plan.lamps} />
      <RigidBody type="fixed" colliders={false}>
        {plan.lamps.map((l, i) => (
          <CylinderCollider key={i} args={[1.6, l.kind === 'street' ? 0.17 : 0.3]} position={[l.u, 1.6, -l.v]} />
        ))}
      </RigidBody>
    </group>
  );
}
