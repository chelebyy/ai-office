import { useEffect, useRef, useState } from 'react';
import type { Locale, OfficeRuntimeState } from '../../shared/contract.ts';
import { Icon } from './Icon.tsx';
import './office-power.css';

const wording = {
  tr: {
    title: 'Ofis kontrolü',
    running: 'Ofis açık',
    stopped: 'Ofis durduruldu',
    starting: 'Ofis açılıyor…',
    stopping: 'Ofis durduruluyor…',
    restarting: 'Ofis yeniden başlatılıyor…',
    error: 'Ofis başlatılamadı',
    start: 'Ofisi başlat',
    stop: 'Ofisi durdur',
    restart: 'Yeniden başlat',
    scope: 'Tüm odaların canlı takibini yönetir.',
    note: 'Durdurduğunda bu sayfa açık kalır.',
    unavailable: 'Kontrol hizmetine ulaşılamıyor.',
    busy: 'Başka bir işlem sürüyor. Durum güncelleniyor.',
    uncertain: 'Sonuç doğrulanamadı. Durum yeniden kontrol ediliyor.',
    shutdown: 'Tamamen kapatmak için masaüstündeki Kapat kısayolunu kullan.',
  },
  en: {
    title: 'Office controls',
    running: 'Office on',
    stopped: 'Office stopped',
    starting: 'Starting office…',
    stopping: 'Stopping office…',
    restarting: 'Restarting office…',
    error: 'Office could not start',
    start: 'Start office',
    stop: 'Stop office',
    restart: 'Restart office',
    scope: 'Controls live tracking in every room.',
    note: 'This page stays open when stopped.',
    unavailable: 'Control service is unavailable.',
    busy: 'Another operation is in progress. Updating status.',
    uncertain: 'Result could not be confirmed. Checking status again.',
    shutdown: 'Use the desktop Stop shortcut to shut down completely.',
  },
};
export function officePowerLabel(locale: Locale, state: OfficeRuntimeState['state']) {
  return wording[locale][state];
}
type ControlInfo = OfficeRuntimeState & { controlToken: string };

export function OfficePower({ locale }: { locale: Locale }) {
  const copy = wording[locale];
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ControlInfo | null>(null);
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'busy' | 'uncertain' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const busy =
    pending || Boolean(info && ['starting', 'stopping', 'restarting'].includes(info.state));
  const accept = (value: ControlInfo) => {
    if (!alive.current) return;
    setAvailable(true);
    setInfo((previous) =>
      !previous || Date.parse(value.updatedAt) >= Date.parse(previous.updatedAt) ? value : previous,
    );
  };
  useEffect(() => {
    alive.current = true;
    let disposed = false;
    let request: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      if (disposed) return;
      if (!document.hidden) {
        request = new AbortController();
        const deadline = setTimeout(() => request?.abort(), 5000);
        try {
          let response = await fetch('/api/runtime', { cache: 'no-store', signal: request.signal });
          if (response.status === 401) {
            await fetch('/', { cache: 'no-store', signal: request.signal });
            response = await fetch('/api/runtime', { cache: 'no-store', signal: request.signal });
          }
          if (!response.ok) throw new Error('Unavailable');
          const value = (await response.json()) as ControlInfo;
          if (!value.controlToken || !(value.state in wording.en))
            throw new Error('Invalid status');
          if (!disposed) accept(value);
        } catch {
          if (!disposed) setAvailable(false);
        } finally {
          clearTimeout(deadline);
        }
      }
      if (!disposed)
        timer = setTimeout(() => {
          void read();
        }, 2500);
    };
    void read();
    return () => {
      disposed = true;
      alive.current = false;
      clearTimeout(timer);
      request?.abort();
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !root.current?.contains(document.activeElement)) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  async function command(action: 'start' | 'stop' | 'restart') {
    if (!info || busy || !available) return;
    // Keep a usable focus target when the action buttons become disabled.
    if (root.current?.contains(document.activeElement)) trigger.current?.focus();
    setPending(true);
    setError(null);
    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), 5000);
    try {
      const response = await fetch(`/api/runtime/${action}`, {
        method: 'POST',
        headers: { 'X-Cheleby-Control': info.controlToken },
        signal: abort.signal,
      });
      if (response.status === 409) {
        if (alive.current) setError('busy');
        return;
      }
      if (!response.ok) throw new Error('Unconfirmed');
      accept({
        ...((await response.json()) as OfficeRuntimeState),
        controlToken: info.controlToken,
      });
    } catch {
      if (alive.current) setError('uncertain');
    } finally {
      clearTimeout(deadline);
      if (alive.current) setPending(false);
    }
  }

  const status = available && info ? copy[info.state] : copy.unavailable;
  return (
    <div
      className="fo-power"
      ref={root}
      data-state={available ? info?.state : 'unavailable'}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="fo-power-trigger"
        aria-label={copy.title}
        title={status}
        aria-expanded={open}
        aria-controls="office-power-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="power" size={17} />
        <span className="fo-power-dot" />
      </button>
      {open && (
        <section id="office-power-panel" className="fo-power-panel" aria-label={copy.title}>
          <strong>{copy.title}</strong>
          <p className="fo-power-status" role="status">
            {status}
          </p>
          <p>{copy.scope}</p>
          <div className="fo-power-actions" aria-busy={busy}>
            <button
              disabled={!available || busy || info?.state === 'running'}
              onClick={() => {
                void command('start');
              }}
            >
              <Icon name="play" />
              {copy.start}
            </button>
            <button
              disabled={!available || busy || info?.state === 'stopped'}
              onClick={() => {
                void command('stop');
              }}
            >
              <Icon name="pause" />
              {copy.stop}
            </button>
            <button
              disabled={!available || busy}
              onClick={() => {
                void command('restart');
              }}
            >
              <Icon name="replay" />
              {copy.restart}
            </button>
          </div>
          {error && (
            <p className="fo-power-error" role="alert">
              {copy[error]}
            </p>
          )}
          <p>{copy.note}</p>
          <small>{copy.shutdown}</small>
        </section>
      )}
    </div>
  );
}
