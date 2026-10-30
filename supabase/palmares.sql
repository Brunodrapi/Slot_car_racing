-- Le palmarès : pour chaque circuit et chaque voiture, le plus haut niveau où le joueur a gagné.
--
-- À coller dans le SQL Editor du tableau de bord Supabase, une seule fois ; rejouable sans dégât.
--
-- Ce n'est PAS un tableau mondial : chacun ne voit que le sien, et personne ne le compare. Il sert à
-- retrouver ses trophées sur un autre appareil, une fois connecté avec Google. D'où un modèle plus
-- simple que celui des records (`schema.sql`) : pas de fonction serveur ni de clé de service, une
-- fonction de la base qui ne touche qu'aux lignes de `auth.uid()`. Tricher ici, c'est se décerner
-- une médaille à soi-même, et rien de plus.
--
-- Niveaux : 0 chocolat (facile), 1 bronze (normal), 2 argent (difficile), 3 or (extrême),
-- 4 crâne (cauchemar). Le canal sépare la recette de la prod : la recette roule sur une physique et
-- des circuits en chantier, ses trophées ne doivent pas se mêler à ceux de la prod.

create table if not exists public.palmares (
  auteur   uuid        not null references auth.users(id) on delete cascade,
  canal    text        not null check (canal in ('prod', 'recette')),
  circuit  text        not null check (circuit ~ '^[a-z0-9_-]{1,40}$'),
  voiture  text        not null check (voiture ~ '^[a-z0-9_-]{1,40}$'),
  niveau   smallint    not null check (niveau between 0 and 4),
  pose_le  timestamptz not null default now(),
  primary key (auteur, canal, circuit, voiture)
);

-- Aucune lecture ni écriture directe depuis un navigateur : tout passe par la fonction ci-dessous,
-- qui ne voit que les lignes du joueur connecté.
alter table public.palmares enable row level security;
revoke all on public.palmares from anon, authenticated;
grant all on public.palmares to service_role;

/* Fusionner le palmarès de l'appareil avec celui du compte, et rendre le résultat.

`p_lignes` : un tableau JSON [{"c": circuit, "v": voiture, "n": niveau}, …], éventuellement vide.
Une ligne n'abaisse JAMAIS un niveau : gagner en Normal après avoir gagné en Extrême laisse l'or. On
rend ensuite tout le palmarès du compte pour ce canal, que l'appareil adopte — un seul aller-retour
pour envoyer ses nouveaux trophées et récupérer ceux gagnés ailleurs. */
create or replace function public.synchro_palmares(p_canal text, p_lignes jsonb default '[]'::jsonb)
returns table (circuit text, voiture text, niveau smallint)
language plpgsql
security definer
set search_path = public
as $$
-- les colonnes rendues (circuit, voiture, niveau) portent les noms de celles de la table : sans cette
-- directive, PL/pgSQL refuse l'`on conflict (…, circuit, voiture)` comme ambigu
#variable_conflict use_column
declare
  qui uuid := auth.uid();
  l jsonb;
begin
  if qui is null then raise exception 'anonyme' using errcode = '28000'; end if;
  if p_canal not in ('prod', 'recette') then raise exception 'canal' using errcode = '22023'; end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) > 1000 then
    raise exception 'lignes' using errcode = '22023';
  end if;
  for l in select * from jsonb_array_elements(p_lignes) loop
    -- une ligne mal formée est ignorée, pas fatale : le reste du palmarès passe quand même
    if (l->>'c') ~ '^[a-z0-9_-]{1,40}$' and (l->>'v') ~ '^[a-z0-9_-]{1,40}$'
       and (l->>'n') ~ '^[0-4]$' then
      insert into public.palmares as p (auteur, canal, circuit, voiture, niveau)
      values (qui, p_canal, l->>'c', l->>'v', (l->>'n')::smallint)
      on conflict (auteur, canal, circuit, voiture) do update
        set niveau = excluded.niveau, pose_le = now()
        where p.niveau < excluded.niveau;
    end if;
  end loop;
  return query select p.circuit, p.voiture, p.niveau from public.palmares p
    where p.auteur = qui and p.canal = p_canal;
end;
$$;

revoke all on function public.synchro_palmares(text, jsonb) from public, anon;
grant execute on function public.synchro_palmares(text, jsonb) to authenticated;

-- que l'API REST voie la nouvelle fonction sans attendre
notify pgrst, 'reload schema';
