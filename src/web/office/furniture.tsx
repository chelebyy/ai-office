import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { Ball, Bar, Box, Cylinder, Glow, type Point } from './primitives.tsx';

export function Plant({
  position,
  size = 1,
  color = '#877363',
}: {
  position: Point;
  size?: number;
  color?: string;
}) {
  return (
    <group position={position} scale={size}>
      <Cylinder radius={0.23} top={0.31} height={0.42} position={[0, 0.21, 0]} color={color} />
      <Cylinder radius={0.275} height={0.025} position={[0, 0.42, 0]} color="#302b22" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const angle = i * 2.4,
          height = 0.75 + (i % 3) * 0.18;
        const x = Math.sin(angle) * 0.25,
          z = Math.cos(angle) * 0.25;
        return (
          <group key={i}>
            <Bar from={[0, 0.38, 0]} to={[x, height, z]} radius={0.013} color="#40533a" />
            <Ball
              position={[x * 1.5, height, z * 1.5]}
              rotation={[Math.cos(angle) * 0.45, angle, Math.sin(angle) * 0.45]}
              size={[0.12, 0.28, 0.045]}
              color={i % 2 ? '#405c3d' : '#65804d'}
            />
          </group>
        );
      })}
    </group>
  );
}

export function Chair({
  position = [0, 0, 0],
  rotation = 0,
  color = '#333d42',
}: {
  position?: Point;
  rotation?: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Cylinder
        radius={0.065}
        height={0.48}
        position={[0, 0.37, 0]}
        color="#313a40"
        metalness={0.7}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, i * Math.PI * 0.4, 0]}>
          <Bar from={[0, 0.15, 0]} to={[0.39, 0.1, 0]} radius={0.035} />
          <Ball position={[0.39, 0.065, 0]} size={[0.065, 0.065, 0.05]} color="#20292e" />
        </group>
      ))}
      <Ball position={[0, 0.65, 0]} size={[0.42, 0.1, 0.39]} color={color} />
      <Ball position={[0, 1.12, -0.31]} size={[0.41, 0.54, 0.11]} color={color} />
      <Ball position={[0, 1.57, -0.28]} size={[0.25, 0.13, 0.11]} color={color} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Bar from={[side * 0.38, 0.64, 0]} to={[side * 0.4, 0.91, 0.04]} radius={0.025} />
          <Box size={[0.1, 0.055, 0.36]} position={[side * 0.4, 0.94, 0.03]} color="#343e43" />
        </group>
      ))}
    </group>
  );
}

function useMonitorTexture(accent: string) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#101e29';
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#243540';
    ctx.fillRect(0, 0, 512, 26);
    ctx.fillStyle = accent;
    ctx.fillRect(15, 12, 48, 3);
    ctx.fillStyle = '#162733';
    ctx.fillRect(0, 27, 84, 293);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i === 3 ? accent : '#52636b';
      ctx.fillRect(14, 49 + i * 18, 38 + (i % 3) * 8, 3);
    }
    // Abstract editor marks are decoration, not fabricated source code or task output.
    for (let i = 0; i < 15; i++) {
      ctx.fillStyle = i % 4 === 0 ? accent : i % 3 === 0 ? '#b5a07d' : '#647f8b';
      ctx.globalAlpha = 0.55;
      ctx.fillRect(107 + (i % 3) * 12, 47 + i * 17, 50 + ((i * 47) % 220), 3);
    }
    ctx.globalAlpha = 1;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [accent]);
}

export function Monitor({
  position,
  rotation = 0,
  accent = '#73b4bd',
  size = 1,
}: {
  position: Point;
  rotation?: number;
  accent?: string;
  size?: number;
}) {
  const map = useMonitorTexture(accent);
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={size}>
      <Box size={[0.48, 0.04, 0.31]} position={[0, 0.03, 0]} color="#28353d" metalness={0.45} />
      <Box size={[0.065, 0.28, 0.055]} position={[0, 0.16, 0]} color="#3c484e" metalness={0.65} />
      <Box size={[1.02, 0.65, 0.065]} position={[0, 0.56, 0]} color="#1c2931" />
      <mesh position={[0, 0.56, 0.035]}>
        <planeGeometry args={[0.94, 0.565]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
      <Glow size={[0.045, 0.008, 0.01]} position={[0.4, 0.27, 0.038]} color={accent} />
    </group>
  );
}

