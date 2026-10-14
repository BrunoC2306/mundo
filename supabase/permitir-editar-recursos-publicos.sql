-- Permite que qualquer visitante altere APENAS a vida atual e o esforço atual
-- de fichas públicas. Não permite editar atributos, perícias, ataques ou outras fichas.
create or replace function public.update_character_resources(
  p_character uuid,
  p_vida_atual integer,
  p_esforco_atual integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.characters
  set sheet = jsonb_set(
    jsonb_set(
      coalesce(sheet, '{}'::jsonb),
      '{recursos,vidaAtual}',
      to_jsonb(greatest(coalesce(p_vida_atual, 0), 0)),
      true
    ),
    '{recursos,esforcoAtual}',
    to_jsonb(greatest(coalesce(p_esforco_atual, 0), 0)),
    true
  )
  where id = p_character
    and is_public = true;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.update_character_resources(uuid, integer, integer) from public;
grant execute on function public.update_character_resources(uuid, integer, integer) to anon, authenticated;
