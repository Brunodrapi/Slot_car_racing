/* La fonction qui décide si un temps entre en base.

Elle existe parce que la clé publiable vit dans le code de la page : tout le monde l'a, et une
table ouverte en écriture se remplirait de tours en une milliseconde. Le RLS refuse donc toute
écriture depuis un navigateur, et cette fonction — qui s'authentifie avec la clé de service — est
le seul chemin. C'est ce qui rend la validation incontournable plutôt que polie.

Elle vérifie quatre choses, dans cet ordre, du moins cher au plus cher :

  1. QUI. Le jeton doit être valide et signé par Supabase. On ne le décode pas nous-mêmes : on le
     présente à Supabase, qui répond par un utilisateur ou par une erreur. Un jeton bricolé côté
     joueur n'ira pas plus loin.
  2. LA FORME. Circuit, voiture, temps : des chaînes courtes et un nombre fini positif. Un champ
     absurde est refusé avant d'avoir coûté une requête.
  3. LE PLANCHER. Le temps doit être au-dessus du meilleur tour physiquement possible sur ce
     couple circuit/voiture, mesuré par `tools/plancher.js`. C'est ce qui arrête les valeurs
     inventées. Ça n'arrête pas un joueur patient qui joue vraiment bien — rien ne le peut depuis
     un serveur qui ne voit que le résultat — mais ça garde le tableau lisible.
  4. LA CADENCE. Un compte ne peut pas proposer plus d'un temps toutes les quinze secondes. Un
     tour dure au moins une minute ; qui en propose quatre par minute ne roule pas.

Et une dernière, qui n'est pas une vérification : le temps ne remplace le record que s'il est
MEILLEUR. Cette comparaison se fait dans la base, pas ici, parce que deux joueurs peuvent arriver
en même temps et que seule la base sait trancher.
*/
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const NOM = /^[A-Za-z0-9]{2,14}$/;
const CLE = /^[a-z0-9_-]{1,40}$/;        // identifiants de circuit et de voiture
const ENTRE_DEUX_MS = 15000;

const rep = (code: number, corps: Record<string, unknown>) =>
  new Response(JSON.stringify(corps), { status: code, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return rep(405, { raison: 'methode' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. QUI. Le jeton du joueur, présenté à Supabase pour qu'il en réponde.
  const jeton = (req.headers.get('Authorization') || '').replace(/^Bearer /i, '');
  if (!jeton) return rep(401, { raison: 'anonyme' });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: qui, error: errQui } = await admin.auth.getUser(jeton);
  if (errQui || !qui?.user) return rep(401, { raison: 'session' });
  const auteur = qui.user.id;

  // 2. LA FORME.
  let corps: { circuit?: string; voiture?: string; temps?: number; pilote?: string | null };
  try { corps = await req.json(); } catch { return rep(400, { raison: 'corps' }); }
  const { circuit, voiture, temps } = corps;
  if (typeof circuit !== 'string' || !CLE.test(circuit)) return rep(400, { raison: 'circuit' });
  if (typeof voiture !== 'string' || !CLE.test(voiture)) return rep(400, { raison: 'voiture' });
  if (typeof temps !== 'number' || !Number.isFinite(temps) || temps <= 0 || temps > 3600) {
    return rep(400, { raison: 'temps' });
  }

  // Le pseudo vient de la table des pilotes, JAMAIS du corps de la requête : sinon n'importe qui
  // signerait n'importe quel nom, et le tableau attribuerait des records à des gens au hasard.
  /* L'erreur de la requête est LUE, et pas confondue avec une absence de ligne.

  En n'en prenant que `data`, une panne de lecture et un pilote inconnu rendaient le même mot :
  « pseudo ». Le joueur lisait « ton nom n'est pas enregistré » alors que son nom était en base et
  que c'est la requête qui avait échoué — un diagnostic faux coûte plus cher qu'un diagnostic
  absent, parce qu'on va chercher au mauvais endroit. */
  const { data: pilote, error: errPilote } = await admin.from('pilotes')
    .select('pseudo').eq('id', auteur).maybeSingle();
  if (errPilote) return rep(500, { raison: 'lecture_pilote', detail: errPilote.message });
  if (!pilote?.pseudo || !NOM.test(pilote.pseudo)) return rep(403, { raison: 'pseudo', auteur });

  // 3. LE PLANCHER.
  const { data: sol, error: errSol } = await admin.from('planchers').select('minimum')
    .eq('circuit', circuit).eq('voiture', voiture).maybeSingle();
  if (errSol) return rep(500, { raison: 'lecture_plancher', detail: errSol.message });
  // Pas de plancher connu pour ce couple : on refuse plutôt que d'accepter. Un plancher manquant
  // est une lacune de notre table, et accepter « par défaut » ouvrirait une porte à qui
  // inventerait un identifiant de voiture que la mesure ne couvre pas encore.
  if (!sol) return rep(422, { raison: 'inconnu' });
  if (temps < sol.minimum) return rep(422, { raison: 'trop_rapide' });

  // 4. LA CADENCE.
  const { data: dernier, error: errCad } = await admin.from('records').select('pose_le')
    .eq('auteur', auteur).order('pose_le', { ascending: false }).limit(1).maybeSingle();
  if (errCad) return rep(500, { raison: 'lecture_cadence', detail: errCad.message });
  if (dernier && Date.now() - Date.parse(dernier.pose_le) < ENTRE_DEUX_MS) {
    return rep(429, { raison: 'cadence' });
  }

  /* L'écriture, conditionnelle, et faite par la base.

  `upsert` seul écraserait un meilleur temps par un moins bon. On pose donc la condition dans la
  requête elle-même : remplacer seulement si le temps existant est moins bon. Deux joueurs qui
  arrivent à la même seconde sont départagés par la base, pas par l'ordre dans lequel leurs
  requêtes nous parviennent. */
  const { error: errEcrit } = await admin.rpc('poser_record', {
    p_circuit: circuit, p_voiture: voiture, p_temps: temps, p_pilote: pilote.pseudo, p_auteur: auteur,
  });
  if (errEcrit) return rep(500, { raison: 'ecriture', detail: errEcrit.message });
  return rep(200, { ok: true });
});
