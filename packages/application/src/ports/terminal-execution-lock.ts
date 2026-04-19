export interface TerminalExecutionLock {
  acquire(ownerId: string): Promise<boolean>;
  release(ownerId: string): Promise<void>;
  clearAll(): Promise<void>;
}
