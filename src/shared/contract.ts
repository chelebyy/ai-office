export const SCHEMA_VERSION = 1;
export type Source = 'desktop' | 'cli' | 'unknown';
export type AgentKind = 'main' | 'subagent' | 'internal';
export type SessionStatus = 'working' | 'idle' | 'waiting' | 'interrupted' | 'unknown';
export type Locale = 'tr' | 'en';
export type EventKind = 'session' | 'turn_started' | 'turn_completed' | 'turn_aborted'
  | 'tool_started' | 'tool_completed' | 'user_message' | 'assistant_message' | 'waiting';

export interface ObservationEvent {
  id: string;
  sessionId: string;
  kind: EventKind;
  occurredAt: string;
  observedAt: string;
  turnId?: string;
  toolName?: string;
  text?: string;
  durationMs?: number;
  outcome?: 'success' | 'error' | 'unknown';
}

export interface SessionView {
  id: string;
  parentId: string | null;
  rootId: string;
  parentResolved: boolean;
  source: Source;
  agentKind: AgentKind;
  project: string;
  version: string;
  status: SessionStatus;
  locale: Locale | null;
  localeEvidence: 'user_message' | 'none';
  startedAt: string;
  lastEventAt: string;
  lastObservedAt: string;
  currentTool: string | null;
  lastTurnId: string | null;
  recordAvailable: boolean;
  historyPartial: boolean;
  events: ObservationEvent[];
  counts: { turns: number; toolStarts: number; toolCompletions: number; messages: number };
}

export interface ObserverSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  revision: number;
  generatedAt: string;
  scan: {
    checkedAt: string | null;
    status: 'starting' | 'ready' | 'source_missing' | 'error';
    files: number;
    candidateFiles: number;
    bytesRead: number;
    malformedLines: number;
    oversizedLines: number;
    resets: number;
    readErrors: number;
    unsupportedRecords: number;
    lastReadDurationMs: number;
    pollIntervalMs: number;
    recentDays: number;
    maxFiles: number;
  };
  sessions: SessionView[];
}
