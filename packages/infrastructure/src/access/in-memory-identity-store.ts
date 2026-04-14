import { normalizeIdentityLogin, normalizeIdentityPhone, type AccessIdentity } from "@lottery/domain";
import type { IdentityStore } from "@lottery/application";

export class InMemoryIdentityStore implements IdentityStore {
  private readonly identitiesById = new Map<string, AccessIdentity>();
  private readonly identitiesByLogin = new Map<string, AccessIdentity>();

  constructor(initialIdentities: readonly AccessIdentity[] = []) {
    for (const identity of initialIdentities) {
      this.upsert(identity);
    }
  }

  async findByLogin(login: string): Promise<AccessIdentity | null> {
    const canonicalLogin = normalizeIdentityLogin(login);
    return cloneIdentity(this.identitiesByLogin.get(canonicalLogin));
  }

  async findById(identityId: string): Promise<AccessIdentity | null> {
    return cloneIdentity(this.identitiesById.get(identityId));
  }

  upsert(identity: AccessIdentity): void {
    const canonicalIdentity: AccessIdentity = {
      ...identity,
      login: normalizeIdentityLogin(identity.login),
      phone: normalizeIdentityPhone(identity.phone)
    };

    this.identitiesById.set(canonicalIdentity.identityId, canonicalIdentity);
    this.identitiesByLogin.set(canonicalIdentity.login, canonicalIdentity);
  }
}

function cloneIdentity(identity: AccessIdentity | undefined): AccessIdentity | null {
  if (!identity) {
    return null;
  }

  return {
    ...identity
  };
}