export function Mug({ position, color = '#d5c5a7' }: { position: Point; color?: string }) {
  return (
    <group position={position}>
      <Cylinder radius={0.073} height={0.14} position={[0, 0.07, 0]} color={color} />
      <Cylinder radius={0.06} height={0.006} position={[0, 0.143, 0]} color="#312419" />
      <mesh position={[0.08, 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.046, 0.012, 6, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

export function Lamp({ position, floor = false }: { position: Point; floor?: boolean }) {
  const height = floor ? 2.1 : 0.65;
  return (
    <group position={position}>
      <Cylinder radius={floor ? 0.22 : 0.12} height={0.035} color="#3e4140" />
      <Bar from={[0, 0, 0]} to={[0.1, height * 0.8, 0]} radius={0.022} color="#857059" />
      <Bar from={[0.1, height * 0.8, 0]} to={[0.26, height, 0.0]} radius={0.022} color="#857059" />
      <group position={[0.26, height, 0]}>
        <Cylinder
          radius={floor ? 0.28 : 0.13}
          top={floor ? 0.17 : 0.065}
          height={floor ? 0.36 : 0.15}
          color="#d6b27c"
        />
        <Glow
          size={[floor ? 0.35 : 0.15, 0.02, floor ? 0.35 : 0.15]}
          position={[0, -(floor ? 0.18 : 0.08), 0]}
          color="#ffca85"
        />
      </group>
    </group>
  );
}

export function Desk({
  position,
  rotation = 0,
  main = false,
  accent = '#79b6c3',
}: {
  position: Point;
  rotation?: number;
  main?: boolean;
  accent?: string;
}) {
  const width = main ? 3.5 : 2.4;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Box size={[width, 0.12, 1.35]} position={[0, 1.06, 0]} color="#aa825a" roughness={0.7} />
      <Box size={[width, 0.035, 1.36]} position={[0, 1.0, 0]} color="#684c37" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            size={[0.075, 1.02, 0.075]}
            position={[side * (width / 2 - 0.14), 0.51, 0.5]}
            color="#30383b"
          />
          <Box
            size={[0.075, 1.02, 0.075]}
            position={[side * (width / 2 - 0.14), 0.51, -0.5]}
            color="#30383b"
          />
          <Bar
            from={[side * (width / 2 - 0.14), 0.15, -0.5]}
            to={[side * (width / 2 - 0.14), 0.15, 0.5]}
            radius={0.025}
          />
        </group>
      ))}
      <Box size={[0.57, 0.8, 1.0]} position={[width / 2 - 0.45, 0.49, -0.02]} color="#685748" />
      {[0.24, 0.49, 0.72].map((y) => (
        <group key={y}>
          <Box size={[0.5, 0.19, 0.015]} position={[width / 2 - 0.45, y, 0.494]} color="#7a6450" />
          <Box
            size={[0.13, 0.025, 0.024]}
            position={[width / 2 - 0.45, y + 0.01, 0.51]}
            color="#333b3c"
          />
        </group>
      ))}
      <Monitor
        position={[main ? -1.08 : -0.46, 1.13, -0.39]}
        rotation={0.17}
        accent={accent}
        size={main ? 1.05 : 0.9}
      />
      {main && (
        <Monitor position={[1.04, 1.13, -0.24]} rotation={-0.3} accent="#bba9d5" size={0.98} />
      )}
      <Box size={[0.84, 0.018, 0.4]} position={[-0.23, 1.132, 0.22]} color="#354248" />
      <Box size={[0.51, 0.022, 0.19]} position={[-0.23, 1.15, 0.19]} color="#b4bab4" />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          size={[0.46, 0.006, 0.009]}
          position={[-0.23, 1.165, 0.14 + i * 0.046]}
          color="#68716f"
        />
      ))}
      <Ball position={[0.31, 1.16, 0.23]} size={[0.048, 0.022, 0.078]} color="#adbbb8" />
      <Mug position={[main ? -1.37 : -0.91, 1.13, 0.39]} />
      <Lamp position={[width / 2 - 0.15, 1.14, -0.45]} />
      {main && (
        <>
          <Box size={[0.55, 0.08, 0.38]} position={[1.27, 1.17, 0.35]} color="#486766" />
          <Box
            size={[0.48, 0.08, 0.33]}
            position={[1.28, 1.25, 0.34]}
            color="#b59670"
            rotation={[0, 0.1, 0]}
          />
          <Plant position={[-1.48, 1.13, -0.48]} size={0.3} />
          <Box size={[0.5, 0.018, 0.3]} position={[-0.05, 1.15, 0.12]} color="#6d7b80" />
          <Box
            size={[0.5, 0.31, 0.023]}
            position={[-0.05, 1.31, -0.035]}
            rotation={[-0.18, 0, 0]}
            color="#435b69"
          />
          <Glow size={[0.13, 0.025, 0.01]} position={[-0.05, 1.31, -0.01]} color="#a4bdc3" />
          <Box size={[0.4, 0.74, 0.7]} position={[-width / 2 + 0.33, 0.42, 0]} color="#24313a" />
          <Glow
            size={[0.018, 0.5, 0.015]}
            position={[-width / 2 + 0.2, 0.44, 0.36]}
            color="#81acdc"
          />
        </>
      )}
    </group>
  );
}

