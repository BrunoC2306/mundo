import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const PlayerIdentityContext = createContext(null)
const STORAGE_KEY = 'mb-jogador-atual-v1'

export function PlayerIdentityProvider({ children }) {
  const [playerName, setPlayerNameState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
  })
  const setPlayerName = useCallback((value) => {
    const clean = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    setPlayerNameState(clean)
    try {
      if (clean) localStorage.setItem(STORAGE_KEY, clean)
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* o seletor continua funcionando nesta sessão */ }
  }, [])
  const value = useMemo(() => ({ playerName, setPlayerName }), [playerName, setPlayerName])
  return <PlayerIdentityContext.Provider value={value}>{children}</PlayerIdentityContext.Provider>
}

export const usePlayerIdentity = () => useContext(PlayerIdentityContext)
