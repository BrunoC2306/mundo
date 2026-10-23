import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, Clock3, Save, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import PlayerPicker from '../components/PlayerPicker.jsx'
import { usePlayerIdentity } from '../state/PlayerIdentityContext.jsx'
import { useMaster } from '../state/MasterContext.jsx'
import { supabase } from '../lib/supabase.js'
import { friendlyError } from '../lib/errors.js'

export default function NotesPage() {
  const { playerName } = usePlayerIdentity()
  const { isMaster } = useMaster()
  const [content, setContent] = useState('')
  const [loadedName, setLoadedName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [dirty, setDirty] = useState(false)
  const debounce = useRef(null)
  const name = isMaster ? 'Mestre' : playerName

  const load = useCallback(async () => {
    if (!name) { setContent(''); setLoadedName(''); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.from('player_notes').select('player_name,content,updated_at').eq('player_name', name).maybeSingle()
    setLoading(false)
    if (err) { setError(friendlyError(err)); return }
    setContent(data?.content || ''); setLoadedName(name); setSavedAt(data?.updated_at || null); setDirty(false)
  }, [name])
  useEffect(() => { load(); return () => clearTimeout(debounce.current) }, [load])

  const save = useCallback(async (value = content) => {
    if (!name || loadedName !== name) return
    setSaving(true); setError('')
    const timestamp = new Date().toISOString()
    const { error: err } = await supabase.from('player_notes').upsert({ player_name: name, content: value, updated_at: timestamp }, { onConflict: 'player_name' })
    setSaving(false)
    if (err) { setError(friendlyError(err)); return }
    setSavedAt(timestamp); setDirty(false)
  }, [content, loadedName, name])

  const change = (value) => {
    setContent(value); setDirty(true)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => save(value), 1000)
  }

  const saveStatus = loading ? 'Carregando notas…' : saving ? 'Salvando…' : dirty ? 'Alterações pendentes' : savedAt ? `Salvo às ${new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Pronto para escrever'

  return <section className="page notes-page">
    <PageHeader title="Notas pessoais" subtitle="Pistas, suspeitas, personagens e ideias da campanha" />
    <div className="page__body personal-page__body">
      <PlayerPicker master={isMaster} />
      {!name ? <div className="personal-empty"><BookOpen size={34} /><h2>Escolhe teu nome para começar</h2><p>As notas ficam separadas por perfil.</p></div> : <div className="notes-workspace"><div className="notes-workspace__top"><div><span className="notes-eyebrow">CADERNO DE CAMPO</span><h2>{isMaster ? 'Notas privadas do mestre' : `Anotações de ${name}`}</h2></div><div className={`notes-save-status ${saving ? 'is-saving' : ''}`}><span className="notes-save-status__dot" />{saveStatus}</div></div><div className="notes-prompt"><BookOpen size={18} /><span>Registra aqui informações que queres consultar durante a sessão. As notas salvam automaticamente.</span></div><textarea className="notes-editor" value={content} onChange={(e) => change(e.target.value)} disabled={loading || loadedName !== name} maxLength={50000} placeholder={isMaster ? 'Anota os segredos da campanha, planos dos vilões, acontecimentos futuros…' : 'Anota pistas, nomes, locais, teorias e objetivos do teu personagem…'} />{error && <div className="alert alert--bad">{error}<button className="btn btn--ghost" onClick={() => save()}>Tentar salvar novamente</button></div>}<div className="notes-workspace__bottom"><span>{content.length.toLocaleString('pt-BR')} / 50.000 caracteres</span><div className="row-gap"><button className="btn" onClick={load} disabled={loading || saving}><RefreshCw size={15} /> Recarregar</button><button className="btn btn--primary" onClick={() => { clearTimeout(debounce.current); save() }} disabled={loading || saving || !dirty}><Save size={16} /> Salvar agora</button></div></div></div>}
    </div>
  </section>
}
