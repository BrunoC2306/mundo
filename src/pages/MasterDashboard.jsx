import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Download, Eye, EyeOff, Loader2, LogOut, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import CharacterCard from '../components/CharacterCard.jsx'
import ImportDialog from '../components/ImportDialog.jsx'
import CharacterEditor from '../components/CharacterEditor.jsx'
import { useData } from '../state/DataContext.jsx'
import { useMaster } from '../state/MasterContext.jsx'
import { useUi } from '../ui/UiProvider.jsx'
import { deleteCharacter, exportBundle, exportOne, fetchFullById, setVisibility } from '../lib/characters.js'
import { friendlyError } from '../lib/errors.js'
import { normText } from '../lib/text.js'

export default function MasterDashboard() {
  const { characters, status, refresh } = useData()
  const { signOut } = useMaster()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()
  const [tab, setTab] = useState('private')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [importing, setImporting] = useState(false)
  const [editor, setEditor] = useState(null) // { row } | { row: null }
  const [busyId, setBusyId] = useState(null)

  const privateList = useMemo(() => characters.filter((c) => !c.is_public), [characters])
  const publicList = useMemo(() => characters.filter((c) => c.is_public), [characters])
  const categories = useMemo(() => [...new Set(privateList.map((c) => c.category).filter(Boolean))].sort(), [privateList])

  const list = useMemo(() => {
    const q = normText(query)
    return (tab === 'private' ? privateList : publicList).filter(
      (c) => (!q || normText(c.name).includes(q)) && (tab !== 'private' || !category || c.category === category),
    )
  }, [tab, privateList, publicList, query, category])

  async function guarded(c, fn) {
    setBusyId(c.id)
    try {
      await fn()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const openEditor = (c) =>
    guarded(c, async () => {
      const row = await fetchFullById(c.id)
      if (!row) throw new Error('NOT_FOUND')
      setEditor({ row })
    })

  const doExport = (c) =>
    guarded(c, async () => {
      const row = await fetchFullById(c.id)
      if (!row) throw new Error('NOT_FOUND')
      exportOne(row)
    })

  async function toggleVisibility(c) {
    const reveal = !c.is_public
    const ok = await confirm({
      title: reveal ? `Revelar ${c.name}?` : `Ocultar ${c.name}?`,
      message: reveal
        ? 'A ficha passa a aparecer na galeria pública e todos os jogadores poderão vê-la, com PD e, nas próximas etapas, árvore e habilidades.'
        : 'A ficha sai da galeria pública e fica visível só para o mestre. PD e demais dados são mantidos.',
      confirmLabel: reveal ? 'Revelar' : 'Ocultar',
    })
    if (!ok) return
    guarded(c, async () => {
      await setVisibility(c.id, reveal)
      toast(reveal ? `${c.name} foi revelado.` : `${c.name} foi ocultado.`, 'success')
      refresh()
    })
  }

  async function remove(c) {
    const ok = await confirm({
      title: `Excluir ${c.name}?`,
      message: 'A ficha e tudo ligado a ela (PD, histórico e, nas próximas etapas, inventário, notas e desbloqueios) serão apagados. Isso não pode ser desfeito. Exporte a ficha antes se quiser guardá-la.',
      confirmLabel: 'Excluir definitivamente',
      danger: true,
      requireText: c.name,
    })
    if (!ok) return
    guarded(c, async () => {
      await deleteCharacter(c.id)
      toast(`${c.name} foi excluído.`, 'success')
      refresh()
    })
  }

  async function backupAll() {
    try {
      const n = await exportBundle({ onlyPublic: false })
      toast(`Backup com ${n} ${n === 1 ? 'ficha' : 'fichas'} (públicas e privadas) baixado.`, 'success')
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const actionsFor = (c) => {
    const busy = busyId === c.id
    return (
      <>
        <button className="btn btn--sm master-edit-button" onClick={() => openEditor(c)} disabled={busy} title="Editar ficha" aria-label={`Editar ${c.name}`}>
          {busy ? <Loader2 className="spin" size={15} /> : <Pencil size={15} />} <span>Editar ficha</span>
        </button>
        <button className="btn btn--icon btn--sm" onClick={() => doExport(c)} disabled={busy} title="Exportar JSON" aria-label={`Exportar ${c.name}`}>
          <Download size={15} />
        </button>
        <button
          className="btn btn--icon btn--sm"
          onClick={() => toggleVisibility(c)}
          disabled={busy}
          title={c.is_public ? 'Ocultar dos jogadores' : 'Revelar aos jogadores'}
          aria-label={c.is_public ? `Ocultar ${c.name}` : `Revelar ${c.name}`}
        >
          {c.is_public ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button className="btn btn--icon btn--sm btn--danger-ghost" onClick={() => remove(c)} disabled={busy} title="Excluir" aria-label={`Excluir ${c.name}`}>
          <Trash2 size={15} />
        </button>
      </>
    )
  }

  return (
    <section className="page">
      <PageHeader
        title="Área do mestre"
        subtitle="Visível somente para você"
        actions={
          <>
            <button className="btn" onClick={backupAll} title="Baixa fichas públicas e privadas">
              <Archive size={16} /> Backup
            </button>
            <button className="btn" onClick={() => signOut()}>
              <LogOut size={16} /> Sair
            </button>
          </>
        }
      />
      <div className="page__body">
        <div className="toolbar">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'private'} className={`tab ${tab === 'private' ? 'tab--on' : ''}`} onClick={() => setTab('private')}>
              Privadas <span className="tab__n">{privateList.length}</span>
            </button>
            <button role="tab" aria-selected={tab === 'public'} className={`tab ${tab === 'public' ? 'tab--on' : ''}`} onClick={() => setTab('public')}>
              Públicas <span className="tab__n">{publicList.length}</span>
            </button>
          </div>
          <label className="search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar ficha" />
          </label>
          <div className="toolbar__end">
            <button className="btn" onClick={() => setImporting(true)}>
              <Upload size={16} /> Importar privadas
            </button>
            <button className="btn btn--primary" onClick={() => setEditor({ row: null })}>
              <Plus size={16} /> Nova ficha
            </button>
          </div>
        </div>

        {tab === 'private' && categories.length > 0 && (
          <div className="chips" aria-label="Filtrar por categoria">
            <button className={`chip ${category === '' ? 'chip--on' : ''}`} onClick={() => setCategory('')}>
              Todas
            </button>
            {categories.map((c) => (
              <button key={c} className={`chip ${category === c ? 'chip--on' : ''}`} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        )}

        {status === 'loading' && (
          <div className="state">
            <Loader2 className="spin" size={28} />
          </div>
        )}
        {status === 'ready' && list.length === 0 && (
          <div className="state">
            <h2 className="state__title">{tab === 'private' ? 'Nenhuma ficha privada' : 'Nenhuma ficha pública'}</h2>
            <p className="state__text">
              {tab === 'private'
                ? 'Importe ou crie fichas de vilões, NPCs e heróis ainda não revelados. Os jogadores não conseguem ver nada desta lista.'
                : 'Fichas reveladas e importadas pelos jogadores aparecem aqui.'}
            </p>
          </div>
        )}
        {list.length > 0 && (
          <div className="grid-cards">
            {list.map((c) => (
              <CharacterCard key={c.id} character={c} actions={actionsFor(c)} onOpen={() => navigate(`/fichas/${c.slug}`)} />
            ))}
          </div>
        )}
      </div>

      {importing && <ImportDialog target="private" onClose={() => setImporting(false)} />}
      {editor && (
        <CharacterEditor
          row={editor.row}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            refresh()
          }}
        />
      )}
    </section>
  )
}
