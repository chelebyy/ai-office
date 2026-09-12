import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';
import { Ball, Bar, Box, Cylinder, Glow, type Point } from './primitives.tsx';
import { Chair } from './furniture.tsx';

interface CharacterProps {
  position: Point;
  rotation?: number;
  moving: boolean;
  working?: boolean;
  onSelect?: () => void;
}

export function HoodedMascot({
  position,
  rotation = 0,
  moving,
  working = false,
  onSelect,
}: CharacterProps) {
  const head = useRef<Group>(null);
  const leftHand = useRef<Group>(null);
  const rightHand = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (head.current) {
      head.current.position.y = 1.64 + (moving ? Math.sin(t * 1.4) * 0.012 : 0);
      head.current.rotation.z = moving ? Math.sin(t * 0.65) * 0.025 : 0;
    }
    if (leftHand.current)
      leftHand.current.position.y = moving && working ? Math.sin(t * 8) * 0.017 : 0;
    if (rightHand.current)
      rightHand.current.position.y = moving && working ? Math.sin(t * 8 + 1.8) * 0.017 : 0;
    if (eyes.current) eyes.current.scale.y = moving && Math.sin(t * 0.9) > 0.995 ? 0.12 : 1;
  });
  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <Chair position={[0, 0, -0.02]} color="#323e42" />
      <Ball position={[0, 1.01, 0.04]} size={[0.34, 0.43, 0.24]} color="#3a4140" />
      <Box position={[0, 0.79, 0.17]} size={[0.43, 0.1, 0.28]} color="#272e31" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Bar
            from={[side * 0.16, 0.78, 0.11]}
            to={[side * 0.18, 0.64, 0.48]}
            radius={0.12}
            color="#30393e"
          />
          <Bar
            from={[side * 0.18, 0.64, 0.48]}
            to={[side * 0.18, 0.25, 0.48]}
            radius={0.1}
            color="#29343b"
          />
          <Ball position={[side * 0.18, 0.18, 0.56]} size={[0.13, 0.09, 0.21]} color="#343b3d" />
          <Box position={[side * 0.18, 0.125, 0.57]} size={[0.23, 0.025, 0.34]} color="#a99b84" />
          <Bar
            from={[side * 0.29, 1.2, 0.05]}
            to={[side * 0.41, 1.01, 0.34]}
            radius={0.13}
            color="#454946"
          />
          <Bar
            from={[side * 0.41, 1.01, 0.34]}
            to={[side * 0.25, 1.04, 0.61]}
            radius={0.1}
            color="#4a4c46"
          />
          <group ref={side < 0 ? leftHand : rightHand}>
            <Ball position={[side * 0.25, 1.07, 0.66]} size={[0.1, 0.055, 0.12]} color="#d4a17c" />
          </group>
        </group>
      ))}
      <group ref={head} position={[0, 1.64, 0]} rotation={[0, 0.18, 0]}>
        <Ball position={[0, 0, -0.045]} size={[0.48, 0.49, 0.4]} color="#333b3b" />
        <Ball position={[0, -0.015, 0.265]} size={[0.37, 0.355, 0.175]} color="#1f292c" />
        <Ball position={[0, -0.036, 0.323]} size={[0.292, 0.286, 0.133]} color="#d2a384" />
        <Ball position={[0, 0.177, 0.321]} size={[0.31, 0.126, 0.143]} color="#252b2b" />
        {[-2, -1, 0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[i * 0.105, 0.112 - Math.abs(i) * 0.012, 0.418]}
            rotation={[0, 0, Math.PI + 0.2 + i * 0.16]}
          >
            <coneGeometry args={[0.072, 0.26, 3]} />
            <meshStandardMaterial color="#252c2c" roughness={0.85} />
          </mesh>
        ))}
        <group ref={eyes} position={[0, -0.035, 0.441]}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Ball
                position={[side * 0.117, 0, 0]}
                size={[0.068, 0.085, 0.025]}
                color="#f1dbc4"
                shadow={false}
              />
              <Ball
                position={[side * 0.116, -0.006, 0.022]}
                size={[0.036, 0.056, 0.02]}
                color="#916239"
                shadow={false}
              />
              <Ball
                position={[side * 0.112, -0.006, 0.035]}
                size={[0.023, 0.039, 0.01]}
                color="#292b29"
                shadow={false}
              />
              <Ball
                position={[side * 0.102, 0.021, 0.043]}
                size={[0.011, 0.014, 0.008]}
                color="#fff1d6"
                shadow={false}
              />
            </group>
          ))}
        </group>
        <Ball
          position={[0, -0.12, 0.458]}
          size={[0.035, 0.03, 0.035]}
          color="#bf8766"
          shadow={false}
        />
        <Bar
          from={[-0.035, -0.183, 0.433]}
          to={[0.042, -0.178, 0.433]}
          radius={0.009}
          color="#9b6651"
        />
        {[-1, 1].map((side) => (
          <Bar
            key={side}
            from={[side * 0.2, -0.32, 0.21]}
            to={[side * 0.12, -0.54, 0.27]}
            radius={0.012}
            color="#ada48c"
          />
        ))}
      </group>
      <Box
        position={[0.24, 0.86, 0.37]}
        size={[0.1, 0.13, 0.012]}
        rotation={[-0.3, 0, 0]}
        color="#293a3c"
      />
    </group>
  );
}

