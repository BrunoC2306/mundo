import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Eye, EyeOff, Loader2, Search, ShieldCheck, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import CharacterCard from '../components/CharacterCard.jsx'
import ImportDialog from '../components/ImportDialog.jsx'
import { useData } from '../state/DataContext.jsx'
import { useMaster } from '../state/MasterContext.jsx'
import { useUi } from '../ui/UiProvider.jsx'
import { exportBundle } from '../lib/characters.js'
import { friendlyError } from '../lib/errors.js'
import { normText } from '../lib/text.js'

export default function SheetsPage() {
  const { characters, status, error, refresh } = useData()
  const { toast } = useUi()
  const { isMaster, signIn } = useMaster()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [masterModal, setMasterModal] = useState(false)
  const [masterPassword, setMasterPassword] = useState('')
  const [showMasterPassword, setShowMasterPassword] = useState(false)
  const [masterBusy, setMasterBusy] = useState(false)
  const [masterError, setMasterError] = useState('')

  // A galeria pública NUNCA mostra fichas privadas, nem para o mestre.
  const list = useMemo(() => {
    const q = normText(query)
    return characters.filter((c) => c.is_public && (!q || normText(c.name).includes(q)))
  }, [characters, query])
  const total = characters.filter((c) => c.is_public).length

  async function enterMaster(e) {
    e.preventDefault()
    if (!masterPassword) return
    setMasterBusy(true)
    setMasterError('')
    try {
      await signIn(masterPassword)
      setMasterPassword('')
      setMasterModal(false)
      navigate('/mestre')
    } catch (err) {
      const message = String(err?.message ?? err)
      if (/invalid login credentials/i.test(message)) setMasterError('Senha incorreta. Confira a senha da conta de mestre.')
      else if (message.includes('MISSING_MASTER_EMAIL')) setMasterError('O acesso do mestre ainda não foi configurado no site.')
      else if (message.includes('NOT_MASTER')) setMasterError('Esta conta ainda não foi autorizada como mestre. É preciso configurá-la no Supabase.')
      else setMasterError('Não foi possível entrar. Verifique a conexão e tente novamente.')
    } finally {
      setMasterBusy(false)
    }
  }

  async function backup() {
    setBusy(true)
    try {
      const n = await exportBundle({ onlyPublic: true })
      toast(`Backup com ${n} ${n === 1 ? 'ficha' : 'fichas'} baixado.`, 'success')
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="Fichas"
        subtitle={status === 'ready' ? `${total} ${total === 1 ? 'personagem' : 'personagens'}` : undefined}
        actions={
          <>
            <button className={isMaster ? 'btn btn--primary' : 'btn'} onClick={() => (isMaster ? navigate('/mestre') : setMasterModal(true))} title="Acesso reservado ao mestre">
              <ShieldCheck size={16} /> {isMaster ? 'Área do mestre' : 'Sou o mestre'}
            </button>
            <label className="search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar personagem" aria-label="Buscar personagem" />
            </label>
            <button className="btn" onClick={backup} disabled={busy || total === 0} title="Baixa todas as fichas públicas em um arquivo">
              <Download size={16} /> Backup
            </button>
            <button className="btn btn--primary" onClick={() => setImporting(true)}>
              <Upload size={16} /> Importar
            </button>
          </>
        }
      />
      <div className="page__body">
        {status === 'loading' && (
          <div className="state">
            <Loader2 className="spin" size={28} />
            <p className="state__text">Carregando personagens…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="state">
            <h2 className="state__title">Não foi possível carregar</h2>
            <p className="state__text">{error}</p>
            <button className="btn" onClick={refresh}>
              Tentar de novo
            </button>
          </div>
        )}
        {status === 'ready' && total === 0 && (
          <div className="state">
            <h2 className="state__title">Nenhuma ficha ainda</h2>
            <p className="state__text">Importe um arquivo .json para adicionar o primeiro personagem à galeria.</p>
            <button className="btn btn--primary" onClick={() => setImporting(true)}>
              <Upload size={16} /> Importar ficha
            </button>
          </div>
        )}
        {status === 'ready' && total > 0 && list.length === 0 && <p className="empty-note">Nenhum personagem com esse nome.</p>}
        {list.length > 0 && (
          <div className="grid-cards">
            {list.map((c) => (
              <CharacterCard key={c.id} character={c} onOpen={() => navigate(`/fichas/${c.slug}`)} />
            ))}
          </div>
        )}
      </div>
      {importing && <ImportDialog target="public" onClose={() => setImporting(false)} />}
      {masterModal && (
        <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setMasterModal(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.72)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <form onSubmit={enterMaster} style={{ width: 'min(100%, 420px)', background: 'var(--panel, #171a20)', color: 'var(--text, #f4f4f5)', border: '1px solid var(--border, #333843)', borderRadius: 16, padding: 24, display: 'grid', gap: 16, boxShadow: '0 24px 80px rgba(0,0,0,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={25} />
              <div><h2 style={{ margin: 0, fontSize: 20 }}>Acesso do mestre</h2><p style={{ margin: '5px 0 0', opacity: .72, fontSize: 13 }}>Digite sua senha para abrir as ferramentas exclusivas.</p></div>
            </div>
            <label style={{ display: 'grid', gap: 7, fontSize: 14 }}>Senha do mestre
              <div style={{ display: 'flex', gap: 8 }}>
                <input autoFocus className="input" type={showMasterPassword ? 'text' : 'password'} value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} autoComplete="current-password" placeholder="Digite sua senha" style={{ flex: 1, minWidth: 0 }} />
                <button type="button" className="btn btn--icon" onClick={() => setShowMasterPassword((v) => !v)} aria-label={showMasterPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showMasterPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            {masterError && <p role="alert" style={{ color: '#ff8b8b', margin: 0, fontSize: 13 }}>{masterError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => { setMasterModal(false); setMasterPassword(''); setMasterError('') }}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={masterBusy || !masterPassword}>{masterBusy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />} Entrar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
