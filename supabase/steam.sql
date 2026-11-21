-- L'IDENTITÉ STEAM POUR LE TABLEAU MONDIAL ET LE PALMARÈS (version Steam de GRIP, Godot).
--
-- Un joueur Steam n'a pas de compte Google : la fonction `steam` (supabase/functions/steam) vérifie
-- son ticket auprès de Valve, puis lui donne un compte Supabase à lui, créé une fois, et une session
-- sur ce compte. Tout le reste — `record`, `synchro_palmares`, les pseudos — marche ensuite comme
-- pour un joueur Google, sur les mêmes tables : un seul tableau mondial pour le web, Godot et Steam.
--
-- Cette table relie le SteamID au compte. Personne d'autre que la fonction (clé de service) n'y lit
-- ni n'y écrit : RLS activé, aucune politique.
create table if not exists public.comptes_steam (
  steamid  text        primary key check (steamid ~ '^[0-9]{17}$'),
  auteur   uuid        not null unique references auth.users(id) on delete cascade,
  cree_le  timestamptz not null default now()
);
alter table public.comptes_steam enable row level security;
