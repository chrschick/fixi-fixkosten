import { useCallback, useEffect, useState } from 'react'
import { api, UNAUTHORIZED_EVENT } from './api'

export type Role = 'user' | 'superadmin'

export interface SessionUser {
  id: number
  username: string
  role: Role
}

export interface Session {
  user: SessionUser | null
  /** true, solange die bestehende Session beim Start geprüft wird */
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

/**
 * Session-Zustand für die Benutzer-App ('user') bzw. das Superadmin-Panel ('sa').
 * Eine Session mit der jeweils anderen Rolle gilt hier als "nicht angemeldet".
 */
export function useSession(scope: 'user' | 'sa'): Session {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wantedRole: Role = scope === 'sa' ? 'superadmin' : 'user'

  useEffect(() => {
    let alive = true
    api<{ user: SessionUser | null }>('/api/auth/me')
      .then((r) => {
        if (!alive) return
        setUser(r.user && r.user.role === wantedRole ? r.user : null)
      })
      .catch(() => {
        // z.B. Server nicht erreichbar → Login-Seite zeigen
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [wantedRole])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      setError(null)
      try {
        const r = await api<{ user: SessionUser }>(
          scope === 'sa' ? '/api/sa/login' : '/api/auth/login',
          { method: 'POST', body: { username, password } },
        )
        setUser(r.user)
        return true
      } catch (e) {
        setError((e as Error).message)
        return false
      }
    },
    [scope],
  )

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // Session lokal trotzdem beenden
    }
    setUser(null)
  }, [])

  return { user, loading, error, login, logout }
}
