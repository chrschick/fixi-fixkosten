// Persistiert FileSystemHandles in IndexedDB, damit der Datei-Pfad zwischen Sitzungen erhalten bleibt.
const DB_NAME = 'fixi-fs'
const STORE = 'handles'
const KEY = 'data-file'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openDB()
  const handle = await new Promise<FileSystemFileHandle | null>(
    (resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () =>
        resolve((req.result as FileSystemFileHandle) ?? null)
      req.onerror = () => reject(req.error)
    },
  )
  db.close()
  return handle
}

export async function clearHandle(): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const opts = { mode } as const
  // @ts-expect-error - API ist je nach TS-Lib-Version
  if ((await handle.queryPermission(opts)) === 'granted') return true
  // @ts-expect-error
  return (await handle.requestPermission(opts)) === 'granted'
}

export function isFsApiSupported(): boolean {
  return typeof (window as any).showOpenFilePicker === 'function'
}
