import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearHandle,
  ensurePermission,
  isFsApiSupported,
  loadHandle,
  saveHandle,
} from './fileHandle'
import { emptyData, readFromHandle, writeToHandle } from './storage'
import { AppData } from './types'

export type SyncStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'error'
  | 'no-file'

export interface UseFileStore {
  data: AppData
  setData: (updater: (d: AppData) => AppData) => void
  status: SyncStatus
  error: string | null
  fileName: string | null
  hasFile: boolean
  isSupported: boolean
  pickFile: () => Promise<void>
  createFile: () => Promise<void>
  disconnect: () => Promise<void>
  reloadNow: () => Promise<void>
}

const POLL_MS = 5000

export function useFileStore(): UseFileStore {
  const [data, setDataState] = useState<AppData>(() => emptyData())
  const [status, setStatus] = useState<SyncStatus>('no-file')
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleRef = useRef<FileSystemFileHandle | null>(null)
  const lastModifiedRef = useRef<number>(0)
  const pendingRef = useRef<AppData | null>(null)
  const writingRef = useRef<boolean>(false)
  const dirtyRef = useRef<boolean>(false)
  const saveTimer = useRef<number | null>(null)

  const supported = isFsApiSupported()

  const flushWrite = useCallback(async () => {
    const handle = handleRef.current
    const payload = pendingRef.current
    if (!handle || !payload || writingRef.current) return
    writingRef.current = true
    setStatus('saving')
    try {
      const lm = await writeToHandle(handle, payload)
      lastModifiedRef.current = lm
      pendingRef.current = null
      dirtyRef.current = false
      setStatus('saved')
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    } finally {
      writingRef.current = false
      if (pendingRef.current) {
        // weiter schreiben, falls in der Zwischenzeit weitere Änderungen kamen
        scheduleWrite()
      }
    }
  }, [])

  const scheduleWrite = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void flushWrite()
    }, 400)
  }, [flushWrite])

  const setData = useCallback(
    (updater: (d: AppData) => AppData) => {
      setDataState((prev) => {
        const next = updater(prev)
        pendingRef.current = next
        dirtyRef.current = true
        scheduleWrite()
        return next
      })
    },
    [scheduleWrite],
  )

  const connectHandle = useCallback(
    async (handle: FileSystemFileHandle, persist = true) => {
      setStatus('loading')
      try {
        const ok = await ensurePermission(handle, 'readwrite')
        if (!ok) throw new Error('Keine Berechtigung für die Datei')
        const { data: d, lastModified } = await readFromHandle(handle)
        handleRef.current = handle
        lastModifiedRef.current = lastModified
        setDataState(d)
        setFileName(handle.name)
        setStatus('saved')
        setError(null)
        if (persist) await saveHandle(handle)
      } catch (e) {
        setError((e as Error).message)
        setStatus('error')
        throw e
      }
    },
    [],
  )

  // Beim Start: gespeicherten Handle laden
  useEffect(() => {
    if (!supported) {
      setStatus('no-file')
      return
    }
    ;(async () => {
      try {
        const stored = await loadHandle()
        if (!stored) {
          setStatus('no-file')
          return
        }
        // @ts-expect-error
        const perm: PermissionState = await stored.queryPermission({
          mode: 'readwrite',
        })
        if (perm === 'granted') {
          await connectHandle(stored, false)
        } else {
          // Wir behalten den Handle, brauchen aber eine Geste
          handleRef.current = stored
          setFileName(stored.name)
          setStatus('no-file')
        }
      } catch (e) {
        setError((e as Error).message)
        setStatus('error')
      }
    })()
  }, [supported, connectHandle])

  // Polling auf externe Änderungen
  useEffect(() => {
    if (!handleRef.current) return
    const id = window.setInterval(async () => {
      const handle = handleRef.current
      if (!handle || writingRef.current || dirtyRef.current) return
      try {
        const file = await handle.getFile()
        if (file.lastModified > lastModifiedRef.current) {
          const { data: next, lastModified } = await readFromHandle(handle)
          lastModifiedRef.current = lastModified
          setDataState(next)
          setStatus('saved')
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [fileName, status])

  const pickFile = useCallback(async () => {
    // @ts-expect-error
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Fixi-Datei',
          accept: { 'application/json': ['.json'] },
        },
      ],
      multiple: false,
      excludeAcceptAllOption: false,
    })
    await connectHandle(handle)
  }, [connectHandle])

  const createFile = useCallback(async () => {
    // @ts-expect-error
    const handle = await window.showSaveFilePicker({
      suggestedName: 'fixi.json',
      types: [
        {
          description: 'Fixi-Datei',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    // Initial leere Daten schreiben
    await writeToHandle(handle, emptyData())
    await connectHandle(handle)
  }, [connectHandle])

  const disconnect = useCallback(async () => {
    handleRef.current = null
    setFileName(null)
    setStatus('no-file')
    setDataState(emptyData())
    await clearHandle()
  }, [])

  const reloadNow = useCallback(async () => {
    if (!handleRef.current) return
    const { data: d, lastModified } = await readFromHandle(handleRef.current)
    lastModifiedRef.current = lastModified
    setDataState(d)
    setStatus('saved')
  }, [])

  return {
    data,
    setData,
    status,
    error,
    fileName,
    hasFile: !!handleRef.current && status !== 'no-file',
    isSupported: supported,
    pickFile,
    createFile,
    disconnect,
    reloadNow,
  }
}
