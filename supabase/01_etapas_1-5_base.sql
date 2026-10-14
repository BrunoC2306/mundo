-- =====================================================================
-- MUNDO DE BATALHA — Etapas 2 a 5
-- Fichas públicas/privadas, PD com saldo atômico, área do mestre, imagens.
-- Cole no SQL Editor do Supabase e execute. Pode ser executado de novo.
-- =====================================================================

-- 1) Quem é o mestre ---------------------------------------------------
-- O mestre é um único usuário do Supabase Auth cujo app_metadata contém
-- {"mb_role":"master"}. app_metadata não pode ser alterado pelo navegador,
-- somente pelo SQL Editor / chave administrativa.
create or replace function public.is_master()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'mb_role', '') = 'master'
     and coalesce(auth.jwt() ->> 'role', '') = 'authenticated';
$$;

-- 2) Tabelas -----------------------------------------------------------
create table if not exists public.characters (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,                       -- identificador estável e legível (vai no JSON como "id")
  name        text not null,
  summary     text,
  image_url   text,
  category    text,                                -- organização do mestre (Vilão, NPC...)
  sheet       jsonb not null default '{}'::jsonb,  -- todos os campos livres da ficha
  pd          integer not null default 0,
  is_public   boolean not null default true,       -- false = ficha privada do mestre
  version     integer not null default 1,          -- sobe a cada mudança de conteúdo (controle de edição simultânea)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint characters_slug_format  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint characters_name_len     check (char_length(btrim(name)) between 1 and 120),
  constraint characters_summary_len  check (summary is null or char_length(summary) <= 600),
  constraint characters_category_len check (category is null or char_length(category) <= 40),
  constraint characters_image_fmt    check (image_url is null or (image_url ~* '^https?://' and char_length(image_url) <= 2000)),
  constraint characters_pd_nonneg    check (pd >= 0),
  constraint characters_sheet_obj    check (jsonb_typeof(sheet) = 'object'),
  constraint characters_sheet_size   check (octet_length(sheet::text) <= 2000000)
);
create unique index if not exists characters_slug_key on public.characters (slug);

-- Cópias de segurança automáticas do conteúdo anterior (últimas 20 por ficha).
create table if not exists public.character_revisions (
  id           bigint generated always as identity primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  name         text not null,
  summary      text,
  image_url    text,
  category     text,
  sheet        jsonb not null,
  replaced_at  timestamptz not null default now()
);
create index if not exists character_revisions_char_idx on public.character_revisions (character_id, id desc);

-- Histórico de movimentações de PD.
create table if not exists public.pd_log (
  id            bigint generated always as identity primary key,
  character_id  uuid not null references public.characters(id) on delete cascade,
  delta         integer not null,
  balance_after integer not null,
  reason        text not null default 'ajuste',
  created_at    timestamptz not null default now()
);
create index if not exists pd_log_char_idx on public.pd_log (character_id, id desc);

-- 3) Auxiliar de visibilidade (usado pelas regras de várias tabelas) ----
create or replace function public.can_see_character(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.characters c
     where c.id = p_id and (c.is_public or public.is_master())
  );
$$;

-- 4) Gatilho: versão, data e cópia de segurança ---------------------------
create or replace function public.characters_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.name, new.summary, new.image_url, new.category, new.sheet, new.is_public)
     is distinct from
     (old.name, old.summary, old.image_url, old.category, old.sheet, old.is_public) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  new.updated_at := now();

  if (new.name, new.summary, new.image_url, new.category, new.sheet)
     is distinct from
     (old.name, old.summary, old.image_url, old.category, old.sheet) then
    insert into public.character_revisions (character_id, name, summary, image_url, category, sheet)
    values (old.id, old.name, old.summary, old.image_url, old.category, old.sheet);

    delete from public.character_revisions
     where character_id = old.id
       and id not in (
         select r.id from public.character_revisions r
          where r.character_id = old.id
          order by r.id desc limit 20
       );
  end if;
  return new;
end;
$$;

drop trigger if exists characters_before_update on public.characters;
create trigger characters_before_update
  before update on public.characters
  for each row execute function public.characters_before_update();

-- 5) Segurança em nível de linha (RLS) -----------------------------------
alter table public.characters         enable row level security;
alter table public.character_revisions enable row level security;
alter table public.pd_log              enable row level security;

-- Privilégios mínimos: visitantes só leem. Toda escrita pública passa pelas
-- funções (RPC) da seção 6, que validam os dados.
revoke all on public.characters          from anon, authenticated;
revoke all on public.character_revisions from anon, authenticated;
revoke all on public.pd_log              from anon, authenticated;
grant select on public.characters to anon;
grant select, insert, update, delete on public.characters to authenticated;
grant select on public.character_revisions to authenticated;
grant select on public.pd_log to anon, authenticated;

drop policy if exists characters_select_public on public.characters;
create policy characters_select_public on public.characters
  for select to anon, authenticated
  using (is_public = true);

drop policy if exists characters_master_all on public.characters;
create policy characters_master_all on public.characters
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

drop policy if exists revisions_master_select on public.character_revisions;
create policy revisions_master_select on public.character_revisions
  for select to authenticated
  using (public.is_master());

drop policy if exists pd_log_select on public.pd_log;
create policy pd_log_select on public.pd_log
  for select to anon, authenticated
  using (public.can_see_character(character_id));

