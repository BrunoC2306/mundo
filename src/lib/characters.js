import { supabase } from './supabase.js'
import { buildBackup, buildExportDoc } from './sheetFormat.js'
import { downloadJson, stamp } from './download.js'

export async function fetchFullBySlug(slug) {
  const { data, error } = await supabase.from('characters').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchFullById(id) {
  const { data, error } = await supabase.from('characters').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchAllFull({ onlyPublic }) {
  let q = supabase.from('characters').select('*').order('name')
  if (onlyPublic) q = q.eq('is_public', true)
  const { data, error } = await q
  if (error) throw error
  return data
}

export const exportOne = (row) => downloadJson(`ficha-${row.slug}.json`, buildExportDoc(row))

export async function exportBundle({ onlyPublic }) {
  const rows = await fetchAllFull({ onlyPublic })
  downloadJson(`backup-fichas-${onlyPublic ? 'publicas' : 'todas'}-${stamp()}.json`, buildBackup(rows))
  return rows.length
}

export async function importOne(entry, { mode, isPublic }) {
  const { data, error } = await supabase.rpc('import_character', {
    p_slug: entry.slug,
    p_name: entry.name,
    p_summary: entry.summary,
    p_image: entry.image,
    p_category: entry.category,
    p_sheet: entry.sheet,
    p_mode: mode,
    p_public: isPublic,
  })
  if (error) throw error
  return data
}

export async function setVisibility(id, isPublic) {
  const { data, error } = await supabase.from('characters').update({ is_public: isPublic }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('FORBIDDEN')
}

export async function deleteCharacter(id) {
  const { data, error } = await supabase.from('characters').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('FORBIDDEN')
}

export async function fetchPdLog(id, limit = 15) {
  const { data, error } = await supabase
    .from('pd_log')
    .select('id,delta,balance_after,reason,created_at')
    .eq('character_id', id)
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
