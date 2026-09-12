import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { ACESFilmicToneMapping, Vector3 } from 'three';
import type { Locale, SessionView } from '../../shared/contract.ts';
import { Architecture, SoftContactShadows, WallDisplay } from './room.tsx';
import { Desk } from './furniture.tsx';
import { HoodedMascot, Robot } from './characters.tsx';
import { canAnimate, officeText, type CameraView, type SceneQuality } from './office-state.ts';
import type { Point } from './primitives.tsx';
import { StaticBatch } from './StaticBatch.tsx';
import { SceneFrameLoop, useRenderRequest, type SceneMetrics } from './SceneFrameLoop.tsx';
import { framePolicy, type PowerMode } from './frame-scheduler.ts';

export type { SceneMetrics } from './SceneFrameLoop.tsx';
interface SceneProps {
  root?: SessionView;
  team: SessionView[];
  locale: Locale;
  connected: boolean;
  available: boolean;
  cameraView: CameraView;
  cameraRevision: number;
  motion: boolean;
  quality: SceneQuality;
  powerMode: PowerMode;
  metricsEnabled: boolean;
  selectedCharacter: number;
  onSelectCharacter: (index: number) => void;
  onMetrics: (metrics: SceneMetrics) => void;
  onFallback: () => void;
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const views: Record<CameraView, { position: Point; target: Point }> = {
  room: { position: [12.4, 10.0, 17.4], target: [0, 1.05, -0.45] },
  desk: { position: [4.7, 4.2, 8.0], target: [-0.5, 1.28, 1.2] },
  overview: { position: [0.1, 22.5, 3.5], target: [0, 0, 0] },
};

function CameraRig({
  view,
  revision,
  reduced,
}: {
  view: CameraView;
  revision: number;
  reduced: boolean;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const invalidate = useRenderRequest();
  const destination = useRef(new Vector3());
  const target = useRef(new Vector3());
  const transitioning = useRef(false);
  useEffect(() => {
    const preset = views[view];
    const focus = new Vector3(...preset.target);
    const aspect = size.width / Math.max(1, size.height);
    const factor = Math.max(1, (view === 'desk' ? 0.95 : 1.3) / aspect);
    destination.current
      .set(...preset.position)
      .sub(focus)
      .multiplyScalar(factor)
      .add(focus);
    target.current.copy(focus);
    if (reduced) {
      camera.position.copy(destination.current);
      controls.current?.target.copy(focus);
      controls.current?.update();
      transitioning.current = false;
    } else transitioning.current = true;
    invalidate();
  }, [view, revision, size.width, size.height, reduced, camera, invalidate]);
  useFrame((_, delta) => {
    if (!transitioning.current || !controls.current) return;
    const blend = 1 - Math.exp(-Math.min(delta, 0.05) * 5);
    camera.position.lerp(destination.current, blend);
    controls.current.target.lerp(target.current, blend);
    controls.current.update();
    if (
      camera.position.distanceTo(destination.current) < 0.015 &&
      controls.current.target.distanceTo(target.current) < 0.015
    )
      transitioning.current = false;
    else invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4.5}
      maxDistance={65}
      minPolarAngle={0.12}
      maxPolarAngle={1.42}
      minAzimuthAngle={-1.05}
      maxAzimuthAngle={1.35}
      enablePan={false}
      rotateSpeed={0.65}
      zoomSpeed={0.7}
      onStart={() => {
        transitioning.current = false;
        invalidate();
      }}
      onChange={invalidate}
      onEnd={invalidate}
    />
  );
}

const stations: { position: Point; rotation: number; color: string }[] = [
  { position: [-3.2, 0, -1.42], rotation: 0.1, color: '#6f9ec5' },
  { position: [1.15, 0, -2.15], rotation: -0.07, color: '#99af6d' },
  { position: [4.7, 0, 0.0], rotation: -0.44, color: '#a491be' },
];

function SceneContents(props: SceneProps) {
  const t = officeText[props.locale];
  return (
    <>
      <color attach="background" args={['#1b2931']} />
      <fog attach="fog" args={['#1b2931', 42, 105]} />
      <hemisphereLight args={['#d1deea', '#8b6a49', 1.45]} />
      <directionalLight
        position={[-2, 10, 8]}
        intensity={3.2}
        color="#ffe0b6"
        castShadow
        shadow-mapSize={[
          props.quality === 'high' ? 2048 : 1024,
          props.quality === 'high' ? 2048 : 1024,
        ]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.1}
        shadow-camera-far={35}
        shadow-normalBias={0.045}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[7, 5, -3]} intensity={1.3} color="#d8a181" />
      <StaticBatch>
        <Architecture />
        <SoftContactShadows />
        <group position={[-0.65, 0, 2.15]} rotation={[0, -0.14, 0]}>
          <Desk position={[0, 0, 0]} main />
        </group>
        {stations.map((station, index) => (
          <group key={index} position={station.position} rotation={[0, station.rotation, 0]}>
            <Desk position={[0, 0, 0]} accent={station.color} />
          </group>
        ))}
      </StaticBatch>
      <WallDisplay session={props.root} locale={props.locale} available={props.available} />
      <group position={[-0.65, 0, 2.15]} rotation={[0, -0.14, 0]}>
        <HoodedMascot
          position={[0, 0.05, -1.05]}
          moving={props.motion}
          working={canAnimate(props.root, props.connected)}
          onSelect={() => props.onSelectCharacter(0)}
        />
        <Html position={[0, 2.62, -1.05]} center distanceFactor={12} zIndexRange={[25, 0]}>
          <button
            className={`world-tag ${props.selectedCharacter === 0 ? 'is-selected' : ''}`}
            onClick={() => props.onSelectCharacter(0)}
          >
            <i className={props.available ? 'online' : ''} />
            {t.main}
          </button>
        </Html>
      </group>
      {stations.map((station, index) => {
        const agent = props.team[index];
        return (
          <group key={index} position={station.position} rotation={[0, station.rotation, 0]}>
            <Robot
              position={[0, 0.055, -1.04]}
              color={station.color}
              moving={props.motion}
              working={canAnimate(agent, props.connected)}
              onSelect={() => props.onSelectCharacter(index + 1)}
            />
            <Html position={[0, 2.39, -1.04]} center distanceFactor={12} zIndexRange={[25, 0]}>
              <button
                className={`world-tag ${props.selectedCharacter === index + 1 ? 'is-selected' : ''}`}
                onClick={() => props.onSelectCharacter(index + 1)}
              >
                <i style={{ background: station.color }} />
                {agent ? `${t.robot} ${index + 1}` : t.model}
              </button>
            </Html>
          </group>
        );
      })}
      <CameraRig view={props.cameraView} revision={props.cameraRevision} reduced={!props.motion} />
    </>
  );
}

export default function OfficeScene(props: SceneProps) {
  const [generation, setGeneration] = useState(0);
  const [lost, setLost] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const t = officeText[props.locale];
  const active = [props.root, ...props.team.slice(0, 3)].some((session) =>
    canAnimate(session, props.connected),
  );
  const policy = framePolicy(props.powerMode, props.motion, active, hidden);
  const quality = props.powerMode === 'eco' ? 'standard' : props.quality;
  const revision = JSON.stringify([
    props.root?.id,
    props.root?.project,
    props.root?.status,
    props.root?.lastEventAt,
    props.root?.events.at(-1)?.id,
    props.available,
    props.connected,
    props.locale,
    props.team
      .slice(0, 3)
      .map((agent) => [agent.id, agent.status, agent.lastEventAt, agent.recordAvailable]),
    props.selectedCharacter,
    props.cameraView,
    props.cameraRevision,
    quality,
    policy.continuous,
  ]);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const fallback = (
    <div className="scene-fallback" role="status">
      <span aria-hidden="true">⌂</span>
      <p>{t.fallback}</p>
      <div>
        <button
          onClick={() => {
            setLost(false);
            setGeneration((value) => value + 1);
          }}
        >
          {t.retry}
        </button>
        <button onClick={props.onFallback}>{t.fallbackAction}</button>
      </div>
    </div>
  );
  return (
    <div className="canvas-stage" aria-label={t.scene}>
      {lost ? (
        fallback
      ) : (
        <SceneBoundary key={generation} fallback={fallback}>
          <Suspense
            fallback={
              <div className="scene-loading" role="status">
                {t.loading}
              </div>
            }
          >
            <Canvas
              shadows={quality === 'high' ? 'percentage' : false}
              dpr={props.powerMode === 'eco' ? 1 : quality === 'high' ? [1, 1.75] : [1, 1.15]}
              frameloop="never"
              camera={{ position: views.room.position, fov: 42, near: 0.1, far: 140 }}
              gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
              fallback={fallback}
              onCreated={({ gl }) => {
                gl.toneMapping = ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.05;
              }}
            >
              <SceneFrameLoop
                {...policy}
                revision={revision}
                metricsEnabled={props.metricsEnabled}
                onMetrics={props.onMetrics}
                onLost={() => setLost(true)}
              >
                <SceneContents {...props} quality={quality} motion={policy.continuous && !hidden} />
              </SceneFrameLoop>
            </Canvas>
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
