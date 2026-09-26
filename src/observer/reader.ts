import { EventEmitter } from 'node:events';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ioDeadline } from './io-deadline.ts';
import { RecordReducer } from './parser.ts';
import { SessionTitles } from './session-titles.ts';
import { discoverRollouts, type RolloutCandidate } from './rollout-discovery.ts';
import { SCHEMA_VERSION } from '../shared/contract.ts';
import type { ObserverSnapshot, SessionView } from '../shared/contract.ts';

export interface ObserverOptions {
  codexHome?: string;
  pollIntervalMs?: number;
  recentDays?: number;
  maxFiles?: number;
  historyBytes?: number;
  maxLineBytes?: number;
  now?: () => Date;
}

type FileState = {
  reducer: RecordReducer;
  offset: number;
  pending: Buffer;
  discarding: boolean;
  inode: number;
  mtime: number;
  present: boolean;
};

export class CodexObserver extends EventEmitter {
  readonly codexHome: string;
  readonly pollIntervalMs: number;
  readonly recentDays: number;
  readonly maxFiles: number;
  private historyBytes: number;
  private maxLineBytes: number;
  private now: () => Date;
  private files = new Map<string, FileState>();
  private retryAfter = new Map<string, number>();
  private titles: SessionTitles;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private inFlight: Promise<void> | null = null;
  private revision = 0;
  private scan: ObserverSnapshot['scan'];
  private published: ObserverSnapshot | null = null;

