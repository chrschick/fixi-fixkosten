// Kleiner Fetch-Wrapper für die JSON-API (/api/…). Session läuft über ein
// httpOnly-Cookie, daher credentials: same-origin.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Wird ausgelöst, wenn der Server mit 401 antwortet (Session abgelaufen). */
export const UNAUTHORIZED_EVENT = 'fixi:unauthorized'

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Anfrage auch nach dem Verlassen der Seite zu Ende senden */
  keepalive?: boolean
}

export async function api<T = unknown>(
  path: string,
  opts: Options = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      headers:
        opts.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      keepalive: opts.keepalive,
    })
  } catch {
    throw new ApiError(0, 'Server nicht erreichbar')
  }

  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    const msg =
      (payload as { error?: string } | null)?.error ?? `HTTP ${res.status}`
    throw new ApiError(res.status, msg)
  }
  return payload as T
}
