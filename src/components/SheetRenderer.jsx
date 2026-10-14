import { RESERVED_KEYS } from '../lib/sheetFormat.js'

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isPrim = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v)
const isShort = (v) => isPrim(v) && (typeof v !== 'string' || (v.length <= 80 && !v.includes('\n')))
const TITLE_KEYS = ['nome', 'name', 'titulo', 'título', 'title']
export const prettify = (key) => { const t = String(key).replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim(); return t.charAt(0).toUpperCase() + t.slice(1) }

function Prim({ value }) {
  if (value === null || value === undefined || value === '') return <span className="sv-empty">—</span>
  if (typeof value === 'boolean') return <>{value ? 'Sim' : 'Não'}</>
  if (typeof value === 'string') return <span className="sv-text">{value}</span>
  return <>{String(value)}</>
}
function tableColumns(items) {
  const keys = [...new Set(items.flatMap((i) => Object.keys(i)))]
  if (keys.length === 0 || keys.length > 8) return null
  return items.every((i) => keys.every((k) => i[k] === undefined || isShort(i[k]))) ? keys : null
}
function List({ items, depth }) {
  if (!items.length) return <span className="sv-empty">—</span>
  if (items.every(isShort)) return <ul className="sv-chips">{items.map((v, i) => <li key={i}><Prim value={v} /></li>)}</ul>
  if (items.every(isObj)) {
    const cols = tableColumns(items)
    if (cols) return <div className="sv-table-wrap"><table className="sv-table"><thead><tr>{cols.map((c) => <th key={c}>{prettify(c)}</th>)}</tr></thead><tbody>{items.map((row, i) => <tr key={i}>{cols.map((c) => <td key={c}><Prim value={row[c]} /></td>)}</tr>)}</tbody></table></div>
    return <div className="sv-cards">{items.map((item, i) => { const titleKey = TITLE_KEYS.find((k) => typeof item[k] === 'string'); const { [titleKey]: title, ...rest } = item; return <article className="sv-card" key={i}>{titleKey && <h4 className="sv-card__title">{title}</h4>}{Object.keys(rest).length > 0 && <Value value={rest} depth={depth + 1} />}</article> })}</div>
  }
  return <ul className="sv-list">{items.map((v, i) => <li key={i}><Value value={v} depth={depth + 1} /></li>)}</ul>
}
function Obj({ value, depth }) {
  const entries = Object.entries(value); if (!entries.length) return <span className="sv-empty">—</span>
  const shorts = entries.filter(([, v]) => isShort(v)), rest = entries.filter(([, v]) => !isShort(v))
  return <div className="sv-obj">{shorts.length > 0 && <dl className="sv-kv">{shorts.map(([k, v]) => <div className="sv-kv__row" key={k}><dt>{prettify(k)}</dt><dd><Prim value={v} /></dd></div>)}</dl>}{rest.map(([k, v]) => <div className="sv-sub" key={k}><h4 className="sv-sub__title">{prettify(k)}</h4><Value value={v} depth={depth + 1} /></div>)}</div>
}
function Value({ value, depth }) { if (depth > 6) return <pre className="sv-json">{JSON.stringify(value, null, 2)}</pre>; if (isPrim(value)) return <Prim value={value} />; if (Array.isArray(value)) return <List items={value} depth={depth} />; return <Obj value={value} depth={depth} /> }

