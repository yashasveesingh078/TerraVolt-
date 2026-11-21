// Every request to the backend goes through this function.
// It sends JSON, includes the login cookie, and turns errors into readable messages.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include', // send the httpOnly "token" cookie
  });

  // Some responses may have no JSON body, so don't crash if parsing fails
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Our server always sends { error: '...' } on failure (see index.js error handler)
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}