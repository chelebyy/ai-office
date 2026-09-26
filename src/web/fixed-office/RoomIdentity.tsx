import { useState, type CSSProperties } from 'react';
import type { Locale } from '../../shared/contract.ts';
import { ROOM_ACCENTS, type RoomProject } from './room-accent.ts';
import { useRoomAccent } from './use-room-accent.ts';
import './room-identity.css';

export function ProjectName({
  project,
  fallback = 'Office',
}: {
  project?: RoomProject;
  fallback?: string;
}) {
  const { color } = useRoomAccent(project);
  return <strong style={{ color }}>{project?.project ?? fallback}</strong>;
}

export function RoomIdentitySettings({
  project,
  locale,
}: {
  project: RoomProject;
  locale: Locale;
}) {
  const { color, custom, setAccent } = useRoomAccent(project);
  const [saveState, setSaveState] = useState<'saved' | 'temporary' | null>(null);
  const tr = locale === 'tr';
  function choose(value: string | null) {
    setSaveState(setAccent(value) ? 'saved' : 'temporary');
  }
  return (
    <section className="fo-room-identity" style={{ '--room-accent': color } as CSSProperties}>
      <div className="fo-room-identity-preview">
        <span>{tr ? 'PROJE OFİSİ' : 'PROJECT OFFICE'}</span>
        <strong>{project.project}</strong>
        <i aria-hidden="true" />
      </div>
      <p className="fo-muted">
        {tr
          ? 'Bu projenin ekran ve oda başlıkları için bir renk seç. Aynı projedeki tüm oturumlarda kullanılır.'
          : 'Choose a color for this project’s screen and room headings. It applies to every session in this project.'}
      </p>
      <div
        className="fo-room-swatches"
        role="group"
        aria-label={tr ? 'Odanın rengi' : 'Room color'}
      >
        {ROOM_ACCENTS.map((entry) => (
          <button
            key={entry.color}
            style={{ '--swatch': entry.color } as CSSProperties}
            aria-pressed={color === entry.color}
            onClick={() => choose(entry.color)}
          >
            <i aria-hidden="true">{color === entry.color ? '✓' : ''}</i>
            <span>{entry[locale]}</span>
          </button>
        ))}
      </div>
      <div className="fo-room-identity-footer">
        <button disabled={custom === null} onClick={() => choose(null)}>
          {tr ? 'Varsayılana dön' : 'Reset to default'}
        </button>
        <span role="status">
          {saveState === 'temporary'
            ? tr
              ? 'Renk uygulandı. Tarayıcı kaydetmeye izin vermedi.'
              : 'Color applied. Browser storage is unavailable.'
            : saveState === 'saved'
              ? tr
                ? 'Bu proje için kaydedildi.'
                : 'Saved for this project.'
              : tr
                ? 'Seçimin bu tarayıcıda saklanır.'
                : 'Your choice is saved in this browser.'}
        </span>
      </div>
    </section>
  );
}
