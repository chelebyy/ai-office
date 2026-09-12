import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { ThreeElements } from '@react-three/fiber';

export type Point = [number, number, number];
type ShapeProps = {
  position?: Point;
  rotation?: Point;
  color?: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  shadow?: boolean;
};

export function Box({
  size,
  position,
  rotation,
  color = '#68717a',
  roughness = 0.7,
  metalness = 0,
  emissive,
  shadow = true,
}: ShapeProps & { size: Point }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissive ? 1.3 : 0}
      />
    </mesh>
  );
}

export function Ball({
  size = [1, 1, 1],
  position,
  rotation,
  color = '#899095',
  roughness = 0.6,
  metalness = 0,
  emissive,
  shadow = true,
}: ShapeProps & { size?: Point }) {
  return (
    <mesh scale={size} position={position} rotation={rotation} castShadow={shadow} receiveShadow>
      <sphereGeometry args={[1, 20, 14]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissive ? 1.6 : 0}
      />
    </mesh>
  );
}

export function Cylinder({
  radius = 0.1,
  top,
  height = 1,
  position,
  rotation,
  color = '#899095',
  metalness = 0,
  shadow = true,
}: ShapeProps & { radius?: number; top?: number; height?: number }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow>
      <cylinderGeometry args={[top ?? radius, radius, height, 16]} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={metalness} />
    </mesh>
  );
}

export function Bar({
  from,
  to,
  radius = 0.035,
  color = '#222b30',
}: {
  from: Point;
  to: Point;
  radius?: number;
  color?: string;
}) {
  const direction = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(...direction);
  const center: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  return (
    <group position={center} rotation={[0, 0, 0]}>
      <mesh
        quaternion={useMemo(() => {
          // A cylinder's local Y axis is aligned with the segment.
          const [x, y, z] = direction.map((value) => value / length);
          const dot = y;
          if (dot < -0.999999) return [1, 0, 0, 0];
          const q = [z, 0, -x, 1 + dot];
          const norm = Math.hypot(...q);
          return q.map((value) => value / norm) as [number, number, number, number];
        }, [from[0], from[1], from[2], to[0], to[1], to[2]])}
        castShadow
      >
        <cylinderGeometry args={[radius, radius, length, 8]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
    </group>
  );
}

export function useWoodTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const random = (n: number) => {
      const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    ctx.fillStyle = '#927051';
    ctx.fillRect(0, 0, 1024, 1024);
    for (let row = 0; row < 16; row++) {
      const y = row * 64;
      const lightness = 37 + random(row) * 13;
      ctx.fillStyle = `hsl(28 27% ${lightness}%)`;
      ctx.fillRect(0, y, 1024, 63);
      for (let line = 0; line < 20; line++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(45,27,14,${0.05 + random(row * 100 + line) * 0.12})`;
        ctx.lineWidth = 0.5 + random(line) * 1.4;
        const sy = y + random(row * 30 + line) * 60;
        ctx.moveTo(0, sy);
        ctx.bezierCurveTo(260, sy + 6, 660, sy - 5, 1024, sy + 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#4d3c2e';
      ctx.fillRect(0, y + 62, 1024, 2);
      const joint = (row % 3) * 300 + 120;
      ctx.fillRect(joint, y, 2, 64);
      ctx.fillRect(joint + 510, y, 2, 64);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.anisotropy = 4;
    return texture;
  }, []);
}

export function Glow({
  size,
  color = '#ffb665',
  ...props
}: { size: Point; color?: string } & Omit<ThreeElements['mesh'], 'args'>) {
  return (
    <mesh {...props}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}
