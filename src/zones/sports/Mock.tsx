import { Label } from '../../components/Label.tsx';
import * as P from './plan.ts';

// Temporary layout mock: footprints of every venue.
function Slab({ x, z, w, d, h = 0.3, color, name }: { x: number; z: number; w: number; d: number; h?: number; color: string; name: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} transparent opacity={0.75} />
      </mesh>
      <Label flat font="display" size={1.2} color="#111" position={[0, h + 0.05, 0]}>{name}</Label>
    </group>
  );
}

export function Mock() {
  return (
    <group>
      <Slab x={P.ENTRANCE_SIGN.x} z={P.ENTRANCE_SIGN.z} w={10} d={0.5} h={4} color="#e2557f" name="Sports park" />
      <Slab x={P.FOOTBALL_PAD.x} z={P.FOOTBALL_PAD.z} w={5} d={5} h={0.05} color="#4caf50" name="pad" />
      <Slab x={P.RUNNING_PAD.x} z={P.RUNNING_PAD.z} w={5} d={5} h={0.05} color="#4caf50" name="pad" />
      <Slab x={P.GAMING.x} z={P.GAMING.z - 1.5} w={8} d={6} h={3.2} color="#7c5cff" name="den" />
      <Slab x={P.GAMING.x + 9} z={P.GAMING.z} w={8.5} d={0.6} h={2.2} color="#5a3fd0" name="cases" />
      <Slab x={P.TYPING.x} z={P.TYPING.z + 1.5} w={10.5} d={4} h={0.6} color="#eeeeee" name="keys" />
      <Slab x={P.TYPING.x - 2} z={P.TYPING.z - 2.5} w={5} d={0.3} h={2.6} color="#333" name="screen" />
      <Slab x={P.TYPING.x + 4.5} z={P.TYPING.z - 2.5} w={2.6} d={0.3} h={2.8} color="#444" name="gauge" />
      <mesh position={[P.MOUNTAIN.x, P.MOUNTAIN.h / 2, P.MOUNTAIN.z]}>
        <coneGeometry args={[P.MOUNTAIN.r, P.MOUNTAIN.h, 9]} />
        <meshStandardMaterial color="#8c8fa3" flatShading />
      </mesh>
      <Slab x={P.TENNIS.x} z={P.TENNIS.z} w={21} d={11.5} h={0.05} color="#3f7fbf" name="tennis" />
      <Slab x={P.VOLLEY.x} z={P.VOLLEY.z} w={17} d={10} h={0.05} color="#e8d29a" name="volley" />
      <Slab x={P.PUMP.x} z={P.PUMP.z} w={26} d={15} h={1} color="#b58b5e" name="pump" />
      <Slab x={P.POOL.x} z={P.POOL.z} w={22} d={12} h={0.4} color="#3fa7b5" name="pool" />
      <Slab x={P.BOWLING.x} z={P.BOWLING.z} w={26} d={6} h={0.3} color="#d9b37a" name="bowling" />
    </group>
  );
}
