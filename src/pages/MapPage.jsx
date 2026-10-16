import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LockKeyhole, MapPin, Plus, Swords, ImagePlus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useMaster } from '../state/MasterContext.jsx'
import '../styles/map-page.css'

const PLACES = [
  { id:'torre-vingadores', name:'Torre dos Vingadores', x:70, y:24 },
  { id:'base-shield', name:'Base da S.H.I.E.L.D.', x:54, y:42 },
  { id:'casa-tony-stark', name:'Casa de luxo do Tony Stark', x:20, y:18 },
  { id:'nave-guardioes', name:'Nave dos Guardiões da Galáxia', x:14, y:64 },
  { id:'mansao-xavier', name:'Mansão Charles Xavier', x:34, y:32 },
  { id:'castelo-genosha', name:'Castelo de Genosha', x:84, y:70 },
  { id:'hells-kitchen', name:"Prédio de Hell's Kitchen", x:61, y:32 },
  { id:'complexo-hydra', name:'Complexo da HYDRA', x:37, y:77 },
  { id:'sanctum-sanctorum', name:'Sanctum Sanctorum', x:57, y:53 },
  { id:'galpao-abandonado', name:'Galpão abandonado', x:77, y:48 },
  { id:'estatua-liberdade', name:'Estátua da Liberdade', x:48, y:88 },
  { id:'doca-porto', name:'Doca / Porto', x:89, y:38 },
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
  const [imageFile, setImageFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [filePreview, setFilePreview] = useState('')
  const [tokenName, setTokenName] = useState('')
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
    if (!isMaster || !selected || !title.trim() || (!imageFile && !imageUrl.trim())) return
    setError('')
    setUploading(true)
    // Garante que o local pai exista antes de criar a cena (corrige a foreign key).
    const selectedPlace = PLACES.find(p => p.id === selected)
    if (!selectedPlace) { setError('Este local não foi encontrado no mapa. Volta ao mapa e abre o local novamente.'); setUploading(false); return }
    const { error: placeError } = await supabase.from('map_places').upsert({
      place_id: selectedPlace.id, name: selectedPlace.name,
      locked: places.find(p => p.id === selectedPlace.id)?.locked ?? true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'place_id' })
    if (placeError) { setError('Não consegui preparar o local para receber cenas: ' + placeError.message); setUploading(false); return }
    let finalImageUrl = imageUrl.trim()
    if (imageFile) {
      const safeName = imageFile.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const objectPath = `${selectedPlace.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('map-scenes').upload(objectPath, imageFile, { cacheControl: '3600', upsert: false, contentType: imageFile.type })
      if (uploadError) { setError('Não consegui enviar a imagem. Confere se executaste o SQL de upload de imagens: ' + uploadError.message); setUploading(false); return }
      const { data: publicData } = supabase.storage.from('map-scenes').getPublicUrl(objectPath)
      finalImageUrl = publicData.publicUrl
    }
    const {data,error:e}=await supabase.from('map_scenes').insert({place_id:selectedPlace.id,title:title.trim(),image_url:finalImageUrl,scene_type:'explore'}).select().single()
    if(e){setError('A imagem foi enviada, mas não consegui salvar a cena: '+e.message);setUploading(false);return}
    setScenes(old=>[...old,data]);setTitle('');setImageUrl('');setImageFile(null);setFilePreview('');setUploading(false)
  }
  async function setCombatImage(s) {
    const {error:e}=await supabase.from('map_scenes').update({scene_type:'combat'}).eq('id',s.id)
    if(e){setError('Não consegui marcar o mapa de combate: '+e.message);return}
    setScenes(old=>old.map(x=>x.id===s.id?{...x,scene_type:'combat'}:x));setScene({...s,scene_type:'combat'});setMode('combat')
  }
  async function addToken() {
    if(!isMaster||!scene||!tokenName.trim())return
    const {data,error:e}=await supabase.from('map_tokens').insert({scene_id:scene.id,name:tokenName.trim(),x:50,y:50,emoji:'♟'}).select().single()
    if(e){setError('Não consegui criar o token: '+e.message);return}
    setTokens(old=>[...old,data]);setTokenName('')
  }
  async function moveToken(id,x,y) {
    setTokens(old=>old.map(t=>t.id===id?{...t,x,y}:t))
    const {error:e}=await supabase.from('map_tokens').update({x,y}).eq('id',id)
    if(e)setError('A posição do token não foi salva: '+e.message)
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
      {mode==='combat' && sceneTokens.map(t=><button key={t.id} className="map-token" style={{left:`${t.x}%`,top:`${t.y}%`}} onPointerDown={e=>{if(!isMaster)return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);setDragging({id:t.id})}} title={isMaster?'Arrasta para mover':t.name}><span>{t.emoji||'♟'}</span><small>{t.name}</small></button>)}
      {mode==='explore' && <div className="map-scene-caption">{scene.title}</div>}
    </div>
    {isMaster&&mode==='combat'&&<form className="map-inline-form" onSubmit={e=>{e.preventDefault();addToken()}}><input value={tokenName} onChange={e=>setTokenName(e.target.value)} placeholder="Nome do personagem/inimigo"/><button className="map-button" type="submit"><Plus size={16}/> Adicionar token</button><span>Arrasta os tokens para mover. As posições são salvas para todos.</span></form>}
    {error&&<p className="map-error">{error}</p>}
  </section>

  if (place) {
    const placeScenes=scenes.filter(s=>s.place_id===place.id)
    if(place.locked&&!isMaster)return <section className="map-page"><button className="map-button" onClick={()=>setSelected(null)}><ArrowLeft size={16}/> Voltar ao mapa</button><div className="map-locked"><LockKeyhole size={36}/><h2>Local ainda não descoberto</h2><p>O mestre ainda não liberou este lugar.</p></div></section>
    return <section className="map-page"><header className="map-toolbar"><button className="map-button" onClick={()=>setSelected(null)}><ArrowLeft size={17}/> Mapa geral</button><div><h1>{place.name}</h1><p>{placeScenes.length} cena(s) disponível(is)</p></div>{isMaster&&<button className="map-button" onClick={()=>togglePlace(place)}>{place.locked?'Liberar local':'Bloquear local'}</button>}</header>
      {isMaster&&<form className="map-add-scene" onSubmit={e=>{e.preventDefault();addScene()}}><h3><ImagePlus size={18}/> Criar ambiente de exploração</h3><p className="map-scene-help">Escolhe uma imagem JPG, PNG ou WebP do teu computador. Se preferires, também podes usar um link direto. A imagem enviada fica guardada no Supabase para todos os jogadores.</p><label className="map-scene-field"><span>Nome da cena</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Recepção, laboratório, sala principal" required/></label><label className="map-scene-field"><span>Imagem do computador (recomendado)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0]||null;if(f&&f.size>12*1024*1024){setError('A imagem pode ter no máximo 12 MB.');e.target.value='';return}setError('');setImageFile(f);setFilePreview(f?URL.createObjectURL(f):'');if(f)setImageUrl('')}}/></label><label className="map-scene-field"><span>Ou link direto da imagem</span><input type="url" value={imageUrl} onChange={e=>{setImageUrl(e.target.value);if(e.target.value){setImageFile(null);setFilePreview('')}}} placeholder="https://.../imagem.jpg"/></label>{(filePreview||imageUrl.trim())&&<div className="map-scene-preview"><img src={filePreview||imageUrl} alt="Prévia da imagem da cena" style={{display:'block'}} onError={e=>{e.currentTarget.style.display='none'}}/><span>Prévia da imagem</span></div>}<button className="map-button" type="submit" disabled={uploading}>{uploading?'Enviando imagem…':<><Plus size={16}/> Salvar ambiente</>}</button><small>Formatos aceitos: JPG, PNG e WebP. Tamanho máximo: 12 MB.</small></form>}
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
