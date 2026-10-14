import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownCircle, Coins, Grip, Plus, ShieldAlert, Swords, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import PageHeader from '../components/PageHeader.jsx'
import '../styles/ability-tree.css'
import { useUi } from '../ui/UiProvider.jsx'

const DEFAULT_SKILL = 'Luta'
const cleanAbility = (row) => ({ ...row, damage: row.damage || '0', skill: row.skill || DEFAULT_SKILL })

export default function AbilityTreePage() {
  const { toast } = useUi()
  const [abilities, setAbilities] = useState([])
  const [characters, setCharacters] = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', cost: '1', damage: '0', skill: 'Luta' })
  const [buying, setBuying] = useState(null)
  const [purchasedNow, setPurchasedNow] = useState([])
  const [drag, setDrag] = useState(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, c] = await Promise.all([
      supabase.from('ability_tree_nodes').select('*').order('created_at'),
      supabase.from('characters').select('id,slug,name,pd,sheet,is_public').eq('is_public', true).order('name'),
    ])
    if (a.error) toast(`Não foi possível carregar a árvore: ${a.error.message}. Execute o SQL incluído no ZIP.`, 'error')
    if (c.error) toast(`Não foi possível carregar personagens: ${c.error.message}`, 'error')
    if (!a.error) setAbilities((a.data || []).map(cleanAbility))
    if (!c.error) {
      setCharacters(c.data || [])
      setSelected((current) => current || c.data?.[0]?.id || '')
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const createAbility = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const cost = Number(form.cost)
    if (!name || !Number.isInteger(cost) || cost < 0 || cost > 10000) {
      toast('Informe um nome e um preço em PD válido (número inteiro de 0 a 10000).', 'error')
      return
    }
    setSaving(true)
    const next = {
      name,
      description: form.description.trim(),
      cost,
      damage: form.damage.trim() || '0',
      skill: form.skill.trim() || DEFAULT_SKILL,
      x: 80 + (abilities.length % 4) * 250,
      y: 80 + Math.floor(abilities.length / 4) * 190,
    }
    const { data, error } = await supabase.from('ability_tree_nodes').insert(next).select('*').single()
    setSaving(false)
    if (error) { toast(`Não foi possível criar a habilidade: ${error.message}`, 'error'); return }
    setAbilities((items) => [...items, cleanAbility(data)])
    setShowCreate(false)
    setForm({ name: '', description: '', cost: '1', damage: '0', skill: 'Luta' })
    toast('Habilidade adicionada à árvore.', 'success')
  }

  const startDrag = (e, ability) => {
    if (e.target.closest('button, input, select, textarea, a')) return
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    dragRef.current = { id: ability.id, startX: e.clientX, startY: e.clientY, x: ability.x, y: ability.y, rect }
    setDrag(ability.id)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const moveDrag = (e) => {
    const d = dragRef.current
    if (!d) return
    const x = Math.max(8, Math.min( Math.max(8, (canvasRef.current?.scrollWidth || 1000) - 230), d.x + e.clientX - d.startX))
    const y = Math.max(8, d.y + e.clientY - d.startY)
    setAbilities((items) => items.map((a) => a.id === d.id ? { ...a, x, y } : a))
  }
  const endDrag = async () => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    setDrag(null)
    const current = abilities.find((a) => a.id === d.id)
    // State may still be one pointer event behind; the final position is read from the latest DOM style.
    const node = canvasRef.current?.querySelector(`[data-ability-id="${d.id}"]`)
    const x = node ? Number.parseFloat(node.style.left) : current?.x
    const y = node ? Number.parseFloat(node.style.top) : current?.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const { error } = await supabase.from('ability_tree_nodes').update({ x: Math.round(x), y: Math.round(y) }).eq('id', d.id)
    if (error) toast('A posição mudou na tela, mas não foi salva. Confira se executou o SQL da árvore.', 'error')
  }

  const purchase = async (ability) => {
    if (!selected) { toast('Crie ou selecione uma ficha pública primeiro.', 'error'); return }
    setBuying(ability.id)
    const { data, error } = await supabase.rpc('purchase_tree_ability', { p_character: selected, p_ability: ability.id })
    setBuying(null)
    if (error) {
      const msg = error.message.includes('INSUFFICIENT_PD') ? 'Esse herói não tem PD suficiente.' : error.message.includes('ALREADY_OWNED') ? 'Essa habilidade já está na área de ataques da ficha.' : `Não foi possível comprar: ${error.message}`
      toast(msg, 'error')
      return
    }
    setCharacters((list) => list.map((c) => c.id === selected ? { ...c, pd: data?.pd ?? Math.max(0, c.pd - ability.cost) } : c))
    setPurchasedNow((ids) => ids.includes(ability.id) ? ids : [...ids, ability.id])
    toast(`Habilidade comprada! Foi adicionada à área de ataques de ${characters.find((c) => c.id === selected)?.name || 'seu herói'}.`, 'success')
  }

  const selectedCharacter = characters.find((c) => c.id === selected)
  const knownAttackIds = [...(selectedCharacter?.sheet?.ataques?.map((a) => a.treeAbilityId).filter(Boolean) || []), ...purchasedNow]

  return (
    <section className="page ability-page">
      <PageHeader title="Árvore de habilidades" subtitle="Monte sua árvore, mova as habilidades livremente e compre usando os PD do herói." actions={<button className="btn btn--primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Criar habilidade</button>} />
      <div className="page__body ability-page__body">
        <div className="ability-toolbar">
          <div className="ability-toolbar__hero"><label htmlFor="ability-hero">Comprar para</label><select id="ability-hero" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Selecione um herói</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.pd} PD</option>)}</select></div>
          {selectedCharacter && <div className="ability-pd"><Coins size={18} /><span><strong>{selectedCharacter.pd}</strong> PD disponíveis</span></div>}
          <span className="ability-hint"><Grip size={15} /> Arraste as caixas pelo cabeçalho para organizar</span>
        </div>
        {loading ? <div className="state">Carregando árvore…</div> : abilities.length === 0 ? <div className="ability-empty"><Swords size={36} /><h2>A árvore está vazia</h2><p>Crie a primeira habilidade. Qualquer visitante pode adicionar habilidades e definir o custo em PD.</p><button className="btn btn--primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Criar primeira habilidade</button></div> : (
          <div className="ability-canvas-wrap"><div className="ability-canvas" ref={canvasRef} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <svg className="ability-lines" aria-hidden="true"><defs><pattern id="ability-grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="currentColor" opacity=".18" /></pattern></defs><rect width="100%" height="100%" fill="url(#ability-grid)" /></svg>
            {abilities.map((a) => {
              const owned = knownAttackIds.includes(a.id)
              return <article key={a.id} data-ability-id={a.id} className={`ability-node ${drag === a.id ? 'ability-node--dragging' : ''}`} style={{ left: `${a.x}px`, top: `${a.y}px` }} onPointerDown={(e) => startDrag(e, a)}>
                <div className="ability-node__grab"><Grip size={15} /><span>HABILIDADE</span></div>
                <div className="ability-node__content"><h3>{a.name}</h3>{a.description && <p>{a.description}</p>}<div className="ability-node__stats"><span><Swords size={14} /> Dano: {a.damage || '0'}</span><span>Perícia: {a.skill || DEFAULT_SKILL}</span></div></div>
                <div className="ability-node__footer"><strong><Coins size={15} /> {a.cost} PD</strong><button className="btn btn--primary btn--small" disabled={!selectedCharacter || buying === a.id || owned} onClick={() => purchase(a)}>{owned ? 'Adquirida' : buying === a.id ? 'Comprando…' : 'Comprar'}</button></div>
              </article>
            })}
          </div></div>
        )}
        <p className="ability-footnote"><ShieldAlert size={15} /> Ao comprar, os PD são descontados do herói e a habilidade é registrada automaticamente na seção <strong>Ataques</strong> da ficha, com dano padrão 0 e perícia padrão Luta quando não informados.</p>
      </div>
      {showCreate && <div className="ability-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setShowCreate(false)}><form className="ability-modal" onSubmit={createAbility}><div className="ability-modal__head"><div><span>ÁRVORE DE HABILIDADES</span><h2>Nova habilidade</h2></div><button type="button" className="icon-btn" onClick={() => setShowCreate(false)} aria-label="Fechar"><X size={20} /></button></div>
        <label>Nome da habilidade<input autoFocus maxLength={120} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Rajada de energia" /></label>
        <label>Descrição<textarea rows={3} maxLength={1200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explique o efeito da habilidade…" /></label>
        <div className="ability-form-row"><label>Preço em PD<input type="number" min="0" max="10000" step="1" required value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label><label>Dano<input value={form.damage} onChange={(e) => setForm({ ...form, damage: e.target.value })} placeholder="0" /></label></div>
        <label>Perícia<select value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}><option>Luta</option><option>Pontaria</option><option>Atletismo</option><option>Ocultismo</option><option>Fortitude</option><option>Reflexos</option><option>Percepção</option><option>Iniciativa</option></select></label>
        <p className="ability-form-note">Se dano ou perícia não forem informados, a ficha recebe dano 0 e perícia Luta.</p>
        <div className="ability-modal__actions"><button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar à árvore'}</button></div>
      </form></div>}
    </section>
  )
}
