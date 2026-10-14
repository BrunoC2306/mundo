import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabase.js'
import { slugify } from '../lib/sheetFormat.js'
import { importOne } from '../lib/characters.js'
import { uploadImageBlob } from '../lib/images.js'
import { friendlyError } from '../lib/errors.js'
import { useUi } from '../ui/UiProvider.jsx'

const CATEGORY_SUGGESTIONS = ['Herói', 'Vilão', 'NPC', 'Personagem secundário']
const ATTRIBUTES = ['FOR', 'VIG', 'AGI', 'INT', 'PRE']
const SKILLS = [
  ['Acrobacia+', 'AGI'], ['Adestramento', 'PRE'], ['Artes*', 'PRE'], ['Atletismo', 'FOR'],
  ['Atualidades', 'INT'], ['Ciências*', 'INT'], ['Crime*+', 'AGI'], ['Diplomacia', 'PRE'],
  ['Enganação', 'PRE'], ['Fortitude', 'VIG'], ['Furtividade+', 'AGI'], ['Iniciativa', 'AGI'],
  ['Intimidação', 'PRE'], ['Intuição', 'PRE'], ['Investigação', 'INT'], ['Luta', 'FOR'],
  ['Medicina', 'INT'], ['Ocultismo*', 'INT'], ['Percepção', 'PRE'], ['Pilotagem*', 'AGI'],
  ['Pontaria', 'AGI'], ['Profissão*', 'INT'], ['Reflexos', 'AGI'], ['Religião*', 'PRE'],
]
const num = (v, fallback = 0) => Number.isFinite(Number(v)) && v !== '' ? Number(v) : fallback
const blankSkill = ([nome, atributo]) => ({ nome, atributo, dados: 0, bonus: 0, treino: 0, outros: 0 })

function normalizeSheet(sheet = {}) {
  const attributes = sheet.atributos ?? {}
  const resources = sheet.recursos ?? {}
  const knownSkills = Array.isArray(sheet.pericias) ? sheet.pericias : []
  const skills = SKILLS.map(([nome, atributo]) => {
    const found = knownSkills.find((s) => s?.nome === nome) ?? {}
    return { ...blankSkill([nome, atributo]), ...found, atributo: found.atributo ?? atributo }
  })
  const attacks = Array.isArray(sheet.ataques) ? sheet.ataques : []
  const abilities = Array.isArray(sheet.habilidades) ? sheet.habilidades : []
  return {
    attributes: Object.fromEntries(ATTRIBUTES.map((a) => [a, num(attributes[a], 0)])),
    resources: {
      vidaAtual: num(resources.vidaAtual, num(resources.vidaMaxima, 10)),
      vidaMaxima: num(resources.vidaMaxima, 10),
      esforcoAtual: num(resources.esforcoAtual, num(resources.esforcoMaximo, 10)),
      esforcoMaximo: num(resources.esforcoMaximo, 10),
      classeArmadura: num(resources.classeArmadura, 0),
      esquiva: num(resources.esquiva, 0),
      bloqueio: num(resources.bloqueio, 0),
    },
    skills,
    attacks: attacks.map((a) => ({ nome: a.nome ?? '', teste: a.teste ?? '', dano: a.dano ?? '', especial: a.especial ?? '' })),
    abilities: abilities.map((a) => ({ nome: a.nome ?? '', custo: a.custo ?? '', descricao: a.descricao ?? '' })),
    description: typeof sheet.descricao === 'string' ? sheet.descricao : '',
  }
}

