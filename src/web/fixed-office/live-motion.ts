import type { SessionView } from '../../shared/contract.ts';
import { freshness, type Connection } from './fixed-state.ts';

export type MotionMode = 'idle' | 'typing';
export type MotionPose = { sessionId: string | null; mode: MotionMode };
export const INITIAL_MOTION_POSE: MotionPose = { sessionId: null, mode: 'idle' };

/** Retain the pose during uncertainty, but never keep its animation running. */
function sessionMotion(
  previous: MotionPose,
  session: SessionView | undefined,
  connection: Connection,
  paused: boolean,
  hidden: boolean,
  now: number,
) {
  const pose =
    session && session.id !== previous.sessionId
      ? { sessionId: session.id, mode: 'idle' as const }
      : previous;
  const current =
    !!session &&
    !hidden &&
    freshness(session, connection, paused, now) === 'current' &&
    session.status !== 'unknown';
  return {
    sessionId: pose.sessionId,
    mode: current
      ? ((session.status === 'working' && !session.pendingQuestions?.length
          ? 'typing'
          : 'idle') as MotionMode)
      : pose.mode,
    frozen: !current,
  };
}

export function liveMotion(
  previous: MotionPose,
  session: SessionView | undefined,
  connection: Connection,
  paused: boolean,
  hidden: boolean,
  now: number,
) {
  return sessionMotion(
    previous,
    session?.agentKind === 'main' ? session : undefined,
    connection,
    paused,
    hidden,
    now,
  );
}

export function liveRobotMotion(
  previous: MotionPose,
  session: SessionView | undefined,
  rootId: string | undefined,
  connection: Connection,
  paused: boolean,
  hidden: boolean,
  now: number,
) {
  const member =
    rootId &&
    session?.agentKind === 'subagent' &&
    session.parentResolved &&
    session.rootId === rootId
      ? session
      : undefined;
  return sessionMotion(previous, member, connection, paused, hidden, now);
}
