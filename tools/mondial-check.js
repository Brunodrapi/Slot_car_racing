// L'état réel du tableau mondial, interrogé sur la VRAIE base.
//
//   node tools/mondial-check.js
//
// Ce n'est pas un essai de la suite : il sort du poste et parle au service. Il n'a donc pas sa
// place dans `e2e-*`, qui doivent tourner hors-ligne et ne dépendre de personne. Il sert aux deux
// moments où la question se pose pour de bon : après avoir touché au schéma, et le jour où le
// tableau se tait sans qu'on sache si c'est le jeu, la base ou le réseau.
//
// Il vérifie deux choses, et la seconde compte plus que la première.
//
//   LES PORTES OUVERTES : les trois tables se lisent, les planchers sont chargés. Sans eux, la
//   fonction serveur refuse TOUT avec « inconnu » — un plancher manquant est une lacune, et accepter
//   par défaut ouvrirait la porte à un identifiant de voiture inventé.
//
//   LES PORTES FERMÉES : aucune écriture ne passe depuis un navigateur. C'est le cœur du dispositif,
//   et c'est aussi ce qui se casse sans bruit — un `grant` posé par mégarde, une politique trop
//   large, et la table s'ouvre sans que rien ne change à l'écran. Chaque ligne de cette section DOIT
//   échouer ; une réussite est un échec de l'essai.
//
// Ce qu'il ne peut PAS vérifier : qu'un joueur connecté arrive à poser un temps, et qu'un temps
// truqué soit refusé par le plancher. Les deux demandent un jeton Google, donc un vrai navigateur
// et un vrai compte. Il le dit en clair plutôt que de laisser croire que tout est couvert.
'use strict';
const URL_BASE = 'https://fyaifqvghkvrydcldiup.supabase.co';
const CLE = 'sb_publishable_O5veQvYKXfUt6e7iKtrDUg_rqPC_CS9';
const NUL = '00000000-0000-0000-0000-000000000000';

let fautes = 0;
const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

const appel = async (chemin, opts = {}) => {
  const r = await fetch(`${URL_BASE}${chemin}`, {
    ...opts,
    headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  let corps = null;
  try { corps = await r.json(); } catch (_) { /* une réponse vide est une réponse */ }
  return { code: r.status, corps };
};

(async () => {
  console.log('\nles portes ouvertes');
  for (const t of ['records', 'pilotes', 'planchers']) {
    const r = await appel(`/rest/v1/${t}?select=*&limit=1`);
    dit(r.code === 200, `${t} se lit (HTTP ${r.code}${r.code !== 200 ? ' — ' + JSON.stringify(r.corps).slice(0, 80) : ''})`);
  }
  const n = await fetch(`${URL_BASE}/rest/v1/planchers?select=circuit`,
    { headers: { apikey: CLE, Prefer: 'count=exact', Range: '0-0' } });
  const total = +((n.headers.get('content-range') || '').split('/')[1] || 0);
  dit(total >= 100, `${total} planchers charges (sans eux, le serveur refuse tout avec « inconnu »)`);

  console.log('\nles portes fermees — chaque ligne doit ECHOUER');
  const faux = { circuit: 'monza', voiture: 'f40', temps: 0.001, pilote: 'Tricheur', auteur: NUL };
  const essais = [
    ['INSERT dans records', '/rest/v1/records', 'POST', faux],
    ['UPDATE dans records', '/rest/v1/records?circuit=eq.monza', 'PATCH', { temps: 0.001 }],
    ['DELETE dans records', '/rest/v1/records?circuit=eq.monza', 'DELETE', null],
    ['INSERT dans planchers', '/rest/v1/planchers', 'POST', { circuit: 'monza', voiture: 'f40', minimum: 0.001 }],
    ['INSERT dans pilotes', '/rest/v1/pilotes', 'POST', { id: NUL, pseudo: 'Tricheur' }],
    ['appel direct de poser_record', '/rest/v1/rpc/poser_record', 'POST',
      { p_circuit: 'monza', p_voiture: 'f40', p_temps: 0.001, p_pilote: 'X', p_auteur: NUL }],
    ['fonction serveur sans jeton', '/functions/v1/record', 'POST', faux],
  ];
  for (const [nom, chemin, methode, corps] of essais) {
    const r = await appel(chemin, { method: methode, body: corps ? JSON.stringify(corps) : undefined });
    const refuse = r.code >= 400;
    dit(refuse, `${nom.padEnd(30)} HTTP ${r.code}${refuse ? '' : '  ← LA PORTE EST OUVERTE'}`);
  }

  // et la preuve par la table : rien de tout cela n'a laissé de trace
  const apres = await appel('/rest/v1/records?select=temps&temps=lt.1');
  dit(Array.isArray(apres.corps) && apres.corps.length === 0,
    `aucun temps absurde n'est entre en base (${(apres.corps || []).length} ligne(s) sous 1 s)`);

  console.log('\nce qui n\'est PAS verifie ici');
  console.log('  — qu\'un joueur connecte arrive a poser un temps');
  console.log('  — qu\'un temps sous le plancher soit refuse');
  console.log('  Les deux demandent un jeton Google, donc un navigateur et un vrai compte.');

  console.log(`\nfautes ${fautes}`);
  process.exit(fautes ? 1 : 0);
})();
