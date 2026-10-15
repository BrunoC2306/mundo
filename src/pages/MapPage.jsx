import { useEffect, useState } from 'react'
import { ArrowLeft, ImagePlus, MapPin, Trash2, Lock, Unlock } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useMaster } from '../state/MasterContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import '../styles/map-page.css'

const LOCATIONS = [
  { id:'porto', name:'Doca/Porto', x:12, y:10, desc:'Área portuária e docas.' },
  { id:'galpao', name:'Galpão abandonado', x:48, y:12, desc:'Um galpão isolado nos arredores.' },
  { id:'tony', name:'Casa de luxo Tony Stark', x:86, y:10, desc:'Residência de luxo de Tony Stark.' },
  { id:'shield', name:'Base S.H.I.E.L.D.', x:34, y:28, desc:'Instalação da S.H.I.E.L.D.' },
  { id:'sanctum', name:'Sanctum Sanctorum', x:80, y:29, desc:'Residência e santuário do Doutor Estranho.' },
  { id:'guardioes', name:'Nave dos Guardiões da Galáxia', x:52, y:40, desc:'Ponto de pouso da nave dos Guardiões.' },
  { id:'vingadores', name:'Torre dos Vingadores', x:12, y:43, desc:'A torre dos Vingadores.' },
  { id:'genosha', name:'Castelo de Genosha', x:84, y:47, desc:'Castelo ligado a Genosha.' },
  { id:'xavier', name:'Mansão Charles Xavier', x:20, y:63, desc:'Mansão e escola para jovens mutantes.' },
  { id:'hells-kitchen', name:"Prédio de Hell's Kitchen", x:56, y:65, desc:'Edifício na região de Hell’s Kitchen.' },
  { id:'hydra', name:'Complexo da HYDRA', x:44, y:84, desc:'Complexo de operações da HYDRA.' },
  { id:'liberdade', name:'Estátua da Liberdade', x:83, y:87, desc:'A ilha da Estátua da Liberdade.' },
]
const BUCKET = 'mapa-locais'

