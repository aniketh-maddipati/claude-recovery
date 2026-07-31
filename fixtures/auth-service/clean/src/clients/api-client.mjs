import { AuthProvider } from '../auth/provider.mjs';

export class ApiClient {
  constructor(provider) {
    this.provider = provider;
  }

  request(token) {
    const result = this.provider.authenticate(token);
    if (!result.ok) {
      throw new Error(result.reason ?? 'authentication failed');
    }
    return { authorized: true, userId: result.userId };
  }
}
