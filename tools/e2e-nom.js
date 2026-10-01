// Le nom de pilote, obligatoire à la première connexion.
//
//   NODE_PATH=$(npm root -g) node tools/e2e-nom.js [dossier]
//
// Trois choses, et la première est la seule qui compte vraiment : la porte tient-elle ? Un contrôle
// posé sur le chemin de l'écran-titre laisserait entrer par toutes les autres portes — un lien
// `?track=`, un retour de course, un rechargement en pleine partie. On essaie donc d'entrer par
// plusieurs côtés, pas seulement par celui qu'on a en tête en écrivant le code.
//
// Ensuite le jeu de caractères : le champ doit REFUSER d'afficher ce qu'il n'accepte pas, plutôt
// que d'accepter puis de se plaindre. Une frappe avec accents, espaces et émojis doit ressortir
// nettoyée, et le bouton rester éteint tant qu'il n'y a pas de nom.
//
// Enfin la position du curseur. Nettoyer un champ en réécrivant `value` renvoie le curseur en fin
// de chaîne : corriger le milieu d'un nom déjà tapé devient impossible, chaque lettre expédie le
// curseur à la fin. Ça ne se voit sur aucune capture et ça rend le champ inutilisable.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || '/tmp';

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = 'http://127.0.0.1:' + serveur.address().port;
  const nav = await chromium.launch();
  let fautes = 0, erreurs = 0;
  const dit = (ok, txt) => { if (!ok) fautes++; console.log(`  ${ok ? 'ok  ' : 'FAUX'}  ${txt}`); };

  const neuf = async () => {
    const ctx = await nav.newContext(devices['iPhone 13']);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { erreurs++; console.log('[pageerror]', e.message); });
    await page.goto(base + '/index.html');
    await page.waitForTimeout(400);
    return { ctx, page };
  };

  console.log('\nla porte');
  // --- 1. par l'écran-titre ---
  {
    const { ctx, page } = await neuf();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const vu = await page.evaluate(() => ({
      champ: !!document.getElementById('inp-nom'),
      bandeaux: document.querySelectorAll('.mi').length,
      bouton: (document.getElementById('btn-nom') || {}).disabled,
    }));
    dit(vu.champ && vu.bandeaux === 0, `apres l'ecran-titre : le nom est demande, aucun bandeau de menu (${vu.bandeaux})`);
    dit(vu.bouton === true, 'le bouton part eteint');
    await ctx.close();
  }

  // --- 2. par un lien qui nomme un circuit, puis retour au menu ---
  {
    const { ctx, page } = await neuf();
    const r = await page.evaluate(async () => {
      app.toMenu();
      await new Promise((r2) => setTimeout(r2, 250));
      return { champ: !!document.getElementById('inp-nom'), bandeaux: document.querySelectorAll('.mi').length };
    });
    dit(r.champ && r.bandeaux === 0, `un retour au menu sans nom redemande le nom (${r.bandeaux} bandeaux)`);
    await ctx.close();
  }

  console.log('\nce que le champ accepte');
  {
    const { ctx, page } = await neuf();
    await page.keyboard.press('Enter');
    await page.waitForSelector('#inp-nom');
    await page.fill('#inp-nom', '');
    await page.type('#inp-nom', 'José Mar+tin 42 🏎');
    await page.waitForTimeout(150);
    const v = await page.evaluate(() => ({
      valeur: document.getElementById('inp-nom').value,
      eteint: document.getElementById('btn-nom').disabled,
    }));
    dit(/^[A-Za-z0-9]*$/.test(v.valeur), `la frappe ressort nettoyee : « ${v.valeur} »`);
    dit(v.valeur === 'JosMartin42', `accents, espaces, signes et emoji retires (« ${v.valeur} »)`);
    dit(v.eteint === false, 'le bouton s\'allume sur un nom valide');

    // un nom trop court n'ouvre pas
    await page.fill('#inp-nom', '');
    await page.type('#inp-nom', 'a');
    await page.waitForTimeout(120);
    dit(await page.evaluate(() => document.getElementById('btn-nom').disabled), 'une seule lettre : le bouton reste eteint');

    // --- 3. le curseur ne saute pas à la fin quand on corrige au milieu ---
    await page.fill('#inp-nom', 'BrunoDrapi');
    await page.evaluate(() => { const e = document.getElementById('inp-nom'); e.focus(); e.setSelectionRange(5, 5); });
    await page.keyboard.type('é');       // refusé : le champ ne doit pas bouger, le curseur non plus
    await page.waitForTimeout(120);
    const c1 = await page.evaluate(() => { const e = document.getElementById('inp-nom'); return { v: e.value, pos: e.selectionStart }; });
    dit(c1.v === 'BrunoDrapi' && c1.pos === 5, `un caractere refuse au milieu ne bouge rien (« ${c1.v} », curseur ${c1.pos})`);
    await page.keyboard.type('X');       // accepté : il s'insère AU CURSEUR, pas à la fin
    await page.waitForTimeout(120);
    const c2 = await page.evaluate(() => { const e = document.getElementById('inp-nom'); return { v: e.value, pos: e.selectionStart }; });
    dit(c2.v === 'BrunoXDrapi' && c2.pos === 6, `une lettre s'insere au curseur (« ${c2.v} », curseur ${c2.pos})`);

    // --- 4. valider ouvre le menu, et le nom survit à un rechargement ---
    await page.fill('#inp-nom', 'Bruno42');
    await page.waitForTimeout(120);
    await page.click('#btn-nom');
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => ({ bandeaux: document.querySelectorAll('.mi').length, nom: app.save.name }));
    dit(apres.bandeaux === 3 && apres.nom === 'Bruno42', `valider ouvre le menu (${apres.bandeaux} bandeaux, nom « ${apres.nom} »)`);
    await page.reload();
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const revenu = await page.evaluate(() => ({ champ: !!document.getElementById('inp-nom'), bandeaux: document.querySelectorAll('.mi').length, nom: app.save.name }));
    dit(!revenu.champ && revenu.bandeaux === 3, `au retour, le nom n'est plus demande (« ${revenu.nom} »)`);

    // --- 5. les réglages ne laissent pas effacer le nom ---
    const vide = await page.evaluate(async () => {
      app.ui.settings();
      await new Promise((r) => setTimeout(r, 250));
      const e = document.getElementById('inp-name');
      e.value = '';
      e.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
      return { champ: e.value, enregistre: app.save.name };
    });
    dit(vide.enregistre === 'Bruno42', `vider le champ des reglages n'efface pas le nom (« ${vide.enregistre} »)`);

    /* --- 6. le même champ, EFFACÉ À LA TOUCHE --- */
    /* Le contrôle du dessus n'envoyait qu'un `change`, et c'est par là que le défaut est passé : un
    joueur ne pose pas un champ vide d'un coup, il efface lettre par lettre, et chaque lettre envoie
    un `input`. C'est `input` qui écrivait dans la sauvegarde sans rien vérifier ; le `change` qui
    devait rattraper « restaurait » alors la valeur vide qu'il venait lui-même d'enregistrer, et le
    retour au menu redemandait son nom au joueur comme s'il venait d'arriver. */
    const frappe = await page.evaluate(async () => {
      app.ui.settings();
      await new Promise((r) => setTimeout(r, 250));
      const e = document.getElementById('inp-name');
      for (let n = e.value.length - 1; n >= 0; n--) {
        e.value = e.value.slice(0, n);
        e.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const pendant = app.save.name;
      e.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
      app.toMenu();
      await new Promise((r) => setTimeout(r, 300));
      return { pendant, enregistre: app.save.name, redemande: !!document.getElementById('inp-nom') };
    });
    dit(frappe.pendant === 'Bruno42', `effacer a la touche n'ecrit rien du tout (« ${frappe.pendant} »)`);
    dit(frappe.enregistre === 'Bruno42', `le nom survit a l'effacement (« ${frappe.enregistre} »)`);
    dit(!frappe.redemande, `le menu ne redemande pas le nom (${frappe.redemande ? 'il le redemande' : 'il s\'ouvre'})`);

    /* --- 7. et renommer pour de bon marche toujours --- */
    const renomme = await page.evaluate(async () => {
      app.ui.settings();
      await new Promise((r) => setTimeout(r, 250));
      const e = document.getElementById('inp-name');
      e.value = '';
      for (const c of 'Nina9') { e.value += c; e.dispatchEvent(new Event('input', { bubbles: true })); }
      e.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
      return app.save.name;
    });
    dit(renomme === 'Nina9', `un vrai renommage est bien enregistre (« ${renomme} »)`);
    await page.screenshot({ path: path.join(out, 'nom.png') });
    await ctx.close();
  }

  console.log(`\nfautes ${fautes} | erreurs ${erreurs}`);
  await nav.close();
  serveur.close();
  process.exit(fautes || erreurs ? 1 : 0);
})();
