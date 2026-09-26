export const SCHEMA_VERSION = 1;
export type Source = 'desktop' | 'cli' | 'unknown';
export type AgentKind = 'main' | 'subagent' | 'internal';
export type SessionStatus = 'working' | 'idle' | 'waiting' | 'interrupted' | 'unknown';
export type Locale = 'tr' | 'en';
export type EventKind =
  | 'session'
  | 'turn_started'
  | 'turn_completed'
  | 'turn_aborted'
  | 'tool_started'
  | 'tool_completed'
  | 'user_message'
  | 'assistant_message'
  | 'waiting';

export interface PendingQuestion {
  id: string;
  callId: string;
  index: number;
  title: string;
  options: string[];
  asynchronous: boolean;
}

export interface ToolAction {
  kind: 'command' | 'read' | 'edit' | 'create' | 'delete' | 'tool';
  toolName: string;
  detail?: string;
  /** Statically identified inside a wrapper; execution of each nested call is unverified. */
  nested?: boolean;
}

export interface ObservationEvent {
  id: string;
  sessionId: string;
  kind: EventKind;
  occurredAt: string;
  observedAt: string;
  turnId?: string;
  toolName?: string;
  callId?: string;
  actions?: ToolAction[];
  questions?: PendingQuestion[];
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
  /** Explicit public identity from session metadata; older records may omit it. */
  agentName?: string | null;
  agentTask?: string | null;
  project: string;
  /** Opaque working-directory identity; raw paths are not sent to the browser. */
  projectKey?: string;
  /** Explicit public Codex title; absent titles use an honest UI fallback. */
  title?: string | null;
  version: string;
  status: SessionStatus;
  locale: Locale | null;
  localeEvidence: 'user_message' | 'none';
  startedAt: string;
  lastEventAt: string;
  lastObservedAt: string;
  currentTool: string | null;
  /** Visual attention is independent of background execution status. */
  pendingQuestions?: PendingQuestion[];
  lastTurnId: string | null;
  recordAvailable: boolean;
  historyPartial: boolean;
  events: ObservationEvent[];
  counts: { turns: number; toolStarts: number; toolCompletions: number; messages: number };
}

export interface OfficeRuntimeState {
  state: 'running' | 'stopped' | 'starting' | 'stopping' | 'restarting' | 'error';
  updatedAt: string;
  failed: boolean;
}

export interface ObserverSnapshot {
  /** Local office scanning state; unrelated to Codex task execution. */
  runtime?: OfficeRuntimeState;
  schemaVersion: typeof SCHEMA_VERSION;
  revision: number;
  generatedAt: string;
  scan: {
    checkedAt: string | null;
    status: 'starting' | 'ready' | 'source_missing' | 'error';
    files: number;
    candidateFiles: number;
    /** Metadata-only inventory size; not the number of loaded transcripts. */
    discoveryFiles?: number;
    /** Recently written candidates outside the initial creation-date window. */
    reactivatedFiles?: number;
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
