export interface PasswordVerifier {
  verify(plainTextPassword: string, passwordHash: string): Promise<boolean>;
  hash(plainTextPassword: string): Promise<string>;
}
