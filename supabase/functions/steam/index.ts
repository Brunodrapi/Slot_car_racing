/* LA SESSION D'UN JOUEUR STEAM (version Steam de GRIP, Godot).

Le jeu demande à Steam un ticket pour l'API web (`getAuthTicketForWebApi("grip-records")`) et nous
l'envoie. On le fait vérifier par Valve (ISteamUserAuth/AuthenticateUserTicket, avec la clé Web API
d'éditeur), ce qui donne le SteamID du joueur — sans qu'il ait rien à taper. Puis :

  1. le compte Supabase de ce SteamID (table `comptes_steam`, supabase/steam.sql), créé la première
     fois : un utilisateur dont l'adresse est fictive et jamais écrite (aucun courrier ne part) ;
  2. une session sur ce compte : un lien de connexion généré par l'administration et échangé aussitôt,
     jamais envoyé à personne.

Le jeu reçoit alors exactement ce qu'il reçoit d'une connexion Google — un jeton et un jeton de
renouvellement — et pose ses temps par la fonction `record`, et son palmarès par `synchro_palmares`,
SANS AUCUN CHANGEMENT de celles-ci : un seul tableau mondial pour le web, Godot et Steam, et rien ne
change pour les joueurs Google.

Secrets (Edge Functions → Secrets) : STEAM_CLE_WEB (clé Web API d'éditeur, Steamworks → Users &
Permissions → Manage Groups) et STEAM_APP_ID. Sans eux, la fonction répond 503 et rien d'autre.
Déploiement : bash tools/deploie.sh steam --yes (avec l'accord de Bruno). */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const IDENTITE = 'grip-records';   // la même chaîne que dans le jeu (Mondial.entrerSteam)
const rep = (code: number, corps: Record<string, unknown>) =>
  new Response(JSON.stringify(corps), { status: code, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return rep(405, { raison: 'methode' });
  const cle = Deno.env.get('STEAM_CLE_WEB'), appid = Deno.env.get('STEAM_APP_ID');
  if (!cle || !appid) return rep(503, { raison: 'steam_non_configure' });

  let corps: { ticket?: string };
  try { corps = await req.json(); } catch { return rep(400, { raison: 'corps' }); }
  const ticket = typeof corps.ticket === 'string' ? corps.ticket : '';
  if (!/^[0-9a-fA-F]{20,4096}$/.test(ticket)) return rep(400, { raison: 'ticket_forme' });

  // 1. QUI : Valve dit à quel compte Steam appartient ce ticket, et s'il est valide pour notre jeu.
  let p: { result?: string; steamid?: string; vacbanned?: boolean; publisherbanned?: boolean } | undefined;
  try {
    const u = `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/?key=${encodeURIComponent(cle)}`
      + `&appid=${encodeURIComponent(appid)}&ticket=${ticket}&identity=${IDENTITE}`;
    const r = await fetch(u);
    p = (await r.json())?.response?.params;
  } catch (e) { return rep(502, { raison: 'steam_injoignable', detail: String(e) }); }
  if (!p || p.result !== 'OK' || !/^[0-9]{17}$/.test(p.steamid || '')) return rep(401, { raison: 'ticket' });
  if (p.vacbanned || p.publisherbanned) return rep(403, { raison: 'banni' });
  const steamid = p.steamid as string;

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const email = `steam-${steamid}@steam.grip-game.invalid`;

  // 2. LE COMPTE : celui de ce SteamID, ou un nouveau.
  const { data: lien, error: errLien } = await admin.from('comptes_steam').select('auteur').eq('steamid', steamid).maybeSingle();
  if (errLien) return rep(500, { raison: 'lecture_compte', detail: errLien.message });
  if (!lien) {
    const { data: cree, error } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { fournisseur: 'steam', steamid, full_name: 'Steam' },
    });
    if (error || !cree?.user) return rep(500, { raison: 'creation_compte', detail: error?.message });
    const { error: errIns } = await admin.from('comptes_steam').insert({ steamid, auteur: cree.user.id });
    if (errIns) return rep(500, { raison: 'ecriture_compte', detail: errIns.message });
  }

  // 3. LA SESSION : un lien de connexion généré, jamais envoyé, échangé tout de suite.
  const { data: gen, error: errGen } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (errGen || !gen?.properties?.hashed_token) return rep(500, { raison: 'lien', detail: errGen?.message });
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
  const { data: s, error: errS } = await anon.auth.verifyOtp({ token_hash: gen.properties.hashed_token, type: 'magiclink' });
  if (errS || !s?.session) return rep(500, { raison: 'session', detail: errS?.message });
  const se = s.session;
  return rep(200, {
    access_token: se.access_token, refresh_token: se.refresh_token, expires_in: se.expires_in, expires_at: se.expires_at,
    user: { id: se.user.id, user_metadata: { full_name: 'Steam', fournisseur: 'steam' } },
  });
});
