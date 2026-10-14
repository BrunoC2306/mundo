import { supabase } from './supabase.js'

const BUCKET = 'portraits'
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

/** Reduz imagens grandes antes do envio (limite do bucket: 2 MB). GIFs são mantidos. */
export async function prepareImage(blob, { maxSide = 1400, quality = 0.86 } = {}) {
  if (!EXT[blob.type]) throw new Error('Formato não suportado. Use PNG, JPG, WebP ou GIF.')
  if (blob.type === 'image/gif') {
    if (blob.size > 2_000_000) throw new Error('GIF maior que 2 MB.')
    return blob
  }
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && blob.size <= 1_800_000) {
    bitmap.close?.()
    return blob
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (!out) throw new Error('Não foi possível processar a imagem.')
  return out
}

export async function uploadImageBlob(blob) {
  const ready = await prepareImage(blob)
  const path = `${crypto.randomUUID()}.${EXT[ready.type] ?? 'webp'}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, ready, {
    contentType: ready.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadDataUrl(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob()
  return uploadImageBlob(blob)
}
