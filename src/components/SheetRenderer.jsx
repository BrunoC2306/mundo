import { RESERVED_KEYS } from '../lib/sheetFormat.js'

// Exibe QUALQUER estrutura JSON de ficha sem inventar campos: só organiza o que veio no arquivo.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isPrim = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v)
const isShort = (v) => isPrim(v) && (typeof v !== 'string' || (v.length <= 80 && !v.includes('\n')))
const TITLE_KEYS = ['nome', 'name', 'titulo', 'título', 'title']

export const prettify = (key) => {
  const t = String(key).replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Prim({ value }) {
  if (value === null || value === undefined || value === '') return <span className="sv-empty">—</span>
  if (typeof value === 'boolean') return <>{value ? 'Sim' : 'Não'}</>
  if (typeof value === 'string') return <span className="sv-text">{value}</span>
  return <>{String(value)}</>
}

function tableColumns(items) {
  const keys = [...new Set(items.flatMap((i) => Object.keys(i)))]
  if (keys.length === 0 || keys.length > 8) return null
  const ok = items.every((i) => keys.every((k) => i[k] === undefined || isShort(i[k])))
  return ok ? keys : null
}

function List({ items, depth }) {
  if (!items.length) return <span className="sv-empty">—</span>
  if (items.every(isShort)) {
    return (
      <ul className="sv-chips">
        {items.map((v, i) => (
          <li key={i}>
            <Prim value={v} />
          </li>
        ))}
      </ul>
    )
  }
  if (items.every(isObj)) {
    const cols = tableColumns(items)
    if (cols) {
      return (
        <div className="sv-table-wrap">
          <table className="sv-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{prettify(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>
                      <Prim value={row[c]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    return (
      <div className="sv-cards">
        {items.map((item, i) => {
          const titleKey = TITLE_KEYS.find((k) => typeof item[k] === 'string')
          const { [titleKey]: title, ...rest } = item
          return (
            <article className="sv-card" key={i}>
              {titleKey && <h4 className="sv-card__title">{title}</h4>}
              {Object.keys(rest).length > 0 && <Value value={rest} depth={depth + 1} />}
            </article>
          )
        })}
      </div>
    )
  }
  return (
    <ul className="sv-list">
      {items.map((v, i) => (
        <li key={i}>
          <Value value={v} depth={depth + 1} />
        </li>
      ))}
    </ul>
  )
}

function Obj({ value, depth }) {
  const entries = Object.entries(value)
  if (!entries.length) return <span className="sv-empty">—</span>
  const shorts = entries.filter(([, v]) => isShort(v))
  const rest = entries.filter(([, v]) => !isShort(v))
  return (
    <div className="sv-obj">
      {shorts.length > 0 && (
        <dl className="sv-kv">
          {shorts.map(([k, v]) => (
            <div className="sv-kv__row" key={k}>
              <dt>{prettify(k)}</dt>
              <dd>
                <Prim value={v} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {rest.map(([k, v]) => (
        <div className="sv-sub" key={k}>
          <h4 className="sv-sub__title">{prettify(k)}</h4>
          <Value value={v} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

function Value({ value, depth }) {
  if (depth > 6) return <pre className="sv-json">{JSON.stringify(value, null, 2)}</pre>
  if (isPrim(value)) return <Prim value={value} />
  if (Array.isArray(value)) return <List items={value} depth={depth} />
  return <Obj value={value} depth={depth} />
}

export default function SheetRenderer({ data }) {
  const entries = Object.entries(data ?? {}).filter(([k]) => !RESERVED_KEYS.includes(k))
  if (!entries.length) {
    return <p className="empty-note">Esta ficha ainda não tem campos além do nome.</p>
  }
  const shorts = entries.filter(([, v]) => isShort(v))
  const rest = entries.filter(([, v]) => !isShort(v))
  return (
    <div className="sv">
      {shorts.length > 0 && (
        <section className="panel">
          <h3 className="panel__title">Dados gerais</h3>
          <dl className="sv-stats">
            {shorts.map(([k, v]) => (
              <div className="sv-stat" key={k}>
                <dt>{prettify(k)}</dt>
                <dd>
                  <Prim value={v} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {rest.map(([k, v]) => (
        <section className="panel" key={k}>
          <h3 className="panel__title">{prettify(k)}</h3>
          <Value value={v} depth={1} />
        </section>
      ))}
    </div>
  )
}
