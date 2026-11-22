// One helper for every API call.
// Sends JSON normally, or FormData as-is when uploading files.
export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;

  const res = await fetch(`/api${path}`, {
    method,
    // For FormData the browser sets the multipart Content-Type (with boundary) itself
    headers: body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default api;