import { OperationsAlertService, OperationsAuditService, SystemTimeSource } from "@lottery/application";
import { InMemoryOperationsAuditLog, PostgresOperationsAuditLog } from "@lottery/infrastructure";
import { getAdminOperationsQueryService } from "../purchase/purchase-runtime";
import { getWebPostgresPool, getWebStorageBackend } from "../runtime/postgres-runtime";

const operationsAuditLog =
  getWebStorageBackend() === "postgres"
    ? new PostgresOperationsAuditLog(getWebPostgresPool())
    : new InMemoryOperationsAuditLog();

let cachedOperationsAuditService: OperationsAuditService | null = null;
let cachedOperationsAlertService: OperationsAlertService | null = null;

export function getOperationsAuditService(): OperationsAuditService {
  if (!cachedOperationsAuditService) {
    cachedOperationsAuditService = new OperationsAuditService({
      operationsAuditLog,
      timeSource: new SystemTimeSource()
    });
  }

  return cachedOperationsAuditService;
}

export function getOperationsAlertService(): OperationsAlertService {
  if (!cachedOperationsAlertService) {
    cachedOperationsAlertService = new OperationsAlertService({
      adminOperationsQueryService: getAdminOperationsQueryService(),
      operationsAuditLog,
      timeSource: new SystemTimeSource()
    });
  }

  return cachedOperationsAlertService;
}
