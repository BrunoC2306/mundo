// Formato de ficha (JSON) — documentado em docs/FORMATO_FICHA.md
// Princípio: NADA que o arquivo traga é descartado. Só "nome" é obrigatório.
// Chaves reservadas viram colunas (galeria); todo o resto fica em `sheet` exatamente como veio.

export const FORMAT_ID = 'mundo-de-batalha/ficha'
export const BACKUP_FORMAT_ID = 'mundo-de-batalha/fichas-backup'
export const RESERVED_KEYS = ['formato', 'versao', 'id', 'nome', 'imagem', 'resumo', 'categoria', '_progresso', '_visibilidade']
export const LIMITS = { name: 120, summary: 600, category: 40, sheetChars: 2_000_000, bundleItems: 200, inlineImageChars: 8_000_000 }

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const IMAGE_RE = /^(https?:\/\/\S+|data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)$/i

export function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '')
}

/** Lê UMA ficha. Retorna { entry|null, errors[], warnings[], label }. */
export function parseCharacterDoc(doc) {
  const errors = []
  const warnings = []
  if (!isObject(doc)) {
    return { entry: null, errors: ['A ficha precisa ser um objeto JSON (entre chaves { }).'], warnings, label: null }
  }

  const sheet = { ...doc }
  const take = (key) => {
    const v = sheet[key]
    delete sheet[key]
    return v
  }
  const empty = (v) => v === undefined || v === null || v === ''

  const formato = take('formato')
  if (formato !== undefined && formato !== FORMAT_ID) {
    warnings.push(`O campo "formato" é "${formato}" (esperado "${FORMAT_ID}"). A ficha foi lida mesmo assim.`)
  }
  take('versao')
  take('_progresso')
  take('_visibilidade')

  let rawName = take('nome')
  if (rawName === undefined && typeof sheet.name === 'string') rawName = take('name')
  let name = ''
  if (empty(rawName)) errors.push('Campo obrigatório ausente: "nome".')
  else if (typeof rawName !== 'string') errors.push('O campo "nome" precisa ser um texto.')
  else {
    name = rawName.trim()
    if (!name) errors.push('Campo obrigatório vazio: "nome".')
    else if (name.length > LIMITS.name) errors.push(`O "nome" passa de ${LIMITS.name} caracteres.`)
  }

  const rawId = take('id')
  let slug = ''
  if (!empty(rawId)) {
    if (typeof rawId !== 'string' && typeof rawId !== 'number') errors.push('O campo "id" precisa ser um texto.')
    else {
      slug = slugify(String(rawId))
      if (!slug) errors.push('O campo "id" não tem letras ou números válidos.')
      else if (slug !== String(rawId)) warnings.push(`Identificador "${rawId}" normalizado para "${slug}".`)
    }
  } else if (name) {
    slug = slugify(name)
    if (!slug) errors.push('Não foi possível gerar um identificador a partir do nome; informe o campo "id".')
  }

  const optText = (key, max) => {
    const v = take(key)
    if (empty(v)) return null
    if (typeof v !== 'string') {
      errors.push(`O campo "${key}" precisa ser um texto.`)
      return null
    }
    const t = v.trim()
    if (t.length > max) {
      errors.push(`O campo "${key}" passa de ${max} caracteres.`)
      return null
    }
    return t || null
  }
  const summary = optText('resumo', LIMITS.summary)
  const category = optText('categoria', LIMITS.category)

  const rawImage = take('imagem')
  let image = null
  if (!empty(rawImage)) {
    const t = typeof rawImage === 'string' ? rawImage.trim() : ''
    if (!IMAGE_RE.test(t)) {
      errors.push('O campo "imagem" precisa ser um link http(s) ou uma imagem embutida (data:image/...;base64,...).')
    } else if (t.length > LIMITS.inlineImageChars) {
      errors.push('A imagem embutida é grande demais (máximo ~6 MB).')
    } else if (t.startsWith('http') && t.length > 2000) {
      errors.push('O link da imagem passa de 2000 caracteres.')
    } else image = t
  }

  if (JSON.stringify(sheet).length > LIMITS.sheetChars) errors.push('A ficha passa de 2 MB de texto.')
  if (Object.keys(sheet).length === 0) warnings.push('A ficha não tem campos além do nome.')

  return {
    entry: errors.length ? null : { slug, name, summary, image, category, sheet },
    errors,
    warnings,
    label: name || null,
  }
}

/** Lê o texto de um arquivo: ficha única, lista de fichas ou backup. */
export function parseImportText(text) {
  let data
  try {
    data = JSON.parse(String(text).replace(/^\uFEFF/, ''))
  } catch (e) {
    return { fatal: `O arquivo não é um JSON válido: ${e.message}`, items: [] }
  }
  let docs
  if (Array.isArray(data)) docs = data
  else if (isObject(data) && data.formato === BACKUP_FORMAT_ID) {
    if (!Array.isArray(data.fichas)) return { fatal: 'O backup não contém a lista "fichas".', items: [] }
    docs = data.fichas
  } else docs = [data]
  if (docs.length === 0) return { fatal: 'O arquivo não contém nenhuma ficha.', items: [] }
  if (docs.length > LIMITS.bundleItems) return { fatal: `O arquivo tem mais de ${LIMITS.bundleItems} fichas.`, items: [] }
  return { fatal: null, items: docs.map(parseCharacterDoc) }
}

/** Reconstrói o documento de uma ficha a partir da linha do banco. */
export function buildExportDoc(c) {
  const out = { formato: FORMAT_ID, versao: 1, id: c.slug, nome: c.name }
  if (c.image_url) out.imagem = c.image_url
  if (c.summary) out.resumo = c.summary
  if (c.category) out.categoria = c.category
  for (const [k, v] of Object.entries(c.sheet ?? {})) if (!(k in out)) out[k] = v
  return out
}

export function buildBackup(rows) {
  return {
    formato: BACKUP_FORMAT_ID,
    versao: 1,
    exportado_em: new Date().toISOString(),
    fichas: rows.map((c) => ({
      ...buildExportDoc(c),
      _progresso: { pd: c.pd },
      _visibilidade: c.is_public ? 'publica' : 'privada',
    })),
  }
}

/** Valida o texto JSON do editor de fichas (campos livres). */
export function checkSheetText(text) {
  let value
  try {
    value = JSON.parse(text || '{}')
  } catch (e) {
    return { ok: false, error: `JSON inválido: ${e.message}`, value: null, removed: [] }
  }
  if (!isObject(value)) return { ok: false, error: 'O conteúdo precisa ser um objeto JSON { ... }.', value: null, removed: [] }
  const removed = Object.keys(value).filter((k) => RESERVED_KEYS.includes(k))
  const clean = Object.fromEntries(Object.entries(value).filter(([k]) => !RESERVED_KEYS.includes(k)))
  if (JSON.stringify(clean).length > LIMITS.sheetChars) return { ok: false, error: 'O conteúdo passa de 2 MB.', value: null, removed }
  return { ok: true, error: null, value: clean, removed }
}
