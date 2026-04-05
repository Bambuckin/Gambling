export interface PasswordVerifier {
  verify(plainTextPassword: string, passwordHash: string): Promise<boolean>;
}
