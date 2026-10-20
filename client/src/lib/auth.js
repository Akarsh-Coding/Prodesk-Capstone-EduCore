import { jwtDecode } from 'jwt-decode';

// All localStorage access lives here. Only call these from event handlers or useEffect
// (never during render), otherwise Next.js server rendering will fail or cause hydration errors.
const TOKEN_KEY = 'educore_token';
const USER_KEY = 'educore_user';

export function saveSession({ token, user }) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return true;
  } catch {
    return false; // storage unavailable (for example some private browsing modes)
  }
}

// Returns { token, user } only if a token exists, decodes, and has not expired. Otherwise null.
export function getSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (!token || !user || isTokenExpired(token)) return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // nothing to clear
  }
}

// Reads the exp claim so an expired or garbage token is rejected before any request is made.
// This does NOT verify the signature. The server's protect middleware is what enforces tokens.
function isTokenExpired(token) {
  try {
    const { exp } = jwtDecode(token);
    return typeof exp !== 'number' || exp * 1000 <= Date.now();
  } catch {
    return true; // not a decodable JWT
  }
}
