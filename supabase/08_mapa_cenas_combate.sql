-- Mundo de Batalha: locais, cenas de exploração e tokens de combate.
create table if not exists public.map_places (
  place_id text primary key,
  name text not null,
  locked boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.map_scenes (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.map_places(place_id) on delete cascade,
  title text not null,
  image_url text not null,
  scene_type text not null default 'explore' check (scene_type in ('explore','combat')),
  created_at timestamptz not null default now()
);
create table if not exists public.map_tokens (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.map_scenes(id) on delete cascade,
  name text not null,
  emoji text not null default '♟',
  x double precision not null default 50 check (x >= 0 and x <= 100),
  y double precision not null default 50 check (y >= 0 and y <= 100),
  created_at timestamptz not null default now()
);
alter table public.map_places enable row level security;
alter table public.map_scenes enable row level security;
alter table public.map_tokens enable row level security;
-- Leitura para participantes; escrita somente para a sessão marcada como mestre.
drop policy if exists "map_places_read" on public.map_places;
create policy "map_places_read" on public.map_places for select to anon, authenticated using (true);
drop policy if exists "map_places_master_insert" on public.map_places;
create policy "map_places_master_insert" on public.map_places for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_places_master_update" on public.map_places;
create policy "map_places_master_update" on public.map_places for update to authenticated using ((auth.jwt()->'app_metadata'->>'mb_role') = 'master') with check ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_scenes_read" on public.map_scenes;
create policy "map_scenes_read" on public.map_scenes for select to anon, authenticated using (true);
drop policy if exists "map_scenes_master_insert" on public.map_scenes;
create policy "map_scenes_master_insert" on public.map_scenes for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_scenes_master_update" on public.map_scenes;
create policy "map_scenes_master_update" on public.map_scenes for update to authenticated using ((auth.jwt()->'app_metadata'->>'mb_role') = 'master') with check ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_scenes_master_delete" on public.map_scenes;
create policy "map_scenes_master_delete" on public.map_scenes for delete to authenticated using ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_tokens_read" on public.map_tokens;
create policy "map_tokens_read" on public.map_tokens for select to anon, authenticated using (true);
drop policy if exists "map_tokens_master_insert" on public.map_tokens;
create policy "map_tokens_master_insert" on public.map_tokens for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_tokens_master_update" on public.map_tokens;
create policy "map_tokens_master_update" on public.map_tokens for update to authenticated using ((auth.jwt()->'app_metadata'->>'mb_role') = 'master') with check ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
drop policy if exists "map_tokens_master_delete" on public.map_tokens;
create policy "map_tokens_master_delete" on public.map_tokens for delete to authenticated using ((auth.jwt()->'app_metadata'->>'mb_role') = 'master');
grant select on public.map_places, public.map_scenes, public.map_tokens to anon, authenticated;
grant insert, update, delete on public.map_places, public.map_scenes, public.map_tokens to authenticated;
