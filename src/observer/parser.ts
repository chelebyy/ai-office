import { createHash } from 'node:crypto';
import type {
  AgentKind,
  Locale,
  ObservationEvent,
  SessionView,
  Source,
} from '../shared/contract.ts';

import {
  publicText,
  answeredQuestionIds,
  isQuestionFollowup,
  questionsFromCall,
  toolActions,
} from './public-content.ts';
export { publicText } from './public-content.ts';

type Data = Record<string, unknown>;
const object = (value: unknown): Data =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Data) : {};
const string = (value: unknown): string => (typeof value === 'string' ? value : '');
const safeId = (value: unknown): string =>
  /^[a-zA-Z0-9_.:-]{1,160}$/.test(string(value)) ? string(value) : '';
const validTime = (value: unknown, fallback: string): string => {
  const time = string(value);
  return time && Number.isFinite(Date.parse(time)) ? new Date(time).toISOString() : fallback;
};

export function detectLocale(value: unknown, current: Locale | null = null): Locale | null {
  const text = string(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^\s*>.*$/gm, ' ')
    .replace(/^\s*(?:(?:\w*Error|Exception):.*|Traceback\b.*|at\s+\S.*)$/gm, ' ')
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+|[A-Za-z]:\\\S+|\S+\.(?:tsx?|jsx?|json|md|py)\b/g, ' ')
    .toLowerCase()
    .replace(/\u0307/g, '');
  if (text.trim().length < 12) return current;
  const words = text.match(/\p{L}+/gu) ?? [];
  const turkishWords = words.filter((word) =>
    /^(?:bir|bu|ile|için|şimdi|lütfen|olarak|bunu|olsun|devam|yap|evet|güzel|benim|sadece|başla|başlıyormuyuz|istiyorum|düzelt|ekle|nasıl|neden|tekrar|yapalım)$/.test(
      word,
    ),
  ).length;
  // Shared accents also occur in German and other languages. They are only
  // supporting evidence after a Turkish word, never a language decision alone.
  const tr = turkishWords + (turkishWords > 0 && /[çğıöşü]/u.test(text) ? 1 : 0);
  const en = words.filter((word) =>
    /^(?:the|please|this|with|should|implement|create|update|for|and|can|we|you|test)$/.test(word),
  ).length;
  if (tr >= 2 && tr > en) return 'tr';
  if (en >= 3 && en > tr) return 'en';
  return current;
}

export class RecordReducer {
  session: SessionView | null = null;
  unsupportedRecords = 0;
  private calls = new Map<string, string>();
  private seen = new Set<string>();

