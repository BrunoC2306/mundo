-- Configuração de sprite sheets para os tokens de combate.
alter table public.map_tokens add column if not exists image_url text;
alter table public.map_tokens add column if not exists sprite_cols integer not null default 1;
alter table public.map_tokens add column if not exists sprite_rows integer not null default 1;
alter table public.map_tokens add column if not exists sprite_frames integer not null default 1;
create table if not exists public.map_token_abilities (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.map_tokens(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.map_token_abilities enable row level security;
drop policy if exists "map_token_abilities_read" on public.map_token_abilities;
create policy "map_token_abilities_read" on public.map_token_abilities for select to anon, authenticated using (true);
drop policy if exists "map_token_abilities_master_insert" on public.map_token_abilities;
create policy "map_token_abilities_master_insert" on public.map_token_abilities for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_token_abilities_master_delete" on public.map_token_abilities;
create policy "map_token_abilities_master_delete" on public.map_token_abilities for delete to authenticated using ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
grant select on public.map_token_abilities to anon, authenticated;
grant insert, delete on public.map_token_abilities to authenticated;
