import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabase.js'
import { checkSheetText, slugify } from '../lib/sheetFormat.js'
import { importOne } from '../lib/characters.js'
import { uploadImageBlob } from '../lib/images.js'
import { friendlyError } from '../lib/errors.js'
import { useUi } from '../ui/UiProvider.jsx'

const CATEGORY_SUGGESTIONS = ['Vilão', 'Herói oculto', 'NPC', 'Personagem secundário']
const ATTRIBUTES = [
  ['FOR', 'Força'], ['VIG', 'Vigor'], ['AGI', 'Agilidade'],
  ['INT', 'Intelecto'], ['PRE', 'Presença'], ['SEN', 'Sentidos'],
]
const SKILLS = [
  ['Acrobacia+', 'AGI'], ['Adestramento', 'PRE'], ['Artes*', 'PRE'], ['Atletismo', 'FOR'],
  ['Atualidades', 'INT'], ['Ciências*', 'INT'], ['Crime*', 'AGI'], ['Diplomacia', 'PRE'],
  ['Enganação', 'PRE'], ['Fortitude', 'VIG'], ['Furtividade+', 'AGI'], ['Iniciativa', 'AGI'],
  ['Intimidação', 'PRE'], ['Intuição', 'PRE'], ['Investigação', 'INT'], ['Luta', 'FOR'],
  ['Medicina', 'INT'], ['Ocultismo*', 'INT'], ['Percepção', 'PRE'], ['Pilotagem*', 'AGI'],
  ['Pontaria', 'AGI'], ['Profissão*', 'INT'], ['Reflexos', 'AGI'], ['Religião*', 'PRE'],
]
const asNumber = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v))
const objectOrEmpty = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {}

function defaultStructuredSheet(sheet) {
  const source = objectOrEmpty(sheet)
  const attributes = objectOrEmpty(source.atributos)
  const resources = objectOrEmpty(source.recursos)
  const defense = objectOrEmpty(source.defesas)
  const skills = objectOrEmpty(source.pericias)
  return {
    ...source,
    atributos: Object.fromEntries(ATTRIBUTES.map(([key]) => [key, attributes[key] ?? 0])),
    recursos: {
      vidaAtual: resources.vidaAtual ?? 0, vidaMaxima: resources.vidaMaxima ?? 0,
      esforcoAtual: resources.esforcoAtual ?? 0, esforcoMaximo: resources.esforcoMaximo ?? 0,
    },
    defesas: { armadura: defense.armadura ?? 0, esquiva: defense.esquiva ?? 0, bloqueio: defense.bloqueio ?? 0 },
    pericias: Object.fromEntries(SKILLS.map(([name]) => [name, skills[name] ?? { dados: 0, bonus: 0, treino: 0, outros: 0 }])),
    ataques: Array.isArray(source.ataques) ? source.ataques.map((x) => ({ nome: x?.nome ?? '', teste: x?.teste ?? '', dano: x?.dano ?? '', especial: x?.especial ?? '' })) : [],
    habilidades: Array.isArray(source.habilidades) ? source.habilidades.map((x) => typeof x === 'string' ? ({ nome: x, custo: '', descricao: '' }) : ({ nome: x?.nome ?? '', custo: x?.custo ?? '', descricao: x?.descricao ?? '' })) : [],
    descricao: source.descricao ?? '',
    origem: source.origem ?? '',
    classe: source.classe ?? '',
  }
}

