import { useRef, useState } from 'react'
import { AlertTriangle, Check, FileJson, Loader2, X } from 'lucide-react'
import Modal from './Modal.jsx'
import { useData } from '../state/DataContext.jsx'
import { parseImportText } from '../lib/sheetFormat.js'
import { importOne } from '../lib/characters.js'
import { uploadDataUrl } from '../lib/images.js'
import { friendlyError } from '../lib/errors.js'
import { normText } from '../lib/text.js'

const CHOICES = {
  create: 'Importar como nova',
  update: 'Atualizar a existente',
  skip: 'Ignorar',
}

export default function ImportDialog({ onClose, target = 'public' }) {
  const { characters, refresh } = useData()
  const isPublic = target === 'public'
  const [step, setStep] = useState('pick') // pick | review | running | done
  const [fatal, setFatal] = useState(null)
  const [items, setItems] = useState([])
  const [report, setReport] = useState([])
  const [pasted, setPasted] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  function analyze(text) {
    const parsed = parseImportText(text)
    if (parsed.fatal) {
      setFatal(parsed.fatal)
      return
    }
    setFatal(null)
    const seen = new Set()
    const next = parsed.items.map((it, i) => {
      const errors = [...it.errors]
      let existing = null
      let similar = null
      if (it.entry) {
        if (seen.has(it.entry.slug)) errors.push('Identificador repetido dentro do mesmo arquivo.')
        seen.add(it.entry.slug)
        existing = characters.find((c) => c.slug === it.entry.slug) ?? null
        if (!existing) similar = characters.find((c) => normText(c.name) === normText(it.entry.name)) ?? null
      }
      const options = errors.length ? ['skip'] : existing ? ['skip', 'update'] : similar ? ['skip', 'create'] : ['create', 'skip']
      // Padrão seguro: qualquer conflito começa como "Ignorar". Nada é sobrescrito sem escolha explícita.
      return { key: i, label: it.label ?? `Item ${i + 1}`, entry: it.entry, errors, warnings: it.warnings, existing, similar, options, choice: options[0] }
    })
    setItems(next)
    setStep('review')
  }

  async function readFile(file) {
    if (file.size > 30_000_000) {
      setFatal('O arquivo passa de 30 MB.')
      return
    }
    analyze(await file.text())
  }

  async function run() {
    setStep('running')
    const out = []
    for (const it of items) {
      if (it.choice === 'skip') {
        out.push({ label: it.label, status: 'skipped' })
        continue
      }
      try {
        let entry = it.entry
        const notes = []
        if (entry.image?.startsWith('data:')) {
          try {
            entry = { ...entry, image: await uploadDataUrl(entry.image) }
          } catch (e) {
            entry = { ...entry, image: null }
            notes.push(`imagem não enviada (${friendlyError(e)})`)
          }
        }
        const res = await importOne(entry, { mode: it.choice === 'update' ? 'update' : 'create', isPublic })
        out.push({ label: it.label, status: res.action, notes })
      } catch (e) {
        out.push({ label: it.label, status: 'error', message: friendlyError(e) })
      }
    }
    setReport(out)
    setStep('done')
    refresh()
  }

  const toImport = items.filter((i) => i.choice !== 'skip').length

  return (
    <Modal
      title={isPublic ? 'Importar fichas' : 'Importar fichas privadas'}
      onClose={onClose}
      wide
      dismissOnBackdrop={step === 'pick'}
      footer={
        step === 'review' ? (
          <>
            <button className="btn btn--ghost" onClick={() => setStep('pick')}>
              Escolher outro arquivo
            </button>
            <button className="btn btn--primary" disabled={toImport === 0} onClick={run}>
              Importar {toImport} {toImport === 1 ? 'ficha' : 'fichas'}
            </button>
          </>
        ) : step === 'done' ? (
          <button className="btn btn--primary" onClick={onClose}>
            Concluir
          </button>
        ) : null
      }
    >
      {step === 'pick' && (
        <div className="import">
          <div
            className={`drop ${dragging ? 'drop--on' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) readFile(f)
            }}
          >
            <FileJson size={30} />
            <p>Arraste um arquivo .json aqui ou</p>
            <button className="btn btn--primary" onClick={() => fileRef.current?.click()}>
              Escolher arquivo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) readFile(f)
              }}
            />
            <p className="field__hint">Aceita uma ficha, uma lista de fichas ou um backup exportado pelo site.</p>
          </div>
          <details className="paste">
            <summary>Ou cole o JSON</summary>
            <textarea className="json-area" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} spellCheck={false} />
            <button className="btn" disabled={!pasted.trim()} onClick={() => analyze(pasted)}>
              Analisar
            </button>
          </details>
          {fatal && (
            <p className="alert alert--bad">
              <AlertTriangle size={16} /> {fatal}
            </p>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="import">
          <p className="modal__text">
            Revise antes de importar. Fichas que já existem ou têm nome parecido começam como <strong>Ignorar</strong>: nada é
            sobrescrito sem a sua escolha.
          </p>
          <ul className="import-list">
            {items.map((it) => (
              <li key={it.key} className="import-row">
                <div className="import-row__main">
                  <strong>{it.label}</strong>
                  {it.entry && <code>{it.entry.slug}</code>}
                  {it.existing && <span className="badge badge--warn">Já existe com este identificador</span>}
                  {it.similar && <span className="badge badge--warn">Nome parecido com «{it.similar.name}»</span>}
                  {!it.existing && !it.similar && !it.errors.length && <span className="badge badge--new">Nova</span>}
                  {it.errors.map((e) => (
                    <span key={e} className="import-row__err">
                      {e}
                    </span>
                  ))}
                  {it.warnings.map((w) => (
                    <span key={w} className="import-row__warn">
                      {w}
                    </span>
                  ))}
                </div>
                <select
                  className="input"
                  value={it.choice}
                  disabled={it.options.length === 1}
                  onChange={(e) => setItems((list) => list.map((x) => (x.key === it.key ? { ...x, choice: e.target.value } : x)))}
                  aria-label={`O que fazer com ${it.label}`}
                >
                  {it.options.map((o) => (
                    <option key={o} value={o}>
                      {CHOICES[o]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'running' && (
        <div className="state">
          <Loader2 className="spin" size={28} />
          <p className="state__text">Importando…</p>
        </div>
      )}

      {step === 'done' && (
        <ul className="import-list">
          {report.map((r, i) => (
            <li key={i} className="import-row">
              <div className="import-row__main">
                <strong>{r.label}</strong>
                {r.status === 'created' && (
                  <span className="badge badge--new">
                    <Check size={12} /> Criada
                  </span>
                )}
                {r.status === 'updated' && (
                  <span className="badge badge--new">
                    <Check size={12} /> Atualizada
                  </span>
                )}
                {r.status === 'skipped' && <span className="badge">Ignorada</span>}
                {r.status === 'error' && (
                  <span className="import-row__err">
                    <X size={12} /> {r.message}
                  </span>
                )}
                {r.notes?.map((n) => (
                  <span key={n} className="import-row__warn">
                    {n}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
