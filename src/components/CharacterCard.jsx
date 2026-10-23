import { useState } from 'react'
import { initialsOf } from '../lib/text.js'
import PdControl from './PdControl.jsx'

export default function CharacterCard({ character, onOpen, actions }) {
  const [broken, setBroken] = useState(false)
  const showImage = character.image_url && !broken
  return (
    <article className="char-card">
      <button className="char-card__face" onClick={onOpen} aria-label={`Abrir ficha de ${character.name}`}>
        {showImage ? (
          <img className="char-card__img" src={character.image_url} alt="" loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className="char-card__initials">{initialsOf(character.name)}</span>
        )}
        <span className="char-card__shade" />
        {!character.is_public && <span className="char-card__badge">Privada</span>}
        <span className="char-card__meta">
          <span className="char-card__name">{character.name}</span>
          {(character.summary || character.category) && (
            <span className="char-card__summary">{character.summary || character.category}</span>
          )}
        </span>
      </button>
      {actions && <div className="char-card__actions">{actions}</div>}
      <PdControl character={character} />
    </article>
  )
}
