import { memo, useEffect, useMemo, useState } from 'react';
import { CurvedScreen } from './CurvedScreen.tsx';
import type { Quad, ScreenCurve } from './scene-layout.ts';
import type { SessionView } from '../../shared/contract.ts';
import { STALE_AFTER_MS } from '../office/office-state.ts';
import { INITIAL_MOTION_POSE, liveMotion, liveRobotMotion } from './live-motion.ts';
import type { Connection } from './fixed-state.ts';
import { advanceFrame, colorTokens, frameDelay, screenProgram } from './monitor-program.ts';
import './decorative-screen.css';

/** One visibility/media subscription for all screens, even when characters are hidden. */
export function useScreenEnvironment(sessions: (SessionView | undefined)[], now: number) {
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [, tick] = useState(0);
  const time = Math.max(now, Date.now());
  const expiration = Math.min(
    ...sessions
      .map((s) => Date.parse(s?.lastEventAt ?? '') + STALE_AFTER_MS + 1)
      .filter((t) => Number.isFinite(t) && t > time),
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const visibility = () => setHidden(document.hidden);
    const preference = () => setReduced(media.matches);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', preference);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', preference);
    };
  }, []);
  useEffect(() => {
    if (hidden || !Number.isFinite(expiration)) return;
    const timer = window.setTimeout(() => tick((n) => n + 1), Math.max(0, expiration - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiration, hidden]);
  return { hidden, reduced, now: time };
}

export function screenIsWorking(
  session: SessionView | undefined,
  rootId: string | undefined,
  connection: Connection,
  paused: boolean,
  hidden: boolean,
  now: number,
) {
  const motion =
    session?.agentKind === 'main'
      ? liveMotion(INITIAL_MOTION_POSE, session, connection, paused, hidden, now)
      : liveRobotMotion(INITIAL_MOTION_POSE, session, rootId, connection, paused, hidden, now);
  return motion.mode === 'typing' && !motion.frozen;
}

export const ColoredText = memo(function ColoredText({ text }: { text: string }) {
  return (
    <>
      {colorTokens(text).map((t, i) => (
        <span key={i} className={`fo-syntax-${t.tone}`}>
          {t.value}
        </span>
      ))}
    </>
  );
});

export const DecorativeScreen = memo(function DecorativeScreen({
  id,
  working,
  frozen,
  compact = false,
  surface,
}: {
  id: string;
  working: boolean;
  frozen: boolean;
  compact?: boolean;
  surface?: { quad: Quad; curve: ScreenCurve };
}) {
  const program = useMemo(() => screenProgram(id), [id]);
  const ambient = /^(blue|green|purple)-/.test(id);
  const [frame, setFrame] = useState({ line: 12, characters: 18 });
  const running = working && !frozen;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setFrame((f) => advanceFrame(program, f)),
      frameDelay(program, frame),
    );
    return () => window.clearTimeout(timer);
  }, [running, program, frame]);
  const rowCount = ambient ? 5 : compact ? 8 : 11;
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const line = frame.line - (rowCount - 1) + i;
    const text = program.lines[line % program.lines.length];
    return { line, text: line === frame.line ? text.slice(0, frame.characters) : text };
  });
  const content = (
    <div
      className={`fo-code-screen fo-code-${program.kind}${compact ? ' fo-code-compact' : ''}${ambient ? ' fo-code-ambient' : ''}`}
      data-screen-id={id}
      data-screen-kind={program.kind}
      data-running={running}
      data-frozen={frozen}
      data-frame={`${frame.line}:${frame.characters}`}
      aria-hidden="true"
    >
      <header className="fo-code-title">
        <span className="fo-code-lights">
          <i />
          <i />
          <i />
        </span>
        <span>{program.kind === 'terminal' ? '~ / ' + program.folder : program.file}</span>
        <b>⌘</b>
      </header>
      {!ambient && (
        <div className="fo-code-tabs">
          <span>{program.kind === 'terminal' ? 'TERMINAL' : program.file}</span>
          <span>{program.kind === 'terminal' ? 'OUTPUT' : 'theme.css'}</span>
        </div>
      )}
      <div className="fo-code-workspace">
        {program.kind === 'files' && !ambient && (
          <aside className="fo-code-tree">
            <b>EXPLORER</b>
            {[
              '⌄ ' + program.folder,
              '  ⌄ src',
              '    ◇ scene.ts',
              '    ◇ motion.ts',
              '    ◇ theme.css',
              '  › assets',
              '  › components',
              '  ◇ package.json',
            ].map((file, i) => (
              <div
                key={file}
                className={i === 2 + (Math.floor(frame.line / 3) % 3) ? 'fo-tree-selected' : ''}
              >
                {file}
              </div>
            ))}
          </aside>
        )}
        <div className="fo-code-viewport">
          <div
            className="fo-code-track"
            style={{
              // Restart the scroll without replacing the track and all its rows.
              animationName:
                frame.line === 12
                  ? 'none'
                  : frame.line % 2 === 0
                    ? 'fo-code-scroll'
                    : 'fo-code-scroll-next',
              animationPlayState: running ? 'running' : 'paused',
            }}
          >
            {rows.map(({ line, text }) => (
              <div
                key={line}
                className={`fo-code-row${line === frame.line ? ' fo-code-current' : ''}`}
              >
                {program.kind !== 'terminal' && (
                  <small>{String((line % 99) + 1).padStart(2, '0')}</small>
                )}
                <code
                  className={
                    program.kind === 'terminal'
                      ? text.trimStart().startsWith('$')
                        ? 'fo-terminal-command'
                        : text.includes('✓')
                          ? 'fo-terminal-ready'
                          : text.includes('▸')
                            ? 'fo-terminal-progress'
                            : 'fo-terminal-log'
                      : undefined
                  }
                >
                  {program.kind === 'terminal' ? text : <ColoredText text={text} />}
                  {line === frame.line && <i className="fo-code-cursor" />}
                </code>
              </div>
            ))}
          </div>
        </div>
        {program.kind === 'editor' && !compact && !ambient && (
          <div className="fo-code-minimap">
            {program.lines.slice(0, 25).map((line, i) => (
              <i key={i} style={{ width: `${20 + (line.length % 70)}%` }} />
            ))}
          </div>
        )}
      </div>
      <footer className="fo-code-status">
        <span>⑂ {program.folder}</span>
        <span>{program.kind === 'terminal' ? 'shell' : 'UTF-8  ·  TypeScript'}</span>
      </footer>
    </div>
  );
  return surface ? <CurvedScreen {...surface}>{content}</CurvedScreen> : content;
});