export default function CharacterEditor({ row, onClose, onSaved }) {
  const isNew = !row
  const { toast } = useUi()
  const [name, setName] = useState(row?.name ?? '')
  const [slug, setSlug] = useState(row?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)
  const [summary, setSummary] = useState(row?.summary ?? '')
  const [category, setCategory] = useState(row?.category ?? '')
  const [image, setImage] = useState(row?.image_url ?? '')
  const [isPublic, setIsPublic] = useState(row ? row.is_public : false)
  const [form, setForm] = useState(() => normalizeSheet(row?.sheet ?? {}))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const updateResource = (key, value) => setForm((f) => ({ ...f, resources: { ...f.resources, [key]: value } }))
  const updateAttribute = (key, value) => setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }))
  const updateSkill = (index, key, value) => setForm((f) => ({ ...f, skills: f.skills.map((s, i) => i === index ? { ...s, [key]: value } : s) }))
  const updateItem = (kind, index, key, value) => setForm((f) => ({ ...f, [kind]: f[kind].map((item, i) => i === index ? { ...item, [key]: value } : item) }))
  const addItem = (kind) => setForm((f) => ({ ...f, [kind]: [...f[kind], kind === 'attacks' ? { nome: '', teste: '', dano: '', especial: '' } : { nome: '', custo: '', descricao: '' }] }))
  const removeItem = (kind, index) => setForm((f) => ({ ...f, [kind]: f[kind].filter((_, i) => i !== index) }))

  async function pickImage(file) {
    setUploading(true); setError(null)
    try { setImage(await uploadImageBlob(file)) } catch (e) { setError(friendlyError(e)) } finally { setUploading(false) }
  }

  function buildSheet() {
    const managedKeys = new Set(['atributos', 'recursos', 'pericias', 'ataques', 'habilidades', 'descricao'])
    const legacyExtras = Object.fromEntries(Object.entries(row?.sheet ?? {}).filter(([key]) => !managedKeys.has(key)))
    return {
      ...legacyExtras,
      atributos: form.attributes,
      recursos: form.resources,
      pericias: form.skills,
      ataques: form.attacks.filter((a) => a.nome.trim()),
      habilidades: form.abilities.filter((a) => a.nome.trim()),
      descricao: form.description,
    }
  }

  async function save() {
    setError(null)
    const n = name.trim(), img = image.trim()
    if (!n) return setError('Informe o nome do personagem.')
    if (n.length > 120) return setError('O nome passa de 120 caracteres.')
    if (isNew && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return setError('Identificador inválido: use letras minúsculas, números e hífens.')
    if (img && !/^https?:\/\/\S+$/i.test(img)) return setError('A imagem precisa ser um link http(s). Use “Enviar imagem” para subir um arquivo.')
    const sheet = buildSheet()
    if (JSON.stringify(sheet).length > 2_000_000) return setError('A ficha ficou grande demais.')
    setSaving(true)
    try {
      const fields = { summary: summary.trim() || null, category: category.trim() || null }
      if (isNew) {
        const res = await importOne({ slug, name: n, image: img || null, sheet, ...fields }, { mode: 'create', isPublic })
        toast('Ficha criada.', 'success'); onSaved?.(res)
      } else {
        const { data, error: err } = await supabase.from('characters')
          .update({ name: n, image_url: img || null, sheet, is_public: isPublic, ...fields })
          .eq('id', row.id).eq('version', row.version).select('id')
        if (err) throw err
        if (!data?.length) throw new Error('CONFLICT')
        toast('Ficha salva.', 'success'); onSaved?.({ slug: row.slug })
      }
    } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }

  const resourceFields = [
    ['vidaAtual', 'Vida atual'], ['vidaMaxima', 'Vida máxima'], ['esforcoAtual', 'Esforço atual'], ['esforcoMaximo', 'Esforço máximo'],
    ['classeArmadura', 'Classe de armadura'], ['esquiva', 'Esquiva'], ['bloqueio', 'Bloqueio'],
  ]

  return (
    <Modal title={isNew ? 'Criar ficha' : `Editar ${row.name}`} onClose={onClose} wide dismissOnBackdrop={false}
      footer={<><button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn--primary" onClick={save} disabled={saving || uploading}>{saving ? 'Salvando…' : 'Salvar ficha'}</button></>}>
      <div className="form-grid">
        <label className="field"><span>Nome do personagem</span><input className="input" value={name} maxLength={120} autoFocus onChange={(e) => { setName(e.target.value); if (isNew && !slugTouched) setSlug(slugify(e.target.value)) }} /></label>
        <label className="field"><span>Identificador da ficha</span><input className="input" value={slug} disabled={!isNew} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} /><small className="field__hint">Gerado automaticamente pelo nome; use letras, números e hífens.</small></label>
        <label className="field"><span>Categoria</span><input className="input" list="mb-categories" value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} /><datalist id="mb-categories">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="field"><span>Visibilidade</span><select className="input" value={isPublic ? 'public' : 'private'} onChange={(e) => setIsPublic(e.target.value === 'public')}><option value="private">Privada — só o mestre vê</option><option value="public">Pública — jogadores podem ver</option></select></label>
        <label className="field field--wide"><span>Resumo</span><input className="input" value={summary} maxLength={600} onChange={(e) => setSummary(e.target.value)} placeholder="Uma descrição curta para a galeria" /></label>
        <div className="field field--wide"><span>Imagem do personagem</span><div className="row-gap"><input className="input" placeholder="Link da imagem (opcional)" value={image} onChange={(e) => setImage(e.target.value)} /><button className="btn" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="spin" size={16} /> : <ImagePlus size={16} />} Enviar imagem</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickImage(f) }} /></div></div>

        <div className="field field--wide"><h3 className="editor-section-title">Dados gerais · Atributos</h3><div className="editor-stat-grid">{ATTRIBUTES.map((a) => <label className="field" key={a}><span>{({FOR:'Força (FOR)',VIG:'Vigor (VIG)',AGI:'Agilidade (AGI)',INT:'Inteligência (INT)',PRE:'Presença (PRE)'})[a]}</span><input className="input" type="number" value={form.attributes[a]} onChange={(e) => updateAttribute(a, e.target.value === '' ? '' : Number(e.target.value))} /></label>)}</div></div>
        <div className="field field--wide"><h3 className="editor-section-title">Recursos e combate</h3><div className="editor-stat-grid editor-stat-grid--resources">{resourceFields.map(([key, label]) => <label className="field" key={key}><span>{label}</span><input className="input" type="number" min="0" value={form.resources[key]} onChange={(e) => updateResource(key, e.target.value === '' ? '' : Number(e.target.value))} /></label>)}</div><small className="field__hint">Vida e esforço têm valores atuais e máximos separados.</small></div>

        <div className="field field--wide"><h3 className="editor-section-title">Perícias</h3><p className="field__hint">Os nomes e atributos seguem a referência que tu enviaste. Preenche dados, bônus, treino e outros para cada perícia.</p><div className="editor-skills-wrap"><table className="editor-skills"><thead><tr><th>Perícia</th><th>Atributo</th><th>Dados</th><th>Bônus</th><th>Treino</th><th>Outros</th></tr></thead><tbody>{form.skills.map((s, i) => <tr key={s.nome}><td>{s.nome}</td><td><select className="input" value={s.atributo} onChange={(e) => updateSkill(i, 'atributo', e.target.value)}>{ATTRIBUTES.map((a) => <option key={a}>{a}</option>)}</select></td>{['dados','bonus','treino','outros'].map((key) => <td key={key}><input className="input" type="number" value={s[key] ?? 0} onChange={(e) => updateSkill(i, key, e.target.value === '' ? '' : Number(e.target.value))} aria-label={`${s.nome} ${key}`} /></td>)}</tr>)}</tbody></table></div></div>

        <div className="field field--wide"><div className="editor-section-heading"><h3 className="editor-section-title">Ataques</h3><button type="button" className="btn btn--sm" onClick={() => addItem('attacks')}><Plus size={14} /> Adicionar ataque</button></div>{form.attacks.map((a, i) => <div className="editor-item" key={i}><label className="field"><span>Nome</span><input className="input" value={a.nome} onChange={(e) => updateItem('attacks', i, 'nome', e.target.value)} /></label><label className="field"><span>Teste</span><input className="input" value={a.teste} onChange={(e) => updateItem('attacks', i, 'teste', e.target.value)} /></label><label className="field"><span>Dano</span><input className="input" value={a.dano} onChange={(e) => updateItem('attacks', i, 'dano', e.target.value)} /></label><label className="field"><span>Especial</span><input className="input" value={a.especial} onChange={(e) => updateItem('attacks', i, 'especial', e.target.value)} /></label><button className="btn btn--icon btn--danger-ghost" type="button" onClick={() => removeItem('attacks', i)} aria-label="Remover ataque"><Trash2 size={16}/></button></div>)}</div>
        <div className="field field--wide"><div className="editor-section-heading"><h3 className="editor-section-title">Habilidades</h3><button type="button" className="btn btn--sm" onClick={() => addItem('abilities')}><Plus size={14} /> Adicionar habilidade</button></div>{form.abilities.map((a, i) => <div className="editor-item editor-item--ability" key={i}><label className="field"><span>Nome</span><input className="input" value={a.nome} onChange={(e) => updateItem('abilities', i, 'nome', e.target.value)} /></label><label className="field"><span>Custo</span><input className="input" value={a.custo} onChange={(e) => updateItem('abilities', i, 'custo', e.target.value)} placeholder="Ex.: 10 PE" /></label><label className="field"><span>Descrição</span><textarea className="input" rows={2} value={a.descricao} onChange={(e) => updateItem('abilities', i, 'descricao', e.target.value)} /></label><button className="btn btn--icon btn--danger-ghost" type="button" onClick={() => removeItem('abilities', i)} aria-label="Remover habilidade"><Trash2 size={16}/></button></div>)}</div>
        <label className="field field--wide"><span>Descrição / história</span><textarea className="input" rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="História, observações ou detalhes do personagem" /></label>
      </div>
      {error && <p className="alert alert--bad">{error}</p>}
    </Modal>
  )
}
