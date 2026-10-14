import { useData } from '../state/DataContext.jsx'

const LABELS = { live: 'Sincronizado', connecting: 'Conectando…', offline: 'Sem conexão' }

export default function ConnectionBadge() {
  const { connection, error, refresh } = useData()
  return (
    <button
      className={`sync sync--${connection}`}
      onClick={() => refresh()}
      title={error ? `${error} — clique para tentar de novo` : 'Atualizar agora'}
    >
      <span className="sync__dot" />
      {LABELS[connection]}
    </button>
  )
}
