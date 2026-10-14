import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const MASTER_EMAIL = import.meta.env.VITE_MASTER_EMAIL
export const isConfigured = Boolean(url && key)

// A chave anon é pública por design. O que protege os dados são as regras (RLS) do banco.
export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mb-sessao-mestre' },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null
