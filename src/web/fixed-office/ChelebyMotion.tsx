import { useEffect, useState, type CSSProperties } from 'react';
import type { Locale } from '../../shared/contract.ts';
import './cheleby-motion.css';

export type MotionMode = 'idle' | 'typing';
export const MOTION_BACKGROUND = '/office/cheleby-motion/desk-clean-v1.png';
const strips = {
  idle: '/office/cheleby-motion/idle-v4.webp',
  typing: '/office/cheleby-motion/typing-v4.webp',
};

// Only this forearm/hand region advances through the typing atlas. Everything
// outside it uses frame zero, so generated chair and body details cannot flicker.
const typingHandsPath =
  'M 191 136 L 263 136 L 267 158 L 270 180 L 280 194 L 280 218 L 245 226 L 216 223 L 192 224 L 179 219 L 173 205 L 178 187 L 183 173 L 188 157 Z';
// Overlap the static layer by one source pixel at the seam to avoid an
// antialiasing gap between complementary masks on fractional SVG positions.
const spriteMask = (body: boolean) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 416"><path fill="white" fill-rule="evenodd" ${body ? 'stroke="white" stroke-width="2" stroke-linejoin="round"' : ''} d="${body ? 'M 0 0 H 384 V 416 H 0 Z ' : ''}${typingHandsPath}"/></svg>`,
  )}")`;
const typingMasks = { body: spriteMask(true), hands: spriteMask(false) };

// The office prototype includes Cheleby, his chair and laptop in one registered sprite.
export const MOTION_PLACEMENT = { x: 575, y: 473, width: 270, height: 292.5 };
export const MOTION_CUTOUT =
  'M 578 550 Q 570 557 579 580 L 583 642 Q 579 669 603 688 L 587 711 L 578 729 L 578 770 L 747 770 L 776 712 L 760 678 L 751 638 L 760 632 L 816 639 L 846 620 L 834 602 L 843 556 L 782 541 L 743 570 L 705 583 L 659 574 L 621 562 Z';

const words = {
  tr: {
    title: 'Cheleby · Hareket önizlemesi',
    idle: 'Bekleme',
    typing: 'Yazma',
    close: 'Önizlemeyi kapat',
    loading: 'Hareketler yükleniyor…',
    failed: 'Hareket yüklenemedi; mevcut görünüm korunuyor.',
    reduced: 'Azaltılmış hareket açık.',
    paused: 'Hareket duraklatıldı.',
    note: 'Önizleme seçimi canlı oturum durumunu değiştirmez.',
  },
  en: {
    title: 'Cheleby · Motion preview',
    idle: 'Idle',
    typing: 'Typing',
    close: 'Close preview',
    loading: 'Loading motion…',
    failed: 'Motion could not load; the current scene is retained.',
    reduced: 'Reduced motion is enabled.',
    paused: 'Motion is paused.',
    note: 'Preview selection does not change the live session state.',
  },
};

export function useChelebyMotion(enabled: boolean, viewPaused: boolean) {
  const [assets, setAssets] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [mode, setMode] = useState<MotionMode>('idle');
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setAssets('loading');
    const images = [...Object.values(strips), MOTION_BACKGROUND].map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    Promise.all(images.map((image) => image.decode())).then(
      () => {
        if (!cancelled) setAssets('ready');
      },
      () => {
        if (!cancelled) setAssets('failed');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onVisibility = () => setHidden(document.hidden);
    const onMotion = () => setReduced(media.matches);
    onVisibility();
    onMotion();
    document.addEventListener('visibilitychange', onVisibility);
    media.addEventListener('change', onMotion);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', onMotion);
    };
  }, [enabled]);
  return {
    ready: enabled && assets === 'ready',
    assets,
    mode,
    setMode,
    reduced,
    frozen: viewPaused || hidden || reduced,
  };
}

type Motion = ReturnType<typeof useChelebyMotion>;

export function ChelebyMotionSprite({ motion }: { motion: Motion }) {
  const state = motion.mode;
  const backgroundImage = `url(${strips[state]})`;
  return (
    <foreignObject {...MOTION_PLACEMENT} data-layer="cheleby-motion">
      <div
        key={state}
        className="fo-cheleby-composite"
        data-motion={state}
        data-frozen={motion.frozen}
      >
        {state === 'typing' && (
          <div
            className="fo-cheleby-sprite fo-cheleby-body"
            style={{ backgroundImage, maskImage: typingMasks.body }}
          />
        )}
        <div
          className={`fo-cheleby-sprite fo-cheleby-${state}`}
          data-part={state === 'typing' ? 'hands' : 'idle'}
          style={
            {
              backgroundImage,
              maskImage: state === 'typing' ? typingMasks.hands : undefined,
              animationPlayState: motion.frozen ? 'paused' : 'running',
            } as CSSProperties
          }
        />
      </div>
    </foreignObject>
  );
}

export function ChelebyMotionControls({
  motion,
  locale,
  onClose,
}: {
  motion: Motion;
  locale: Locale;
  onClose: () => void;
}) {
  const copy = words[locale];
  return (
    <section className="fo-motion-controls" aria-label={copy.title}>
      <header>
        <strong>{copy.title}</strong>
        <button onClick={onClose} aria-label={copy.close}>
          ×
        </button>
      </header>
      <div role="group" aria-label={copy.title}>
        {(['idle', 'typing'] as const).map((mode) => (
          <button
            key={mode}
            aria-pressed={motion.mode === mode}
            disabled={!motion.ready}
            onClick={() => motion.setMode(mode)}
          >
            {copy[mode]}
          </button>
        ))}
      </div>
      <small role="status">
        {motion.assets === 'failed'
          ? copy.failed
          : !motion.ready
            ? copy.loading
            : motion.reduced
              ? copy.reduced
              : motion.frozen
                ? copy.paused
                : copy.note}
      </small>
    </section>
  );
}
