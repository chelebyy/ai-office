import { useEffect, useId, useRef, useState } from 'react';
import type { ObserverSnapshot, SessionView, Source } from '../../shared/contract.ts';
import type { OfficeCopy } from './copy.ts';
import type { Connection } from './fixed-state.ts';
import { liveProjectGroups, projectGroups, sessionTitle } from './office-rooms.ts';
import { moveRoom, readRoomOrder, ROOM_ORDER_KEY } from './room-order.ts';
import { Icon } from './Icon.tsx';
import { ProjectName } from './RoomIdentity.tsx';
import { searchText } from '../locale.ts';
import './project-navigator.css';

type Props = {
  snapshot: ObserverSnapshot | null;
  selectedRootId?: string;
  connection: Connection;
  paused: boolean;
  now: number;
  copy: OfficeCopy;
  onSelect: (session: SessionView) => void;
  expandedView?: boolean;
};

export function ProjectNavigator(props: Props) {
  const { copy, selectedRootId } = props;
  const tr = copy.working === 'Çalışıyor';
  const [order, setOrder] = useState(readRoomOrder);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ key: string; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<Source | 'all'>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const unsorted = props.expandedView
    ? projectGroups(props.snapshot, props.connection, props.paused, props.now)
    : liveProjectGroups(props.snapshot, selectedRootId, props.connection, props.paused, props.now);
  const groups = [...unsorted].sort((a, b) => {
    const ai = order.indexOf(a.key),
      bi = order.indexOf(b.key);
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
  });
  const selectedProject = groups.find((p) =>
    p.rooms.some((r) => r.session.id === selectedRootId),
  )?.key;
  const query = searchText(search.trim());
  const filtered = groups
    .map((project) => ({
      ...project,
      rooms: project.rooms.filter(
        ({ session }) =>
          (source === 'all' || session.source === source) &&
          searchText(`${project.name} ${session.title ?? ''} ${session.id}`).includes(query),
      ),
    }))
    .filter((project) => project.rooms.length);

  useEffect(() => {
    if (selectedProject) setOpen((previous) => ({ ...previous, [selectedProject]: true }));
  }, [selectedProject]);

  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (selected && listRef.current) {
      const list = listRef.current;
      const row = selected.getBoundingClientRect();
      const bounds = list.getBoundingClientRect();
      if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom;
      else if (row.top < bounds.top) list.scrollTop -= bounds.top - row.top;
    }
  }, [selectedRootId, selectedProject ? open[selectedProject] : false]);

  useEffect(() => {
    const sync = () => setOrder(readRoomOrder());
    window.addEventListener('storage', sync);
    window.addEventListener('cheleby-room-order', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cheleby-room-order', sync);
    };
  }, []);

  function reorder(sourceKey: string, targetKey: string, after: boolean) {
    const next = moveRoom(
      order,
      groups.map((group) => group.key),
      sourceKey,
      targetKey,
      after,
    );
    setOrder(next);
    try {
      localStorage.setItem(ROOM_ORDER_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('cheleby-room-order'));
    } catch {
      /* Keep the order for this view when storage is unavailable. */
    }
    setAnnouncement(tr ? 'Oda sırası değiştirildi.' : 'Room order updated.');
    setDragKey(null);
    setDrop(null);
  }

  return (
    <div className={`fo-project-nav${props.expandedView ? ' fo-project-nav-expanded' : ''}`}>
      <span className="fo-reorder-a11y" role="status" aria-live="polite">
        {announcement}
      </span>
      <span className="fo-reorder-a11y" id={id + '-reorder'}>
        {tr
          ? 'Sıralamak için sürükleyin veya Alt ile yukarı/aşağı ok tuşlarını kullanın.'
          : 'Drag to reorder, or use Alt and the up/down arrow keys.'}
      </span>
      <div className="fo-project-filters">
        <label className="fo-project-search">
          <Icon name="search" size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.projectSearch}
            aria-label={copy.search}
          />
        </label>
        {props.expandedView && (
          <select
            value={source}
            aria-label={copy.source}
            onChange={(e) => setSource(e.target.value as Source | 'all')}
          >
            <option value="all">{copy.allSources}</option>
            {(['desktop', 'cli', 'unknown'] as const).map((value) => (
              <option key={value} value={value}>
                {copy[value]}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="fo-project-list" ref={listRef}>
        {filtered.map((project, index) => {
          const expanded = Boolean(query || source !== 'all' || open[project.key]);
          const visible =
            query || source !== 'all' || showAll[project.key] || props.expandedView
              ? project.rooms
              : project.rooms.filter(
                  (r, i) =>
                    i < 4 ||
                    r.session.id === selectedRootId ||
                    r.state === 'working' ||
                    r.state === 'waiting',
                );
          const regionId = `${id}-project-${index}`;
          return (
            <section
              key={project.key}
              className="fo-project-group"
              data-project-key={project.key}
              data-dragging={dragKey === project.key || undefined}
              data-drop={drop?.key === project.key ? (drop.after ? 'after' : 'before') : undefined}
              onDragOver={(e) => {
                if (!dragKey || dragKey === project.key) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const bounds = e.currentTarget.getBoundingClientRect();
                setDrop({ key: project.key, after: e.clientY > bounds.top + bounds.height / 2 });
                const list = listRef.current;
                if (list) {
                  const box = list.getBoundingClientRect();
                  if (e.clientY < box.top + 25) list.scrollTop -= 14;
                  else if (e.clientY > box.bottom - 25) list.scrollTop += 14;
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragKey && e.dataTransfer.getData('text/plain') === dragKey) {
                  const bounds = e.currentTarget.getBoundingClientRect();
                  reorder(dragKey, project.key, e.clientY > bounds.top + bounds.height / 2);
                }
                setDragKey(null);
                setDrop(null);
              }}
            >
              <button
                className="fo-project-heading"
                aria-expanded={expanded}
                aria-controls={regionId}
                draggable={groups.length > 1}
                aria-describedby={groups.length > 1 ? id + '-reorder' : undefined}
                onDragStart={(e) => {
                  if (groups.length < 2) {
                    e.preventDefault();
                    return;
                  }
                  setDragKey(project.key);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', project.key);
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setDrop(null);
                }}
                onKeyDown={(e) => {
                  if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
                  e.preventDefault();
                  const direction = e.key === 'ArrowUp' ? -1 : 1;
                  const target = filtered[index + direction];
                  if (target) reorder(project.key, target.key, direction > 0);
                }}
                title={project.name}
                onClick={() => setOpen((previous) => ({ ...previous, [project.key]: !expanded }))}
              >
                {groups.length > 1 && (
                  <span className="fo-room-grip" aria-hidden="true">
                    ⠿
                  </span>
                )}
                <Icon name="files" size={15} />
                <ProjectName project={project.rooms[0]?.session} fallback={project.name} />
                {project.working > 0 ? (
                  <span className="fo-project-count" data-state="working">
                    <i aria-hidden="true" />
                    {project.working} {copy.working}
                  </span>
                ) : project.waiting > 0 ? (
                  <span className="fo-project-count" data-state="waiting">
                    <i aria-hidden="true" />
                    {project.waiting} {copy.waiting}
                  </span>
                ) : (
                  <span
                    className="fo-project-total"
                    aria-label={`${project.rooms.length} ${copy.session}`}
                  >
                    {project.rooms.length}
                  </span>
                )}
                <span className="fo-project-chevron" aria-hidden="true">
                  <Icon name="chevron" size={11} />
                </span>
              </button>
              <div id={regionId} hidden={!expanded} className="fo-project-sessions">
                {visible.map(({ session, state }) => {
                  const title = sessionTitle(session, copy.session);
                  const label = copy[state === 'unknown' ? 'unknownState' : state];
                  return (
                    <button
                      key={session.id}
                      className="fo-project-session"
                      data-office-id={session.id}
                      data-office-state={state}
                      aria-pressed={session.id === selectedRootId}
                      title={`${title}\n${copy[session.source]} · ${label}\n${session.id}`}
                      onClick={() => props.onSelect(session)}
                    >
                      <i className="fo-project-light" aria-hidden="true" />
                      <strong>{title}</strong>
                      <small>
                        {copy[session.source]} · {label}
                      </small>
                    </button>
                  );
                })}
                {visible.length < project.rooms.length && (
                  <button
                    className="fo-project-more"
                    onClick={() => setShowAll((previous) => ({ ...previous, [project.key]: true }))}
                  >
                    {copy.moreSessions} ({project.rooms.length - visible.length})
                  </button>
                )}
              </div>
            </section>
          );
        })}
        {!filtered.length && (
          <p className="fo-project-empty">
            {groups.length
              ? copy.noMatch
              : props.paused
                ? copy.paused
                : props.connection !== 'connected'
                  ? copy.offline
                  : props.expandedView
                    ? copy.noSessions
                    : copy.noActiveRooms}
          </p>
        )}
      </div>
    </div>
  );
}
