import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Download, Loader2, Pencil } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import PdControl from '../components/PdControl.jsx'
import SheetRenderer from '../components/SheetRenderer.jsx'
import CharacterEditor from '../components/CharacterEditor.jsx'
import { useData } from '../state/DataContext.jsx'
import { useMaster } from '../state/MasterContext.jsx'
import { exportOne, fetchFullBySlug, fetchPdLog } from '../lib/characters.js'
import { friendlyError } from '../lib/errors.js'
import { initialsOf, timeOf } from '../lib/text.js'

export default function SheetView() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { characters, refresh } = useData()
  const { isMaster } = useMaster()
  const entry = characters.find((c) => c.slug === slug)

  const [full, setFull] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | missing | error
  const [error, setError] = useState(null)
  const [log, setLog] = useState([])
  const [editing, setEditing] = useState(false)
  const [broken, setBroken] = useState(false)

  // Recarrega o conteúdo completo quando a versão da ficha muda (outra pessoa editou).
  useEffect(() => {
    let alive = true
    fetchFullBySlug(slug)
      .then((row) => {
        if (!alive) return
        setFull(row)
        setState(row ? 'ready' : 'missing')
      })
      .catch((e) => {
        if (!alive) return
        setError(friendlyError(e))
        setState('error')
      })
    return () => {
      alive = false
    }
  }, [slug, entry?.version, entry?.is_public, isMaster])

  useEffect(() => {
    if (!full?.id) return
    let alive = true
    fetchPdLog(full.id)
      .then((rows) => alive && setLog(rows))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [full?.id, entry?.pd])

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(isMaster && full && !full.is_public ? '/mestre' : '/fichas'))

  if (state === 'loading') {
    return (
      <section className="page">
        <PageHeader title="Ficha" onBack={goBack} />
        <div className="state">
          <Loader2 className="spin" size={28} />
        </div>
      </section>
    )
  }
  if (state === 'missing' || state === 'error' || !full) {
    return (
      <section className="page">
        <PageHeader title="Ficha" onBack={goBack} />
        <div className="state">
          <h2 className="state__title">{state === 'error' ? 'Não foi possível carregar' : 'Ficha não encontrada'}</h2>
          <p className="state__text">{state === 'error' ? error : 'Ela pode ter sido removida ou ainda não foi revelada pelo mestre.'}</p>
        </div>
      </section>
    )
  }

  const view = { ...full, pd: entry?.pd ?? full.pd }
  const showImage = view.image_url && !broken

  return (
    <section className="page">
      <PageHeader
        title={view.name}
        onBack={goBack}
        backLabel="Voltar"
        actions={
          <>
            {isMaster && (
              <button className="btn" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Editar
              </button>
            )}
            <button className="btn" onClick={() => exportOne(full)}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />
      <div className="page__body">
        <div className="sheet">
          <aside className="sheet__aside">
            <div className="sheet__portrait">
              {showImage ? <img src={view.image_url} alt={view.name} onError={() => setBroken(true)} /> : <span>{initialsOf(view.name)}</span>}
            </div>
            {!view.is_public && <span className="tag tag--private">Ficha privada — só o mestre vê</span>}
            {view.category && <span className="tag">{view.category}</span>}
            {view.summary && <p className="sheet__summary">{view.summary}</p>}
            <PdControl character={view} large />
            {log.length > 0 && (
              <details className="pd-log">
                <summary>Histórico de PD</summary>
                <ul>
                  {log.map((l) => (
                    <li key={l.id}>
                      <span className={l.delta > 0 ? 'pd-log__plus' : 'pd-log__minus'}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
                      <span>saldo {l.balance_after}</span>
                      <time>{timeOf(l.created_at)}</time>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </aside>
          <div className="sheet__main">
            <SheetRenderer data={full.sheet} />
          </div>
        </div>
      </div>
      {editing && (
        <CharacterEditor
          row={full}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            refresh()
          }}
        />
      )}
    </section>
  )
}
