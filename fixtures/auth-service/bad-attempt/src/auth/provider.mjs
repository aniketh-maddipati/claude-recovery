export class AuthProvider {
  constructor(secret) {
    this.secret = secret;
  }

  /**
   * Rejected attempt: changed exported interface — breaks existing clients.
   * Deterministic fixture overlay (not proof of independent instruction violation).
   * @param {{ headers: Record<string, string> }} request
   */
  verifyRequest(request) {
    const token = request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token || token.startsWith('expired')) {
      return { ok: false, reason: 'invalid or expired token' };
    }
    return { ok: true, userId: 'user-1' };
  }
}
