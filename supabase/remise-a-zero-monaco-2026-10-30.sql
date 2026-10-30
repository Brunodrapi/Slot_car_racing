-- Effacer du tableau mondial les temps du Rocher (Monaco) posés sur l'ancien tracé.
--
-- Joué le 30 octobre 2026, à la demande de Bruno, après la publication en prod de la 0.52.47 : le
-- Rocher y change de bords de piste, d'axe et de trajectoires (reprise de Bruno, tracks_11), et un
-- temps posé avant ne se compare plus. Un seul temps effacé : Bruno, Howitzer K1, 1:41.1, posé le
-- 25 octobre. Les pilotes ne sont pas touchés, ni les autres circuits.
--
--   Joué une fois. Ce fichier ne sert pas deux fois.
delete from public.records where circuit = 'monaco' and pose_le < timestamptz '2026-10-30 12:00:00 Europe/Paris';
