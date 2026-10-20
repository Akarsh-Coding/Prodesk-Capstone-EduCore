// The backend URL comes from the environment, never hardcoded.
// NEXT_PUBLIC_ variables are inlined at build time, so restart `npm run dev` after changing .env.local.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

export async function apiPost(path, body) {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set. Add it to client/.env.local and restart the dev server.');
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // fetch only rejects on network failure or a CORS block, not on 4xx/5xx
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON response (for example an HTML error page from a sleeping host)
  }

  if (!res.ok) {
    const error = new Error(data.message || `Request failed (${res.status})`);
    error.status = res.status;
    error.fieldErrors = data.errors || {};
    throw error;
  }

  return data;
}
