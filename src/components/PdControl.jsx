import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useData } from '../state/DataContext.jsx'
import { useUi } from '../ui/UiProvider.jsx'

export default function PdControl({ character, large }) {
  const { adjustPd, pdOf, isSaving } = useData()
  const { toast } = useUi()
  const value = pdOf(character)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    setEditing(false)
    const n = Number(draft)
    if (!Number.isInteger(n) || n < 0) {
      toast('Informe um número inteiro maior ou igual a zero.', 'error')
      return
    }
    // Envia a diferença (não o total): dois ajustes simultâneos se somam em vez de um apagar o outro.
    if (n !== value) adjustPd(character.id, n - value)
  }

  return (
    <div className={`pd ${large ? 'pd--large' : ''} ${isSaving(character.id) ? 'pd--saving' : ''}`}>
      <span className="pd__caption">PD disponíveis</span>
      <div className="pd__row">
        <button
          className="pd__btn"
          onClick={() => adjustPd(character.id, -1)}
          disabled={value <= 0}
          aria-label={`Remover 1 PD de ${character.name}`}
        >
          <Minus size={18} />
        </button>
        {editing ? (
          <input
            className="pd__input"
            type="number"
            min="0"
            inputMode="numeric"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label={`Total de PD de ${character.name}`}
          />
        ) : (
          <button
            className="pd__value"
            onClick={() => {
              setDraft(String(value))
              setEditing(true)
            }}
            title="Clique para digitar o total"
          >
            {value}
          </button>
        )}
        <button className="pd__btn" onClick={() => adjustPd(character.id, 1)} aria-label={`Adicionar 1 PD a ${character.name}`}>
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}