export function Sofa({ position }: { position: Point }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <Box size={[2.55, 0.35, 0.87]} position={[0, 0.28, 0]} color="#3d4446" />
      <Box size={[2.55, 0.69, 0.22]} position={[0, 0.68, -0.39]} color="#525351" />
      {[-0.66, 0.66].map((x) => (
        <Box key={x} size={[1.21, 0.18, 0.73]} position={[x, 0.49, 0.03]} color="#676660" />
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box size={[0.22, 0.58, 0.98]} position={[side * 1.26, 0.47, 0]} color="#545653" />
          <Cylinder
            radius={0.04}
            height={0.15}
            position={[side * 1.11, 0.075, 0.28]}
            color="#73563d"
          />
          <Cylinder
            radius={0.04}
            height={0.15}
            position={[side * 1.11, 0.075, -0.28]}
            color="#73563d"
          />
        </group>
      ))}
      <Ball
        size={[0.29, 0.28, 0.1]}
        position={[-0.75, 0.82, -0.14]}
        rotation={[0, 0.12, -0.16]}
        color="#918679"
      />
      <Ball
        size={[0.32, 0.28, 0.1]}
        position={[0.76, 0.81, -0.14]}
        rotation={[0, -0.1, 0.18]}
        color="#555d68"
      />
    </group>
  );
}

export function Lounge() {
  return (
    <group>
      <Box size={[3.7, 0.014, 3.9]} position={[-4.5, 0.019, 2.15]} color="#726253" shadow={false} />
      {[-1, 1].map((side) => (
        <Box
          key={side}
          size={[0.025, 0.01, 3.7]}
          position={[-4.5 + side * 1.68, 0.034, 2.15]}
          color="#a08c6f"
          shadow={false}
        />
      ))}
      <Sofa position={[-5.78, 0, 1.75]} />
      <Cylinder radius={0.65} height={0.085} position={[-4.18, 0.57, 1.9]} color="#aa8056" />
      {[0, 1, 2].map((i) => (
        <Bar
          key={i}
          from={[-4.18 + Math.sin(i * 2.1) * 0.43, 0.02, 1.9 + Math.cos(i * 2.1) * 0.43]}
          to={[-4.18 + Math.sin(i * 2.1) * 0.32, 0.54, 1.9 + Math.cos(i * 2.1) * 0.32]}
          radius={0.027}
        />
      ))}
      <Mug position={[-3.99, 0.616, 2.01]} color="#e6d0a5" />
      <Plant position={[-4.4, 0.62, 1.83]} size={0.32} />
      <Box
        size={[0.39, 0.035, 0.27]}
        position={[-4.1, 0.64, 1.6]}
        color="#8a9c98"
        rotation={[0, -0.2, 0]}
      />
      <Lamp position={[-6.1, 0, 3.55]} floor />
    </group>
  );
}