  constructor(options: ObserverOptions = {}) {
    super();
    this.codexHome = path.resolve(options.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'));
    this.titles = new SessionTitles(this.codexHome);
    this.pollIntervalMs = options.pollIntervalMs ?? 1500;
    this.recentDays = options.recentDays ?? 7;
    this.maxFiles = options.maxFiles ?? 60;
    this.historyBytes = options.historyBytes ?? 2 * 1024 * 1024;
    this.maxLineBytes = options.maxLineBytes ?? 1024 * 1024;
    this.now = options.now ?? (() => new Date());
    this.scan = {
      checkedAt: null, status: 'starting', files: 0, candidateFiles: 0, bytesRead: 0,
      malformedLines: 0, oversizedLines: 0, resets: 0, readErrors: 0,
      unsupportedRecords: 0, lastReadDurationMs: 0,
      pollIntervalMs: this.pollIntervalMs, recentDays: this.recentDays, maxFiles: this.maxFiles,
    };
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.scanOnce();
    const tick = async () => {
      if (this.stopped) return;
      await this.scanOnce();
      if (!this.stopped) this.timer = setTimeout(tick, this.pollIntervalMs);
    };
    if (!this.stopped) this.timer = setTimeout(tick, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.inFlight;
  }

  scanOnce(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.scanFiles().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  snapshot(): ObserverSnapshot {
    // HTTP and newly connected sockets see only a completed scan, never the
    // temporary unavailable flags and partial events of an in-flight scan.
    return this.published ? structuredClone(this.published) : {
      schemaVersion: SCHEMA_VERSION, revision: 0, generatedAt: this.now().toISOString(),
      scan: { ...this.scan, checkedAt: null, status: 'starting' }, sessions: [],
    };
  }

  private buildSnapshot(): ObserverSnapshot {
    const sessions: SessionView[] = [...this.files.values()].flatMap(file => {
      if (!file.reducer.session) return [];
      return [{ ...file.reducer.session, title: this.titles.get(file.reducer.session.id), recordAvailable: file.present,
        counts: { ...file.reducer.session.counts }, events: [...file.reducer.session.events] }];
    });
    // A file can be moved/rotated. Keep one view per source identity.
    const unique = new Map<string, SessionView>();
    for (const session of sessions) {
      const previous = unique.get(session.id);
      if (!previous || (!previous.recordAvailable && session.recordAvailable)
        || (previous.recordAvailable === session.recordAvailable && session.lastEventAt > previous.lastEventAt)) unique.set(session.id, session);
    }
    for (const session of unique.values()) {
      const visited = new Set([session.id]);
      let current = session;
      session.rootId = session.id;
      session.parentResolved = !session.parentId;
      while (current.parentId) {
        if (visited.has(current.parentId)) { session.parentResolved = false; break; }
        visited.add(current.parentId);
        const parent = unique.get(current.parentId);
        if (!parent) { session.rootId = current.parentId; session.parentResolved = false; break; }
        session.rootId = parent.id; session.parentResolved = true; current = parent;
      }
    }
    return {
      schemaVersion: SCHEMA_VERSION, revision: this.revision, generatedAt: this.now().toISOString(),
      scan: { ...this.scan },
      sessions: [...unique.values()].sort((a,b) => b.lastEventAt.localeCompare(a.lastEventAt)),
    };
  }

  private async scanFiles(): Promise<void> {
    const started = performance.now();
    const checkedAt = this.now().toISOString();
    try {
      await this.titles.refresh();
      const root = path.join(this.codexHome, 'sessions');
      await ioDeadline(stat(root));
      // Recent creation dates provide initial context; metadata-only discovery adds old resumptions.
      const datePaths = new Set<string>();
      for (let day = 0; day < this.recentDays; day++) {
        const date = this.now(); date.setUTCDate(date.getUTCDate() - day);
        datePaths.add(path.join(root, ...date.toISOString().slice(0,10).split('-')));
        datePaths.add(path.join(root, String(date.getFullYear()), String(date.getMonth() + 1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')));
      }
      const discovery = await discoverRollouts(root, datePaths, new Set(this.files.keys()), Date.parse(checkedAt));
      this.scan.readErrors += discovery.errors;
      this.scan.discoveryFiles = discovery.catalog.length;
      this.scan.reactivatedFiles = discovery.reactivated;
      this.scan.candidateFiles = discovery.candidates.length;
      for (const file of this.files.values()) file.present = false;
      const attempted = new Set<string>();
      const readFamily = async (candidate: RolloutCandidate): Promise<void> => {
        if (attempted.has(candidate.filename) || attempted.size >= this.maxFiles) return;
        if ((this.retryAfter.get(candidate.filename) ?? 0) > Date.now()) return;
        attempted.add(candidate.filename);
        const cached = this.files.get(candidate.filename);
        if (cached?.reducer.session?.agentKind === 'internal' && cached.mtime === candidate.mtime) {
          cached.present = true;
          return;
        }
        try { await this.readFile(candidate.filename); this.retryAfter.delete(candidate.filename); }
        catch {
          this.scan.readErrors++;
          this.retryAfter.set(candidate.filename, Date.now() + 30000);
          if (this.retryAfter.size > this.maxFiles * 2) this.retryAfter.delete(this.retryAfter.keys().next().value!);
          const file = this.files.get(candidate.filename); if (file) file.present = false;
          return;
        }
        const parentId = this.files.get(candidate.filename)?.reducer.session?.parentId;
        if (!parentId) return;
        const cachedParent = [...this.files].find(([, file]) => file.reducer.session?.id === parentId);
        const parent = cachedParent
          ? discovery.catalog.find(file => file.filename === cachedParent[0])
          : discovery.catalog.find(file => path.basename(file.filename).endsWith('-' + parentId + '.jsonl'));
        // Explicit parent dependencies take priority over unrelated recent history, within the same cap.
        if (parent) await readFamily(parent);
      };
      for (const candidate of discovery.candidates) await readFamily(candidate);
      // Keep a bounded last-known view for sources that disappeared.
      if (this.files.size > this.maxFiles * 2) {
        for (const [filename, file] of this.files) {
          if (this.files.size <= this.maxFiles * 2) break;
          if (!file.present) this.files.delete(filename);
        }
      }
      this.scan.files = attempted.size;
      this.scan.status = 'ready';
      this.scan.unsupportedRecords = [...this.files.values()].reduce((sum, file) => sum + file.reducer.unsupportedRecords, 0);
    } catch (error) {
      this.scan.status = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'source_missing' : 'error';
      for (const file of this.files.values()) file.present = false;
    }
    this.scan.checkedAt = checkedAt;
    this.scan.lastReadDurationMs = Math.round(performance.now() - started);
    this.revision++;
    this.published = this.buildSnapshot();
    this.emit('snapshot', this.snapshot());
  }

  private async readFile(filename: string): Promise<void> {
    const handle = await ioDeadline(open(filename, 'r'), 1500, late => { void late.close().catch(() => {}); });
    try {
      const info = await ioDeadline(handle.stat());
      let file = this.files.get(filename);
      if (file && (info.ino !== file.inode || info.size < file.offset
        || (info.size === file.offset && info.mtimeMs !== file.mtime))) {
        this.files.delete(filename); file = undefined; this.scan.resets++;
      }
      if (!file) {
        file = { reducer: new RecordReducer(), offset: 0, pending: Buffer.alloc(0), discarding: false,
          inode: info.ino, mtime: info.mtimeMs, present: true };
        this.files.set(filename, file);
        if (info.size > this.historyBytes) {
          const prefix = Buffer.alloc(Math.min(this.maxLineBytes + 1, info.size));
          const { bytesRead } = await ioDeadline(handle.read(prefix, 0, prefix.length, 0));
          this.scan.bytesRead += bytesRead;
          const newline = prefix.indexOf(10);
          if (newline !== -1) this.consume(file, prefix.subarray(0, newline + 1), this.now().toISOString());
          file.offset = Math.max(newline + 1, info.size - this.historyBytes);
          file.discarding = file.offset > newline + 1;
          if (file.reducer.session) file.reducer.session.historyPartial = true;
        }
      }
      file.present = true;
      if (this.isInternal(file)) {
        file.offset = info.size; file.pending = Buffer.alloc(0); file.discarding = false; file.mtime = info.mtimeMs;
        return;
      }
      let budget = 4 * 1024 * 1024;
      while (file.offset < info.size && budget > 0) {
        const buffer = Buffer.alloc(Math.min(256 * 1024, info.size - file.offset, budget));
        const { bytesRead } = await ioDeadline(handle.read(buffer, 0, buffer.length, file.offset));
        if (!bytesRead) break;
        file.offset += bytesRead; budget -= bytesRead; this.scan.bytesRead += bytesRead;
        // A scan can span newly appended events; timestamp the completed read.
        this.consume(file, buffer.subarray(0, bytesRead), this.now().toISOString());
        if (this.isInternal(file)) {
          file.offset = info.size; file.pending = Buffer.alloc(0); file.discarding = false; break;
        }
      }
      file.mtime = info.mtimeMs;
    } finally { await ioDeadline(handle.close()); }
  }

  private isInternal(file: FileState): boolean { return file.reducer.session?.agentKind === 'internal'; }

  private consume(file: FileState, incoming: Buffer, observedAt: string): void {
    let buffer: Buffer = file.pending.length ? Buffer.concat([file.pending, incoming]) : incoming;
    file.pending = Buffer.alloc(0);
    let offset = 0;
    while (offset < buffer.length) {
      const newline = buffer.indexOf(10, offset);
      const end = newline === -1 ? buffer.length : newline;
      const length = end - offset;
      if (file.discarding) {
        if (newline === -1) return;
        file.discarding = false;
      } else if (length > this.maxLineBytes) {
        this.scan.oversizedLines++;
        if (newline === -1) { file.discarding = true; return; }
      } else if (newline === -1) {
        file.pending = Buffer.from(buffer.subarray(offset)); return;
      } else if (length) {
        try { file.reducer.accept(JSON.parse(buffer.toString('utf8', offset, end).replace(/^\uFEFF/, '')), observedAt); }
        catch { this.scan.malformedLines++; }
      }
      offset = end + 1;
    }
  }
}
