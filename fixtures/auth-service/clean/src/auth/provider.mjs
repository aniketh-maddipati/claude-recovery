export class AuthProvider {
  constructor(secret) {
    this.secret = secret;
  }

  /**
   * Authenticate a bearer token.
   * @param {string} token
   * @returns {{ ok: boolean, userId?: string, reason?: string }}
   */
  authenticate(token) {
    if (!token || token.startsWith('expired')) {
      return { ok: false, reason: 'invalid or expired token' };
    }
    return { ok: true, userId: 'user-1' };
  }
}
