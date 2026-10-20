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

// Convenience only: reads the exp claim so an expired token is not treated as logged in.
// This does NOT verify the signature. The server middleware is what actually enforces tokens.
function isTokenExpired(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true; // malformed token
  }
}