-- 6) Funções chamadas pelo site ---------------------------------------------
-- 6.1 Ajuste de PD: atômico (trava a linha), nunca deixa o saldo negativo.
create or replace function public.adjust_pd(p_character uuid, p_delta integer, p_reason text default 'ajuste')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pd integer;
  v_reason text;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000 then
    raise exception 'INVALID_DELTA';
  end if;

  select c.pd into v_pd
    from public.characters c
   where c.id = p_character and (c.is_public or public.is_master())
   for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_pd + p_delta < 0 then
    raise exception 'INSUFFICIENT_PD';
  end if;

  update public.characters set pd = v_pd + p_delta
   where id = p_character
   returning pd into v_pd;

  v_reason := case when public.is_master() and p_reason = 'mestre' then 'mestre' else 'ajuste' end;
  insert into public.pd_log (character_id, delta, balance_after, reason)
  values (p_character, p_delta, v_pd, v_reason);

  return v_pd;
end;
$$;

-- 6.2 Importação de ficha: cria ou atualiza, sem sobrescrever em silêncio.
--     p_public = false só é aceito para o mestre.
create or replace function public.import_character(
  p_slug     text,
  p_name     text,
  p_summary  text,
  p_image    text,
  p_category text,
  p_sheet    jsonb,
  p_mode     text    default 'create',
  p_public   boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := btrim(coalesce(p_name, ''));
  v_summary  text := nullif(btrim(coalesce(p_summary, '')), '');
  v_image    text := nullif(btrim(coalesce(p_image, '')), '');
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
  v_slug     text := p_slug;
  v_row      public.characters;
  v_try      integer := 0;
begin
  if p_mode not in ('create', 'update') then raise exception 'INVALID_MODE'; end if;
  if p_public is distinct from true and not public.is_master() then raise exception 'FORBIDDEN'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 80 then raise exception 'INVALID_SLUG'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'INVALID_NAME'; end if;
  if v_summary is not null and char_length(v_summary) > 600 then raise exception 'INVALID_SUMMARY'; end if;
  if v_category is not null and char_length(v_category) > 40 then raise exception 'INVALID_CATEGORY'; end if;
  if v_image is not null and (v_image !~* '^https?://' or char_length(v_image) > 2000) then raise exception 'INVALID_IMAGE'; end if;
  if p_sheet is null or jsonb_typeof(p_sheet) <> 'object' then raise exception 'INVALID_SHEET'; end if;
  if octet_length(p_sheet::text) > 2000000 then raise exception 'SHEET_TOO_LARGE'; end if;

  if p_mode = 'update' then
    -- Campos opcionais ausentes no arquivo preservam o valor atual.
    update public.characters c
       set name      = v_name,
           summary   = coalesce(v_summary, c.summary),
           image_url = coalesce(v_image, c.image_url),
           category  = coalesce(v_category, c.category),
           sheet     = p_sheet
     where c.slug = p_slug and (c.is_public or public.is_master())
     returning * into v_row;
    if not found then raise exception 'NOT_FOUND'; end if;
    return jsonb_build_object('id', v_row.id, 'slug', v_row.slug, 'action', 'updated', 'is_public', v_row.is_public);
  end if;

  loop
    begin
      insert into public.characters (slug, name, summary, image_url, category, sheet, is_public)
      values (v_slug, v_name, v_summary, v_image, v_category, p_sheet, p_public)
      returning * into v_row;
      exit;
    exception when unique_violation then
      -- Identificador já usado. Se for uma ficha visível ao chamador, avisa;
      -- se for uma ficha privada que o chamador não pode ver, escolhe outro sufixo
      -- (sem revelar que ela existe).
      if exists (select 1 from public.characters x where x.slug = v_slug and (x.is_public or public.is_master())) then
        raise exception 'SLUG_EXISTS';
      end if;
      v_try := v_try + 1;
      if v_try > 5 then raise exception 'SLUG_EXISTS'; end if;
      v_slug := left(p_slug, 70) || '-' || substr(md5(random()::text), 1, 4);
    end;
  end loop;

  return jsonb_build_object('id', v_row.id, 'slug', v_row.slug, 'action', 'created', 'is_public', v_row.is_public);
end;
$$;

-- Permissões das funções
revoke all on function public.adjust_pd(uuid, integer, text) from public;
grant execute on function public.adjust_pd(uuid, integer, text) to anon, authenticated;
revoke all on function public.import_character(text, text, text, text, text, jsonb, text, boolean) from public;
grant execute on function public.import_character(text, text, text, text, text, jsonb, text, boolean) to anon, authenticated;
grant execute on function public.is_master() to anon, authenticated;
grant execute on function public.can_see_character(uuid) to anon, authenticated;
revoke all on function public.characters_before_update() from public, anon, authenticated;

-- 7) Imagens dos personagens (Storage) -------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists portraits_insert_anyone on storage.objects;
create policy portraits_insert_anyone on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'portraits');

drop policy if exists portraits_master_manage on storage.objects;
create policy portraits_master_manage on storage.objects
  for all to authenticated
  using (bucket_id = 'portraits' and public.is_master())
  with check (bucket_id = 'portraits' and public.is_master());

-- 8) Sincronização em tempo real ---------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'characters'
     ) then
    alter publication supabase_realtime add table public.characters;
  end if;
end;
$$;
