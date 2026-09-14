import { AlertTriangle, Loader2, LogIn, Moon, Sun, Wallet } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Theme } from '../useTheme'

interface Props {
  title: string
  subtitle: string
  onLogin: (username: string, password: string) => Promise<boolean>
  error: string | null
  theme: Theme
  onToggleTheme: () => void
}

export function LoginScreen({
  title,
  subtitle,
  onLogin,
  error,
  theme,
  onToggleTheme,
}: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const ok = await onLogin(username.trim(), password)
      if (!ok) setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='welcome'>
      <div className='welcome-card'>
        <div className='welcome-head'>
          <div className='brand'>
            <Wallet size={22} />
            <h1>{title}</h1>
          </div>
          <button
            type='button'
            className='btn btn-icon'
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <p className='muted'>{subtitle}</p>

        <form className='login-form' onSubmit={submit}>
          <label className='field'>
            Benutzername
            <input
              type='text'
              autoComplete='username'
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className='field'>
            Passwort
            <input
              type='password'
              autoComplete='current-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <div className='error-box'>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button
            className='btn btn-primary'
            type='submit'
            disabled={busy || !username.trim() || !password}
          >
            {busy ? (
              <Loader2 size={18} className='spin' />
            ) : (
              <LogIn size={18} />
            )}{' '}
            Anmelden
          </button>
        </form>
      </div>
    </div>
  )
}
