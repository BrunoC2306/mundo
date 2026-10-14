import { ArrowLeft } from 'lucide-react'
import ConnectionBadge from './ConnectionBadge.jsx'

export default function PageHeader({ title, subtitle, actions, onBack, backLabel }) {
  return (
    <header className="page__head">
      <div className="page__titles">
        {onBack && (
          <button className="back" onClick={onBack}>
            <ArrowLeft size={16} /> {backLabel ?? 'Voltar'}
          </button>
        )}
        <h1 className="page__title">{title}</h1>
        {subtitle && <p className="page__sub">{subtitle}</p>}
      </div>
      <div className="page__tools">
        {actions}
        <ConnectionBadge />
      </div>
    </header>
  )
}
