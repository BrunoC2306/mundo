import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Shield, Trash2, Zap } from 'lucide-react'

const POSES = {
  idle: '/characters/iron-man/idle.png',
  left: '/characters/iron-man/walk-left.png',
  right: '/characters/iron-man/walk-right.png',
  defend: '/characters/iron-man/defend.png',
  attack1: '/characters/iron-man/attack-1.png',
  attack2: '/characters/iron-man/attack-2.png',
  attack3: '/characters/iron-man/attack-3.png',
  attack4: '/characters/iron-man/attack-4.png',
}
const ATTACKS = [
  { id: 'attack1', label: 'Ataque 1', icon: '⚡', duration: 900 },
  { id: 'attack2', label: 'Ataque 2', icon: '☄️', duration: 1000 },
  { id: 'attack3', label: 'Ataque 3', icon: '💥', duration: 1000 },
  { id: 'attack4', label: 'Ataque 4', icon: '🔥', duration: 900 },
]

export default function CombatBoard({ scene, tokens, isMaster, onAddIronMan, onMoveToken, onRemoveToken, onBack, error }) {
  const [selectedId, setSelectedId] = useState(null)
  const [poses, setPoses] = useState({})
  const [activeAction, setActiveAction] = useState('')
  const [scale, setScale] = useState(1)
  const [saving, setSaving] = useState(false)
  const boardRef = useRef(null)
  const dragRef = useRef(null)
  const timersRef = useRef({})

  useEffect(() => () => Object.values(timersRef.current).forEach(clearTimeout), [])
  const selected = tokens.find(t => t.id === selectedId) || tokens[0] || null

  function setPose(id, pose) {
    setPoses(old => ({ ...old, [id]: pose }))
  }

  function playAction(token, pose, label, duration = 1000) {
    if (!token) return
    clearTimeout(timersRef.current[token.id])
    setSelectedId(token.id)
    setActiveAction(label)
    setPose(token.id, pose)
    timersRef.current[token.id] = setTimeout(() => {
      setPose(token.id, 'idle')
      setActiveAction('')
    }, duration)
  }

  function pointerDown(e, token) {
    if (!isMaster) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(token.id)
    dragRef.current = {
      id: token.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      x: Number(token.x),
      y: Number(token.y),
      moved: false,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function pointerMove(e) {
    const drag = dragRef.current
    if (!drag || !boardRef.current) return
    const rect = boardRef.current.getBoundingClientRect()
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 2) drag.moved = true
    if (drag.moved) {
      const horizontalTravel = e.clientX - drag.startX
      const pose = Math.abs(horizontalTravel) > 3 ? (horizontalTravel < 0 ? 'left' : 'right') : 'idle'
      setPose(drag.id, pose)
      const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100))
      drag.x = x
      drag.y = y
      onMoveToken(drag.id, x, y, false)
    }
    drag.lastX = e.clientX
    drag.lastY = e.clientY
  }

  async function pointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    if (drag.moved) {
      setSaving(true)
      await onMoveToken(drag.id, drag.x, drag.y, true)
      setSaving(false)
    }
    setPose(drag.id, 'idle')
  }

  const currentPose = (token) => poses[token.id] || 'idle'

  return (
    <div className="new-combat">
      <div className="new-combat__top">
        <button className="map-button" onClick={onBack}><ArrowLeft size={17}/> Voltar à cena</button>
        <div className="new-combat__heading">
          <span className="new-combat__eyebrow">MUNDO DE BATALHA · COMBATE</span>
          <h2>{scene.title}</h2>
          <p>{tokens.length} personagem(ns) no tabuleiro</p>
        </div>
        {isMaster && <button className="new-combat__add" onClick={onAddIronMan}>＋ Adicionar Homem de Ferro</button>}
      </div>

      <div className="new-combat__layout">
        <div
          ref={boardRef}
          className="new-combat__board"
          style={{ backgroundImage: `linear-gradient(0deg,rgba(5,8,14,.12),rgba(5,8,14,.02)),url("${scene.image_url}")` }}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onLostPointerCapture={pointerUp}
        >
          {tokens.map(token => {
            const pose = currentPose(token)
            return (
              <div
                key={token.id}
                className={`new-combat__token ${selectedId === token.id ? 'is-selected' : ''}`}
                style={{ left: `${token.x}%`, top: `${token.y}%`, '--sprite-scale': selectedId === token.id ? scale : 1 }}
                onPointerDown={e => pointerDown(e, token)}
                onClick={() => setSelectedId(token.id)}
                role="button"
                tabIndex={0}
                aria-label={token.name}
              >
                <img draggable="false" src={POSES[pose] || POSES.idle} alt={token.name}/>
                <span>{token.name}</span>
              </div>
            )
          })}
          {!tokens.length && <div className="new-combat__empty">Adicione o Homem de Ferro para começar o combate.</div>}
          {saving && <div className="new-combat__saving">Salvando posição…</div>}
        </div>

        <aside className="new-combat__hud">
          <div className="new-combat__hud-title"><span>CONTROLE DO PERSONAGEM</span><b>{selected?.name || 'Nenhum selecionado'}</b></div>
          {selected ? <>
            <div className="new-combat__portrait"><img src={POSES[currentPose(selected)] || POSES.idle} alt={selected.name}/></div>
            <label className="new-combat__scale">Tamanho do personagem <strong>{Math.round(scale * 100)}%</strong>
              <input type="range" min="0.55" max="1.8" step="0.05" value={scale} onChange={e => setScale(Number(e.target.value))}/>
            </label>
            <div className="new-combat__section-label">ATAQUES</div>
            <div className="new-combat__actions">
              {ATTACKS.map(action => <button key={action.id} onClick={() => playAction(selected, action.id, action.label, action.duration)}><span>{action.icon}</span>{action.label}</button>)}
            </div>
            <button className="new-combat__defend" onClick={() => playAction(selected, 'defend', 'Defendendo', 1200)}><Shield size={17}/> Defender</button>
            {activeAction && <div className="new-combat__status"><Zap size={15}/>{activeAction}</div>}
            {isMaster && <button className="new-combat__remove" onClick={() => { if (confirm(`Remover ${selected.name} do mapa?`)) { onRemoveToken(selected.id); setSelectedId(null) } }}><Trash2 size={15}/> Remover personagem</button>}
          </> : <p className="new-combat__hint">Selecione um personagem no tabuleiro para controlar seus ataques e defesa.</p>}
          <p className="new-combat__tip">Arraste o personagem no tabuleiro. A pose muda conforme a direção do movimento e volta ao normal quando você soltar.</p>
          {error && <p className="map-error">{error}</p>}
        </aside>
      </div>
    </div>
  )
}
