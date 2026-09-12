import { createHash } from 'node:crypto';
import type { AgentKind, Locale, ObservationEvent, SessionView, Source } from '../shared/contract.ts';

type Data = Record<string, unknown>;
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const safeId = (value: unknown): string => /^[a-zA-Z0-9_.:-]{1,160}$/.test(string(value)) ? string(value) : '';
const validTime = (value: unknown, fallback: string): string => {
  const time = string(value);
  return time && Number.isFinite(Date.parse(time)) ? new Date(time).toISOString() : fallback;
};

// This boundary deliberately never projects arguments, tool output, reasoning,
// instructions, environment values, or entire records into the browser model.
export function publicText(value: unknown, limit = 1200): string {
  return string(value)
    .replace(/<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/g, '')
    .replace(/(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{12,}/g, '[redacted]')
    .replace(/(bearer\s+)[A-Za-z0-9._~+\/-]{8,}/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|password|passwd|secret|access[_-]?token|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, limit);
}

export function detectLocale(value: unknown, current: Locale | null = null): Locale | null {
  const text = string(value).replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+|[A-Za-z]:\\\S+|\S+\.(?:ts|js|json|md|py)\b/g, ' ').toLocaleLowerCase('tr');
  if (text.trim().length < 12) return current;
  const tr = (text.match(/\b(?:bir|bu|ile|için|şimdi|lütfen|olarak|bunu|olsun|devam|yap|evet|güzel|benim|sadece|başla|başlıyormuyuz)\b/gu) ?? []).length
    + (/[çğıöşü]/u.test(text) ? 2 : 0);
  const en = (text.match(/\b(?:the|please|this|with|should|implement|create|update|for|and|can|we|you|test)\b/g) ?? []).length;
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
      if (!id) { this.unsupportedRecords++; return; }
      if (this.session) return;
      const subagent = object(object(data.source).subagent);
      const spawned = object(subagent.thread_spawn);
      const isSubagent = Object.keys(subagent).length > 0;
      // Fork ancestry does not imply an office-team membership.
      const parentId = isSubagent ? safeId(data.parent_thread_id) || safeId(spawned.parent_thread_id) || null : null;
      const internal = string(subagent.other) || string(subagent.type);
      const agentKind: AgentKind = internal ? 'internal' : isSubagent ? 'subagent' : 'main';
      const sourceHint = `${string(data.source)} ${string(data.originator)}`.toLowerCase();
      const source: Source = /desktop/.test(sourceHint) ? 'desktop' : /cli|exec/.test(sourceHint) ? 'cli' : 'unknown';
      const startedAt = validTime(data.timestamp ?? row.timestamp, observedAt);
      this.session = {
        id, parentId, rootId: parentId ?? id, parentResolved: !parentId, source, agentKind,
        agentName: agentKind === 'subagent' ? publicText(data.agent_nickname, 80).trim() || null : null,
        agentTask: agentKind === 'subagent'
          ? publicText(string(data.agent_path).split('/').filter(Boolean).at(-1), 100).trim() || null
          : null,
        project: publicText(string(data.cwd).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '—', 100),
        version: publicText(data.cli_version, 40) || 'unknown',
        status: 'unknown', locale: null, localeEvidence: 'none', startedAt,
        lastEventAt: startedAt, lastObservedAt: observedAt, currentTool: null, lastTurnId: null,
        recordAvailable: true, historyPartial: false, events: [],
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
            this.session.status = 'working'; this.session.currentTool = null;
            this.session.counts.turns++; this.session.lastTurnId = safeId(data.turn_id) || null;
          }
          return;
        case 'task_complete':
          if (this.emit('turn_completed', data, row.timestamp, observedAt)) {
            this.session.status = 'idle'; this.session.currentTool = null;
          }
          return;
        case 'turn_aborted':
          if (this.emit('turn_aborted', data, row.timestamp, observedAt)) {
            this.session.status = 'interrupted'; this.session.currentTool = null;
          }
          return;
        case 'user_message': {
          const detected = detectLocale(data.message, this.session.locale);
          if (detected) { this.session.locale = detected; this.session.localeEvidence = 'user_message'; }
          if (this.emit('user_message', data, row.timestamp, observedAt)) this.session.counts.messages++;
          return;
        }
        case 'agent_message':
          if (data.phase === 'commentary' || data.phase === 'final' || data.phase === 'final_answer') {
            if (this.emit('assistant_message', data, row.timestamp, observedAt, { text: publicText(data.message) })) this.session.counts.messages++;
          }
          return;
        case 'item_completed': {
          // This event is a second representation of tool completion. It is
          // intentionally ignored until its item schema is separately verified.
          return;
        }
        default: return;
      }
    }
    if (type === 'response_item') {
      // Desktop 0.153.4 stores visible chat here. The explicit phase is
      // required for assistants; unclassified/analysis messages stay private.
      if (data.type === 'message') {
        const metadata = object(data.internal_chat_message_metadata_passthrough);
        const parts = Array.isArray(data.content) ? data.content : [];
        const message = parts.map(object).filter(part => ['input_text','output_text','text'].includes(string(part.type)))
          .map(part => string(part.text)).join('\n');
        const messageData = { ...data, message, turn_id: metadata.turn_id ?? data.turn_id };
        if (data.role === 'user') {
          const kinds = Array.isArray(metadata.content_item_kinds) ? metadata.content_item_kinds : [];
          if (kinds.length && !kinds.includes('user.text')) return;
          const detected = detectLocale(message, this.session.locale);
          if (detected) { this.session.locale = detected; this.session.localeEvidence = 'user_message'; }
          if (this.emit('user_message', messageData, row.timestamp, observedAt)) this.session.counts.messages++;
        } else if (data.role === 'assistant' && ['commentary','final','final_answer'].includes(string(data.phase))) {
          if (this.emit('assistant_message', messageData, row.timestamp, observedAt, { text: publicText(message) })) this.session.counts.messages++;
        }
        return;
      }
      const callId = safeId(data.call_id);
      if ((data.type === 'function_call' || data.type === 'custom_tool_call') && callId) {
        const toolName = /^[a-zA-Z0-9_.:-]{1,120}$/.test(string(data.name)) ? string(data.name) : 'unknown';
        const waiting = /(?:request_user_input|ask_user)/i.test(toolName);
        if (this.emit(waiting ? 'waiting' : 'tool_started', data, row.timestamp, observedAt, { toolName })) {
          this.calls.set(callId, toolName);
          if (this.calls.size > 1000) this.calls.delete(this.calls.keys().next().value!);
          this.session.counts.toolStarts++; this.session.currentTool = toolName;
          this.session.status = waiting ? 'waiting' : 'working';
        }
      } else if ((data.type === 'function_call_output' || data.type === 'custom_tool_call_output') && callId) {
        const toolName = this.calls.get(callId) ?? 'unknown';
        if (this.emit('tool_completed', data, row.timestamp, observedAt, { toolName, outcome: 'unknown' })) {
          this.session.counts.toolCompletions++;
          this.calls.delete(callId);
          this.session.currentTool = [...this.calls.values()].at(-1) ?? null;
          this.session.status = 'working';
        }
      }
      return;
    }
    // Known non-public record families are omitted completely.
    if (!['turn_context', 'token_usage_record', 'world_state', 'compacted'].includes(type)) this.unsupportedRecords++;
  }

  private emit(kind: ObservationEvent['kind'], data: Data, timestamp: unknown, observedAt: string, extra: Partial<ObservationEvent> = {}): boolean {
    const session = this.session!;
    const occurredAt = validTime(timestamp, observedAt);
    const turnId = safeId(data.turn_id) || session.lastTurnId || undefined;
    const isMessage = kind === 'assistant_message' || kind === 'user_message';
    const identity = isMessage ? '' : safeId(data.call_id) || safeId(data.id) || string(timestamp);
    const textKey = isMessage ? publicText(data.message) : '';
    const id = createHash('sha256').update(`${session.id}|${kind}|${identity}|${turnId}|${textKey}`).digest('hex').slice(0,24);
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    if (this.seen.size > 6000) this.seen.delete(this.seen.values().next().value!);
    session.events.push({ id, sessionId: session.id, kind, occurredAt, observedAt, turnId, ...extra });
    if (session.events.length > 120) session.events.shift();
    session.lastEventAt = occurredAt; session.lastObservedAt = observedAt;
    return true;
  }
}
