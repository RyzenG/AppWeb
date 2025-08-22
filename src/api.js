export const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

export async function getJSON(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`);
  if (!res.ok) throw new Error('Error en la petición');
  return res.json();
}

export async function postJSON(endpoint, data) {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function patchJSON(endpoint, data) {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function deleteJSON(endpoint) {
  return fetch(`${API_URL}${endpoint}`, { method: 'DELETE' });
}
