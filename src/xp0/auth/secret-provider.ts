export interface SecretProvider {
  getSecret(name: string): Promise<string>;
}

export class EnvSecretProvider implements SecretProvider {
  async getSecret(name: string): Promise<string> {
    const value = process.env[name];
    if (value === undefined) {
      throw new Error(`Secret '${name}' not found in environment variables`);
    }
    return value;
  }

  toString(): string {
    return '[EnvSecretProvider]';
  }
}
