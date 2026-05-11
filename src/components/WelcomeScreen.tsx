import { AlertTriangle, FilePlus2, FolderOpen } from 'lucide-react'

interface Props {
  isSupported: boolean
  onOpen: () => void
  onCreate: () => void
  error: string | null
}

export function WelcomeScreen({ isSupported, onOpen, onCreate, error }: Props) {
  return (
    <div className='welcome'>
      <div className='welcome-card'>
        <h1>Willkommen bei Fixi</h1>
        <p className='muted'>
          Wähle eine geteilte JSON-Datei (z.B. auf <strong>OneDrive</strong>{' '}
          oder einem Netzlaufwerk), damit du und andere immer denselben Stand
          seht.
        </p>

        {!isSupported && (
          <div className='warn-box'>
            <AlertTriangle size={18} />
            <div>
              Dein Browser unterstützt die File-System-API nicht. Bitte verwende
              <strong> Chrome </strong> oder <strong>Edge</strong>.
            </div>
          </div>
        )}

        <div className='welcome-actions'>
          <button
            className='btn btn-primary'
            disabled={!isSupported}
            onClick={onOpen}
          >
            <FolderOpen size={18} /> Bestehende Datei öffnen
          </button>
          <button className='btn' disabled={!isSupported} onClick={onCreate}>
            <FilePlus2 size={18} /> Neue Datei anlegen
          </button>
        </div>

        {error && (
          <div className='error-box'>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <ul className='welcome-hints'>
          <li>
            Lege die Datei z.B. unter <code>OneDrive/Fixi/fixi.json</code> ab.
          </li>
          <li>Jeder andere Nutzer öffnet bei sich die gleiche Datei.</li>
          <li>
            Änderungen werden automatisch gespeichert und alle 5 Sekunden
            synchronisiert.
          </li>
          <li>
            Gleichzeitiges Editieren wird nicht zusammengeführt – nacheinander
            arbeiten.
          </li>
        </ul>
      </div>
    </div>
  )
}
