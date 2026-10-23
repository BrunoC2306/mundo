import { useState } from 'react'
import { Check, UserRound, Pencil } from 'lucide-react'
import { usePlayerIdentity } from '../state/PlayerIdentityContext.jsx'

export default function PlayerPicker({ master = false }) {
  const { playerName, setPlayerName } = usePlayerIdentity()
  const [draft, setDraft] = useState(master ? 'Mestre' : playerName)
  const [editing, setEditing] = useState(!playerName && !master)
  const current = master ? 'Mestre' : playerName

  const save = (event) => {
    event.preventDefault()
    const name = master ? 'Mestre' : draft.trim()
    if (!name) return
    setPlayerName(name)
    setDraft(name)
    setEditing(false)
  }

  return (
    <section className="player-picker">
      <div className="player-picker__identity">
        <span className="player-picker__icon"><UserRound size={18} /></span>
        <div><span className="player-picker__label">{master ? 'Caderno pessoal do mestre' : 'Perfil deste navegador'}</span><strong>{current || 'Escolha seu nome'}</strong></div>
      </div>
      {(!master && (editing || !playerName)) ? (
        <form className="player-picker__form" onSubmit={save}>
          <label className="field">Nome do jogador
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} placeholder="Ex.: Bruno" autoComplete="nickname" required />
          </label>
          <button className="btn btn--primary" type="submit"><Check size={16} /> Usar este nome</button>
        </form>
      ) : !master ? (
        <button className="btn btn--ghost" type="button" onClick={() => { setDraft(playerName); setEditing(true) }}><Pencil size={15} /> Trocar jogador</button>
      ) : null}
      <p className="player-picker__hint">Os dados são separados pelo nome escolhido. Como não há login individual, isso não impede outra pessoa de escolher o mesmo nome.</p>
    </section>
  )
}
