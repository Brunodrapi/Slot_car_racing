// Un faux Supabase pour tests/mondial.tscn : la lecture des records, la connexion Google en PKCE
// (« Google » accepte tout de suite et renvoie au jeu avec un code), l'échange du code, le
// renouvellement de session et la fonction `record`. Il note ce qu'il reçoit dans <journal>.
//
//   node godot/outils/faux-supabase.js <port> <journal.json>
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs');
const [PORT, JOURNAL] = [+process.argv[2] || 54321, process.argv[3] || '/tmp/faux-supabase.json'];
const defis = new Map(), jetons = new Set(), renouv = new Set();
const journal = { lectures: 0, authorize: [], echanges: 0, renouvellements: 0, records: [] };
const note = () => fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 2));
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (r, code, o) => { r.writeHead(code, { 'content-type': 'application/json' }); r.end(JSON.stringify(o)); };
const session = () => {
  const t = 'jeton-' + crypto.randomBytes(8).toString('hex'), rt = 'renouv-' + crypto.randomBytes(8).toString('hex');
  jetons.add(t); renouv.add(rt);
  return { access_token: t, refresh_token: rt, expires_in: 3600, token_type: 'bearer',
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'pilote@exemple.test', user_metadata: { full_name: 'Pilote Essai' } } };
};
http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  let corps = '';
  q.on('data', (d) => (corps += d));
  q.on('end', () => {
    if (q.method === 'GET' && u.pathname === '/rest/v1/records') {
      journal.lectures++; note();
      if (q.headers.apikey !== 'sb_publishable_O5veQvYKXfUt6e7iKtrDUg_rqPC_CS9') return json(r, 401, { message: 'clé' });
      return json(r, 200, u.searchParams.get('circuit') === 'eq.spa'
        ? [{ voiture: 'porsche991gt3r', temps: 141.234, pilote: 'Monde1' }, { voiture: 'f40', temps: 150.5, pilote: 'Monde2' }, { voiture: 'porsche991gt3r', temps: 142.0, pilote: 'Lent' }] : []);
    }
    if (q.method === 'GET' && u.pathname === '/auth/v1/authorize') {
      const retour = u.searchParams.get('redirect_to'), defi = u.searchParams.get('code_challenge');
      journal.authorize.push({ provider: u.searchParams.get('provider'), redirect_to: retour, methode: u.searchParams.get('code_challenge_method') }); note();
      const code = 'code-' + crypto.randomBytes(6).toString('hex');
      defis.set(code, defi);
      r.writeHead(302, { location: `${retour}?code=${code}` }); return r.end();
    }
    if (q.method === 'POST' && u.pathname === '/auth/v1/token') {
      const b = JSON.parse(corps || '{}');
      if (u.searchParams.get('grant_type') === 'pkce') {
        const defi = defis.get(b.auth_code); defis.delete(b.auth_code);
        if (!defi || b64url(crypto.createHash('sha256').update(b.code_verifier || '').digest()) !== defi) return json(r, 400, { error_description: 'code verifier invalide' });
        journal.echanges++; note();
        return json(r, 200, session());
      }
      if (u.searchParams.get('grant_type') === 'refresh_token') {
        if (!renouv.delete(b.refresh_token)) return json(r, 400, { error_description: 'refresh invalide' });
        journal.renouvellements++; note();
        return json(r, 200, session());
      }
    }
    // la version Steam : un ticket (en hexadécimal) contre une session ; le faux Valve connaît c0ffee…
    if (q.method === 'POST' && u.pathname === '/functions/v1/steam') {
      const b = JSON.parse(corps || '{}');
      journal.steam = (journal.steam || 0) + 1; note();
      if (!/^c0ffee/.test(b.ticket || '')) return json(r, 401, { raison: 'ticket' });
      const s = session(); s.user.user_metadata = { full_name: 'Steam', fournisseur: 'steam' };
      return json(r, 200, s);
    }
    if (q.method === 'POST' && u.pathname === '/functions/v1/record') {
      const t = (q.headers.authorization || '').replace(/^Bearer /, '');
      if (!jetons.has(t)) return json(r, 401, { raison: 'session' });
      const b = JSON.parse(corps || '{}');
      journal.records.push(b); note();
      if (!/^[A-Za-z0-9]{2,14}$/.test(b.pilote || '')) return json(r, 400, { raison: 'pseudo_forme' });
      return json(r, 200, { ok: true });
    }
    json(r, 404, { message: 'inconnu' });
  });
}).listen(PORT, '127.0.0.1', () => { note(); console.log('faux Supabase sur', PORT); });
