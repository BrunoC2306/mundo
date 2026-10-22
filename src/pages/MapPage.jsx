import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LockKeyhole, MapPin, Plus, Swords, ImagePlus, Trash2, Zap, Crosshair, UserRound, X, ScanSearch, Play, Pencil, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useMaster } from '../state/MasterContext.jsx'
import '../styles/map-page.css'

const PLACES = [
  // Coordenadas relativas à imagem completa do mapa (1536 × 1024).
  // Mantemos o mapa na proporção 3:2 para os marcadores não deslizarem quando a tela muda.
  { id:'doca-porto', name:'Doca / Porto', x:8, y:9 },
  { id:'galpao-abandonado', name:'Galpão abandonado', x:52, y:10 },
  { id:'casa-tony-stark', name:'Casa de luxo do Tony Stark', x:85, y:10 },
  { id:'base-shield', name:'Base da S.H.I.E.L.D.', x:33, y:28 },
  { id:'sanctum-sanctorum', name:'Sanctum Sanctorum', x:68, y:24 },
  { id:'nave-guardioes', name:'Nave dos Guardiões da Galáxia', x:47, y:41 },
  { id:'torre-vingadores', name:'Torre dos Vingadores', x:12, y:32 },
  { id:'castelo-genosha', name:'Castelo de Genosha', x:83, y:39 },
  { id:'mansao-xavier', name:'Mansão Charles Xavier', x:24, y:64 },
  { id:'hells-kitchen', name:"Prédio de Hell's Kitchen", x:61, y:60 },
  { id:'complexo-hydra', name:'Complexo da HYDRA', x:53, y:81 },
  { id:'estatua-liberdade', name:'Estátua da Liberdade', x:85, y:84 },
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
  const [tokenEmoji, setTokenEmoji] = useState('🦸')
  const [tokenImageFile, setTokenImageFile] = useState(null)
  const [spriteSheetFile, setSpriteSheetFile] = useState(null)
  const [spriteFrames, setSpriteFrames] = useState([])
  const [spriteImportError, setSpriteImportError] = useState('')
  const [playingSpriteId, setPlayingSpriteId] = useState(null)
  const [spriteScale, setSpriteScale] = useState(1)
  const [selectedTokenId, setSelectedTokenId] = useState(null)
  const [abilityName, setAbilityName] = useState('')
  const [abilities, setAbilities] = useState([])
  const [attackFx, setAttackFx] = useState(null)
  const [moveMode, setMoveMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(null)
  const place = places.find(p => p.id === selected)

  async function loadAll() {
    setLoading(true); setError('')
    const [pRes,sRes,tRes,aRes] = await Promise.all([
      supabase.from('map_places').select('*'),
      supabase.from('map_scenes').select('*').order('created_at'),
      supabase.from('map_tokens').select('*').order('created_at'),
      supabase.from('map_token_abilities').select('*').order('created_at'),
    ])
    if (pRes.error && pRes.error.code !== 'PGRST116') setError('Não consegui carregar os locais. Confere se executaste o SQL incluído no ZIP.')
    const pRows = pRes.data || []
    setPlaces(PLACES.map(p => ({...p, locked: pRows.find(r => r.place_id === p.id)?.locked ?? true})))
    setScenes(sRes.data || []); setTokens(tRes.data || []); setAbilities(aRes.data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  // Atalho Delete/Backspace remove o token selecionado no modo combate.
  useEffect(() => {
    if (!isMaster || mode !== 'combat' || !scene || !selectedTokenId) return
    const onKeyDown = (event) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const el = event.target
      if (el && (el.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName))) return
      const token = tokens.find(t => t.id === selectedTokenId && t.scene_id === scene.id)
      if (!token) return
      event.preventDefault()
      removeToken(token)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMaster, mode, scene, selectedTokenId, tokens])

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
  async function analyzeSpriteSheet(file) {
    setSpriteSheetFile(file || null); setSpriteFrames([]); setSpriteImportError(''); setPlayingSpriteId(null)
    if (!file) return
    if (!file.type.startsWith('image/')) { setSpriteImportError('Escolhe uma imagem PNG, JPG ou WebP.'); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d', {willReadFrequently:true}); ctx.drawImage(img,0,0)
        const {data,width,height}=ctx.getImageData(0,0,canvas.width,canvas.height)
        const total=width*height, mask=new Uint8Array(total), seen=new Uint8Array(total)
        // Treat transparency as background; for opaque black-background sheets, black pixels are also background.
        for(let i=0,pix=0;i<data.length;i+=4,pix++) {
          const a=data[i+3], r=data[i],g=data[i+1],b=data[i+2]
          mask[pix]=(a>24 && (a<250 || r+g+b>42))?1:0
        }
        const components=[]; const queue=new Int32Array(total)
        for(let start=0;start<total;start++) {
          if(!mask[start]||seen[start]) continue
          let head=0,tail=0;queue[tail++]=start;seen[start]=1
          let minX=width,minY=height,maxX=0,maxY=0,count=0
          while(head<tail) {
            const q=queue[head++],x=q%width,y=(q/width)|0;count++
            if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y
            const neighbors=[]
            if(x>0)neighbors.push(q-1);if(x<width-1)neighbors.push(q+1);if(y>0)neighbors.push(q-width);if(y<height-1)neighbors.push(q+width)
            for(const n of neighbors) if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n}
          }
          const w=maxX-minX+1,h=maxY-minY+1,area=w*h
          if(count>=90 && area>=180 && w>=8 && h>=8 && area<total*.45) components.push({x:minX,y:minY,w,h,count})
        }
        components.sort((a,b)=>a.y-b.y || a.x-b.x)
        // Very small detached details are excluded; each detected component becomes a testable preview.
        const frames=components.slice(0,160).map((c,i)=>{
          const crop=document.createElement('canvas');crop.width=c.w;crop.height=c.h
          crop.getContext('2d').drawImage(canvas,c.x,c.y,c.w,c.h,0,0,c.w,c.h)
          return {id:`sprite-${i+1}`,name:`Animação ${i+1}`,url:crop.toDataURL('image/png'),width:c.w,height:c.h,x:c.x,y:c.y}
        })
        setSpriteFrames(frames)
        if(!frames.length)setSpriteImportError('Não encontrei elementos separados. A imagem pode ter fundo opaco ou os sprites podem estar encostados. O arquivo foi carregado, mas não consegui separar automaticamente.')
      } catch(err) { setSpriteImportError('Não consegui analisar essa imagem. Tenta PNG com transparência.'); }
      URL.revokeObjectURL(url)
    }
    img.onerror=()=>{setSpriteImportError('Não consegui abrir a imagem.');URL.revokeObjectURL(url)}
    img.src=url
  }
  function chooseSpriteAsToken(frame) {
    const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);c.toBlob(blob=>{if(blob)setTokenImageFile(new File([blob],`${frame.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`,{type:'image/png'}))},'image/png')};img.src=frame.url
  }
  async function addToken() {
    if(!isMaster||!scene||!tokenName.trim())return
    let imageUrl = null
    if (tokenImageFile) {
      const safeName = tokenImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const objectPath = `tokens/${scene.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('map-scenes').upload(objectPath, tokenImageFile, { cacheControl:'3600', upsert:false, contentType:tokenImageFile.type })
      if (uploadError) { setError('Não consegui enviar a imagem do token: '+uploadError.message); return }
      imageUrl = supabase.storage.from('map-scenes').getPublicUrl(objectPath).data.publicUrl
    }
    const {data,error:e}=await supabase.from('map_tokens').insert({scene_id:scene.id,name:tokenName.trim(),x:50,y:50,emoji:tokenEmoji,image_url:imageUrl}).select().single()
    if(e){setError('Não consegui criar o token: '+e.message);return}
    setTokens(old=>[...old,data]);setTokenName('');setTokenImageFile(null);setSelectedTokenId(data.id)
  }
  async function addAbility(e) {
    e?.preventDefault(); const token = sceneTokens.find(t=>t.id===selectedTokenId)
    if(!isMaster || !token || !abilityName.trim()) return
    const {data,error:e2}=await supabase.from('map_token_abilities').insert({token_id:token.id,name:abilityName.trim()}).select().single()
    if(e2){setError('Não consegui salvar a habilidade. Executa o SQL de combate incluído no ZIP: '+e2.message);return}
    setAbilities(old=>[...old,data]);setAbilityName('')
  }
  async function useAbility(a, token) {
    setSelectedTokenId(token.id); setAttackFx({tokenId:token.id, ability:a.name, at:Date.now()})
    window.setTimeout(()=>setAttackFx(null), 1000)
  }
  async function removeToken(token) {
    if(!isMaster || !confirm(`Remover ${token.name} do combate?`)) return
    const {error:e}=await supabase.from('map_tokens').delete().eq('id',token.id)
    if(e){setError('Não consegui remover o token: '+e.message);return}
    setTokens(old=>old.filter(t=>t.id!==token.id));setAbilities(old=>old.filter(a=>a.token_id!==token.id));if(selectedTokenId===token.id)setSelectedTokenId(null)
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
  if (scene) {
    const activeToken = sceneTokens.find(t=>t.id===selectedTokenId)
    const activeAbilities = abilities.filter(a=>a.token_id===activeToken?.id)
    return <section className="map-page map-page--scene">
      <header className="map-toolbar"><button className="map-button" onClick={()=>{setScene(null);setMode('explore');setSelectedTokenId(null)}}><ArrowLeft size={17}/> Voltar ao local</button><div><h1>{scene.title}</h1><p>{place?.name || PLACES.find(p=>p.id===scene.place_id)?.name}</p></div><div className="map-mode-switch"><button className={mode==='explore'?'active':''} onClick={()=>setMode('explore')}>Exploração</button><button className={mode==='combat'?'active':''} onClick={()=>setMode('combat')}><Swords size={15}/> Combate</button></div></header>
      {mode==='combat' && <div className="combat-intro"><div><strong><Swords size={17}/> Modo combate</strong><span>Seleciona um token e usa uma habilidade para disparar a animação. O mestre pode mover as peças arrastando-as ou escolhendo um destino.</span></div><span className="combat-live">● Tabuleiro ativo</span></div>}
      <div className={`map-scene-canvas ${mode==='combat'?'is-combat':''}`} style={{backgroundImage:`linear-gradient(0deg,rgba(5,8,14,.12),rgba(5,8,14,.02)),url("${scene.image_url}")`}} onClick={e=>{if(mode!=='combat'||!isMaster||!moveMode||!selectedTokenId)return;const r=e.currentTarget.getBoundingClientRect();moveToken(selectedTokenId,Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)),Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100)));setMoveMode(false)}} onPointerMove={e=>{if(!dragging)return;const r=e.currentTarget.getBoundingClientRect();moveToken(dragging.id,Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)),Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100)) )}} onPointerUp={()=>setDragging(null)}>
        {mode==='combat' && sceneTokens.map(t=><button key={t.id} className={`map-token ${selectedTokenId===t.id?'selected':''} ${attackFx?.tokenId===t.id?'attacking':''}`} style={{left:`${t.x}%`,top:`${t.y}%`}} onClick={e=>{e.stopPropagation();setSelectedTokenId(t.id);if(moveMode&&isMaster)setMoveMode(false)}} onPointerDown={e=>{if(!isMaster)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture?.(e.pointerId);setSelectedTokenId(t.id);setDragging({id:t.id})}} title={isMaster?'Clica para selecionar; arrasta para mover; Delete remove':t.name}><span className="map-token-portrait">{t.image_url?<img src={t.image_url} alt=""/>:(t.emoji||'♟')}</span><small>{t.name}</small>{attackFx?.tokenId===t.id&&<span key={attackFx.at} className="combat-impact">{attackFx.ability}<i>✦</i></span>}</button>)}
        {mode==='explore' && <div className="map-scene-caption">{scene.title}</div>}
        {mode==='combat'&&moveMode&&<div className="combat-target-hint"><Crosshair size={15}/> Clica no tabuleiro para mover o token selecionado</div>}
      </div>
      {isMaster&&mode==='combat'&&<div className="combat-controls">
        <form className="combat-add-token" onSubmit={e=>{e.preventDefault();addToken()}}><h3><UserRound size={17}/> Adicionar personagem ou inimigo</h3><div className="combat-add-row"><input value={tokenName} onChange={e=>setTokenName(e.target.value)} placeholder="Nome do personagem/inimigo" required/><select value={tokenEmoji} onChange={e=>setTokenEmoji(e.target.value)} aria-label="Ícone do token"><option value="🦸">Herói</option><option value="🦹">Vilão</option><option value="👾">Inimigo</option><option value="🤖">Robô</option><option value="♟">Peão</option></select><label className="combat-upload">Retrato (opcional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setTokenImageFile(e.target.files?.[0]||null)}/></label><button className="map-button" type="submit"><Plus size={16}/> Adicionar token</button></div></form>
        <section className="sprite-importer">
          <div className="sprite-importer-heading"><div><h3><ScanSearch size={17}/> Importador automático de sprite sheet</h3><p>Envia uma única imagem. O site tenta separar os elementos visuais para testar e renomear.</p></div><label className="map-button sprite-file-button"><Upload size={15}/> Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>analyzeSpriteSheet(e.target.files?.[0]||null)}/></label></div>
          {spriteSheetFile&&<details className="sprite-results"><summary>{spriteFrames.length} elementos detectados — revisar e testar</summary>
            <div className="sprite-import-meta">Arquivo: {spriteSheetFile.name}<label>Escala de prévia <input type="range" min="0.5" max="2.5" step="0.1" value={spriteScale} onChange={e=>setSpriteScale(Number(e.target.value))}/>{Math.round(spriteScale*100)}%</label></div>
            {spriteImportError&&<p className="sprite-import-error">{spriteImportError}</p>}
            {spriteFrames.length>0&&<div className="sprite-frame-grid">{spriteFrames.map((f,i)=><article className="sprite-frame-card" key={f.id}><div className="sprite-frame-preview"><img src={f.url} alt={f.name} style={{transform:`scale(${spriteScale})`}}/></div><input aria-label={`Nome da animação ${i+1}`} value={f.name} onChange={e=>setSpriteFrames(old=>old.map(x=>x.id===f.id?{...x,name:e.target.value}:x))}/><small>{f.width} × {f.height}px</small><div><button type="button" className="map-button" onClick={()=>setPlayingSpriteId(playingSpriteId===f.id?null:f.id)}><Play size={13}/>{playingSpriteId===f.id?'Parar':'Testar'}</button><button type="button" className="map-button" onClick={()=>{chooseSpriteAsToken(f);setTokenName(v=>v||'Homem de Ferro')}}>Usar como token</button></div>{playingSpriteId===f.id&&<div className="sprite-test-stage"><img src={f.url} alt="Prévia da animação"/></div>}</article>)}</div>}
          </details>}
        </section>
        <div className="combat-action-panel"><div className="combat-action-heading"><div><h3><Zap size={17}/> Habilidades de combate</h3><p>{activeToken?`Personagem selecionado: ${activeToken.name}`:'Seleciona um personagem no tabuleiro para ver as habilidades.'}</p></div>{activeToken&&<button className="map-button map-button-quiet" onClick={()=>removeToken(activeToken)} title="Remover token"><Trash2 size={15}/><X size={13}/></button>}</div>
          {activeToken&&<><form className="combat-add-ability" onSubmit={addAbility}><input value={abilityName} onChange={e=>setAbilityName(e.target.value)} placeholder="Nome da habilidade (ex.: Teia, Raio repulsor)"/><button className="map-button" type="submit"><Plus size={15}/> Adicionar habilidade</button></form><div className="combat-ability-list">{activeAbilities.map(a=><button key={a.id} className="combat-ability-button" onClick={()=>useAbility(a,activeToken)}><Zap size={15}/>{a.name}<span>USAR</span></button>)}{!activeAbilities.length&&<p className="combat-empty-abilities">Adiciona as habilidades deste personagem. Ao clicar no nome, a animação será exibida no tabuleiro.</p>}</div><div className="combat-move-row"><button className={`map-button ${moveMode?'active':''}`} onClick={()=>setMoveMode(v=>!v)}><Crosshair size={15}/>{moveMode?'Cancelar destino':'Escolher destino no mapa'}</button><span>Ou arrasta o token diretamente. As posições são salvas no Supabase.</span></div></>}
        </div>
      </div>}
      {!isMaster&&mode==='combat'&&<div className="combat-action-panel"><h3><Zap size={17}/> Habilidades</h3><p>Seleciona um personagem para ver as habilidades disponíveis.</p>{activeToken&&activeAbilities.map(a=><button key={a.id} className="combat-ability-button" onClick={()=>useAbility(a,activeToken)}><Zap size={15}/>{a.name}<span>USAR</span></button>)}</div>}
      {error&&<p className="map-error">{error}</p>}
    </section>
  }

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
