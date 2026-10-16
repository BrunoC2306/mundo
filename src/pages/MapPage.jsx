import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LockKeyhole, MapPin, Plus, Swords, ImagePlus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useMaster } from '../state/MasterContext.jsx'
import '../styles/map-page.css'

const PLACES = [
  { id:'torre-vingadores', name:'Torre dos Vingadores', x:9, y:45 },
  { id:'base-shield', name:'Base S.H.I.E.L.D.', x:23, y:25 },
  { id:'casa-tony-stark', name:'Casa de luxo do Tony Stark', x:86, y:5 },
  { id:'nave-guardioes', name:'Nave dos Guardiões da Galáxia', x:46, y:37 },
  { id:'mansao-xavier', name:'Mansão Charles Xavier', x:10, y:68 },
  { id:'castelo-genosha', name:'Castelo de Genosha', x:80, y:53 },
  { id:'hells-kitchen', name:"Prédio de Hell's Kitchen", x:55, y:67 },
  { id:'complexo-hydra', name:'Complexo da HYDRA', x:43, y:87 },
  { id:'sanctum-sanctorum', name:'Sanctum Sanctorum', x:82, y:27 },
  { id:'galpao-abandonado', name:'Galpão abandonado', x:48, y:10 },
  { id:'estatua-liberdade', name:'Estátua da Liberdade', x:80, y:86 },
  { id:'doca-porto', name:'Doca / Porto', x:14, y:4 },
]
const MASTER_ROLE = (u) => u?.app_metadata?.mb_role === 'master'

