import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Loader2, Search, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import CharacterCard from '../components/CharacterCard.jsx'
import ImportDialog from '../components/ImportDialog.jsx'
import { useData } from '../state/DataContext.jsx'
import { useUi } from '../ui/UiProvider.jsx'
import { exportBundle } from '../lib/characters.js'
import { friendlyError } from '../lib/errors.js'
import { normText } from '../lib/text.js'

export default function SheetsPage() {
  const { characters, status, error, refresh } = useData()
  const { toast } = useUi()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [busy, setBusy] = useState(false)

  // A galeria pública NUNCA mostra fichas privadas, nem para o mestre.
  const list = useMemo(() => {
    const q = normText(query)
    return characters.filter((c) => c.is_public && (!q || normText(c.name).includes(q)))
  }, [characters, query])
  const total = characters.filter((c) => c.is_public).length

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
    </section>
  )
}
