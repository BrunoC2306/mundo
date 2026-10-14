import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { friendlyError } from '../lib/errors.js'
import { useMaster } from './MasterContext.jsx'
import { useUi } from '../ui/UiProvider.jsx'

// A lista leve não traz o conteúdo (sheet) das fichas: é barata de baixar a cada mudança.
const LIGHT = 'id,slug,name,summary,image_url,category,pd,is_public,player_username,version,updated_at'
const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { isMaster } = useMaster()
  const { toast } = useUi()
  const [characters, setCharacters] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)
  const [link, setLink] = useState('connecting') // connecting | live | offline
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pendingView, setPendingView] = useState({})

  const seq = useRef(0)
  const timer = useRef(null)
  const charsRef = useRef([])
  const pending = useRef({}) // id -> { delta, sending, timer }
  charsRef.current = characters

  const refresh = useCallback(async () => {
    const mine = ++seq.current
    const { data, error: err } = await supabase.from('characters').select(LIGHT)
    if (mine !== seq.current) return false
    if (err) {
      setError(friendlyError(err))
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
      return false
    }
    setCharacters([...data].sort(byName))
    setStatus('ready')
    setError(null)
    return true
  }, [])

  const scheduleRefresh = useCallback(
    (delay = 250) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(refresh, delay)
    },
    [refresh],
  )

  // Carga inicial e recarga quando o mestre entra/sai (muda o que o banco devolve).
  useEffect(() => {
    refresh()
  }, [refresh, isMaster])

  // Tempo real: qualquer mudança em "characters" dispara uma recarga leve.
  useEffect(() => {
    const name = `mb-characters-${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, () => scheduleRefresh())
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          setLink('live')
          scheduleRefresh(0)
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setLink('offline')
        else if (s === 'CLOSED') setLink('connecting')
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isMaster, scheduleRefresh])

  const flushPd = useCallback(
    async (id) => {
      const entry = pending.current[id]
      if (!entry) return
      const toSend = entry.delta - entry.sending
      if (toSend === 0) {
        if (entry.sending === 0) {
          delete pending.current[id]
          setPendingView((p) => {
            const { [id]: _drop, ...rest } = p
            return rest
          })
        }
        return
      }
      entry.sending += toSend
      const { data, error: err } = await supabase.rpc('adjust_pd', { p_character: id, p_delta: toSend, p_reason: 'ajuste' })
      entry.sending -= toSend

      if (err) {
        // Descarta o que ainda não foi confirmado e volta ao saldo oficial.
        entry.delta = entry.sending
        clearTimeout(entry.timer)
        toast(friendlyError(err), 'error')
        scheduleRefresh(0)
      } else {
        entry.delta -= toSend
        setCharacters((list) =>
          list.map((c) => (c.id === id ? { ...c, pd: entry.sending === 0 ? data : c.pd + toSend } : c)),
        )
        scheduleRefresh(400)
      }
      if (entry.delta === 0 && entry.sending === 0) delete pending.current[id]
      setPendingView((p) => {
        const next = { ...p }
        if (pending.current[id]) next[id] = entry.delta
        else delete next[id]
        return next
      })
    },
    [scheduleRefresh, toast],
  )

  // Soma cliques rápidos num único envio (debounce). Retorna false se o saldo ficaria negativo.
  const adjustPd = useCallback(
    (id, delta) => {
      const c = charsRef.current.find((x) => x.id === id)
      if (!c || !Number.isInteger(delta) || delta === 0) return false
      const entry = pending.current[id] ?? (pending.current[id] = { delta: 0, sending: 0, timer: null })
      if (c.pd + entry.delta + delta < 0) return false
      entry.delta += delta
      setPendingView((p) => ({ ...p, [id]: entry.delta }))
      clearTimeout(entry.timer)
      entry.timer = setTimeout(() => flushPd(id), 400)
      return true
    },
    [flushPd],
  )

  // Atualiza ao voltar para a aba, envia PD pendentes ao sair e reage à conexão.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        Object.keys(pending.current).forEach((id) => flushPd(id))
      } else scheduleRefresh(0)
    }
    const onOnline = () => {
      setOnline(true)
      scheduleRefresh(0)
    }
    const onOffline = () => setOnline(false)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(poll)
    }
  }, [flushPd, refresh, scheduleRefresh])

  const pdOf = useCallback((c) => c.pd + (pendingView[c.id] ?? 0), [pendingView])
  const isSaving = useCallback((id) => (pendingView[id] ?? 0) !== 0, [pendingView])
  const connection = !online || error ? 'offline' : link

  const value = useMemo(
    () => ({ characters, status, error, connection, refresh, adjustPd, pdOf, isSaving }),
    [characters, status, error, connection, refresh, adjustPd, pdOf, isSaving],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
