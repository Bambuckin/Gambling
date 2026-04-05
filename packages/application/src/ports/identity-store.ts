import type { AccessIdentity } from "@lottery/domain";

export interface IdentityStore {
  findByLogin(login: string): Promise<AccessIdentity | null>;
  findById(identityId: string): Promise<AccessIdentity | null>;
}
