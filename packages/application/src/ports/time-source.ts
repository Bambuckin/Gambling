export interface TimeSource {
  nowIso(): string;
}

export class SystemTimeSource implements TimeSource {
  nowIso(): string {
    return new Date().toISOString();
  }
}
