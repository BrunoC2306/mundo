-- MUNDO DE BATALHA — vínculo entre ficha e usuário do jogador
-- Execute no Supabase > SQL Editor, depois de já ter instalado a base 01.
-- Este script não cria logins; ele adiciona o campo usado para associar uma ficha
-- ao nome de usuário que será utilizado no sistema de contas dos jogadores.

alter table public.characters
  add column if not exists player_username text;

alter table public.characters
  drop constraint if exists characters_player_username_format;
alter table public.characters
  add constraint characters_player_username_format
  check (player_username is null or (player_username ~ '^[a-z0-9_-]{1,40}$'));

create index if not exists characters_player_username_idx
  on public.characters (player_username);

comment on column public.characters.player_username is
  'Nome de usuário do jogador responsável por esta ficha; null significa sem jogador atribuído.';