  accept(input: unknown, observedAt: string): void {
    const row = object(input);
    const data = object(row.payload);
    const type = string(row.type);
    if (type === 'session_meta') {
      const id = safeId(data.id) || safeId(data.session_id);
      if (!id) {
        this.unsupportedRecords++;
        return;
      }
      if (this.session) return;
      const subagent = object(object(data.source).subagent);
      const spawned = object(subagent.thread_spawn);
      const isSubagent = Object.keys(subagent).length > 0;
      // Fork ancestry does not imply an office-team membership.
      const parentId = isSubagent
        ? safeId(data.parent_thread_id) || safeId(spawned.parent_thread_id) || null
        : null;
      const internal = string(subagent.other) || string(subagent.type);
      const agentKind: AgentKind = internal ? 'internal' : isSubagent ? 'subagent' : 'main';
      const sourceHint = `${string(data.source)} ${string(data.originator)}`.toLowerCase();
      const source: Source = /desktop/.test(sourceHint)
        ? 'desktop'
        : /cli|exec/.test(sourceHint)
          ? 'cli'
          : 'unknown';
      const startedAt = validTime(data.timestamp ?? row.timestamp, observedAt);
      const cwd = string(data.cwd).replace(/\\/g, '/').replace(/\/+$/, '');
      const projectPath = /^(?:[a-z]:|\/\/)/i.test(cwd) ? cwd.toLowerCase() : cwd;
      const projectKey = createHash('sha256')
        .update(projectPath || id)
        .digest('hex')
        .slice(0, 24);
      this.session = {
        id,
        parentId,
        rootId: parentId ?? id,
        parentResolved: !parentId,
        source,
        agentKind,
        agentName:
          agentKind === 'subagent' ? publicText(data.agent_nickname, 80).trim() || null : null,
        agentTask:
          agentKind === 'subagent'
            ? publicText(string(data.agent_path).split('/').filter(Boolean).at(-1), 100).trim() ||
              null
            : null,
        project: publicText(cwd.split('/').pop() || '—', 100),
        projectKey,
        version: publicText(data.cli_version, 40) || 'unknown',
        status: 'unknown',
        locale: null,
        localeEvidence: 'none',
        startedAt,
        lastEventAt: startedAt,
        lastObservedAt: observedAt,
        currentTool: null,
        lastTurnId: null,
        recordAvailable: true,
        historyPartial: false,
        events: [],
        counts: { turns: 0, toolStarts: 0, toolCompletions: 0, messages: 0 },
      };
      this.emit('session', data, row.timestamp, observedAt);
      return;
    }
    if (!this.session) return;
    // Internal infrastructure transcripts are not public assistant chat.
    if (this.session.agentKind === 'internal') return;
    if (type === 'event_msg') {
      switch (data.type) {
        case 'task_started':
          if (this.emit('turn_started', data, row.timestamp, observedAt)) {
            this.session.status = 'working';
            this.session.currentTool = null;
            this.session.counts.turns++;
            this.session.lastTurnId = safeId(data.turn_id) || null;
          }
          return;
        case 'task_complete':
          if (this.emit('turn_completed', data, row.timestamp, observedAt)) {
            this.session.status = 'idle';
            this.session.currentTool = null;
          }
          return;
        case 'turn_aborted':
          if (this.emit('turn_aborted', data, row.timestamp, observedAt)) {
            this.session.status = 'interrupted';
            this.session.currentTool = null;
          }
          return;
        case 'user_message': {
          const detected = detectLocale(data.message, this.session.locale);
          if (detected) {
            this.session.locale = detected;
            this.session.localeEvidence = 'user_message';
          }
          if (this.emit('user_message', data, row.timestamp, observedAt)) {
            this.answerQuestions(string(data.message));
            this.session.counts.messages++;
          }
          return;
        }
        case 'agent_message':
          if (
            data.phase === 'commentary' ||
            data.phase === 'final' ||
            data.phase === 'final_answer'
          ) {
            if (
              this.emit('assistant_message', data, row.timestamp, observedAt, {
                text: publicText(data.message, 8000),
              })
            )
              this.session.counts.messages++;
          }
          return;
        case 'item_completed': {
          // This event is a second representation of tool completion. It is
          // intentionally ignored until its item schema is separately verified.
          return;
        }
        default:
          return;
      }
    }
    if (type === 'response_item') {
      // Desktop 0.153.4 stores visible chat here. The explicit phase is
      // required for assistants; unclassified/analysis messages stay private.
      if (data.type === 'message') {
        const metadata = object(data.internal_chat_message_metadata_passthrough);
        const parts = Array.isArray(data.content) ? data.content : [];
        const message = parts
          .map(object)
          .filter((part) => ['input_text', 'output_text', 'text'].includes(string(part.type)))
          .map((part) => string(part.text))
          .join('\n');
        const messageData = { ...data, message, turn_id: metadata.turn_id ?? data.turn_id };
        if (data.role === 'user') {
          const kinds = Array.isArray(metadata.content_item_kinds)
            ? metadata.content_item_kinds
            : [];
          if (kinds.length && !kinds.includes('user.text')) return;
          const detected = detectLocale(message, this.session.locale);
          if (detected) {
            this.session.locale = detected;
            this.session.localeEvidence = 'user_message';
          }
          if (this.emit('user_message', messageData, row.timestamp, observedAt)) {
            this.answerQuestions(message);
            this.session.counts.messages++;
          }
        } else if (
          data.role === 'assistant' &&
          ['commentary', 'final', 'final_answer'].includes(string(data.phase))
        ) {
          if (
            this.emit('assistant_message', messageData, row.timestamp, observedAt, {
              text: publicText(message, 8000),
            })
          )
            this.session.counts.messages++;
        }
        return;
      }
      const callId = safeId(data.call_id);
      if ((data.type === 'function_call' || data.type === 'custom_tool_call') && callId) {
        const toolName = /^[a-zA-Z0-9_.:-]{1,120}$/.test(string(data.name))
          ? string(data.name)
          : 'unknown';
        // Async questions return immediately while work continues; only known
        // blocking tool names are evidence that execution is waiting for input.
        const questions = questionsFromCall(toolName, data.arguments, callId);
        const actions = toolActions(toolName, data.arguments, data.input);
        const waiting = /(?:^|[.:])(?:request_user_input|ask_user)$/i.test(toolName);
        if (
          this.emit(waiting ? 'waiting' : 'tool_started', data, row.timestamp, observedAt, {
            toolName,
            callId,
            ...(actions.length ? { actions } : {}),
            ...(questions.length ? { questions } : {}),
          })
        ) {
          if (questions.length)
            this.session.pendingQuestions = [
              ...(this.session.pendingQuestions ?? []),
              ...questions,
            ].slice(-12);
          this.calls.set(callId, toolName);
          if (this.calls.size > 1000) this.calls.delete(this.calls.keys().next().value!);
          this.session.counts.toolStarts++;
          this.session.currentTool = toolName;
          this.session.status = waiting ? 'waiting' : 'working';
        }
      } else if (
        (data.type === 'function_call_output' || data.type === 'custom_tool_call_output') &&
        callId
      ) {
        const toolName = this.calls.get(callId) ?? 'unknown';
        if (
          this.emit('tool_completed', data, row.timestamp, observedAt, {
            toolName,
            callId,
            outcome: 'unknown',
          })
        ) {
          this.session.counts.toolCompletions++;
          this.calls.delete(callId);
          this.session.pendingQuestions = this.session.pendingQuestions?.filter(
            (q) => q.callId !== callId || q.asynchronous,
          );
          this.session.currentTool = [...this.calls.values()].at(-1) ?? null;
          this.session.status = 'working';
        }
      }
      return;
    }
    // Known non-public record families are omitted completely.
    if (!['turn_context', 'token_usage_record', 'world_state', 'compacted'].includes(type))
      this.unsupportedRecords++;
  }

