import { createHash, timingSafeEqual } from "node:crypto";
import type { PasswordVerifier } from "@lottery/application";

export class Sha256PasswordVerifier implements PasswordVerifier {
  async verify(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    const calculatedHash = hashAccessPassword(plainTextPassword);
    if (calculatedHash.length !== passwordHash.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(calculatedHash, "utf8"), Buffer.from(passwordHash, "utf8"));
  }
}

export function hashAccessPassword(plainTextPassword: string): string {
  return createHash("sha256").update(plainTextPassword).digest("hex");
}
