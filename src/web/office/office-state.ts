import type { ObservationEvent, SessionView } from '../../shared/contract.ts';

export const STALE_AFTER_MS = 120_000;
export type CameraView = 'room' | 'desk' | 'overview';
export type SceneQuality = 'standard' | 'high';

export function officeState(
  sessions: SessionView[],
  selectedId: string | undefined,
  connected: boolean,
  now = Date.now(),
) {
  const selected = sessions.find((session) => session.id === selectedId);
  const root =
    selected?.agentKind === 'main'
      ? selected
      : selected?.parentResolved
        ? sessions.find((session) => session.id === selected.rootId && session.agentKind === 'main')
        : undefined;
  const team = root
    ? sessions.filter(
        (session) =>
          session.agentKind === 'subagent' && session.parentResolved && session.rootId === root.id,
      )
    : [];
  const stale = !!root && now - Date.parse(root.lastEventAt) > STALE_AFTER_MS;
  const available = connected && !!root?.recordAvailable && !stale;
  const working = available && root?.status === 'working';
  const events = root?.events.slice(-9).reverse() ?? [];
  const message = root?.events.findLast(
    (event) => event.kind === 'assistant_message' && event.text,
  )?.text;
  return { root, team, stale, available, working, events, message };
}

export function canAnimate(session: SessionView | undefined, connected: boolean, now = Date.now()) {
  return (
    connected &&
    session?.recordAvailable === true &&
    session.status === 'working' &&
    now - Date.parse(session.lastEventAt) <= STALE_AFTER_MS
  );
}

export function latestTool(events: ObservationEvent[]) {
  return events.findLast((event) => event.toolName)?.toolName;
}

export const officeText = {
  tr: {
    office: 'Ofis',
    events: 'Olaylar',
    identity: 'Kişisel AI ofisi',
    title: 'Birlikte üretmek için bir yer.',
    subtitle: 'Sıcak ışıklar, sakin bir ofis, gerçek oturumlar.',
    rooms: 'Oturumlar',
    observed: 'Gözlenen kayıtlar',
    room: 'Ofis',
    desk: 'Ana masa',
    overview: 'Üstten',
    reset: 'Kamerayı sıfırla',
    controls: 'Kamera görünümleri',
    drag: 'Sürükle: döndür',
    zoom: 'Tekerlek: yaklaş',
    touch: 'Sürükleyerek incele · iki parmakla yaklaş',
    preview: 'OFİS ÖNİZLEMESİ',
    main: 'Ana Codex',
    robot: 'Robot',
    model: 'Model örneği',
    team: 'Ekip',
    activity: 'Son hareketler',
    empty: 'Bu oturumda henüz görünür olay yok.',
    noRoot: 'Bir ana oturum seç',
    live: 'Kaynak bağlı',
    disconnected: 'Kaynak bekleniyor',
    stale: 'Son bilinen durum',
    waiting: 'Oturum bekleniyor',
    scene: 'Ofisin etkileşimli 3D görünümü',
    loading: 'Ofis hazırlanıyor…',
    fallback:
      'Bu tarayıcıda 3D görünüm açılamadı. Olaylar görünümünden oturumlarını izleyebilirsin.',
    retry: '3D görünümü yeniden aç',
    fallbackAction: 'Olaylara git',
    quality: 'Görüntü kalitesi',
    power: 'Kaynak kullanımı',
    balanced: 'Dengeli · en fazla 60 FPS',
    eco: 'Tasarruf · en fazla 30 FPS',
    powerNote: 'Boşta yalnızca değişiklikte çizilir. Gizli sekmede 3D durur.',
    standard: 'Standart',
    high: 'Yüksek',
    motion: 'Karakter hareketleri',
    pause: 'Hareketi durdur',
    play: 'Hareketi aç',
    details: 'Oturum ayrıntıları',
    collapse: 'Ayrıntıları kapat',
    open: 'Ayrıntıları aç',
    settings: 'Görünüm ayarları',
    character: 'Karakter',
    characterNote: 'İlk model ve oturma/yazma hareketi denemesi.',
    prototype: 'Tek oda · ilk model çalışması',
    previewRobots: 'Bağlı alt ajanı olmayan robotlar model örneğidir.',
    moreTeam: 'Ekipteki diğer kayıtlar Olaylar görünümünde.',
    monitor: 'GÖZLENEN OTURUM',
    tool: 'Son araç',
    noTool: 'Araç olayı bekleniyor',
    source: 'Kaynak',
    metrics: 'Sahne ölçümü',
    fps: 'Kare/sn',
    draws: 'Çizim',
    triangles: 'Üçgen',
    noMetrics: 'Ölçüm hazırlanıyor',
    totalFrames: 'Çizilen toplam kare',
    emptyRooms: 'Henüz ana oturum bulunamadı.',
    mainCharacter: 'Gözlüksüz kapüşonlu ana maskot',
  },
  en: {
    office: 'Office',
    events: 'Events',
    identity: 'Personal AI office',
    title: 'A place to make things together.',
    subtitle: 'Warm lights, a quiet office, real sessions.',
    rooms: 'Sessions',
    observed: 'Observed records',
    room: 'Office',
    desk: 'Main desk',
    overview: 'Overhead',
    reset: 'Reset camera',
    controls: 'Camera views',
    drag: 'Drag to orbit',
    zoom: 'Scroll to zoom',
    touch: 'Drag to explore · pinch to zoom',
    preview: 'OFFICE PREVIEW',
    main: 'Main Codex',
    robot: 'Robot',
    model: 'Model preview',
    team: 'Team',
    activity: 'Recent activity',
    empty: 'No public event in this session yet.',
    noRoot: 'Choose a main session',
    live: 'Source connected',
    disconnected: 'Waiting for source',
    stale: 'Last known state',
    waiting: 'Waiting for session',
    scene: 'Interactive 3D view of the office',
    loading: 'Preparing the office…',
    fallback: 'The 3D view could not open in this browser. You can follow your sessions in Events.',
    retry: 'Reopen the 3D view',
    fallbackAction: 'Open events',
    quality: 'Visual quality',
    power: 'Resource use',
    balanced: 'Balanced · up to 60 FPS',
    eco: 'Power saving · up to 30 FPS',
    powerNote: 'Idle scenes render only on change. Hidden tabs stop 3D.',
    standard: 'Standard',
    high: 'High',
    motion: 'Character motion',
    pause: 'Pause motion',
    play: 'Enable motion',
    details: 'Session details',
    collapse: 'Close details',
    open: 'Open details',
    settings: 'View settings',
    character: 'Character',
    characterNote: 'First model with seated and typing motion studies.',
    prototype: 'One room · first model study',
    previewRobots: 'Robots without a linked subagent are model previews.',
    moreTeam: 'Other team records are available in Events.',
    monitor: 'OBSERVED SESSION',
    tool: 'Last tool',
    noTool: 'Waiting for a tool event',
    source: 'Source',
    metrics: 'Scene metrics',
    fps: 'FPS',
    draws: 'Draws',
    triangles: 'Triangles',
    noMetrics: 'Preparing metrics',
    totalFrames: 'Total rendered frames',
    emptyRooms: 'No main session found yet.',
    mainCharacter: 'Hooded main mascot without glasses',
  },
} as const;
