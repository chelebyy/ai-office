import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Locale, SessionView } from '../../shared/contract.ts';
import { statusLabels } from '../i18n.ts';
import { Box, Glow, useWoodTexture } from './primitives.tsx';
import { Lamp, Lounge, Plant } from './furniture.tsx';
import { latestTool, officeText } from './office-state.ts';

export function Architecture() {
  const wood = useWoodTexture();
  useEffect(() => () => wood.dispose(), [wood]);
  return (
    <group>
      <Box size={[14.2, 0.35, 10.2]} position={[0, -0.2, 0]} color="#26353d" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial map={wood} roughness={0.8} />
      </mesh>
      <Box size={[14.2, 0.05, 0.08]} position={[0, 0.013, 5.07]} color="#b99360" shadow={false} />
      <Box size={[0.08, 0.05, 10.1]} position={[7.07, 0.013, 0]} color="#b99360" shadow={false} />
      <Box size={[14.1, 4.7, 0.22]} position={[0, 2.28, -5.04]} color="#655e56" shadow={false} />
      <Box size={[0.2, 4.7, 10.1]} position={[-7.04, 2.28, 0]} color="#605c55" shadow={false} />
      <Box size={[14, 0.14, 0.34]} position={[0, 4.53, -4.94]} color="#383d3d" />
      <Box size={[0.32, 0.15, 10]} position={[-6.92, 4.53, 0]} color="#383d3d" />
      {[-6.8, -0.55, 6.85].map((x) => (
        <Box key={x} size={[0.15, 4.5, 0.2]} position={[x, 2.23, -4.82]} color="#444946" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Box
          key={i}
          size={[0.016, 4.4, 0.01]}
          position={[-6.8 + i * 2.04, 2.2, -4.915]}
          color="#514f49"
          shadow={false}
        />
      ))}
      <Glow position={[-3.59, 3.98, -4.8]} size={[5.9, 0.026, 0.07]} color="#ffbd78" />
      <Glow position={[-6.86, 0.7, -0.3]} size={[0.035, 0.025, 5.1]} color="#ffbd79" />
      <Box size={[0.42, 0.13, 5.2]} position={[-6.63, 0.72, -0.3]} color="#a3825e" />
      <Box size={[6.65, 0.08, 0.37]} position={[3.28, 1.09, -4.65]} color="#bca078" />
      <LandscapeWindow />
      {[0.05, 2.45].map((z, index) => (
        <group key={z} position={[-6.86, 2.75, z]} rotation={[0, Math.PI / 2, 0]}>
          <Box size={[1.5, 1.8, 0.07]} color="#343d3c" />
          <mesh position={[0, 0, 0.039]}>
            <planeGeometry args={[1.35, 1.65]} />
            <meshBasicMaterial color={index ? '#b6afa0' : '#c4baa1'} />
          </mesh>
          <mesh position={[0.2, 0.34, 0.045]}>
            <circleGeometry args={[0.28, 30]} />
            <meshBasicMaterial color={index ? '#b27e62' : '#73857a'} />
          </mesh>
          <mesh position={[-0.15, -0.25, 0.047]} rotation={[0, 0, index ? 0.18 : -0.14]}>
            <planeGeometry args={[0.92, 0.48]} />
            <meshBasicMaterial color={index ? '#72867d' : '#b09371'} />
          </mesh>
        </group>
      ))}
      <Lounge />
      <Plant position={[-6.18, 0, -3.92]} size={1.6} />
      <Plant position={[6.05, 0, -3.96]} size={1.85} color="#8b8571" />
      <Plant position={[6.24, 0, 3.79]} size={1.3} />
      <Plant position={[-6.62, 0.8, -1.8]} size={0.65} />
      <Plant position={[0.32, 1.15, -4.66]} size={0.58} />
      <Plant position={[5.8, 1.15, -4.6]} size={0.45} />
      <Lamp position={[6.38, 0, 1.4]} floor />
      <Box size={[1.15, 0.7, 0.68]} position={[-6.34, 0.35, -3.25]} color="#696451" />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          size={[0.24, 0.12, 0.25]}
          position={[-6.6 + i * 0.25, 0.78, -3.3]}
          color={['#c8ac79', '#748887', '#9f7866'][i]}
        />
      ))}
      <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1b2931" roughness={1} />
      </mesh>
      <pointLight
        position={[-3.0, 3.1, -3.7]}
        intensity={7}
        distance={9}
        color="#72a7bf"
        decay={2}
      />
      <pointLight
        position={[-5.7, 2.1, 1.4]}
        intensity={12}
        distance={8}
        color="#ffc187"
        decay={2}
      />
      <pointLight
        position={[5.6, 3.4, -3.7]}
        intensity={15}
        distance={10}
        color="#ffb775"
        decay={2}
      />
    </group>
  );
}

