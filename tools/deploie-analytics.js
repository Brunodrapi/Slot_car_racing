// Installe la migration et autorise un compte déjà connecté au jeu via Google.
// Les identifiants se définissent dans l'environnement, jamais dans le dépôt ni dans le chat.
// SUPABASE_ACCESS_TOKEN, ANALYTICS_ADMIN_EMAIL ; SUPABASE_PROJECT_REF facultatif.
'use strict';
const fs = require('fs'), path = require('path');
const { randomUUID } = require('crypto');
(async () => {
  const token = process.env.SUPABASE_ACCESS_TOKEN, email = process.env.ANALYTICS_ADMIN_EMAIL;
  const project = process.env.SUPABASE_PROJECT_REF || 'fyaifqvghkvrydcldiup';
  if (!token || !email) {
    console.error('Activation non effectuée : définir SUPABASE_ACCESS_TOKEN et ANALYTICS_ADMIN_EMAIL dans les variables de l’environnement, puis relancer node tools/deploie-analytics.js. Voir docs/analytics/README.md.');
    process.exitCode = 2; return;
  }
  if (!/^[a-z0-9]{20}$/.test(project) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Error('Projet ou adresse du propriétaire invalide.');
  const literal = "'" + email.replaceAll("'", "''") + "'";
  const tag = '$owner_' + randomUUID().replaceAll('-', '') + '$';
  if (email.includes(tag)) throw Error('Adresse invalide.');
  const migration = fs.readFileSync(path.join(__dirname,'../supabase/analytics.sql'),'utf8');
  const query = `begin; ${migration}
    do ${tag} declare owner_id uuid; begin
      select id into owner_id from auth.users where lower(email)=lower(${literal}) and email_confirmed_at is not null;
      if owner_id is null then raise exception 'Le compte propriétaire doit d’abord se connecter au jeu avec Google.'; end if;
      insert into public.analytics_admins(user_id) values(owner_id) on conflict do nothing;
    end ${tag}; commit;`;
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({query}),signal:AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error('Installation refusée par Supabase (HTTP '+response.status+'). Vérifier le projet, les droits du jeton et la première connexion du propriétaire.');
  console.log('Collecte installée et compte propriétaire autorisé. Ouvrir analytics.html sur le site du jeu. Si la connexion Google doit revenir directement sur cette page, ajouter son URL dans Authentication → URL Configuration → Redirect URLs.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
