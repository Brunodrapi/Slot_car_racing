## Le tableau mondial de bout en bout, contre outils/faux-supabase.js :
##   lecture du tableau, connexion Google en PKCE (le retour du navigateur sur l'adresse locale),
##   envoi d'un tour net, refus d'un tour au guide, renouvellement d'une session expirée.
##
##   node godot/outils/faux-supabase.js 54321 /tmp/faux.json &
##   GRIP_MONDIAL_URL=http://127.0.0.1:54321 GRIP_MONDIAL_PUBLIE=1 godot --headless --path godot tests/mondial.tscn
extends Node

var echecs := []


func _ready() -> void:
	await get_tree().process_frame
	var M = get_node("/root/Mondial")
	var A = get_node("/root/App")
	M.session = {}
	M.envoyes = {}
	A.reglages.nom = "Bruno"
	A.reglages.guide = false
	A.reglages.recordsNets = {}
	# 1. La lecture : le meilleur par voiture
	var par = M.meilleurs("spa")
	_verifie(par == null, "rien tant que la réponse n'est pas là")
	await _attends(func(): return M.meilleurs("spa") != null, 5.0)
	par = M.meilleurs("spa")
	_verifie(par is Dictionary and par.has("porsche991gt3r"), "le tableau de Spa est lu")
	if par is Dictionary and par.has("porsche991gt3r"):
		_verifie(is_equal_approx(par.porsche991gt3r.temps, 141.234) and par.porsche991gt3r.pilote == "Monde1", "le meilleur temps par voiture, avec son pilote")
	# 2. La connexion : le « navigateur » suit la redirection jusqu'à l'adresse locale du jeu
	M.ouvreLien = func(u: String) -> void:
		# comme un navigateur : suivre la redirection de « Google », en complétant l'adresse
		# http://localhost:port?code=… en http://localhost:port/?code=…
		var h := HTTPRequest.new()
		h.max_redirects = 0
		add_child(h)
		h.request(u)
		var rep: Array = await h.request_completed
		var vers := ""
		for e in rep[2]:
			if String(e).to_lower().begins_with("location:"): vers = String(e).substr(9).strip_edges()
		vers = vers.replace(":%s?" % vers.get_slice(":", 2).get_slice("?", 0), ":%s/?" % vers.get_slice(":", 2).get_slice("?", 0))
		h.max_redirects = 8
		h.request(vers)
	M.entrer()
	_verifie(M.enCours, "la connexion attend le navigateur")
	await _attends(func(): return M.connecte(), 10.0)
	_verifie(M.connecte() and not M.enCours, "connecté par le code du retour (PKCE)")
	_verifie(M.nom() == "Pilote Essai", "le nom du compte Google : %s" % M.nom())
	# 3. Un tour net part au tableau ; un tour au guide n'y va pas
	M.tourNet("spa", "porsche991gt3r", 140.5, false)
	await _attends(func(): return M.envoyes.has("spa|porsche991gt3r"), 5.0)
	_verifie(M.envoyes.has("spa|porsche991gt3r"), "le tour net est accepté")
	A.reglages.guide = true
	M.tourNet("spa", "f40", 149.0, false)
	_verifie(M.dernierRefus.get("raison") == "aides", "le tour au guide ne part pas")
	A.reglages.guide = false
	# 4. Session expirée : elle se renouvelle avant l'envoi
	M.session.expire = 0
	await get_tree().create_timer(0.2).timeout
	var r = await M.propose("spa", "f40", 149.5)
	_verifie(r.ok, "envoi après renouvellement de la session")
	# 5. Un nom refusé par le serveur se dit
	A.reglages.nom = "B"
	r = await M.propose("monza", "f40", 99.0)
	_verifie(not r.ok and r.raison == "pseudo_forme" and "2 à 14" in M.etat().texte if A.reglages.langue == "fr" else true, "le refus du nom est expliqué")
	A.reglages.nom = "Bruno"
	M.sortir()
	_verifie(not M.connecte(), "déconnecté")
	print("MONDIAL ", "OK" if echecs.is_empty() else "ÉCHEC %s" % [echecs])
	get_tree().quit(0 if echecs.is_empty() else 1)


func _verifie(ok: bool, quoi: String) -> void:
	print(("  ok  " if ok else "  NON ") + quoi)
	if not ok: echecs.append(quoi)


func _attends(f: Callable, s: float) -> void:
	var t := 0.0
	while not f.call() and t < s:
		await get_tree().create_timer(0.1).timeout
		t += 0.1
