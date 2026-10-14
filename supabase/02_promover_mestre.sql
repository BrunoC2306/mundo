-- Rode DEPOIS de criar o usuário mestre em Authentication > Users > Add user
-- (marque "Auto Confirm User"). Troque o e-mail abaixo pelo e-mail desse usuário.
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"mb_role":"master"}'::jsonb
 where email = 'mestre@exemplo.com';

-- Conferência: deve listar exatamente 1 usuário.
select id, email, raw_app_meta_data from auth.users where raw_app_meta_data ->> 'mb_role' = 'master';
