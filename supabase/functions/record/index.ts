/* La fonction qui décide si un temps entre en base.

Elle existe parce que la clé publiable vit dans le code de la page : tout le monde l'a, et une
table ouverte en écriture se remplirait de tours en une milliseconde. Le RLS refuse donc toute
écriture depuis un navigateur, et cette fonction — qui s'authentifie avec la clé de service — est
le seul chemin. C'est ce qui rend la validation incontournable plutôt que polie.

Elle vérifie quatre choses, dans cet ordre, du moins cher au plus cher :

  0. LE NOM. La fonction inscrit elle-même le pseudo du joueur, lié à son identifiant vérifié.
     Le navigateur ne touche plus à la table des pilotes : c'était trois pièces mobiles — un
     privilège d'écriture, une politique RLS, un ordre de passage — pour un champ de texte.

  1. QUI. Le jeton doit être valide et signé par Supabase. On ne le décode pas nous-mêmes : on le
     présente à Supabase, qui répond par un utilisateur ou par une erreur. Un jeton bricolé côté
     joueur n'ira pas plus loin.
  2. LA FORME. Circuit, voiture, temps : des chaînes courtes et un nombre fini positif. Un champ
     absurde est refusé avant d'avoir coûté une requête.
  3. LE PLANCHER. Trente secondes, pour tous les circuits et toutes les voitures. Le tour le plus
     rapide que la physique autorise est de 55,6 s, sur le couple le plus favorable des cent huit :
     trente secondes passent donc largement sous tout ce qui est atteignable, et ne refuseront
     jamais un tour réel. Ça n'arrête pas un joueur patient qui joue vraiment bien — rien ne le
     peut depuis un serveur qui ne voit que le résultat — mais ça arrête les valeurs inventées, et
     ça garde le tableau lisible.
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

/* LE PLANCHER, EN UN SEUL NOMBRE.

Il y avait une table de cent huit minimums, un par couple circuit/voiture, mesurés par un banc qui
rejouait chaque couple trois fois — vingt-cinq minutes de calcul à refaire après tout changement de
tracé, de physique ou de voiture, et une ligne à ne pas oublier à chaque voiture ajoutée.

Un seul nombre fait le même travail pour ce qu'on lui demande. Le tour le plus rapide que la
physique autorise, sur le plus favorable des cent huit couples, est de 55,6 s. Trente secondes
passent donc sous TOUT ce qui est atteignable, avec une marge de 46 %, et ne refuseront jamais un
tour réel — ce qui est le seul défaut qu'un plancher ne doit pas avoir. Ce qu'on y perd est réel et
assumé : un plancher au plus juste refusait un temps inventé de 60 s, celui-ci le laisse passer.
Il arrête les valeurs absurdes, pas les valeurs plausibles.

`tools/plancher.js` reste, et sert maintenant à vérifier cette phrase : il mesure les cent huit
couples et dit de combien le plus rapide passe au-dessus. */
const PLANCHER_S = 30;

/* La table des planchers servait aussi de liste blanche : un couple absent était refusé. En la
retirant, n'importe quelle chaîne de quarante caractères minuscules serait devenue un circuit, et le
tableau mondial se serait rempli de lignes qu'aucun écran n'affiche. On garde donc la liste, qui ne
demande aucune mesure — juste de penser à y ajouter une voiture quand on en ajoute une. */
const CIRCUITS = new Set(['monza', 'spa', 'monaco', 'silverstone', 'suzuka', 'interlagos',
                          'laguna', 'nurburgring', 'lemans', 'bathurst', 'redbullring', 'zandvoort']);
const VOITURES = new Set(['m1procar', 'f40', 'countach', '930', 'gt40', '935', 'corvette',
                          '787b', 'csl']);
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

  /* LE PSEUDO. C'est la fonction qui l'inscrit, et plus le navigateur.

  Il était écrit par le jeu, directement dans la table, ce qui demandait un privilège d'écriture
  côté navigateur, une politique RLS pour le borner à sa propre ligne, et un ordre de passage
  strict — le nom avant le premier temps. Trois pièces mobiles pour un champ de texte, et chacune
  a cassé à son tour : droits manquants, requête non authentifiée, déclaration qui ne se rejouait
  qu'au chargement de la page. La fonction a déjà l'identité vérifiée du joueur et la clé de
  service ; elle n'a besoin de personne pour écrire une ligne.

  La garantie ne change pas d'un pouce. Le nom arrive bien du corps de la requête, mais il est
  LIÉ à `auth.uid()` : on ne peut inscrire un nom que pour soi-même, et l'index unique empêche de
  prendre celui d'un autre compte. Signer un record du nom de quelqu'un d'autre reste impossible,
  ce qui était tout l'objet de la règle. */
  const pseudo = typeof corps.pilote === 'string' ? corps.pilote : '';
  if (!NOM.test(pseudo)) return rep(400, { raison: 'pseudo_forme' });
  const { error: errPseudo } = await admin.from('pilotes')
    .upsert({ id: auteur, pseudo, maj_le: new Date().toISOString() }, { onConflict: 'id' });
  // 23505 : l'index unique sur le pseudo. Le nom appartient déjà à un autre compte.
  if (errPseudo) {
    return errPseudo.code === '23505'
      ? rep(409, { raison: 'pseudo_pris' })
      : rep(500, { raison: 'ecriture_pilote', detail: errPseudo.message });
  }

  /* UN RENOMMAGE SUIT LE JOUEUR SUR SES ANCIENS RECORDS.

  Le nom du pilote est recopié dans `records` au moment où le temps est posé — c'est ce qui permet
  d'afficher le tableau mondial d'une seule lecture, sans jointure. Mais une copie se périme : après
  un changement de nom, le joueur voyait son ancien pseudo sur tous ses records déjà en base, et son
  nouveau sur les suivants. Le même pilote apparaissait sous deux noms, ce qui est pire qu'un nom
  dépassé : ça ressemble à deux personnes.

  On remet donc les siennes à jour — les siennes seulement, `auteur` étant l'identité vérifiée — et
  rien que lorsqu'elles diffèrent, donc jamais dans le cas courant. Une erreur ici n'arrête pas
  l'envoi : le temps compte plus que l'étiquette. */
  const { error: errNom } = await admin.from('records')
    .update({ pilote: pseudo }).eq('auteur', auteur).neq('pilote', pseudo);
  if (errNom) console.log('renommage des records', errNom.message);

  // 3. LE PLANCHER, et les identifiants.
  if (!CIRCUITS.has(circuit) || !VOITURES.has(voiture)) return rep(422, { raison: 'inconnu' });
  if (temps < PLANCHER_S) return rep(422, { raison: 'trop_rapide' });

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
    p_circuit: circuit, p_voiture: voiture, p_temps: temps, p_pilote: pseudo, p_auteur: auteur,
  });
  if (errEcrit) return rep(500, { raison: 'ecriture', detail: errEcrit.message });
  return rep(200, { ok: true });
});
