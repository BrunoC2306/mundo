import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, MASTER_EMAIL } from '../lib/supabase.js'

const MasterContext = createContext(null)

export function MasterProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session ?? null)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next ?? null))
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Apenas para a interface. A proteção real dos dados é feita pelas regras (RLS) do banco.
  const isMaster = session?.user?.app_metadata?.mb_role === 'master'

  const signIn = useCallback(async (password) => {
    if (!MASTER_EMAIL) throw new Error('MISSING_MASTER_EMAIL')
    const { data, error } = await supabase.auth.signInWithPassword({ email: MASTER_EMAIL, password })
    if (error) throw error
    if (data.user?.app_metadata?.mb_role !== 'master') {
      await supabase.auth.signOut()
      throw new Error('NOT_MASTER')
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(() => ({ ready, isMaster, signIn, signOut }), [ready, isMaster, signIn, signOut])
  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>
}

export const useMaster = () => useContext(MasterContext)
