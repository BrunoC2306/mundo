import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Shield, ShieldOff, Trash2 } from 'lucide-react'

const CHARACTERS = {
  'Homem de Ferro': { folder:'iron-man', poses:{ idle:'idle.png', left:'walk-left.png', right:'walk-right.png', defend:'defend.png', attack1:'attack-1.png', attack2:'attack-2.png', attack3:'attack-3.png', attack4:'attack-4.png' }, actions:[['attack1','Ataque 1'],['attack2','Ataque 2'],['attack3','Ataque 3'],['attack4','Ataque 4'],['defend','Defender']] },
  'Noturno': { folder:'nightcrawler', poses:{ idle:'idle.png', left:'walk-left.png', right:'walk-right.png', teleport:'teleport.png', attackRight:'attack-right.png', attackLeft:'attack-left.png' }, actions:[['teleport','Teleporte','mode'],['attackRight','Ataque direita'],['attackLeft','Ataque esquerda']] },
  'Homem-Aranha': { folder:'spider-man', poses:{ idle:'idle.png', left:'walk-left.png', right:'walk-right.png', dodge:'dodge.png', web:'web.png' }, actions:[['web','Disparar teia'],['dodge','Esquiva']] },
  'Doutor Estranho': { folder:'doctor-strange', poses:{ idle:'idle.png', shieldIdle:'shield-idle.png', shield:'shield.png', lasso:'lasso.png', eye:'eye.png' }, actions:[['lasso','Laço mágico'],['eye','Olho de Agamotto']], shield:true },

  'Venom': { folder:'venom', poses:{ idle:'portrait.png' }, actions:[] },
  'Visão': { folder:'visao', poses:{ idle:'portrait.png' }, actions:[] },
  'Wolverine': { folder:'wolverine', poses:{ idle:'portrait.png' }, actions:[] },
  'Capitã Marvel': { folder:'capita-marvel', poses:{ idle:'portrait.png' }, actions:[] },
  'Capitão América': { folder:'capitao-america', poses:{ idle:'portrait.png' }, actions:[] },
  'Coisa': { folder:'coisa', poses:{ idle:'portrait.png' }, actions:[] },
  'Demolidor': { folder:'demolidor', poses:{ idle:'portrait.png' }, actions:[] },
  'Gambit': { folder:'gambit', poses:{ idle:'portrait.png' }, actions:[] },
  'Groot': { folder:'groot', poses:{ idle:'portrait.png' }, actions:[] },
  'Homem-Formiga': { folder:'homem-formiga', poses:{ idle:'portrait.png' }, actions:[] },
  'Hulk': { folder:'hulk', poses:{ idle:'portrait.png' }, actions:[] },
  'Loki': { folder:'loki', poses:{ idle:'portrait.png' }, actions:[] },
  'Magneto': { folder:'magneto', poses:{ idle:'portrait.png' }, actions:[] },
  'Mercúrio': { folder:'mercurio', poses:{ idle:'portrait.png' }, actions:[] },
  'Miles Morales': { folder:'miles-morales', poses:{ idle:'portrait.png' }, actions:[] },
  'Sr. Fantástico': { folder:'sr-fantastico', poses:{ idle:'portrait.png' }, actions:[] },
  'Nova': { folder:'nova', poses:{ idle:'portrait.png' }, actions:[] },
  'Ciclope': { folder:'ciclope', poses:{ idle:'portrait.png' }, actions:[] },
  'Deadpool': { folder:'deadpool', poses:{ idle:'portrait.png' }, actions:[] },
  'Mulher Invisível': { folder:'mulher-invisivel', poses:{ idle:'portrait.png' }, actions:[] },
  'Senhor das Estrelas': { folder:'senhor-das-estrelas', poses:{ idle:'portrait.png' }, actions:[] },
  'Tempestade': { folder:'tempestade', poses:{ idle:'portrait.png' }, actions:[] },
  'Thanos': { folder:'thanos', poses:{ idle:'portrait.png' }, actions:[] },
  'Tocha Humana': { folder:'tocha-humana', poses:{ idle:'portrait.png' }, actions:[] },
  'Ultron': { folder:'ultron', poses:{ idle:'portrait.png' }, actions:[] },
  'Vampira': { folder:'vampira', poses:{ idle:'portrait.png' }, actions:[] },
}
const getCharacter = token => CHARACTERS[token?.name] || null
const imagePath = (token, pose) => { const c=getCharacter(token); return c ? `/characters/${c.folder}/${c.poses[pose] || c.poses.idle}` : '' }

