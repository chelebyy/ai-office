import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import { AgXToneMapping, Mesh, PCFShadowMap, Vector3 } from 'three';
import { SceneFrameLoop, useRenderRequest, type SceneMetrics } from './SceneFrameLoop.tsx';
import './blender-pilot.css';

const MODEL = '/models/main-desk-v2.glb';
type View = 'perspective' | 'front' | 'top';
const cameras: Record<View, [number, number, number]> = {
  perspective: [4.8, 3.6, 6.3],
  front: [0, 2.9, 7.8],
  top: [0, 9.2, 0.01],
};
const target = new Vector3(0, 1.0, 0.35);

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <div className="pilot-fallback" role="alert">
        <strong>3B önizleme açılamadı</strong>
        <p>Model yüklenemedi veya grafik bağlantısı kesildi.</p>
        <button onClick={() => window.location.reload()}>Yeniden yükle</button>
      </div>
    ) : this.props.children;
  }
}

function DeskModel({ moving, onReady }: { moving: boolean; onReady: () => void }) {
  const { scene } = useGLTF(MODEL);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        // glTF resources remain loader-owned and shared across viewer remounts.
      }
    });
    return clone;
  }, [scene]);
  const parts = useMemo(() => ['Pilot_head', 'Pilot_hand_left', 'Pilot_hand_right'].map((name) => {
    const object = model.getObjectByName(name);
    return object ? { object, position: object.position.clone(), rotation: object.rotation.clone() } : null;
  }), [model]);
  const request = useRenderRequest();
  useLayoutEffect(() => { onReady(); request(); }, [onReady, request]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    parts.forEach((part, index) => {
      if (!part) return;
      part.object.position.copy(part.position);
      part.object.rotation.copy(part.rotation);
      if (!moving) return;
      if (index === 0) {
        part.object.rotation.y += Math.sin(t * 1.3) * 0.035;
        part.object.rotation.x += Math.sin(t * 2.2) * 0.012;
      } else {
        part.object.position.y += Math.sin(t * 11 + index * Math.PI) * 0.008;
      }
    });
  });
  return <primitive object={model} dispose={null} />;
}

function CameraRig({ view, revision, rotating }: { view: View; revision: number; rotating: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const request = useRenderRequest();
  useEffect(() => {
    const position = new Vector3(...cameras[view]);
    if (size.width < 600 && view !== 'top') position.multiplyScalar(1.4);
    camera.position.copy(position);
    camera.lookAt(target);
    controls.current?.target.copy(target);
    controls.current?.update();
    request();
  }, [camera, view, revision, size.width, request]);
  return <OrbitControls ref={controls} makeDefault target={target} enableDamping={false}
    minDistance={3.5} maxDistance={13} minPolarAngle={0.02} maxPolarAngle={Math.PI / 2.03}
    autoRotate={rotating} autoRotateSpeed={0.55} onChange={request} />;
}

function SetLighting({ warm }: { warm: boolean }) {
  return <>
    <ambientLight intensity={0.15} color="#d6e2ff" />
    <hemisphereLight args={['#cedef4', '#39291e', 0.6]} />
    <directionalLight position={[-3, 6, 4]} intensity={warm ? 2.8 : 2.5} color={warm ? '#ffcf9d' : '#f1f5ff'}
      castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4}
      shadow-camera-top={4} shadow-camera-bottom={-4} shadow-normalBias={0.02} shadow-bias={-0.0001} />
    <directionalLight position={[4, 3, -2]} intensity={1.1} color="#a9c6ff" />
    <pointLight position={[-1.5, 1.8, 0.25]} color="#ffb366" intensity={4} distance={3} decay={2} />
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" position={[-3, 4, 3]} scale={[6, 4, 1]} intensity={2.5} color="#fff2dd" />
      <Lightformer form="rect" position={[4, 3, -2]} rotation-y={Math.PI / 2} scale={[4, 4, 1]} intensity={2} color="#adcaff" />
      <Lightformer form="rect" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[5, 5, 1]} intensity={1.3} />
    </Environment>
  </>;
}

function Stage() {
  return <>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.055, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <shadowMaterial transparent opacity={0.3} />
    </mesh>
    <mesh position={[0, -0.023, 0.4]} receiveShadow>
      <boxGeometry args={[4.7, 0.04, 3.1]} />
      <meshStandardMaterial color="#443c35" roughness={1} />
    </mesh>
  </>;
}

function LoadingScene() { return null; }

