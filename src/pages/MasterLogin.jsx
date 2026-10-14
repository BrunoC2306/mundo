import { useState } from 'react'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useMaster } from '../state/MasterContext.jsx'
import { friendlyError } from '../lib/errors.js'

function loginMessage(err) {
  const raw = String(err?.message ?? err)
  if (/invalid login credentials/i.test(raw)) return 'Senha incorreta.'
  if (err?.status === 429 || /rate limit|too many/i.test(raw)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (raw.includes('NOT_MASTER')) return 'Esta conta existe, mas não está marcada como mestre. Rode o script 02_promover_mestre.sql e entre de novo.'
  if (raw.includes('MISSING_MASTER_EMAIL')) return 'Defina VITE_MASTER_EMAIL no arquivo .env e reinicie o site.'
  if (/email logins are disabled/i.test(raw)) return 'O login por e-mail/senha está desativado no Supabase (Authentication > Sign In / Providers > Email).'
  return friendlyError(err)
}

export default function MasterLogin() {
  const { signIn } = useMaster()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await signIn(password)
      setPassword('')
    } catch (err) {
      setError(loginMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <div className="login">
        <form className="login__panel" onSubmit={submit}>
          <ShieldCheck size={30} />
          <h1 className="login__title">Área do mestre</h1>
          <p className="state__text">Fichas privadas, criação de fichas e gerenciamento da campanha.</p>
          <label className="field">
            <span>Senha</span>
            <div className="row-gap">
              <input
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button type="button" className="btn btn--icon" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && <p className="alert alert--bad">{error}</p>}
          <button className="btn btn--primary" disabled={busy || !password}>
            {busy ? <Loader2 className="spin" size={16} /> : null} Entrar
          </button>
        </form>
      </div>
    </section>
  )
}
