const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')

export async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {})

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error(`Could not reach the backend at ${API_BASE_URL}. Make sure it is running.`)
  }

  const contentType = response.headers.get('content-type') || ''
  const result = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const error = new Error(
      typeof result === 'object' && result?.message
        ? result.message
        : `Request failed with status ${response.status}.`,
    )
    error.status = response.status
    throw error
  }

  return result
}
