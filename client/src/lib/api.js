import { clearSession, getToken } from '@/lib/auth';

// The backend URL comes from the environment, never hardcoded.
// NEXT_PUBLIC_ variables are inlined at build time, so restart `npm run dev` after changing .env.local.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

// Called when the session is missing or the server answers 401: clear the token and go to /login.
function handleUnauthorized() {
  clearSession();
  // A full-page redirect on purpose: this runs outside React (no router available), and the reload
  // also wipes any in-memory state that belonged to the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (typeof window !== 'undefined') window.location.assign('/login');
  // The page is navigating away, so this promise never settles. Callers stay in their loading
  // state until the redirect happens, instead of flashing an error or stale data.
  return new Promise(() => {});
}

async function request(method, path, { body, token, auth = false } = {}) {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set. Add it to client/.env.local and restart the dev server.');
  }

  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    // Authenticated mode: the token always comes from localStorage
    const stored = getToken();
    if (!stored) return handleUnauthorized();
    headers.Authorization = `Bearer ${stored}`;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`; // explicit token (used by the route guard hook)
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    // fetch only rejects on network failure or a CORS block, not on 4xx/5xx.
    // This error has no .status, so callers can tell it apart from a real 401.
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 401 && auth) return handleUnauthorized();

  let data = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON response (for example an HTML error page from a sleeping host)
  }

  if (!res.ok) {
    const error = new Error(data.message || `Request failed (${res.status})`);
    error.status = res.status;
    error.code = data.code; // for example INVALID_ID or FORBIDDEN
    error.fieldErrors = data.errors || {};
    throw error;
  }

  return data;
}

// Public requests (login, register). A 401 here means "Invalid credentials", so no redirect.
export const apiPost = (path, body) => request('POST', path, { body });
// Explicit-token GET, used by the useRequireAuth route guard
export const apiGet = (path, token) => request('GET', path, { token });

// Authenticated requests: attach the stored token, send JSON, and on a 401 clear it and go to /login
export const api = {
  get: (path) => request('GET', path, { auth: true }),
  post: (path, body) => request('POST', path, { body, auth: true }),
  put: (path, body) => request('PUT', path, { body, auth: true }),
  patch: (path, body) => request('PATCH', path, { body, auth: true }),
  delete: (path) => request('DELETE', path, { auth: true }),
};
