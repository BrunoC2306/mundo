import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Package, Search, X, Save, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import PlayerPicker from '../components/PlayerPicker.jsx'
import { usePlayerIdentity } from '../state/PlayerIdentityContext.jsx'
import { useMaster } from '../state/MasterContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useUi } from '../ui/UiProvider.jsx'
import { friendlyError } from '../lib/errors.js'

const EMPTY = { name: '', quantity: '1', description: '', notes: '' }

export default function InventoryPage() {
  const { playerName } = usePlayerIdentity()
  const { isMaster } = useMaster()
  const { toast } = useUi()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!playerName || isMaster) { setItems([]); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.from('player_inventory_items').select('id,player_name,name,quantity,description,notes,created_at,updated_at').eq('player_name', playerName).order('name')
    setLoading(false)
    if (err) { setError(friendlyError(err)); return }
    setItems(data || [])
  }, [playerName, isMaster])
  useEffect(() => { refresh() }, [refresh])

  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.description || ''} ${item.notes || ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [items, search])
  const startNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true) }
  const startEdit = (item) => { setEditing(item.id); setForm({ name: item.name, quantity: String(item.quantity), description: item.description || '', notes: item.notes || '' }); setShowForm(true) }

  const saveItem = async (event) => {
    event.preventDefault()
    if (!playerName || isMaster) return
    const quantity = Number.parseInt(form.quantity, 10)
    if (!form.name.trim() || !Number.isInteger(quantity) || quantity < 1 || quantity > 999999) { toast('Informe um nome e uma quantidade válida.', 'error'); return }
    setSaving(true)
    const payload = { player_name: playerName, name: form.name.trim(), quantity, description: form.description.trim() || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }
    const request = editing ? supabase.from('player_inventory_items').update(payload).eq('id', editing).eq('player_name', playerName) : supabase.from('player_inventory_items').insert(payload)
    const { error: err } = await request
    setSaving(false)
    if (err) { toast(friendlyError(err), 'error'); return }
    toast(editing ? 'Item atualizado.' : 'Item adicionado.', 'success'); setShowForm(false); setForm(EMPTY); setEditing(null); refresh()
  }

  const removeItem = async (item) => {
    if (!window.confirm(`Remover “${item.name}” do inventário?`)) return
    const { error: err } = await supabase.from('player_inventory_items').delete().eq('id', item.id).eq('player_name', playerName)
    if (err) { toast(friendlyError(err), 'error'); return }
    setItems((current) => current.filter((x) => x.id !== item.id)); toast('Item removido.', 'success')
  }

  return <section className="page inventory-page">
    <PageHeader title="Inventário" subtitle="Itens, equipamentos e recursos do teu personagem" />
    <div className="page__body personal-page__body">
      <PlayerPicker master={isMaster} />
      {isMaster ? <div className="personal-empty"><Package size={34} /><h2>Inventário dos jogadores</h2><p>Como mestre, teu espaço pessoal é reservado para notas. O inventário fica disponível quando entrares como um jogador.</p></div> : !playerName ? <div className="personal-empty"><Package size={34} /><h2>Escolhe teu nome para começar</h2><p>Define teu nome acima para carregar teu inventário pessoal.</p></div> : <>
        <div className="inventory-toolbar"><div className="search"><Search size={16} /><input aria-label="Buscar itens" placeholder="Buscar item..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="row-gap"><button className="btn" onClick={refresh} disabled={loading}><RefreshCw size={16} /> Atualizar</button><button className="btn btn--primary" onClick={startNew}><Plus size={17} /> Adicionar item</button></div></div>
        {error && <div className="alert alert--bad">{error}<button className="btn btn--ghost" onClick={refresh}>Tentar novamente</button></div>}
        {showForm && <form className="inventory-form" onSubmit={saveItem}><div className="inventory-form__head"><h2>{editing ? 'Editar item' : 'Novo item'}</h2><button className="btn btn--icon" type="button" aria-label="Fechar" onClick={() => setShowForm(false)}><X size={17} /></button></div><div className="inventory-form__grid"><label className="field">Nome do item<input className="input" autoFocus maxLength={120} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Comunicador Stark" /></label><label className="field">Quantidade<input className="input" type="number" min="1" max="999999" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label><label className="field inventory-form__wide">Descrição<textarea className="input" rows="2" maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="O que é este item?" /></label><label className="field inventory-form__wide">Observações<textarea className="input" rows="2" maxLength={4000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condição, cargas, pistas associadas..." /></label></div><div className="row-gap inventory-form__actions"><button className="btn" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" disabled={saving} type="submit"><Save size={16} /> {saving ? 'Salvando...' : 'Salvar item'}</button></div></form>}
        {loading ? <div className="personal-empty"><RefreshCw className="spin" size={26} /><p>Carregando inventário...</p></div> : filtered.length ? <div className="inventory-list">{filtered.map((item) => <article className="inventory-item" key={item.id}><div className="inventory-item__count">{item.quantity}×</div><div className="inventory-item__main"><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}{item.notes && <p className="inventory-item__notes">{item.notes}</p>}</div><div className="inventory-item__actions"><button className="btn btn--icon" title="Editar item" onClick={() => startEdit(item)}><Pencil size={16} /></button><button className="btn btn--icon" title="Remover item" onClick={() => removeItem(item)}><Trash2 size={16} /></button></div></article>)}</div> : <div className="personal-empty"><Package size={34} /><h2>{search ? 'Nenhum item encontrado' : 'Inventário vazio'}</h2><p>{search ? 'Tenta outra palavra.' : 'Adiciona o primeiro item para começar a organizar teu equipamento.'}</p>{!search && <button className="btn btn--primary" onClick={startNew}><Plus size={17} /> Adicionar primeiro item</button>}</div>}
      </>}
    </div>
  </section>
}
