// Installe la collecte et son rapport public agrégé, sans compte Google.
// Les identifiants se définissent dans l'environnement, jamais dans le dépôt ni dans le chat.
// SUPABASE_ACCESS_TOKEN ; SUPABASE_PROJECT_REF facultatif.
'use strict';
const fs = require('fs'), path = require('path');
(async () => {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const project = process.env.SUPABASE_PROJECT_REF || 'fyaifqvghkvrydcldiup';
  if (!token) {
    console.error('Activation non effectuée : définir SUPABASE_ACCESS_TOKEN dans les variables de l’environnement, puis relancer node tools/deploie-analytics.js. Aucun compte Google ni adresse e-mail nécessaire. Voir docs/analytics/README.md.');
    process.exitCode = 2; return;
  }
  if (!/^[a-z0-9]{20}$/.test(project)) throw Error('Projet invalide.');
  const migration = fs.readFileSync(path.join(__dirname,'../supabase/analytics.sql'),'utf8');
  const query = `begin; ${migration} commit;`;
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({query}),signal:AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error('Installation refusée par Supabase (HTTP '+response.status+'). Vérifier le projet et les droits du jeton.');
  console.log('Collecte installée. Statistiques globales publiques dans analytics.html, sans connexion. Les événements individuels restent inaccessibles.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
