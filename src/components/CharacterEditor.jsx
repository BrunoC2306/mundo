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
  const [sheetText, setSheetText] = useState(() => JSON.stringify(row?.sheet ?? {}, null, 2))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const sheetCheck = useMemo(() => checkSheetText(sheetText), [sheetText])

  async function pickImage(file) {
    setUploading(true)
    setError(null)
    try {
      setImage(await uploadImageBlob(file))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setError(null)
    const n = name.trim()
    const img = image.trim()
    if (!n) return setError('Informe o nome.')
    if (n.length > 120) return setError('O nome passa de 120 caracteres.')
    if (isNew && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return setError('Identificador inválido: use letras minúsculas, números e hífens.')
    if (!sheetCheck.ok) return setError(sheetCheck.error)
    if (img && !/^https?:\/\/\S+$/i.test(img)) return setError('A imagem precisa ser um link http(s). Use "Enviar imagem" para subir um arquivo.')

    setSaving(true)
    try {
      const fields = { summary: summary.trim() || null, category: category.trim() || null }
      if (isNew) {
        const res = await importOne({ slug, name: n, image: img || null, sheet: sheetCheck.value, ...fields }, { mode: 'create', isPublic })
        toast('Ficha criada.', 'success')
        onSaved?.(res)
      } else {
        const { data, error: err } = await supabase
          .from('characters')
          .update({ name: n, image_url: img || null, sheet: sheetCheck.value, is_public: isPublic, ...fields })
          .eq('id', row.id)
          .eq('version', row.version) // só salva se ninguém alterou a ficha desde que você abriu
          .select('id')
        if (err) throw err
        if (!data?.length) throw new Error('CONFLICT')
        toast('Ficha salva.', 'success')
        onSaved?.({ slug: row.slug })
      }
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? 'Nova ficha' : `Editar ${row.name}`}
      onClose={onClose}
      wide
      dismissOnBackdrop={false}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving || uploading}>
            {saving ? 'Salvando…' : 'Salvar ficha'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Nome</span>
          <input
            className="input"
            value={name}
            maxLength={120}
            autoFocus
            onChange={(e) => {
              setName(e.target.value)
              if (isNew && !slugTouched) setSlug(slugify(e.target.value))
            }}
          />
        </label>
        <label className="field">
          <span>Identificador</span>
          <input
            className="input"
            value={slug}
            disabled={!isNew}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
          />
          <small className="field__hint">{isNew ? 'Estável: liga a ficha à árvore e aos arquivos. Não muda se o nome mudar.' : 'Não pode ser alterado.'}</small>
        </label>
        <label className="field">
          <span>Categoria</span>
          <input className="input" list="mb-categories" value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="mb-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Visibilidade</span>
          <select className="input" value={isPublic ? 'public' : 'private'} onChange={(e) => setIsPublic(e.target.value === 'public')}>
            <option value="private">Privada (só o mestre vê)</option>
            <option value="public">Pública (todos os jogadores veem)</option>
          </select>
        </label>
        <label className="field field--wide">
          <span>Resumo (aparece no card)</span>
          <input className="input" value={summary} maxLength={600} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <div className="field field--wide">
          <span>Imagem</span>
          <div className="row-gap">
            <input className="input" placeholder="https://…" value={image} onChange={(e) => setImage(e.target.value)} />
            <button className="btn" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="spin" size={16} /> : <ImagePlus size={16} />} Enviar imagem
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) pickImage(f)
              }}
            />
          </div>
        </div>
        <label className="field field--wide">
          <span>Conteúdo da ficha (JSON livre — os campos do seu sistema)</span>
          <textarea className="json-area" rows={14} spellCheck={false} value={sheetText} onChange={(e) => setSheetText(e.target.value)} />
          {!sheetCheck.ok && <small className="field__error">{sheetCheck.error}</small>}
          {sheetCheck.ok && sheetCheck.removed.length > 0 && (
            <small className="field__hint">
              Estes campos são controlados pelos campos acima e serão ignorados aqui: {sheetCheck.removed.join(', ')}.
            </small>
          )}
        </label>
      </div>
      {error && <p className="alert alert--bad">{error}</p>}
    </Modal>
  )
}
