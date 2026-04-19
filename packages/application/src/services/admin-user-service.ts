import {
  type AccessIdentity,
  type IdentityFieldUpdate,
  applyIdentityFieldUpdate,
  normalizeIdentityLogin
} from "@lottery/domain";
import type { IdentityStore } from "../ports/identity-store.js";
import type { PasswordVerifier } from "../ports/password-verifier.js";
import type { TimeSource } from "../ports/time-source.js";

export interface AdminUserServiceDependencies {
  readonly identityStore: IdentityStore;
  readonly passwordVerifier: PasswordVerifier;
  readonly timeSource: TimeSource;
}

export interface AdminUserUpdateCommand {
  readonly identityId: string;
  readonly login?: string;
  readonly password?: string;
  readonly role?: string;
  readonly status?: string;
  readonly displayName?: string;
  readonly phone?: string;
}

export class AdminUserService {
  private readonly identityStore: IdentityStore;
  private readonly passwordVerifier: PasswordVerifier;
  private readonly timeSource: TimeSource;

  constructor(dependencies: AdminUserServiceDependencies) {
    this.identityStore = dependencies.identityStore;
    this.passwordVerifier = dependencies.passwordVerifier;
    this.timeSource = dependencies.timeSource;
  }

  async listUsers(): Promise<readonly AccessIdentity[]> {
    return this.identityStore.listAll();
  }

  async getUser(identityId: string): Promise<AccessIdentity | null> {
    return this.identityStore.findById(identityId);
  }

  async updateUser(command: AdminUserUpdateCommand): Promise<AccessIdentity> {
    const identity = await this.identityStore.findById(command.identityId);
    if (!identity) {
      throw new Error(`identity "${command.identityId}" not found`);
    }

    if (command.login) {
      const normalizedNewLogin = normalizeIdentityLogin(command.login);
      if (normalizedNewLogin !== identity.login) {
        const existing = await this.identityStore.findByLogin(normalizedNewLogin);
        if (existing && existing.identityId !== identity.identityId) {
          throw new Error(`login "${normalizedNewLogin}" is already taken`);
        }
      }
    }

    let passwordHash: string | undefined;
    if (command.password) {
      passwordHash = await this.passwordVerifier.hash(command.password);
    }

    const update: IdentityFieldUpdate = {
      ...(command.login ? { login: command.login } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      ...(command.role === "admin" || command.role === "user" ? { role: command.role } : {}),
      ...(command.status === "active" || command.status === "disabled" ? { status: command.status } : {}),
      ...(command.displayName !== undefined ? { displayName: command.displayName } : {}),
      ...(command.phone ? { phone: command.phone } : {})
    };

    const nowIso = this.timeSource.nowIso();
    const updated = applyIdentityFieldUpdate(identity, update, nowIso);
    await this.identityStore.save(updated);
    return updated;
  }
}
