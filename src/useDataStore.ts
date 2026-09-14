// Hält die Fixkostendaten des angemeldeten Benutzers und synchronisiert sie
// mit der Datenbank (über /api/data). Änderungen werden gesammelt (400 ms)
// und als Ganzes gespeichert; alle 5 s wird auf Änderungen von anderen
// Geräten/Tabs geprüft.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { emptyData, sanitize } from './storage'
import { AppData } from './types'

export type SyncStatus = 'loading' | 'saving' | 'saved' | 'error'

export interface UseDataStore {
  data: AppData
  /** true, sobald die Daten einmal erfolgreich geladen wurden */
  loaded: boolean
  setData: (updater: (d: AppData) => AppData) => void
  status: SyncStatus
  error: string | null
  reloadNow: () => Promise<void>
  /** Ausstehende Änderungen sofort speichern (z.B. vor dem Abmelden) */
  flushNow: () => Promise<void>
}

const POLL_MS = 5000
const SAVE_DEBOUNCE_MS = 400
const RETRY_MS = 5000

export function useDataStore(): UseDataStore {
  const [data, setDataState] = useState<AppData>(() => emptyData())
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<SyncStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const versionRef = useRef(0)
  const pendingRef = useRef<AppData | null>(null)
  const writingRef = useRef(false)
  const dirtyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const scheduleRef = useRef<(delay: number) => void>(() => {})

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const flushWrite = useCallback(async (keepalive = false) => {
    const payload = pendingRef.current
    if (!payload || writingRef.current) return
    writingRef.current = true
    pendingRef.current = null
    setStatus('saving')
    try {
      const r = await api<{ version: number }>('/api/data', {
        method: 'PUT',
        body: { data: payload },
        keepalive,
      })
      versionRef.current = r.version
      if (!pendingRef.current) dirtyRef.current = false
      setStatus('saved')
      setError(null)
    } catch (e) {
      // Änderung nicht verlieren: erneut vormerken (neuere haben Vorrang)
      if (!pendingRef.current) pendingRef.current = payload
      setError((e as Error).message)
      setStatus('error')
      writingRef.current = false
      scheduleRef.current(RETRY_MS)
      return
    }
    writingRef.current = false
    // weiter schreiben, falls in der Zwischenzeit weitere Änderungen kamen
    if (pendingRef.current) scheduleRef.current(SAVE_DEBOUNCE_MS)
  }, [])

  const scheduleWrite = useCallback(
    (delay: number) => {
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        void flushWrite()
      }, delay)
    },
    [flushWrite],
  )
  scheduleRef.current = scheduleWrite

  const setData = useCallback((updater: (d: AppData) => AppData) => {
    setDataState((prev) => {
      const next = updater(prev)
      pendingRef.current = next
      dirtyRef.current = true
      scheduleRef.current(SAVE_DEBOUNCE_MS)
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const r = await api<{ version: number; data: AppData }>('/api/data')
      versionRef.current = r.version
      setDataState(sanitize(r.data))
      setLoaded(true)
      setStatus('saved')
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }, [])

  const flushNow = useCallback(async () => {
    clearTimer()
    await flushWrite()
  }, [flushWrite])

  // Initial laden
  useEffect(() => {
    void load()
  }, [load])

  // Polling auf Änderungen von anderen Geräten/Tabs
  useEffect(() => {
    if (!loaded) return
    const id = window.setInterval(async () => {
      if (writingRef.current || dirtyRef.current || document.hidden) return
      try {
        const r = await api<{ version: number }>('/api/data/version')
        if (r.version !== versionRef.current) await load()
      } catch {
        // vorübergehende Fehler ignorieren
      }
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [loaded, load])

  // Ausstehende Änderungen beim Verlassen/Verstecken der Seite sofort senden
  useEffect(() => {
    const flushIfPending = () => {
      if (pendingRef.current && !writingRef.current) {
        clearTimer()
        void flushWrite(true)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushIfPending()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushIfPending)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushIfPending)
    }
  }, [flushWrite])

  useEffect(() => () => clearTimer(), [])

  return {
    data,
    loaded,
    setData,
    status,
    error,
    reloadNow: load,
    flushNow,
  }
}