// row = linha completa do banco (editar) ou null (nova ficha).
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
  const [structured, setStructured] = useState(() => defaultStructuredSheet(row?.sheet ?? {}))
  const [extraText, setExtraText] = useState(() => JSON.stringify(Object.fromEntries(Object.entries(row?.sheet ?? {}).filter(([k]) => !['atributos','recursos','defesas','pericias','habilidades','ataques','descricao','origem','classe'].includes(k))), null, 2))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const extraCheck = useMemo(() => checkSheetText(extraText), [extraText])

  const updateGroup = (group, key, value) => setStructured((s) => ({ ...s, [group]: ['origem', 'classe', 'descricao'].includes(group) ? value : { ...objectOrEmpty(s[group]), [key]: value } }))
  const updateEntry = (group, index, field, value) => setStructured((s) => ({ ...s, [group]: (s[group] ?? []).map((entry, i) => i === index ? { ...entry, [field]: value } : entry) }))
  const addEntry = (group, entry) => setStructured((s) => ({ ...s, [group]: [...(s[group] ?? []), entry] }))
  const removeEntry = (group, index) => setStructured((s) => ({ ...s, [group]: (s[group] ?? []).filter((_, i) => i !== index) }))

  const updateSkill = (skill, field, value) => setStructured((s) => ({
    ...s,
    pericias: { ...objectOrEmpty(s.pericias), [skill]: { ...objectOrEmpty(s.pericias?.[skill]), [field]: value } },
  }))

  async function pickImage(file) {
    setUploading(true); setError(null)
    try { setImage(await uploadImageBlob(file)) } catch (e) { setError(friendlyError(e)) } finally { setUploading(false) }
  }

  async function save() {
    setError(null)
    const n = name.trim(); const img = image.trim()
    if (!n) return setError('Informe o nome.')
    if (n.length > 120) return setError('O nome passa de 120 caracteres.')
    if (isNew && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return setError('Identificador inválido: use letras minúsculas, números e hífens.')
    if (!extraCheck.ok) return setError(extraCheck.error)
    if (img && !/^https?:\/\/\S+$/i.test(img)) return setError('A imagem precisa ser um link http(s). Use "Enviar imagem" para subir um arquivo.')
    const sheet = { ...extraCheck.value, ...structured }
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

  const numericField = (label, value, onChange, hint) => (
    <label className="field" key={label}><span>{label}</span><input className="input" type="number" value={value ?? 0} onChange={(e) => onChange(asNumber(e.target.value))} />{hint && <small className="field__hint">{hint}</small>}</label>
  )

  return (
    <Modal title={isNew ? 'Nova ficha' : `Editar ${row.name}`} onClose={onClose} wide dismissOnBackdrop={false}
      footer={<><button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn--primary" onClick={save} disabled={saving || uploading}>{saving ? 'Salvando…' : 'Salvar ficha'}</button></>}>
      <div className="form-grid">
        <label className="field"><span>Nome</span><input className="input" value={name} maxLength={120} autoFocus onChange={(e) => { setName(e.target.value); if (isNew && !slugTouched) setSlug(slugify(e.target.value)) }} /></label>
        <label className="field"><span>Identificador</span><input className="input" value={slug} disabled={!isNew} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} /><small className="field__hint">{isNew ? 'Letras minúsculas, números e hífens.' : 'Não pode ser alterado.'}</small></label>
        <label className="field"><span>Categoria</span><input className="input" list="mb-categories" value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} /><datalist id="mb-categories">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="field"><span>Visibilidade</span><select className="input" value={isPublic ? 'public' : 'private'} onChange={(e) => setIsPublic(e.target.value === 'public')}><option value="private">Privada (só o mestre vê)</option><option value="public">Pública (jogadores veem)</option></select></label>
        <label className="field field--wide"><span>Resumo curto</span><input className="input" value={summary} maxLength={600} onChange={(e) => setSummary(e.target.value)} placeholder="Resumo que aparece na galeria" /></label>
        <label className="field"><span>Origem</span><input className="input" value={structured.origem} onChange={(e) => updateGroup('origem', null, e.target.value)} placeholder="Ex.: Asgard, laboratório..." /></label>
        <label className="field"><span>Classe / arquétipo</span><input className="input" value={structured.classe} onChange={(e) => updateGroup('classe', null, e.target.value)} placeholder="Ex.: Combatente, tecnológico..." /></label>
        <div className="field field--wide"><span>Imagem</span><div className="row-gap"><input className="input" placeholder="https://…" value={image} onChange={(e) => setImage(e.target.value)} /><button className="btn" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="spin" size={16} /> : <ImagePlus size={16} />} Enviar imagem</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickImage(f) }} /></div></div>

        <div className="field field--wide"><h3 className="panel__title">Atributos</h3><div className="form-grid">{ATTRIBUTES.map(([key, label]) => numericField(`${key} — ${label}`, structured.atributos[key], (v) => updateGroup('atributos', key, v)))}</div></div>
        <div className="field field--wide"><h3 className="panel__title">Vida e pontos de esforço</h3><div className="form-grid">
          {numericField('Vida atual', structured.recursos.vidaAtual, (v) => updateGroup('recursos', 'vidaAtual', v))}
          {numericField('Vida máxima', structured.recursos.vidaMaxima, (v) => updateGroup('recursos', 'vidaMaxima', v))}
          {numericField('Esforço atual', structured.recursos.esforcoAtual, (v) => updateGroup('recursos', 'esforcoAtual', v))}
          {numericField('Esforço máximo', structured.recursos.esforcoMaximo, (v) => updateGroup('recursos', 'esforcoMaximo', v))}
        </div></div>
        <div className="field field--wide"><h3 className="panel__title">Defesas</h3><div className="form-grid">
          {numericField('Armadura', structured.defesas.armadura, (v) => updateGroup('defesas', 'armadura', v))}
          {numericField('Esquiva', structured.defesas.esquiva, (v) => updateGroup('defesas', 'esquiva', v))}
          {numericField('Bloqueio', structured.defesas.bloqueio, (v) => updateGroup('defesas', 'bloqueio', v))}
        </div></div>
        <div className="field field--wide"><h3 className="panel__title">Perícias</h3><p className="field__hint">Valores iniciais editáveis pelo mestre. Dados, Bônus, Treino e Outros ficam separados.</p><div className="sv-table-wrap"><table className="sv-table"><thead><tr><th>Perícia / atributo</th><th>Dados</th><th>Bônus</th><th>Treino</th><th>Outros</th></tr></thead><tbody>{SKILLS.map(([skill, attr]) => { const v = objectOrEmpty(structured.pericias[skill]); return <tr key={skill}><td>{skill} <small>({attr})</small></td>{['dados','bonus','treino','outros'].map((field) => <td key={field}><input className="input input--small" aria-label={`${skill} ${field}`} type="number" value={v[field] ?? 0} onChange={(e) => updateSkill(skill, field, asNumber(e.target.value))} /></td>)}</tr> })}</tbody></table></div></div>
        <div className="field field--wide"><h3 className="panel__title">Ataques</h3><p className="field__hint">Adicione os ataques e preencha os campos. Não é necessário escrever código.</p>{structured.ataques.map((attack, i) => <div className="form-grid" key={`attack-${i}`} style={{border: '1px solid var(--line, #34343c)', borderRadius: 8, padding: 12, marginBottom: 10}}><label className="field"><span>Nome do ataque</span><input className="input" value={attack.nome} onChange={(e) => updateEntry('ataques', i, 'nome', e.target.value)} placeholder="Ex.: Mjölnir" /></label><label className="field"><span>Teste</span><input className="input" value={attack.teste} onChange={(e) => updateEntry('ataques', i, 'teste', e.target.value)} placeholder="Ex.: Luta +10" /></label><label className="field"><span>Dano</span><input className="input" value={attack.dano} onChange={(e) => updateEntry('ataques', i, 'dano', e.target.value)} placeholder="Ex.: 5d12" /></label><label className="field"><span>Efeito especial</span><input className="input" value={attack.especial} onChange={(e) => updateEntry('ataques', i, 'especial', e.target.value)} placeholder="Descrição opcional" /></label><div><button type="button" className="btn btn--ghost" onClick={() => removeEntry('ataques', i)}>Remover ataque</button></div></div>)}<button type="button" className="btn" onClick={() => addEntry('ataques', { nome: '', teste: '', dano: '', especial: '' })}>+ Adicionar ataque</button></div>
        <div className="field field--wide"><h3 className="panel__title">Habilidades</h3><p className="field__hint">Cada habilidade tem nome, custo e descrição.</p>{structured.habilidades.map((ability, i) => <div className="form-grid" key={`ability-${i}`} style={{border: '1px solid var(--line, #34343c)', borderRadius: 8, padding: 12, marginBottom: 10}}><label className="field"><span>Nome da habilidade</span><input className="input" value={ability.nome} onChange={(e) => updateEntry('habilidades', i, 'nome', e.target.value)} placeholder="Nome" /></label><label className="field"><span>Custo</span><input className="input" value={ability.custo} onChange={(e) => updateEntry('habilidades', i, 'custo', e.target.value)} placeholder="Ex.: 5 PE" /></label><label className="field field--wide"><span>Descrição</span><textarea className="input" rows={3} value={ability.descricao} onChange={(e) => updateEntry('habilidades', i, 'descricao', e.target.value)} placeholder="O que a habilidade faz" /></label><div><button type="button" className="btn btn--ghost" onClick={() => removeEntry('habilidades', i)}>Remover habilidade</button></div></div>)}<button type="button" className="btn" onClick={() => addEntry('habilidades', { nome: '', custo: '', descricao: '' })}>+ Adicionar habilidade</button></div>
        <label className="field field--wide"><span>Descrição do personagem</span><textarea className="input" rows={4} value={structured.descricao} onChange={(e) => updateGroup('descricao', null, e.target.value)} placeholder="História, aparência, personalidade ou informações adicionais..." /></label>
      </div>
      {error && <p className="alert alert--bad">{error}</p>}
    </Modal>
  )
}