export default function MapPage() {
  const { isMaster } = useMaster()
  const [selected, setSelected] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [caption, setCaption] = useState('')
  const [unlocked, setUnlocked] = useState([])
  const [accessLoading, setAccessLoading] = useState(true)

  async function loadAccess() {
    setAccessLoading(true)
    const { data, error } = await supabase.from('map_location_access').select('location_id, is_unlocked')
    if (!error) setUnlocked((data || []).filter(row => row.is_unlocked).map(row => row.location_id))
    else setNotice('Não foi possível carregar o acesso aos locais. O mestre precisa executar o SQL de bloqueio do mapa no Supabase.')
    setAccessLoading(false)
  }

  useEffect(() => { loadAccess() }, [])

  async function toggleLocation(loc) {
    const currentlyUnlocked = unlocked.includes(loc.id)
    setBusy(true); setNotice('')
    const { error } = await supabase.from('map_location_access').upsert(
      { location_id: loc.id, is_unlocked: !currentlyUnlocked, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )
    if (error) setNotice(`Não foi possível alterar o acesso: ${error.message}`)
    else setUnlocked(prev => currentlyUnlocked ? prev.filter(id => id !== loc.id) : [...prev, loc.id])
    setBusy(false)
  }

  async function loadPhotos(location) {
    setLoading(true); setNotice('')
    const { data, error } = await supabase.storage.from(BUCKET).list(location.id, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
    if (error) { setPhotos([]); setNotice('Não foi possível carregar as imagens. Confere se o mestre configurou o armazenamento do mapa no Supabase.'); setLoading(false); return }
    const items = (data || []).filter(f => f.name && !f.name.startsWith('.'))
    setPhotos(items.map(f => {
      const path = `${location.id}/${f.name}`
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return { name:f.name, path, url:urlData.publicUrl, caption:f.metadata?.eTag ? '' : '' }
    }))
    setLoading(false)
  }
  useEffect(() => { if (selected) loadPhotos(selected) }, [selected?.id])

  async function addFiles(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!selected || !files.length) return
    setBusy(true); setNotice('')
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${selected.id}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert:false, contentType:file.type })
      if (error) { setNotice(`Erro ao enviar ${file.name}: ${error.message}`); break }
    }
    await loadPhotos(selected); setBusy(false)
  }
  async function removePhoto(photo) {
    if (!confirm('Remover esta imagem deste local?')) return
    const { error } = await supabase.storage.from(BUCKET).remove([photo.path])
    if (error) setNotice(`Não foi possível remover: ${error.message}`)
    else await loadPhotos(selected)
  }

  return <section className="page map-page">
    <PageHeader title="Mapa" subtitle="Explore os locais do Mundo de Batalha." />
    <div className="map-page__body">
      {!selected ? <>
        <div className="map-page__intro"><span><MapPin size={16}/> MAPA DA CAMPANHA</span><p>Clique em um marcador para entrar no local e ver as imagens adicionadas pelo mestre.</p></div>
        <div className="world-map">
          <img className="world-map__image" src="/mapa-mundo.png" alt="Mapa ilustrado do Mundo de Batalha" />
          {LOCATIONS.map(loc => {
            const isUnlocked = unlocked.includes(loc.id)
            const blocked = !isMaster && !isUnlocked
            return <button key={loc.id} className={`map-pin ${blocked ? 'map-pin--locked' : ''}`} style={{left:`${loc.x}%`,top:`${loc.y}%`}} onClick={() => blocked ? setNotice(`${loc.name} ainda não foi liberado pelo mestre.`) : (setNotice(''), setSelected(loc))} title={blocked ? `${loc.name} — bloqueado` : loc.name} aria-label={loc.name}>
              <span className="map-pin__dot">{blocked ? <Lock size={16}/> : <MapPin size={17}/>}</span><span className="map-pin__label">{loc.name}</span>
              {isMaster && <span className={`map-pin__status ${isUnlocked ? 'is-open' : ''}`}>{isUnlocked ? 'Liberado' : 'Bloqueado'}</span>}
            </button>
          })}
        </div>
        {notice && <div className="alert alert--bad">{notice}</div>}
        {isMaster && <div className="map-access-panel"><h3>Controle de acesso dos locais</h3><p>Libera um local quando os jogadores chegarem até ele. Locais bloqueados aparecem com cadeado para os jogadores.</p><div className="map-access-list">{LOCATIONS.map(loc => {
          const open = unlocked.includes(loc.id)
          return <div className="map-access-row" key={loc.id}><span>{loc.name}</span><button className={`btn ${open ? 'btn--secondary' : 'btn--primary'}`} disabled={busy || accessLoading} onClick={() => toggleLocation(loc)}>{open ? <><Lock size={15}/> Bloquear</> : <><Unlock size={15}/> Liberar</>}</button></div>
        })}</div></div>}
        <p className="map-page__footnote">Os marcadores indicam posições aproximadas e podem ser ajustados conforme a campanha.</p>
      </> : <>
        <button className="map-back" onClick={() => { setSelected(null); setNotice('') }}><ArrowLeft size={17}/> Voltar ao mapa</button>
        <div className="location-heading"><div><span className="location-heading__eyebrow">LOCALIZAÇÃO</span><h2>{selected.name}</h2><p>{selected.desc}</p></div>
          {isMaster && <label className="btn btn--primary map-upload"><ImagePlus size={17}/>{busy ? 'Enviando...' : 'Adicionar imagens'}<input type="file" accept="image/*" multiple disabled={busy} onChange={addFiles}/></label>}
        </div>
        {isMaster && <p className="map-page__hint">As imagens enviadas aqui ficam disponíveis para todos os jogadores. Podes selecionar várias de uma vez.</p>}
        {notice && <div className="alert alert--bad">{notice}</div>}
        {loading ? <div className="map-empty">Carregando imagens...</div> : photos.length ? <div className="location-gallery">{photos.map(photo => <article className="location-photo" key={photo.path}>
          <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.name}/></a>
          {isMaster && <button className="location-photo__remove" onClick={() => removePhoto(photo)} title="Remover imagem"><Trash2 size={16}/></button>}
          <div className="location-photo__name">{photo.name.replace(/^\d+-/, '').replace(/-/g,' ')}</div>
        </article>)}</div> : <div className="map-empty"><ImagePlus size={30}/><h3>Nenhuma imagem neste local ainda</h3><p>{isMaster ? 'Adiciona as imagens usando o botão acima.' : 'O mestre ainda não adicionou imagens a este local.'}</p></div>}
      </>}
    </div>
  </section>
}
