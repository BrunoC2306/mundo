import { useEffect, useRef, useState } from 'react'
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
import { supabase } from '../lib/supabase.js'
import { useUi } from '../ui/UiProvider.jsx'
import { initialsOf, timeOf } from '../lib/text.js'

export default function SheetView() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { characters, refresh } = useData()
  const { toast } = useUi()
  const { isMaster } = useMaster()
  const entry = characters.find((c) => c.slug === slug)

  const [full, setFull] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | missing | error
  const [error, setError] = useState(null)
  const [log, setLog] = useState([])
  const [editing, setEditing] = useState(false)
  const [broken, setBroken] = useState(false)
  const [savingResources, setSavingResources] = useState(false)
  const resourceTimer = useRef(null)
  const latestSheet = useRef(null)
  const saveInFlight = useRef(false)

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

  useEffect(() => () => clearTimeout(resourceTimer.current), [])

  const changeResource = (key, value) => {
    if (!full) return
    const currentResources = full.sheet?.recursos ?? {}
    const maxKey = key === 'vidaAtual' ? 'vidaMaxima' : 'esforcoMaximo'
    const requested = Math.max(0, Number(value) || 0)
    const maximum = Number(currentResources[maxKey] ?? 0)
    const safeValue = maximum > 0 ? Math.min(requested, maximum) : requested
    const nextSheet = {
      ...(full.sheet ?? {}),
      recursos: { ...currentResources, [key]: safeValue },
    }
    latestSheet.current = nextSheet
    setFull((current) => current ? { ...current, sheet: nextSheet } : current)
    setSavingResources(true)
    clearTimeout(resourceTimer.current)
    resourceTimer.current = setTimeout(async () => {
      if (saveInFlight.current) {
        resourceTimer.current = setTimeout(() => changeResourceSave(), 350)
        return
      }
      await changeResourceSave()
    }, 650)
  }

  const changeResourceSave = async () => {
    if (!full?.id || !latestSheet.current) return
    saveInFlight.current = true
    const sheetToSave = latestSheet.current
    const snapshot = JSON.stringify(sheetToSave)
    try {
      const { data, error: saveError } = await supabase.rpc('update_character_resources', {
        p_character: full.id,
        p_vida_atual: Math.max(0, Number(sheetToSave.recursos?.vidaAtual ?? 0)),
        p_esforco_atual: Math.max(0, Number(sheetToSave.recursos?.esforcoAtual ?? 0)),
      })
      if (saveError) throw saveError
      if (data !== true) throw new Error('FORBIDDEN')
      if (latestSheet.current && JSON.stringify(latestSheet.current) === snapshot) setSavingResources(false)
      refresh()
    } catch (e) {
      setSavingResources(false)
      toast(`Não foi possível salvar a alteração. ${friendlyError(e)} Se isso for erro de permissão, será necessário liberar a atualização de vida/esforço no Supabase.`, 'error')
      // Keep the optimistic value on screen so it is not lost while diagnosing permissions.
    } finally {
      saveInFlight.current = false
      if (latestSheet.current && JSON.stringify(latestSheet.current) !== snapshot) {
        clearTimeout(resourceTimer.current)
        resourceTimer.current = setTimeout(changeResourceSave, 250)
      }
    }
  }

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
            <SheetRenderer data={full.sheet} onResourceChange={changeResource} savingResources={savingResources} />
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
