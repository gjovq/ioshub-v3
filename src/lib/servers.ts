/**
 * Live-score responses carry a base64 `matchDataToken` shaped
 * `IP:PORT_MATCHID_HOMECODE_AWAYCODE`, which is how the server address can be
 * recovered without a public server-list endpoint (`GET /api/server` is
 * protected).
 */
export function serverEndpointFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const first = atob(token).split('_')[0] ?? '';
    return /^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(first) ? first : null;
  } catch {
    return null;
  }
}

/** iosoccer.com/connect/#<endpoint> forwards to steam://connect/<endpoint>. */
export function connectLink(endpoint: string): string {
  return `https://iosoccer.com/connect/#${endpoint}`;
}

/**
 * Join password for hub servers. EFC-run official servers use a separate
 * password from community match servers.
 */
export function serverPassword(serverName: string | null | undefined): string {
  return /official/i.test(serverName ?? '') ? 'efcmatch' : 'iosmatch';
}
