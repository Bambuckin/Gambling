import type { AccessAuditEvent } from "@lottery/domain";

export interface AccessAuditLog {
  append(event: AccessAuditEvent): Promise<void>;
}