export default function MapPage() {
  const { isMaster } = useMaster()
  const [places, setPlaces] = useState(PLACES.map(p => ({...p, locked:true})))
  const [scenes, setScenes] = useState([])
  const [tokens, setTokens] = useState([])
  const [selected, setSelected] = useState(null)
  const [scene, setScene] = useState(null)
  const [mode, setMode] = useState('explore')
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [tokenName, setTokenName] = useState('')
  const [tokenEmoji, setTokenEmoji] = useState('🦸')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(null)
  const place = places.find(p => p.id === selected)

  async function loadAll() {
    setLoading(true); setError('')
    const [pRes,sRes,tRes] = await Promise.all([
      supabase.from('map_places').select('*'),
      supabase.from('map_scenes').select('*').order('created_at'),
      supabase.from('map_tokens').select('*').order('created_at'),
    ])
    if (pRes.error && pRes.error.code !== 'PGRST116') setError('Não consegui carregar os locais. Confere se executaste o SQL incluído no ZIP.')
    const pRows = pRes.data || []
    setPlaces(PLACES.map(p => ({...p, locked: pRows.find(r => r.place_id === p.id)?.locked ?? true})))
    setScenes(sRes.data || []); setTokens(tRes.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function togglePlace(p) {
    if (!isMaster) return
    const next = !p.locked
    const { error: e } = await supabase.from('map_places').upsert({place_id:p.id, name:p.name, locked:next, updated_at:new Date().toISOString()}, {onConflict:'place_id'})
    if (e) { setError('Não foi possível salvar o acesso do local: '+e.message); return }
    setPlaces(old => old.map(x => x.id===p.id ? {...x,locked:next}:x))
  }
  async function addScene() {
    if (!isMaster || !selected || !title.trim() || !imageUrl.trim()) return
    setError('')
    // Garante que o local pai exista antes de criar a cena (corrige a foreign key).
    const selectedPlace = PLACES.find(p => p.id === selected)
    if (!selectedPlace) { setError('Este local não foi encontrado no mapa. Volta ao mapa e abre o local novamente.'); return }
    const { error: placeError } = await supabase.from('map_places').upsert({
      place_id: selectedPlace.id, name: selectedPlace.name,
      locked: places.find(p => p.id === selectedPlace.id)?.locked ?? true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'place_id' })
    if (placeError) { setError('Não consegui preparar o local para receber cenas: ' + placeError.message); return }
    const {data,error:e}=await supabase.from('map_scenes').insert({place_id:selectedPlace.id,title:title.trim(),image_url:imageUrl.trim(),scene_type:'explore'}).select().single()
    if(e){setError('Não consegui salvar a cena: '+e.message);return}
    setScenes(old=>[...old,data]);setTitle('');setImageUrl('')
  }
  async function setCombatImage(s) {
    const {error:e}=await supabase.from('map_scenes').update({scene_type:'combat'}).eq('id',s.id)
    if(e){setError('Não consegui marcar o mapa de combate: '+e.message);return}
    setScenes(old=>old.map(x=>x.id===s.id?{...x,scene_type:'combat'}:x));setScene({...s,scene_type:'combat'});setMode('combat')
  }
  async function addToken() {
    if(!isMaster||!scene||!tokenName.trim())return
    const {data,error:e}=await supabase.from('map_tokens').insert({scene_id:scene.id,name:tokenName.trim(),x:50,y:50,emoji:tokenEmoji}).select().single()
    if(e){setError('Não consegui criar o token: '+e.message);return}
    setTokens(old=>[...old,data]);setTokenName('')
  }
  async function moveToken(id,x,y) {
    setTokens(old=>old.map(t=>t.id===id?{...t,x,y}:t))
    const {error:e}=await supabase.from('map_tokens').update({x,y}).eq('id',id)
    if(e)setError('A posição do token não foi salva: '+e.message)
  }
  async function removeToken(t) {
    if (!isMaster || !confirm(`Remover o token ${t.name}?`)) return
    const { error: e } = await supabase.from('map_tokens').delete().eq('id', t.id)
    if (e) { setError('Não consegui remover o token: ' + e.message); return }
    setTokens(old => old.filter(x => x.id !== t.id))
  }
  async function removeScene(s) {
    if(!isMaster||!confirm('Excluir esta cena?'))return
    const {error:e}=await supabase.from('map_scenes').delete().eq('id',s.id)
    if(e){setError(e.message);return}
    setScenes(old=>old.filter(x=>x.id!==s.id));setTokens(old=>old.filter(t=>t.scene_id!==s.id));if(scene?.id===s.id)setScene(null)
  }
  const sceneTokens = useMemo(()=>tokens.filter(t=>t.scene_id===scene?.id),[tokens,scene])
  if (loading) return <section className="map-page"><p>Carregando o mapa…</p></section>
  if (scene) return <section className="map-page map-page--scene">
    <header className="map-toolbar"><button className="map-button" onClick={()=>{setScene(null);setMode('explore')}}><ArrowLeft size={17}/> Voltar ao local</button><div><h1>{scene.title}</h1><p>{place?.name || PLACES.find(p=>p.id===scene.place_id)?.name}</p></div><div className="map-mode-switch"><button className={mode==='explore'?'active':''} onClick={()=>setMode('explore')}>Exploração</button><button className={mode==='combat'?'active':''} onClick={()=>setMode('combat')}><Swords size={15}/> Combate</button></div></header>
    <div className={`map-scene-canvas ${mode==='combat'?'is-combat':''}`} style={{backgroundImage:`linear-gradient(0deg,rgba(5,8,14,.15),rgba(5,8,14,.02)),url("${scene.image_url}")`}} onPointerMove={e=>{if(!dragging)return;const r=e.currentTarget.getBoundingClientRect();moveToken(dragging.id,Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)),Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100)) )}} onPointerUp={()=>setDragging(null)}>
      {mode==='combat' && <div className="combat-grid-overlay" aria-hidden="true" />}
      {mode==='combat' && sceneTokens.map(t=><div key={t.id} className="map-token-wrap" style={{left:`${t.x}%`,top:`${t.y}%`}}>
        <button className="map-token" onPointerDown={e=>{if(!isMaster)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture?.(e.pointerId);setDragging({id:t.id})}} title={isMaster?'Arrasta para mover':t.name}><span>{t.emoji||'♟'}</span><small>{t.name}</small></button>
        {isMaster&&<button className="map-token-remove" title="Remover token" onPointerDown={e=>e.stopPropagation()} onClick={()=>removeToken(t)}>×</button>}
      </div>)}
      {mode==='explore' && <div className="map-scene-caption">{scene.title}</div>}
    </div>
    {isMaster&&mode==='combat'&&<form className="map-inline-form" onSubmit={e=>{e.preventDefault();addToken()}}><input value={tokenName} onChange={e=>setTokenName(e.target.value)} placeholder="Nome do personagem/inimigo" required/><select aria-label="Tipo de token" value={tokenEmoji} onChange={e=>setTokenEmoji(e.target.value)}><option value="🦸">🦸 Herói</option><option value="🦹">🦹 Vilão</option><option value="👾">👾 Inimigo</option><option value="🧍">🧍 NPC</option><option value="♟">♟ Peça</option></select><button className="map-button" type="submit"><Plus size={16}/> Adicionar token</button><span>Arrasta os tokens para mover. O tabuleiro tem quadrícula e as posições são compartilhadas com a mesa.</span></form>}
    {error&&<p className="map-error">{error}</p>}
  </section>

  if (place) {
    const placeScenes=scenes.filter(s=>s.place_id===place.id)
    if(place.locked&&!isMaster)return <section className="map-page"><button className="map-button" onClick={()=>setSelected(null)}><ArrowLeft size={16}/> Voltar ao mapa</button><div className="map-locked"><LockKeyhole size={36}/><h2>Local ainda não descoberto</h2><p>O mestre ainda não liberou este lugar.</p></div></section>
    return <section className="map-page"><header className="map-toolbar"><button className="map-button" onClick={()=>setSelected(null)}><ArrowLeft size={17}/> Mapa geral</button><div><h1>{place.name}</h1><p>{placeScenes.length} cena(s) disponível(is)</p></div>{isMaster&&<button className="map-button" onClick={()=>togglePlace(place)}>{place.locked?'Liberar local':'Bloquear local'}</button>}</header>
      {isMaster&&<form className="map-add-scene" onSubmit={e=>{e.preventDefault();addScene()}}><h3><ImagePlus size={18}/> Criar ambiente de exploração</h3><p className="map-scene-help">Cada ambiente é uma cena dentro deste local. Usa um link direto para uma imagem JPG, PNG ou WebP; depois clica na imagem para entrar nela.</p><label className="map-scene-field"><span>Nome da cena</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Recepção, laboratório, sala principal" required/></label><label className="map-scene-field"><span>Link direto da imagem</span><input type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://.../imagem.jpg" required/></label>{imageUrl.trim()&&<div className="map-scene-preview"><img src={imageUrl} alt="Prévia da imagem da cena" onError={e=>{e.currentTarget.style.display='none'}} onLoad={e=>{e.currentTarget.style.display='block'}}/><span>Prévia da imagem</span></div>}<button className="map-button" type="submit"><Plus size={16}/> Salvar ambiente</button><small>O link precisa abrir a imagem diretamente, não uma página de galeria. O envio de arquivos do computador ainda não está disponível nesta versão.</small></form>}
      <div className="map-scene-grid">{placeScenes.map(s=><article className="map-scene-card" key={s.id}><button className="map-scene-open" onClick={()=>{setScene(s);setMode(s.scene_type==='combat'?'combat':'explore')}}><img src={s.image_url} alt={s.title}/><span>{s.title}</span><small>{s.scene_type==='combat'?'Mapa de combate':'Cena de exploração'}</small></button><div className="map-scene-actions"><button onClick={()=>setCombatImage(s)}><Swords size={15}/> Usar em combate</button>{isMaster&&<button onClick={()=>removeScene(s)} aria-label="Excluir cena"><Trash2 size={15}/></button>}</div></article>)}</div>
      {!placeScenes.length&&<div className="map-empty">{isMaster?'Adiciona a primeira imagem deste local acima.':'O mestre ainda não adicionou cenas a este local.'}</div>}{error&&<p className="map-error">{error}</p>}
    </section>
  }

  return <section className="map-page"><header className="map-toolbar"><div><h1>Mundo de Batalha</h1><p>Escolhe um ponto do mapa para entrar no local.</p></div>{isMaster&&<span className="map-master-label">Modo mestre: controla os acessos</span>}</header>
    {error&&<p className="map-error">{error}</p>}
    <div className="map-world" style={{backgroundImage:'url("/mapa-mundo.png")'}}>{places.map(p=><button key={p.id} className={`map-place ${p.locked?'locked':''}`} style={{left:`${p.x}%`,top:`${p.y}%`}} onClick={()=>setSelected(p.id)} title={p.name}><span className="map-place-icon">{p.locked&&!isMaster?<LockKeyhole size={16}/>:<MapPin size={17}/>}</span><span className="map-place-name">{p.name}</span>{isMaster&&<span className="map-place-lock" onClick={e=>{e.stopPropagation();togglePlace(p)}}>{p.locked?'Bloqueado':'Liberado'}</span>}</button>)}</div>
    <p className="map-footnote">{isMaster?'Clica num local para editar suas cenas. Usa o status no marcador para liberar ou bloquear o acesso.':'Locais bloqueados aparecem com cadeado e podem ser liberados pelo mestre.'}</p>
  </section>
}
