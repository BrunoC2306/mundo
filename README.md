# Mundo de Batalha — central da campanha (etapas 1 a 5)

Site de RPG com fichas compartilhadas, PD sincronizados em tempo real e uma área do mestre protegida **pelo banco de dados**.

**O que já funciona nesta entrega:** navegação e tema, banco compartilhado (Supabase), galeria de fichas, importar/exportar JSON e backup, área privada do mestre com login real, revelar/ocultar fichas, edição de fichas, PD com saldo atômico e sincronização em tempo real.
**Ainda não existe (e as abas avisam isso, sem fingir):** árvores de habilidades e desbloqueios (etapas 6–7), mapa (8), inventário e notas (9).

> ⚠️ Este código foi escrito e validado sem acesso à internet: o JavaScript compila, o formato de ficha e o renderizador têm testes, mas **o SQL e a integração com o Supabase real ainda não foram executados**. Use o roteiro de testes no final antes de usar numa sessão e me mande qualquer erro.

## Como a segurança funciona

- Não há contas de jogadores. Visitantes usam a chave pública (`anon`) do Supabase.
- As fichas ficam numa tabela com **RLS**: visitantes só enxergam linhas com `is_public = true`. Fichas privadas **não são devolvidas pela API**, nem por consulta direta, nem pelo tempo real.
- Visitantes não escrevem direto nas tabelas. Só chamam funções do banco que validam tudo: `adjust_pd` (trava a linha; saldo nunca fica negativo; dois cliques simultâneos se somam) e `import_character` (nunca sobrescreve sem `mode = update`).
- O **mestre** é um usuário do Supabase Auth com `app_metadata.mb_role = "master"`. Esse campo só pode ser definido pelo SQL Editor/chave administrativa, nunca pelo navegador. A senha é verificada (com hash e limite de tentativas) pelo próprio Supabase. Nenhuma chave privilegiada vai para o site.
- Esconder o botão do mestre é só conforto. A barreira real é o banco.

Decisões que tomei e você pode reverter:
- **Só o mestre exclui fichas.** Jogadores importam e atualizam, mas não apagam.
- Qualquer jogador pode ajustar PD de qualquer personagem (como você descreveu). Tudo fica registrado no histórico de PD de cada ficha.
- Imagens de fichas privadas ficam num armazenamento com link público e nome aleatório: ninguém lista os arquivos, mas quem tiver o link vê a imagem. Se isso importar, use o link só após revelar a ficha.

## Configuração (uma vez, ~15 minutos)

1. **Criar o projeto**: em supabase.com, crie um projeto gratuito.
2. **Banco**: abra *SQL Editor*, cole todo o `supabase/01_etapas_1-5_base.sql` e execute. Pode rodar de novo sem problema.
3. **Fechar cadastros** (importante): *Authentication → Sign In / Providers* → desative **Allow new users to sign up**. Mantenha o provedor *Email* ativo.
4. **Criar o mestre**: *Authentication → Users → Add user → Create new user*. Use um e-mail qualquer (pode ser inventado, ex.: `mestre-x7k2@campanha.local`), uma **senha longa** (16+ caracteres) e marque **Auto Confirm User**.
5. **Promover o mestre**: edite o e-mail em `supabase/02_promover_mestre.sql`, execute no SQL Editor e confira que aparece 1 linha.
6. **Chaves**: *Project Settings → API*. Copie a URL e a chave `anon`/`publishable`. **Nunca** use a `service_role` neste projeto.
7. **Variáveis**: copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_MASTER_EMAIL` (o mesmo e-mail do passo 4).
8. **Rodar**: `npm install` e `npm run dev`.
9. **Publicar** (para todos acessarem): Vercel, Netlify ou Cloudflare Pages. Build: `npm run build`, pasta `dist`. Cadastre as 3 variáveis do passo 7 no painel da hospedagem.

**Acesso do mestre:** endereço `…/#/mestre`, ou 5 toques seguidos na marca "MB" da barra lateral. Para trocar a senha: Authentication → Users no Supabase.

## Usando

- **Fichas**: importe `.json` (formato em `docs/FORMATO_FICHA.md`, exemplo em `docs/ficha-exemplo.json`). Clique no número de PD para digitar um total; `−`/`+` ajustam de 1 em 1. "Backup" baixa todas as fichas públicas.
- **Área do mestre**: abas Privadas/Públicas, filtro por categoria, importar privadas, nova ficha, editar, exportar, revelar/ocultar, excluir (pede para digitar o nome), backup completo.
- A bolinha "Sincronizado" no topo mostra a conexão. Se cair, o site tenta de novo sozinho e recarrega ao voltar para a aba.

## Roteiro de testes (faça antes de jogar)

1. Importe `docs/ficha-exemplo.json` em **Fichas**, abra a ficha e confira que todos os campos aparecem.
2. Importe o mesmo arquivo de novo: deve oferecer *Atualizar/Ignorar*, começando em *Ignorar*.
3. Clique `+` três vezes rápido num card; o saldo deve ir a 3. Abra o site em **outro aparelho**: o 3 aparece em segundos. Clique `−` até 0: o botão trava e nunca fica negativo.
4. Entre como mestre, crie uma ficha **Privada** e confirme que ela **não** aparece na galeria pública nem em outro aparelho.
5. **Teste de segurança** (troque URL e chave). Deve devolver `[]` mesmo existindo ficha privada:
   `curl "https://SEU-PROJETO.supabase.co/rest/v1/characters?select=name&is_public=eq.false" -H "apikey: SUA_ANON" -H "Authorization: Bearer SUA_ANON"`
6. Revele a ficha privada: ela aparece para todos. Oculte de novo: some.
7. Exporte uma ficha, apague-a como mestre e importe o arquivo: volta igual.

## Estrutura

```
supabase/   SQL do banco (tabelas, RLS, funções, storage, realtime)
docs/       formato da ficha + exemplo
src/lib/    cliente Supabase, formato de ficha, imagens
src/state/  sessão do mestre e dados em tempo real (PD otimista com envio agrupado)
src/pages/  Fichas, Ficha completa, Área do mestre
```

## Próximas etapas

6. Editor visual de árvores (nós arrastáveis, conexões, custos, publicar) — ligado à ficha pelo `id` (slug) estável.
7. Compra de habilidades (função atômica no banco: confere PD e pré-requisitos, desconta e registra) e exibição na ficha.
8. Mapa, pontos de interesse e galerias. 9. Inventário e notas (cadernos por personagem, sem prometer privacidade). 10. Backup completo e testes finais.
