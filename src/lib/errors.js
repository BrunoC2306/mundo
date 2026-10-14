const MESSAGES = {
  INSUFFICIENT_PD: 'PD insuficientes. O saldo mudou enquanto você clicava; os dados foram atualizados.',
  NOT_FOUND: 'Registro não encontrado. Ele pode ter sido removido ou ocultado pelo mestre.',
  SLUG_EXISTS: 'Já existe uma ficha com esse identificador.',
  INVALID_NAME: 'O nome precisa ter entre 1 e 120 caracteres.',
  INVALID_SLUG: 'Identificador inválido: use letras minúsculas, números e hífens.',
  INVALID_SUMMARY: 'O resumo passa de 600 caracteres.',
  INVALID_CATEGORY: 'A categoria passa de 40 caracteres.',
  INVALID_IMAGE: 'A imagem precisa ser um link http(s).',
  INVALID_SHEET: 'O conteúdo da ficha precisa ser um objeto JSON.',
  INVALID_DELTA: 'Quantidade de PD inválida.',
  INVALID_MODE: 'Modo de importação inválido.',
  SHEET_TOO_LARGE: 'A ficha é grande demais (limite de 2 MB de texto).',
  FORBIDDEN: 'Esta ação é permitida apenas ao mestre.',
  CONFLICT: 'Esta ficha foi alterada por outra pessoa enquanto você editava. Feche, reabra e refaça a edição para não perder as mudanças dela.',
  characters_summary_len: 'O resumo passa de 600 caracteres.',
  characters_name_len: 'O nome precisa ter entre 1 e 120 caracteres.',
  characters_slug_format: 'Identificador inválido: use letras minúsculas, números e hífens.',
}

export function friendlyError(err) {
  if (!err) return 'Erro desconhecido.'
  const raw = String(err.message ?? err)
  for (const key of Object.keys(MESSAGES)) {
    if (raw.includes(key)) return MESSAGES[key]
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  }
  if (err.code === '42501' || /row-level security|permission denied/i.test(raw)) {
    return 'Você não tem permissão para essa ação.'
  }
  if (/Bucket not found/i.test(raw)) {
    return 'O armazenamento de imagens não foi configurado. Rode o SQL 01 completo.'
  }
  return raw
}