export default function BlenderPilot() {
  const [view, setView] = useState<View>('perspective');
  const [revision, setRevision] = useState(0);
  const [moving, setMoving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [warm, setWarm] = useState(true);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [lost, setLost] = useState(false);
  const [metrics, setMetrics] = useState<SceneMetrics | null>(null);
  const markReady = useMemo(() => () => setReady(true), []);
  useEffect(() => {
    document.title = 'Cheleby Home · Blender önizleme';
    document.documentElement.lang = 'tr';
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  const chooseView = (next: View) => { setView(next); setRevision((value) => value + 1); setRotating(false); };

  return <div className="pilot-page">
    <header className="pilot-header">
      <a href="/" className="pilot-brand" aria-label="Cheleby Home ana sayfa"><span className="pilot-logo">⌂</span> cheleby <span>home</span></a>
      <div className="pilot-breadcrumb"><span>Stüdyo</span><i>/</i> Blender önizleme</div>
      <a href="/" className="pilot-back">Ofise dön <span aria-hidden="true">↗</span></a>
    </header>
    <main className="pilot-layout">
      <section className="pilot-viewport" aria-label="Ana masa ve robotun etkileşimli 3B önizlemesi">
        <div className="pilot-scene-heading"><p>BLENDER → WEB / 01</p><h1>Ana çalışma masası.</h1><span>Aynı tasarım. Artık keşfedilebilir.</span></div>
        <div className="pilot-canvas" data-ready={ready} data-moving={moving} data-view={view} data-rotating={rotating}>
          {lost ? <div className="pilot-fallback" role="alert"><p>Grafik bağlantısı kesildi.</p><button onClick={() => window.location.reload()}>Yeniden yükle</button></div> :
          <PreviewBoundary><Canvas shadows={{ type: PCFShadowMap }} frameloop="never" dpr={[1, 1.5]} camera={{ position: cameras.perspective, fov: 38, near: 0.1, far: 220 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: AgXToneMapping }}
            onCreated={({ gl }) => { gl.toneMappingExposure = 1.05; }}
            fallback={<div className="pilot-fallback" role="alert">Bu tarayıcı 3B görüntülemeyi desteklemiyor.</div>}>
            <SceneFrameLoop limit={30} continuous={moving || rotating} hidden={hidden}
              revision={`${view}:${revision}:${warm}:${ready}:${moving}:${rotating}`} metricsEnabled onMetrics={setMetrics} onLost={() => setLost(true)}>
              <SetLighting warm={warm} /><Stage />
              <Suspense fallback={<LoadingScene />}><DeskModel moving={moving} onReady={markReady} /></Suspense>
              <CameraRig view={view} revision={revision} rotating={rotating} />
            </SceneFrameLoop>
          </Canvas></PreviewBoundary>}
        </div>
        {!ready && !lost && <div className="pilot-loading" role="status"><span />Masa hazırlanıyor…</div>}
        <div className="pilot-live-badge"><span className={moving ? 'active' : ''} />{moving ? 'Çalışma hareketi · demo' : 'Tasarım önizlemesi'}</div>
        <div className="pilot-view-controls" role="group" aria-label="Kamera açısı">
          <button aria-pressed={view === 'perspective'} onClick={() => chooseView('perspective')}>Perspektif</button>
          <button aria-pressed={view === 'front'} onClick={() => chooseView('front')}>Önden</button>
          <button aria-pressed={view === 'top'} onClick={() => chooseView('top')}>Üstten</button>
          <span />
          <button className="pilot-reset" onClick={() => chooseView('perspective')} aria-label="Kamerayı sıfırla">↺</button>
        </div>
        <div className="pilot-gesture-hint"><span>↔ Sürükle: döndür</span><span>⊕ Kaydır: yaklaş</span></div>
      </section>
      <aside className="pilot-inspector" aria-label="Önizleme ayarları">
        <div className="pilot-inspector-top"><span className="pilot-kicker">SAHNE KOLEKSİYONU</span><span className="pilot-version">v2</span></div>
        <div className="pilot-object-icon" aria-hidden="true">⌘</div>
        <h2>Main Codex</h2><p className="pilot-description">Dört ekran, meşe masa ve çalışma arkadaşı. Blender’daki güncel sahneden aktarıldı.</p>
        <div className="pilot-materials"><span><i style={{ background: '#b58458' }} />Meşe</span><span><i style={{ background: '#292e36' }} />Çelik</span><span><i style={{ background: '#e2dfd5' }} />Seramik</span></div>
        <div className="pilot-setting-group"><h3>Görünüm</h3>
          <div className="pilot-light-options" role="group" aria-label="Işık ortamı"><button aria-pressed={warm} onClick={() => setWarm(true)}>☀ Gün batımı</button><button aria-pressed={!warm} onClick={() => setWarm(false)}>◉ Stüdyo</button></div>
          <button className="pilot-toggle" role="switch" aria-checked={rotating} onClick={() => setRotating(!rotating)}><span>Otomatik tur<small>Masayı her açıdan incele</small></span><i /></button>
        </div>
        <div className="pilot-setting-group"><h3>Karakter</h3><button className={`pilot-play ${moving ? 'playing' : ''}`} aria-pressed={moving} disabled={!ready} onClick={() => setMoving(!moving)}><span aria-hidden="true">{moving ? 'Ⅱ' : '▷'}</span>{moving ? 'Hareketi durdur' : 'Çalışma hareketini dene'}</button><p className="pilot-demo-note">Bu hareket bir demodur. Canlı Codex olaylarına henüz bağlı değil.</p></div>
        <div className="pilot-checklist"><h3>Bu aktarımda</h3><p><span>✓</span> İçeri dönük yan monitörler</p><p><span>✓</span> Ahşap ve kumaş dokuları</p><p><span>✓</span> Masa aksesuarları ve bitkiler</p></div>
        <div className="pilot-bottom-note"><span className="pilot-kicker">BİR SONRAKİ ADIM</span><p>Görünüşü birlikte netleştirip odanın kalanını taşıyacağız.</p></div>
      </aside>
    </main>
    <footer className="pilot-footer"><span><i /> {ready ? '3B model hazır' : 'Model yükleniyor'}<b>·</b>Yerel önizleme</span><span>{metrics ? `${metrics.calls} çizim · ${new Intl.NumberFormat('tr').format(metrics.triangles)} üçgen` : 'Blender / React Three Fiber'}<b>·</b>{moving || rotating ? `${metrics?.fps ?? '…'} FPS / 30 sınır` : 'Hareketsizken beklemede'}</span></footer>
  </div>;
}
