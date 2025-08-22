async function request(method, url, data) {
  try {
    const options = { method, headers: {} };
    if (data !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      console.error(`Error ${method} ${url}: ${res.status} ${text}`);
      throw new Error(`Request failed with status ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return undefined;
  } catch (err) {
    console.error(`Network error ${method} ${url}:`, err);
    throw err;
  }
}

async function get(url) {
  return request('GET', url);
}
async function post(url, data) {
  return request('POST', url, data);
}
async function patch(url, data) {
  return request('PATCH', url, data);
}
async function del(url) {
  return request('DELETE', url);
}

window.api = { get, post, patch, del };
