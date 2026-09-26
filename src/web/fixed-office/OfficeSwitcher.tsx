import type { ObserverSnapshot, SessionView } from '../../shared/contract.ts';
import type { OfficeCopy } from './copy.ts';
import type { Connection } from './fixed-state.ts';
import { officeCards } from './office-rooms.ts';
import './office-switcher.css';

type Props = {
  snapshot: ObserverSnapshot | null;
  selectedRootId?: string;
  connection: Connection;
  paused: boolean;
  now: number;
  copy: OfficeCopy;
  onSelect: (session: SessionView) => void;
  onShowAll: () => void;
};

export function OfficeSwitcher(props: Props) {
  const { copy } = props;
  const cards = officeCards(props.snapshot, props.selectedRootId, props.connection, props.paused, props.now);
  if (!cards.length) return null;
  return (
    <section className="fo-room-switcher" aria-label={copy.offices}>
      <div className="fo-room-heading">
        <strong>{copy.offices}</strong>
        <button onClick={props.onShowAll} title={copy.allOffices} aria-label={copy.allOffices}>…</button>
      </div>
      <div className="fo-room-cards">
        {cards.map(card => {
          const s = card.session;
          const state = copy[card.state === 'unknown' ? 'unknownState' : card.state];
          const description = `${s.project} · ${copy[s.source]} · ${s.id} · ${state}`;
          return (
            <button key={s.id} className="fo-room-card" data-office-id={s.id} data-office-state={card.state}
              aria-pressed={s.id === props.selectedRootId} aria-label={description} title={description}
              onClick={() => props.onSelect(s)}>
              <span className="fo-room-initial" aria-hidden="true">{s.project.slice(0, 1).toLocaleUpperCase()}</span>
              <span className="fo-room-light" aria-hidden="true" />
              <strong>{s.project}</strong>
              <small>{copy[s.source]} · {s.id.slice(-6)}</small>
              <span className="fo-room-state">{state}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