function CustomSheet({ data }) {
  const attributes = data.atributos ?? {}, resources = data.recursos ?? {}, skills = Array.isArray(data.pericias) ? data.pericias : []
  const attacks = Array.isArray(data.ataques) ? data.ataques : [], abilities = Array.isArray(data.habilidades) ? data.habilidades : []
  const attrNames = { FOR: 'Força', VIG: 'Vigor', AGI: 'Destreza', INT: 'Inteligência', PRE: 'Presença' }
  const stats = [['vidaAtual', 'Vida', resources.vidaAtual, resources.vidaMaxima, 'life'], ['esforcoAtual', 'Pontos de esforço', resources.esforcoAtual, resources.esforcoMaximo, 'effort']]
  return <div className="sv sv--character">
    <section className="panel"><h3 className="panel__title">Dados gerais</h3><div className="character-resources">{stats.map(([key, label, current, max, cls]) => <div className={`character-resource character-resource--${cls}`} key={key}><div className="character-resource__label">{label}</div><div className="character-resource__value">{current ?? 0}<span> / {max ?? 0}</span></div><div className="character-resource__bar"><span style={{ width: `${Math.max(0, Math.min(100, Number(max) > 0 ? Number(current) / Number(max) * 100 : 0))}%` }} /></div></div>)}<div className="character-resource"><div className="character-resource__label">Classe de armadura</div><div className="character-resource__value">{resources.classeArmadura ?? 0}</div></div><div className="character-resource"><div className="character-resource__label">Esquiva</div><div className="character-resource__value">{resources.esquiva ?? 0}</div></div><div className="character-resource"><div className="character-resource__label">Bloqueio</div><div className="character-resource__value">{resources.bloqueio ?? 0}</div></div></div></section>
    <section className="panel"><h3 className="panel__title">Atributos</h3><div className="character-attributes">{Object.entries(attrNames).map(([key, label]) => <div className="character-attribute" key={key}><span>{label}</span><strong>{attributes[key] ?? 0}</strong><small>{key}</small></div>)}</div></section>
    {skills.length > 0 && <section className="panel"><h3 className="panel__title">Perícias</h3><div className="sv-table-wrap"><table className="sv-table character-skills"><thead><tr><th>Perícia</th><th>Atributo</th><th>Dados</th><th>Bônus</th><th>Treino</th><th>Outros</th></tr></thead><tbody>{skills.map((s, i) => <tr key={`${s.nome}-${i}`}><td>{s.nome}</td><td>({s.atributo})</td><td>{s.dados ?? 0}</td><td>{s.bonus ?? 0}</td><td>{s.treino ?? 0}</td><td>{s.outros ?? 0}</td></tr>)}</tbody></table></div></section>}
    {attacks.length > 0 && <section className="panel"><h3 className="panel__title">Ataques</h3><div className="sv-table-wrap"><table className="sv-table"><thead><tr><th>Nome</th><th>Teste</th><th>Dano</th><th>Especial</th></tr></thead><tbody>{attacks.map((a, i) => <tr key={i}><td>{a.nome}</td><td>{a.teste}</td><td>{a.dano}</td><td>{a.especial || '—'}</td></tr>)}</tbody></table></div></section>}
    {abilities.length > 0 && <section className="panel"><h3 className="panel__title">Habilidades</h3><div className="sv-cards">{abilities.map((a, i) => <article className="sv-card" key={i}><h4 className="sv-card__title">{a.nome}</h4>{a.custo && <p className="character-ability__cost">{a.custo}</p>}{a.descricao && <p className="sv-text">{a.descricao}</p>}</article>)}</div></section>}
    {data.descricao && <section className="panel"><h3 className="panel__title">Descrição</h3><p className="sv-text">{data.descricao}</p></section>}
  </div>
}

export default function SheetRenderer({ data }) {
  if (data && (data.atributos || data.recursos || data.pericias || data.ataques || data.habilidades)) return <CustomSheet data={data} />
  const entries = Object.entries(data ?? {}).filter(([k]) => !RESERVED_KEYS.includes(k))
  if (!entries.length) return <p className="empty-note">Esta ficha ainda não tem campos além do nome.</p>
  const shorts = entries.filter(([, v]) => isShort(v)), rest = entries.filter(([, v]) => !isShort(v))
  return <div className="sv">{shorts.length > 0 && <section className="panel"><h3 className="panel__title">Dados gerais</h3><dl className="sv-stats">{shorts.map(([k, v]) => <div className="sv-stat" key={k}><dt>{prettify(k)}</dt><dd><Prim value={v} /></dd></div>)}</dl></section>}{rest.map(([k, v]) => <section className="panel" key={k}><h3 className="panel__title">{prettify(k)}</h3><Value value={v} depth={1} /></section>)}</div>
}
