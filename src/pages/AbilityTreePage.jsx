import { useCallback, useEffect, useRef, useState } from 'react'
import { Coins, Grip, Plus, ShieldAlert, Swords, X, GitBranch, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import PageHeader from '../components/PageHeader.jsx'
import '../styles/ability-tree.css'
import { useUi } from '../ui/UiProvider.jsx'

const DEFAULT_SKILL = 'Luta'
const cleanAbility = (row) => ({ ...row, damage: row.damage || '0', skill: row.skill || DEFAULT_SKILL, x: Number(row.x ?? 80), y: Number(row.y ?? 80) })

export default function AbilityTreePage() {
  const { toast } = useUi()
  const [abilities, setAbilities] = useState([])
  const [characters, setCharacters] = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [viewAbility, setViewAbility] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', cost: '1', damage: '0', skill: 'Luta', parent_id: '' })
  const [buying, setBuying] = useState(null)
  const [drag, setDrag] = useState(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)

  const loadCharacters = useCallback(async () => {
    const { data, error } = await supabase.from('characters').select('id,slug,name,pd,sheet,is_public').eq('is_public', true).order('name')
    if (error) toast(`Não foi possível carregar os heróis: ${error.message}`, 'error')
    else {
      setCharacters(data || [])
      setSelected((current) => current || data?.[0]?.id || '')
    }
  }, [toast])

  const loadAbilities = useCallback(async () => {
    if (!selected) { setAbilities([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.from('ability_tree_nodes').select('*').eq('character_id', selected).order('created_at')
    if (error) toast(`Não foi possível carregar a árvore: ${error.message}. Confira o SQL de atualização incluído no ZIP.`, 'error')
    else setAbilities((data || []).map(cleanAbility))
    setLoading(false)
  }, [selected, toast])

  useEffect(() => { loadCharacters() }, [loadCharacters])
  useEffect(() => { loadAbilities() }, [loadAbilities])

  const createAbility = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const cost = Number(form.cost)
    if (!selected) { toast('Selecione um herói para criar a habilidade na árvore dele.', 'error'); return }
    if (!name || !Number.isInteger(cost) || cost < 0 || cost > 10000) {
      toast('Informe um nome e um preço em PD válido (número inteiro de 0 a 10000).', 'error'); return
    }
    if (form.parent_id && !abilities.some((a) => a.id === form.parent_id)) { toast('A habilidade anterior selecionada não pertence a esta árvore.', 'error'); return }
    setSaving(true)
    const next = {
      character_id: selected, parent_id: form.parent_id || null, name,
      description: form.description.trim(), cost,
      damage: form.damage.trim() || '0', skill: form.skill.trim() || DEFAULT_SKILL,
      x: form.parent_id ? Math.max(80, (abilities.find((a) => a.id === form.parent_id)?.x || 80) + 280) : 90 + (abilities.length % 3) * 290,
      y: form.parent_id ? (abilities.find((a) => a.id === form.parent_id)?.y || 80) + 155 : 90 + Math.floor(abilities.length / 3) * 220,
    }
    const { data, error } = await supabase.from('ability_tree_nodes').insert(next).select('*').single()
    setSaving(false)
    if (error) { toast(`Não foi possível criar a habilidade: ${error.message}`, 'error'); return }
    setAbilities((items) => [...items, cleanAbility(data)])
    setShowCreate(false)
    setForm({ name: '', description: '', cost: '1', damage: '0', skill: 'Luta', parent_id: '' })
    toast('Habilidade adicionada à árvore deste herói.', 'success')
  }

  const startDrag = (e, ability) => {
    if (e.target.closest('button, input, select, textarea, a')) return
    e.preventDefault()
    dragRef.current = { id: ability.id, startX: e.clientX, startY: e.clientY, x: ability.x, y: ability.y }
    setDrag(ability.id)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const moveDrag = (e) => {
    const d = dragRef.current
    if (!d) return
    const x = Math.max(12, d.x + (e.clientX - d.startX) / zoom)
    const y = Math.max(12, d.y + (e.clientY - d.startY) / zoom)
    setAbilities((items) => items.map((a) => a.id === d.id ? { ...a, x, y } : a))
  }
  const endDrag = async () => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    setDrag(null)
    const current = abilities.find((a) => a.id === d.id)
    const node = canvasRef.current?.querySelector(`[data-ability-id="${d.id}"]`)
    const x = node ? Number.parseFloat(node.style.left) : current?.x
    const y = node ? Number.parseFloat(node.style.top) : current?.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const { error } = await supabase.from('ability_tree_nodes').update({ x: Math.round(x), y: Math.round(y) }).eq('id', d.id)
    if (error) toast('Não foi possível salvar a posição do nó. Confira as permissões da tabela no Supabase.', 'error')
  }

  const purchase = async (ability) => {
    if (!selected) { toast('Selecione um herói primeiro.', 'error'); return }
    setBuying(ability.id)
    const { data, error } = await supabase.rpc('purchase_tree_ability', { p_character: selected, p_ability: ability.id })
    setBuying(null)
    if (error) {
      const msg = error.message.includes('INSUFFICIENT_PD') ? 'Esse herói não tem PD suficiente.' : error.message.includes('ALREADY_OWNED') ? 'Essa habilidade já foi comprada para este herói.' : error.message.includes('ABILITY_WRONG_CHARACTER') ? 'Esta habilidade pertence à árvore de outro herói.' : error.message.includes('PREREQUISITE_REQUIRED') ? 'Compre primeiro a habilidade anterior deste caminho.' : `Não foi possível comprar: ${error.message}`
      toast(msg, 'error'); return
    }
    setCharacters((list) => list.map((c) => c.id === selected ? { ...c, pd: data?.pd ?? Math.max(0, c.pd - ability.cost), sheet: { ...(c.sheet || {}), ataques: [...(c.sheet?.ataques || []), { treeAbilityId: ability.id, nome: ability.name, dano: ability.damage || '0', pericia: ability.skill || DEFAULT_SKILL, descricao: ability.description || '', custoPD: ability.cost }] } } : c))
    toast(`Habilidade comprada e adicionada aos ataques de ${selectedCharacter?.name || 'seu herói'}!`, 'success')
  }

  const selectedCharacter = characters.find((c) => c.id === selected)
  const ownedIds = (selectedCharacter?.sheet?.ataques || []).map((a) => a.treeAbilityId).filter(Boolean)
  const nodesById = Object.fromEntries(abilities.map((a) => [a.id, a]))
  // Mantém os nós em coordenadas estáveis e reduz o zoom conforme a árvore cresce.
  const worldWidth = Math.max(1500, ...abilities.map((a) => a.x + 250))
  const worldHeight = Math.max(700, ...abilities.map((a) => a.y + 200))
  const zoom = Math.max(0.35, Math.min(1, 1700 / worldWidth, 900 / worldHeight))
  const canvasWidth = Math.max(900, worldWidth * zoom)
  const canvasHeight = Math.max(700, worldHeight * zoom)

  return (
    <section className="page ability-page">
      <PageHeader title="Árvore de habilidades" subtitle="Cada herói tem sua própria árvore. Crie caminhos, conecte habilidades e compre com PD." actions={<button className="btn btn--primary" onClick={() => selected ? setShowCreate(true) : toast('Selecione um herói antes de criar uma habilidade.', 'error')}><Plus size={16} /> Criar habilidade</button>} />
      <div className="page__body ability-page__body">
        <div className="ability-toolbar">
          <div className="ability-toolbar__hero"><label htmlFor="ability-hero">Árvore do herói</label><select id="ability-hero" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Selecione um herói</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          {selectedCharacter && <div className="ability-pd"><Coins size={19} /><span><strong>{selectedCharacter.pd}</strong> PD disponíveis</span></div>}
          <span className="ability-hint"><Grip size={15} /> Clique em uma habilidade para ver detalhes · Arraste pelo cabeçalho para reorganizar · Zoom automático: {Math.round(zoom * 100)}%</span>
        </div>
        {!selected ? <div className="ability-empty"><GitBranch size={40} /><h2>Escolha um herói</h2><p>Cada personagem tem uma árvore independente. Selecione um herói para visualizar ou criar suas habilidades.</p></div> : loading ? <div className="state">Carregando árvore de {selectedCharacter?.name || 'herói'}…</div> : abilities.length === 0 ? <div className="ability-empty"><Swords size={40} /><h2>Esta árvore ainda não tem habilidades</h2><p>Crie o primeiro nó para este herói. As habilidades de outros personagens não aparecem nesta árvore.</p><button className="btn btn--primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Criar primeira habilidade</button></div> : (
          <div className="ability-canvas-wrap"><div className="ability-canvas" style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}><div className="ability-world" ref={canvasRef} style={{ width: `${worldWidth}px`, height: `${worldHeight}px`, transform: `scale(${zoom})` }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <svg className="ability-lines" aria-hidden="true"><defs><pattern id="ability-grid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="currentColor" opacity=".2" /></pattern><linearGradient id="ability-line-gradient"><stop offset="0%" stopColor="#4c8bd9"/><stop offset="100%" stopColor="#58d9c3"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#ability-grid)" />{abilities.filter((a) => a.parent_id && nodesById[a.parent_id]).map((a) => { const p = nodesById[a.parent_id]; return <path key={`${p.id}-${a.id}`} d={`M ${p.x + 220} ${p.y + 85} C ${p.x + 255} ${p.y + 85}, ${a.x - 35} ${a.y + 85}, ${a.x} ${a.y + 85}`} stroke="url(#ability-line-gradient)" /> })}</svg>
            {abilities.map((a) => {
              const owned = ownedIds.includes(a.id)
              const prerequisite = a.parent_id ? nodesById[a.parent_id] : null
              const locked = prerequisite && !ownedIds.includes(prerequisite.id)
              return <article key={a.id} data-ability-id={a.id} className={`ability-node ability-node--clickable ${drag === a.id ? 'ability-node--dragging' : ''} ${owned ? 'ability-node--owned' : ''} ${locked ? 'ability-node--locked' : ''}`} style={{ left: `${a.x}px`, top: `${a.y}px` }} onPointerDown={(e) => startDrag(e, a)} onClick={(e) => { if (e.target.closest('button')) return; setViewAbility(a) }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewAbility(a) } }} aria-label={`Ver descrição da habilidade ${a.name}`}>
                <div className="ability-node__grab"><Grip size={15} /><span>{owned ? 'HABILIDADE ADQUIRIDA' : locked ? 'CAMINHO BLOQUEADO' : 'HABILIDADE'}</span>{locked && <LockKeyhole size={13} />}</div>
                <div className="ability-node__content"><h3>{a.name}</h3>{a.description && <p>{a.description}</p>}<div className="ability-node__stats"><span><Swords size={14} /> Dano: {a.damage || '0'}</span><span>Perícia: {a.skill || DEFAULT_SKILL}</span>{prerequisite && <span><GitBranch size={13} /> Requer: {prerequisite.name}</span>}</div></div>
                <div className="ability-node__footer"><strong><Coins size={15} /> {a.cost} PD</strong><button className="btn btn--primary btn--small" disabled={!selectedCharacter || buying === a.id || owned || Boolean(locked)} onClick={() => purchase(a)}>{owned ? 'Adquirida' : locked ? 'Bloqueada' : buying === a.id ? 'Comprando…' : 'Comprar'}</button></div>
              </article>
            })}
          </div></div></div>
        )}
        <p className="ability-footnote"><ShieldAlert size={15} /> Cada árvore pertence a um único herói. Ao comprar, os PD são descontados e a habilidade é registrada na seção <strong>Ataques</strong> da ficha, com dano 0 e perícia Luta como padrões.</p>
      </div>
      {viewAbility && <div className="ability-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setViewAbility(null)}><div className="ability-modal" role="dialog" aria-modal="true" aria-labelledby="ability-detail-title"><div className="ability-modal__head"><div><span>HABILIDADE DE {selectedCharacter?.name?.toUpperCase() || 'HERÓI'}</span><h2 id="ability-detail-title">{viewAbility.name}</h2></div><button type="button" className="icon-btn" onClick={() => setViewAbility(null)} aria-label="Fechar"><X size={20} /></button></div><div className="ability-detail"><p>{viewAbility.description?.trim() || 'Esta habilidade ainda não tem descrição.'}</p><div className="ability-node__stats"><span><Swords size={14} /> Dano: {viewAbility.damage || '0'}</span><span>Perícia: {viewAbility.skill || DEFAULT_SKILL}</span><span><Coins size={14} /> Custo: {viewAbility.cost} PD</span>{viewAbility.parent_id && nodesById[viewAbility.parent_id] && <span><GitBranch size={14} /> Requer: {nodesById[viewAbility.parent_id].name}</span>}</div></div><div className="ability-modal__actions"><button type="button" className="btn" onClick={() => setViewAbility(null)}>Fechar</button></div></div></div>}
      {showCreate && <div className="ability-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setShowCreate(false)}><form className="ability-modal" onSubmit={createAbility}><div className="ability-modal__head"><div><span>ÁRVORE DE {selectedCharacter?.name?.toUpperCase() || 'HERÓI'}</span><h2>Nova habilidade</h2></div><button type="button" className="icon-btn" onClick={() => setShowCreate(false)} aria-label="Fechar"><X size={20} /></button></div>
        <label>Nome da habilidade<input autoFocus maxLength={120} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Rajada de energia" /></label>
        <label>Descrição<textarea rows={3} maxLength={1200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explique o efeito da habilidade…" /></label>
        <div className="ability-form-row"><label>Preço em PD<input type="number" min="0" max="10000" step="1" required value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label><label>Dano<input value={form.damage} onChange={(e) => setForm({ ...form, damage: e.target.value })} placeholder="0" /></label></div>
        <label>Perícia<select value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}><option>Luta</option><option>Pontaria</option><option>Atletismo</option><option>Ocultismo</option><option>Fortitude</option><option>Reflexos</option><option>Percepção</option><option>Iniciativa</option><option>Enganação</option><option>Intimidação</option><option>Diplomacia</option><option>Medicina</option></select></label>
        <label>Habilidade anterior (opcional)<select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}><option value="">Nenhuma — início de caminho</option>{abilities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <p className="ability-form-note">Escolha uma habilidade anterior para criar uma conexão e exigir esse caminho antes da compra. Se dano ou perícia ficarem vazios, serão usados 0 e Luta.</p>
        <div className="ability-modal__actions"><button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar à árvore'}</button></div>
      </form></div>}
    </section>
  )
}
