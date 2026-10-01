-- La table des records mondiaux, et les règles qui la gardent.
--
-- À coller dans le SQL Editor du tableau de bord Supabase, une seule fois.
--
-- Tout tient sur un principe : personne n'écrit ici depuis un navigateur. La clé publiable vit dans
-- le code de la page, donc tout le monde l'a ; une table ouverte en écriture se remplirait de tours
-- en une milliseconde le jour où quelqu'un ouvrirait la console. La lecture, elle, est ouverte à
-- tous — y compris à qui n'a pas de compte : un tableau qu'il faut mériter de voir ne sert à rien.

create table if not exists public.records (
  circuit    text        not null,
  voiture    text        not null,
  temps      real        not null,
  pilote     text        not null,
  -- l'identifiant Google du joueur. C'est LUI qui identifie, pas le pseudo : le pseudo peut
  -- changer, être repris par un autre, ou être écrit en double. Un record suit son auteur.
  auteur     uuid        not null references auth.users(id) on delete cascade,
  pose_le    timestamptz not null default now(),
  -- un seul record par couple circuit/voiture : c'est la définition d'un record du monde, et la
  -- contrainte évite d'avoir à trier des milliers de lignes à chaque lecture.
  primary key (circuit, voiture)
);

-- La lecture se fait par circuit, triée par temps. L'index suit exactement cette requête.
create index if not exists records_circuit_temps on public.records (circuit, temps);
create index if not exists records_auteur on public.records (auteur);

alter table public.records enable row level security;

-- LECTURE : ouverte à tous, comptes et anonymes.
--
-- DEUX choses sont nécessaires, et une politique seule n'en fait qu'une. Postgres demande d'abord
-- le PRIVILÈGE (`grant select`), puis le RLS filtre les lignes que ce privilège laisse voir. Une
-- politique sans privilège ne donne rien : la base répond « permission denied for table » (42501)
-- et pas « aucune ligne », ce qui est déroutant — la politique est là, bien visible, et ne sert à
-- rien. Supabase pose ces `grant` tout seul quand « Automatically expose new tables » est coché ;
-- on l'a décoché exprès, pour que rien ne s'ouvre sans qu'on l'ait écrit. Alors on l'écrit.
grant select on public.records to anon, authenticated;
drop policy if exists records_lecture on public.records;
create policy records_lecture on public.records for select to anon, authenticated using (true);

-- ÉCRITURE : aucune politique. Sans politique permissive, le RLS refuse tout — y compris à un
-- compte connecté. Seule la fonction serveur, qui s'authentifie avec la clé de service, passe
-- outre le RLS et peut écrire. C'est ce qui rend la validation incontournable plutôt que polie.

-- La table des pseudos. Séparée des records pour qu'un changement de pseudo mette à jour toutes
-- les lignes d'un joueur d'un coup, au lieu d'en laisser derrière sous l'ancien nom.
create table if not exists public.pilotes (
  id     uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null,
  maj_le timestamptz not null default now(),
  -- la même règle que dans le jeu, écrite ici aussi : une règle que seul le client applique
  -- n'est pas une règle.
  constraint pseudo_propre check (pseudo ~ '^[A-Za-z0-9]{2,14}$')
);
create unique index if not exists pilotes_pseudo on public.pilotes (lower(pseudo));

alter table public.pilotes enable row level security;
grant select on public.pilotes to anon, authenticated;
-- Le navigateur n'écrit PAS ici. C'est la fonction serveur qui inscrit le pseudo, lié à
-- l'identifiant vérifié du joueur. Laisser cette écriture au navigateur demandait un privilège,
-- une politique RLS et un ordre de passage strict ; les trois ont cassé à leur tour.
drop policy if exists pilotes_lecture on public.pilotes;
create policy pilotes_lecture on public.pilotes for select to anon, authenticated using (true);

-- Le plancher par circuit : le meilleur tour qu'une voiture peut physiquement faire ici.
-- Rempli par tools/plancher.js, qui le MESURE au lieu de le deviner. La fonction serveur refuse
-- tout temps en dessous — c'est ce qui arrête les tours en une milliseconde.
create table if not exists public.planchers (
  circuit text not null,
  voiture text not null,
  minimum real not null,
  primary key (circuit, voiture)
);
alter table public.planchers enable row level security;
grant select on public.planchers to anon, authenticated;
drop policy if exists planchers_lecture on public.planchers;
create policy planchers_lecture on public.planchers for select to anon, authenticated using (true);

-- Poser un record, et seulement s'il est meilleur.
--
-- La comparaison vit dans la base et non dans la fonction : deux joueurs peuvent arriver à la même
-- seconde, et seule la base peut les départager. `security definer` lui donne le droit d'écrire
-- malgré le RLS ; elle est appelée uniquement par la fonction serveur, jamais depuis un navigateur.
create or replace function public.poser_record(
  p_circuit text, p_voiture text, p_temps real, p_pilote text, p_auteur uuid
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.records (circuit, voiture, temps, pilote, auteur)
  values (p_circuit, p_voiture, p_temps, p_pilote, p_auteur)
  on conflict (circuit, voiture) do update
    set temps = excluded.temps, pilote = excluded.pilote,
        auteur = excluded.auteur, pose_le = now()
    where public.records.temps > excluded.temps;
$$;

-- Personne ne l'appelle depuis un navigateur : seule la clé de service y a droit.
revoke all on function public.poser_record(text, text, real, text, uuid) from public, anon, authenticated;

-- Les deux politiques d'écriture du navigateur sont retirées : plus personne n'écrit ici depuis
-- une page. Elles sont supprimées explicitement pour que rejouer ce fichier défasse l'ancienne
-- installation au lieu de la laisser traîner — une politique oubliée rouvre une porte en silence.
drop policy if exists pilotes_le_mien on public.pilotes;
drop policy if exists pilotes_maj_le_mien on public.pilotes;

-- Et RIEN de plus. Aucune écriture n'est accordée sur `records` ni sur `planchers`, à personne :
-- ni à un anonyme, ni à un compte connecté. Seule la fonction serveur, qui porte la clé de
-- service, écrit — et elle ne le fait qu'après avoir vérifié. On le révoque explicitement plutôt
-- que de compter sur l'absence : un `grant` posé par mégarde plus tard ne se verrait pas, et une
-- table de records ouverte en écriture ne se remarque que lorsqu'elle est déjà pleine de faux.
revoke insert, update, delete on public.records from anon, authenticated;
revoke insert, update, delete on public.planchers from anon, authenticated;
revoke insert, update, delete on public.pilotes from anon, authenticated;