function LandscapeWindow() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d')!;
    const sky = ctx.createLinearGradient(0, 0, 0, 800);
    sky.addColorStop(0, '#72768e');
    sky.addColorStop(0.38, '#e6a391');
    sky.addColorStop(0.7, '#f1c39c');
    sky.addColorStop(1, '#535e68');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1600, 800);
    const glow = ctx.createRadialGradient(1200, 270, 5, 1200, 270, 210);
    glow.addColorStop(0, '#ffe6b5');
    glow.addColorStop(0.2, '#ffcaa3bb');
    glow.addColorStop(1, '#fac39b00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1600, 800);
    ctx.fillStyle = '#ffe5b0';
    ctx.beginPath();
    ctx.arc(1200, 270, 24, 0, Math.PI * 2);
    ctx.fill();
    const layers = [
      { y: 330, h: 140, c: '#73738a' },
      { y: 410, h: 100, c: '#606b7d' },
      { y: 520, h: 95, c: '#4c616d' },
      { y: 620, h: 80, c: '#385461' },
    ];
    layers.forEach((layer, index) => {
      ctx.fillStyle = layer.c;
      ctx.beginPath();
      ctx.moveTo(0, 800);
      for (let x = 0; x <= 1600; x += 65) {
        const peak = Math.sin(x * 0.012 + index * 2.2) * 0.6 + Math.sin(x * 0.028 + index) * 0.35;
        ctx.lineTo(x, layer.y - peak * layer.h);
      }
      ctx.lineTo(1600, 800);
      ctx.closePath();
      ctx.fill();
    });
    for (let i = 0; i < 72; i++) {
      const x = i * 24;
      const base = 700 + Math.sin(i * 0.7) * 70;
      const h = 90 + (Math.sin(i * 16.2) + 1) * 50;
      ctx.fillStyle = i % 2 ? '#294b50' : '#34565a';
      ctx.fillRect(x - 2, base - h, 4, h);
      for (let b = 0; b < 4; b++) {
        const y = base - h + b * h * 0.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 12 - b * 5, y + h * 0.35);
        ctx.lineTo(x + 12 + b * 5, y + h * 0.35);
        ctx.closePath();
        ctx.fill();
      }
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[3.17, 2.7, -4.89]}>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[6.58, 2.96]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {[-3.34, -1.68, 0, 1.68, 3.34].map((x) => (
        <Box key={x} size={[0.1, 3.15, 0.16]} position={[x, 0, 0.11]} color="#303b3e" />
      ))}
      {[-1.54, 1.54].map((y) => (
        <Box key={y} size={[6.77, 0.12, 0.16]} position={[0, y, 0.11]} color="#303b3e" />
      ))}
      <Box size={[6.74, 0.065, 0.17]} position={[0, 0.5, 0.13]} color="#374246" />
    </group>
  );
}

export function WallDisplay({
  session,
  locale,
  available,
}: {
  session?: SessionView;
  locale: Locale;
  available: boolean;
}) {
  const t = officeText[locale];
  const lastMessage =
    session?.events.findLast((event) => event.kind === 'assistant_message' && event.text)?.text ??
    '';
  const tool = session ? latestTool(session.events) : undefined;
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#10212c';
    ctx.fillRect(0, 0, 1536, 768);
    ctx.fillStyle = '#172d38';
    ctx.fillRect(0, 0, 1536, 80);
    ctx.fillStyle = available ? '#8fc9b7' : '#d2b58b';
    ctx.beginPath();
    ctx.arc(43, 42, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '24px Segoe UI, sans-serif';
    ctx.fillStyle = '#b4d2d7';
    ctx.fillText(t.monitor, 66, 51);
    ctx.font = 'bold 65px Segoe UI, sans-serif';
    ctx.fillStyle = '#e6e2d3';
    ctx.fillText((session?.project ?? 'AI Office').slice(0, 32), 48, 177);
    ctx.font = '25px Segoe UI, sans-serif';
    ctx.fillStyle = '#8fb5b7';
    ctx.fillText(
      session ? (available ? statusLabels[locale][session.status] : t.stale) : t.waiting,
      50,
      235,
    );
    ctx.strokeStyle = '#35505a';
    ctx.beginPath();
    ctx.moveTo(48, 278);
    ctx.lineTo(1480, 278);
    ctx.stroke();
    ctx.font = '20px Segoe UI, sans-serif';
    ctx.fillStyle = '#849da6';
    ctx.fillText(t.tool.toLocaleUpperCase(locale), 50, 332);
    ctx.font = '28px monospace';
    ctx.fillStyle = '#d6b589';
    ctx.fillText((tool ?? t.noTool).slice(0, 67), 50, 383);
    ctx.font = '27px Segoe UI, sans-serif';
    ctx.fillStyle = '#b8c7c9';
    const words = lastMessage.replace(/\s+/g, ' ').split(' ');
    let line = '',
      row = 0;
    for (const word of words) {
      if (ctx.measureText(line + ' ' + word).width > 1350) {
        ctx.fillText(line, 50, 464 + row * 43);
        row++;
        line = word;
        if (row === 5) break;
      } else line += (line ? ' ' : '') + word;
    }
    if (row < 5) ctx.fillText(line, 50, 464 + row * 43);
    if (!lastMessage) {
      ctx.fillStyle = '#688b94';
      ctx.fillText(t.subtitle, 50, 489);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [session?.project, session?.status, locale, available, lastMessage, tool, t]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[-3.64, 2.8, -4.7]}>
      <Box size={[6.02, 3.07, 0.16]} color="#252e32" />
      <mesh position={[0, 0, 0.085]}>
        <planeGeometry args={[5.83, 2.9]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <Glow
        position={[2.8, -1.48, 0.088]}
        size={[0.025, 0.018, 0.008]}
        color={available ? '#9cdcc5' : '#e1b782'}
      />
    </group>
  );
}

export function SoftContactShadows() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(12,19,21,.33)');
    gradient.addColorStop(1, 'rgba(12,19,21,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      {[
        [-1.1, 1.9, 4.5, 2.3],
        [-3, -1.65, 3.6, 2.4],
        [1.25, -2.3, 3.6, 2.4],
        [4.9, -0.1, 3.6, 2.4],
        [-5.8, 1.75, 1.8, 3.5],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.016, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
