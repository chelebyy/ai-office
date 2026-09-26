import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ObserverSnapshot, OfficeRuntimeState } from '../shared/contract.ts';

export type OfficeCommand = 'start' | 'stop' | 'restart';
export interface OfficeReader {
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): ObserverSnapshot;
  on(event: 'snapshot', listener: (snapshot: ObserverSnapshot) => void): unknown;
  off(event: 'snapshot', listener: (snapshot: ObserverSnapshot) => void): unknown;
}
type Reader = OfficeReader;

/** Keeps the local web/control service available while record scanning is stopped. */
export class OfficeRuntime extends EventEmitter {
  private reader: Reader;
  private retained: ObserverSnapshot;
  private state: OfficeRuntimeState['state'] = 'stopped';
  private failure = false;
  private operation: Promise<void> | null = null;
  private closing = false;
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly onSnapshot = () => {
    if (this.state !== 'running') return;
    this.retained = this.reader.snapshot();
    this.publish();
  };

  constructor(
    private readonly factory: () => Reader,
    private readonly rememberDesired: (enabled: boolean) => Promise<void> = async () => {},
  ) {
    super();
    this.reader = factory();
    this.retained = this.reader.snapshot();
    this.reader.on('snapshot', this.onSnapshot);
    this.heartbeat = setInterval(() => {
      if (this.state !== 'running') this.publish();
    }, 5000);
    this.heartbeat.unref();
  }

  status(): OfficeRuntimeState {
    return { state: this.state, updatedAt: new Date().toISOString(), failed: this.failure };
  }
  snapshot(): ObserverSnapshot {
    return { ...this.retained, runtime: this.status() };
  }
  private publish() {
    this.emit('snapshot', this.snapshot());
  }

  command(command: OfficeCommand, remember = true): void {
    if (this.operation || this.closing) throw new Error('busy');
    if (
      (command === 'start' && this.state === 'running') ||
      (command === 'stop' && this.state === 'stopped')
    )
      return;
    this.state =
      command === 'stop' ? 'stopping' : command === 'restart' ? 'restarting' : 'starting';
    this.failure = false;
    this.publish();
    this.operation = (async () => {
      try {
        // Persist intent in the owning supervisor before reporting completion.
        if (remember) await this.rememberDesired(command !== 'stop');
        await this.reader.stop();
        if (command === 'stop') this.state = 'stopped';
        else {
          this.reader.off('snapshot', this.onSnapshot);
          this.reader = this.factory();
          this.reader.on('snapshot', this.onSnapshot);
          await this.reader.start();
          this.retained = this.reader.snapshot();
          this.state = 'running';
        }
      } catch {
        await this.reader.stop().catch(() => {});
        this.state = 'error';
        this.failure = true;
      } finally {
        this.operation = null;
        this.publish();
      }
    })();
  }

  async settled(): Promise<void> {
    await this.operation;
  }
  async initialize(enabled: boolean): Promise<void> {
    if (enabled) {
      this.command('start', false);
      await this.settled();
    }
  }
  async close(): Promise<void> {
    this.closing = true;
    clearInterval(this.heartbeat);
    await this.settled();
    await this.reader.stop();
    this.reader.off('snapshot', this.onSnapshot);
  }
}

/** No Codex commands: this IPC only remembers the office scanner's desired state. */
export async function rememberSupervisorTracking(enabled: boolean): Promise<void> {
  if (!process.send) return; // Manually launched web server has no supervisor.
  if (!process.connected) throw new Error('Supervisor unavailable');
  const id = randomUUID();
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error | null) => {
      clearTimeout(timer);
      process.off('message', receive);
      if (error) reject(error);
      else resolve();
    };
    const receive = (message: unknown) => {
      const reply = message as { type?: string; id?: string };
      if (reply?.type === 'office-tracking-ack' && reply.id === id) finish();
    };
    const timer = setTimeout(() => finish(new Error('Supervisor acknowledgement timeout')), 2000);
    process.on('message', receive);
    process.send!({ type: 'office-tracking', id, enabled }, (error: Error | null) => {
      if (error) finish(error);
    });
  });
}