export default function CombatBoard({ scene, tokens, isMaster, onAddCharacter, onMoveToken, onRemoveToken, onBack, error }) {
  const [selectedId,setSelectedId]=useState(null)
  const [poses,setPoses]=useState({})
  const [shielded,setShielded]=useState({})
  const [teleportId,setTeleportId]=useState(null)
  const [missileId,setMissileId]=useState(null)
  const [missileTargets,setMissileTargets]=useState([])
  const [explosions,setExplosions]=useState([])
  const [actionLabel,setActionLabel]=useState('')
  const [scales,setScales]=useState({})
  const [saving,setSaving]=useState(false)
  const drag=useRef(null); const timer=useRef({}); const board=useRef(null); const missileCleanup=useRef(null)
  useEffect(()=>()=>{Object.values(timer.current).forEach(clearTimeout); if(missileCleanup.current)clearTimeout(missileCleanup.current)},[])
  const selected=tokens.find(t=>t.id===selectedId)||tokens[0]||null
  const selectedScale=selected ? (scales[selected.id] ?? 1) : 1
  const character=getCharacter(selected)
  const poseFor=t=> t?.name==='Doutor Estranho'&&shielded[t.id] ? 'shieldIdle' : poses[t?.id]||'idle'
  const srcFor=t=>imagePath(t,poseFor(t))
  const setPose=(id,p)=>setPoses(v=>({...v,[id]:p}))

  function playAction(token,id,label) {
    if (id === 'attack4' && token.name === 'Homem de Ferro') {
      clearTimeout(timer.current[token.id])
      setSelectedId(token.id)
      setTeleportId(null)
      setMissileId(token.id)
      setMissileTargets([])
      setExplosions([])
      if(missileCleanup.current)clearTimeout(missileCleanup.current)
      setPose(token.id, 'attack4')
      setActionLabel('Mísseis: escolha 3 pontos no mapa (pode repetir o mesmo alvo)')
      return
    }
    clearTimeout(timer.current[token.id]); setSelectedId(token.id); setActionLabel(label); setPose(token.id,id)
    timer.current[token.id]=setTimeout(()=>{setPose(token.id,token.name==='Doutor Estranho'&&shielded[token.id]?'shieldIdle':'idle');setActionLabel(shielded[token.id]&&token.name==='Doutor Estranho'?'Escudo ativo':'')},1000)
  }
  function toggleShield(token) {
    const next=!shielded[token.id]; clearTimeout(timer.current[token.id]); setShielded(v=>({...v,[token.id]:next})); setPose(token.id,next?'shieldIdle':'idle'); setActionLabel(next?'Escudo ativo':'Escudo desativado')
  }
  function toggleTeleport(token) {
    if(teleportId===token.id){setTeleportId(null);setActionLabel('');return}
    setSelectedId(token.id);setTeleportId(token.id);setActionLabel('Clique no destino do mapa para teleportar')
  }
  async function boardClick(e) {
    if (e.target.closest('.combat-token') || !board.current) return
    const r=board.current.getBoundingClientRect()
    const x=Math.max(1,Math.min(99,(e.clientX-r.left)/r.width*100))
    const y=Math.max(1,Math.min(99,(e.clientY-r.top)/r.height*100))

    if (missileId) {
      const next=[...missileTargets,{x,y}]
      setMissileTargets(next)
      setExplosions(old=>[...old,{id:`${Date.now()}-${old.length}-${Math.random()}`,x,y}])
      if (next.length >= 3) {
        setMissileId(null)
        setMissileTargets([])
        setPose(missileId,'idle')
        setActionLabel('Ataque 4 realizado!')
        // Mantém as explosões visíveis brevemente e limpa os marcadores ao concluir o ataque.
        if(missileCleanup.current)clearTimeout(missileCleanup.current)
        missileCleanup.current=setTimeout(()=>setExplosions([]),1200)
      } else {
        setActionLabel(`Mísseis: ${next.length}/3 lançados — escolha o próximo ponto`)
      }
      return
    }

    if (!teleportId) return
    const token=tokens.find(t=>t.id===teleportId); if(!token)return
    setSaving(true); await onMoveToken(token.id,x,y); setSaving(false); setPose(token.id,'teleport'); setSelectedId(token.id); setTeleportId(null); setActionLabel('Teleporte realizado')
  }
  function startDrag(e,t) { if(!isMaster||teleportId||missileId)return; e.preventDefault();e.stopPropagation();setSelectedId(t.id);drag.current={id:t.id,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};e.currentTarget.setPointerCapture?.(e.pointerId) }
  function moveDrag(e) { const d=drag.current;if(!d||!board.current)return;const r=board.current.getBoundingClientRect();if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>3)d.moved=true;if(!d.moved)return;const dx=e.clientX-d.lastX;if(Math.abs(dx)>1)setPose(d.id,dx<0?'left':'right');const x=Math.max(1,Math.min(99,(e.clientX-r.left)/r.width*100));const y=Math.max(1,Math.min(99,(e.clientY-r.top)/r.height*100));d.px=x;d.py=y;d.lastX=e.clientX;d.lastY=e.clientY;onMoveToken(d.id,x,y,false) }
  async function endDrag(){const d=drag.current;if(!d)return;drag.current=null;if(d.moved){setSaving(true);await onMoveToken(d.id,d.px,d.py,true);setSaving(false);setPose(d.id,'idle')}}

  return <section className="combat-board-page">
    <header className="combat-board-header"><button className="map-button" onClick={onBack}><ArrowLeft size={16}/> Voltar à cena</button><div><h1>{scene.title}</h1><p>Combate · {tokens.length} personagem(ns)</p></div></header>
    <div className="combat-board-layout">
      <div ref={board} className={`combat-board ${teleportId?'teleport-target':''} ${missileId?'missile-target':''}`} style={{backgroundImage:`linear-gradient(#05080e12,#05080e22),url("${scene.image_url}")`}} onClick={boardClick} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {explosions.map((blast,i)=><img key={blast.id} className="combat-missile-explosion" src="/characters/iron-man/missile-explosion.png" alt="Explosão de míssil" style={{left:`${blast.x}%`,top:`${blast.y}%`}} />)}
        {tokens.map(t=>{const c=getCharacter(t);return <button key={t.id} className={`combat-token ${['Homem de Ferro','Noturno','Homem-Aranha','Doutor Estranho'].includes(t.name)?'animated-character ':''}${selected?.id===t.id?'selected':''} ${teleportId===t.id?'teleport-active':''}`} style={{left:`${t.x}%`,top:`${t.y}%`,'--token-scale':scales[t.id] ?? 1}} onPointerDown={e=>startDrag(e,t)} onClick={e=>{e.stopPropagation();if(missileId||teleportId)return;setSelectedId(t.id);if(teleportId===t.id){setTeleportId(null);setActionLabel('')}}} title={t.name}>
          {c?<img src={srcFor(t)} alt={t.name} draggable="false"/>:<span className="combat-token-fallback">{t.emoji||'♟'}</span>}<small>{t.name}</small>
        </button>})}
        {!tokens.length&&<div className="combat-empty">Adicione personagens para começar.</div>}
        {teleportId&&<div className="combat-teleport-hint">🌀 TELEPORTE ATIVADO — clique no destino</div>}
        {missileId&&<div className="combat-teleport-hint combat-missile-hint">🚀 MÍSSEIS {missileTargets.length}/3 — clique em 3 pontos do mapa; pode repetir o alvo</div>}
        {saving&&<div className="combat-saving">Salvando posição…</div>}
      </div>
      <aside className="combat-hud">
        <div className="combat-hud-title">CONTROLE DO PERSONAGEM<strong>{selected?.name||'Selecione um personagem'}</strong></div>
        {isMaster&&<div className="combat-add-list"><span>ADICIONAR AO MAPA</span>{Object.keys(CHARACTERS).map(name=><button key={name} onClick={()=>onAddCharacter(name)}>＋ {name}</button>)}</div>}
        {selected&&character?<>
          <div className="combat-portrait"><img src={srcFor(selected)} alt={selected.name}/></div>
          <label className="combat-scale">Tamanho <b>{Math.round(selectedScale*100)}%</b><input type="range" min=".1" max="1.8" step=".05" value={selectedScale} onChange={e=>setScales(v=>({...v,[selected.id]:Number(e.target.value)}))}/></label>
          <div className="combat-action-title">AÇÕES</div><div className="combat-actions">{character.actions.map(([id,label,mode])=><button key={id} className={(id==='teleport'&&teleportId===selected.id)||(id==='attack4'&&missileId===selected.id)?'active':''} disabled={(!!teleportId&&teleportId!==selected.id)||(!!missileId&&missileId!==selected.id)} onClick={()=>mode?toggleTeleport(selected):playAction(selected,id,label)}>{label}</button>)}</div>
          {character.shield&&<button className={`combat-shield ${shielded[selected.id]?'active':''}`} onClick={()=>toggleShield(selected)}>{shielded[selected.id]?<ShieldOff size={16}/>:<Shield size={16}/>} {shielded[selected.id]?'Desativar escudo':'Ativar escudo'}</button>}
          {actionLabel&&<p className="combat-action-status">{actionLabel}</p>}
          {selected.name==='Doutor Estranho'&&shielded[selected.id]&&<p className="combat-note">Escudo mantido. O Laço mágico pode ser usado sem desativá-lo.</p>}
          {isMaster&&<button className="combat-remove" onClick={()=>{if(confirm(`Remover ${selected.name} do combate?`)){onRemoveToken(selected.id);setSelectedId(null);setTeleportId(null)}}}><Trash2 size={15}/> Remover personagem</button>}
        </>:<p className="combat-note">Selecione um personagem cadastrado para ver suas ações.</p>}
        <p className="combat-note">Arraste personagens para movimentá-los. A pose acompanha a direção do movimento.</p>{error&&<p className="map-error">{error}</p>}
      </aside>
    </div>
  </section>
}