export function Robot({
  position,
  rotation = 0,
  color,
  moving,
  working = false,
  onSelect,
}: CharacterProps & { color: string }) {
  const head = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const face = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (head.current) {
      head.current.rotation.y = moving ? Math.sin(t * 0.55 + position[0]) * 0.1 : 0;
      head.current.position.y = 1.48 + (moving ? Math.sin(t * 1.4 + position[0]) * 0.014 : 0);
    }
    if (arm.current) arm.current.rotation.x = moving && working ? Math.sin(t * 7) * 0.08 : 0;
    if (face.current)
      face.current.scale.y = moving && Math.sin(t * 0.7 + position[0]) > 0.997 ? 0.2 : 1;
  });
  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <Chair color="#34434a" />
      <Ball position={[0, 1.02, 0]} size={[0.28, 0.34, 0.2]} color={color} metalness={0.25} />
      <Box position={[0, 1.02, 0.2]} size={[0.2, 0.14, 0.02]} color="#293a44" />
      <Glow position={[0, 1.04, 0.217]} size={[0.08, 0.023, 0.007]} color="#b9eae5" />
      <Cylinder
        radius={0.055}
        height={0.18}
        position={[0, 1.28, 0]}
        color="#667a85"
        metalness={0.7}
      />
      <group ref={head} position={[0, 1.48, 0]}>
        <Ball size={[0.38, 0.31, 0.28]} color={color} metalness={0.28} />
        <Ball
          position={[0, -0.02, 0.218]}
          size={[0.29, 0.187, 0.077]}
          color="#152c3d"
          roughness={0.3}
        />
        <mesh ref={face} position={[0, -0.014, 0.29]}>
          <planeGeometry args={[0.4, 0.065]} />
          <meshBasicMaterial transparent opacity={0} />
          {[-1, 1].map((side) => (
            <Ball
              key={side}
              position={[side * 0.106, 0, 0.005]}
              size={[0.045, 0.051, 0.015]}
              color="#96e7ed"
              emissive="#6dbbca"
              shadow={false}
            />
          ))}
        </mesh>
        <Bar
          from={[-0.06, -0.102, 0.287]}
          to={[0.06, -0.102, 0.287]}
          radius={0.008}
          color="#77b5c2"
        />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Cylinder
              radius={0.12}
              height={0.11}
              position={[side * 0.38, 0.025, 0]}
              rotation={[0, 0, Math.PI / 2]}
              color="#3e5663"
              metalness={0.6}
            />
            <Cylinder
              radius={0.085}
              height={0.115}
              position={[side * 0.39, 0.025, 0]}
              rotation={[0, 0, Math.PI / 2]}
              color={color}
            />
          </group>
        ))}
        <Bar from={[0, 0.27, 0]} to={[0.06, 0.46, 0]} radius={0.014} color="#72868a" />
        <Ball
          position={[0.06, 0.47, 0]}
          size={[0.034, 0.034, 0.034]}
          color="#e3d0a4"
          emissive="#ad9570"
        />
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Bar
            from={[side * 0.14, 0.79, 0.04]}
            to={[side * 0.15, 0.62, 0.33]}
            radius={0.085}
            color="#344b58"
          />
          <Bar
            from={[side * 0.15, 0.62, 0.33]}
            to={[side * 0.16, 0.24, 0.33]}
            radius={0.07}
            color="#566977"
          />
          <Ball position={[side * 0.16, 0.18, 0.41]} size={[0.105, 0.09, 0.18]} color={color} />
          <Ball position={[side * 0.3, 1.12, 0]} size={[0.09, 0.09, 0.09]} color="#8c9ca4" />
          <Bar
            from={[side * 0.3, 1.12, 0]}
            to={[side * 0.37, 0.98, 0.22]}
            radius={0.075}
            color={color}
          />
          <group ref={side < 0 ? arm : undefined}>
            <Bar
              from={[side * 0.37, 0.98, 0.22]}
              to={[side * 0.22, 1.01, 0.51]}
              radius={0.063}
              color="#80929a"
            />
            <Ball position={[side * 0.22, 1.04, 0.54]} size={[0.085, 0.043, 0.09]} color={color} />
          </group>
        </group>
      ))}
    </group>
  );
}