  private answerQuestions(message: string) {
    const answered = answeredQuestionIds(message);
    if (answered.size && this.session) {
      this.session.pendingQuestions = this.session.pendingQuestions?.filter(
        (q) => !answered.has(q.id),
      );
    } else if (isQuestionFollowup(message) && this.session) {
      // The conversation continued in this session. Keep the original question
      // in event history without presenting an old async card as a current wait.
      this.session.pendingQuestions = this.session.pendingQuestions?.filter((q) => !q.asynchronous);
    }
  }

  private emit(
    kind: ObservationEvent['kind'],
    data: Data,
    timestamp: unknown,
    observedAt: string,
    extra: Partial<ObservationEvent> = {},
  ): boolean {
    const session = this.session!;
    const occurredAt = validTime(timestamp, observedAt);
    const turnId = safeId(data.turn_id) || session.lastTurnId || undefined;
    const isMessage = kind === 'assistant_message' || kind === 'user_message';
    const identity = isMessage ? '' : safeId(data.call_id) || safeId(data.id) || string(timestamp);
    const textKey = isMessage ? publicText(data.message, 8000) : '';
    const id = createHash('sha256')
      .update(`${session.id}|${kind}|${identity}|${turnId}|${textKey}`)
      .digest('hex')
      .slice(0, 24);
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    if (this.seen.size > 6000) this.seen.delete(this.seen.values().next().value!);
    session.events.push({
      id,
      sessionId: session.id,
      kind,
      occurredAt,
      observedAt,
      turnId,
      ...extra,
    });
    if (session.events.length > 120) session.events.shift();
    // Retain complete recent messages within a per-session text budget. With the
    // reader's 2*maxFiles retention cap this also bounds aggregate message text.
    let retainedText = 0;
    for (let index = session.events.length - 1; index >= 0; index--) {
      const event = session.events[index]!;
      retainedText += event.text?.length ?? 0;
      if (event.text && retainedText > 16_000) session.events.splice(index, 1);
    }
    session.lastEventAt = occurredAt;
    session.lastObservedAt = observedAt;
    return true;
  }
}
