## Les records mondiaux, comme js/mondial.js : la même base Supabase que le jeu web.
##
## 1. La LECTURE est publique (API REST, clé publiable) : le tableau se lit sans compte, partout,
##    y compris dans la version web de Godot.
## 2. L'ÉCRITURE passe par la fonction serveur `record`, la même que celle du jeu web : elle vérifie
##    le joueur, le nom, la forme, le plancher et la cadence. La base est fermée au reste.
## 3. La CONNEXION Google se fait dans le navigateur de l'appareil, et revient au jeu par une adresse
##    locale (http://localhost:<port>), déjà autorisée dans Supabase. C'est le flux PKCE : le jeu
##    garde un secret, Google et Supabase ne rendent qu'un code, que seul ce secret échange contre une
##    session. Rien à régler côté Supabase, et rien ne change pour le jeu web.
##
## Seule la version publiée (grip/canal = "prod") écrit au tableau ; la recette le lit, comme le web.
## Rien ici n'est indispensable : sans réseau, le tableau reste vide et la course continue.
extends Node

const URL := "https://fyaifqvghkvrydcldiup.supabase.co"
# PUBLIQUE par construction, comme dans js/mondial.js : ce qu'elle permet est décidé par la base.
const CLE := "sb_publishable_O5veQvYKXfUt6e7iKtrDUg_rqPC_CS9"
const FICHIER := "user://mondial.json"
const ENTRE_DEUX := 16.0          # la fonction refuse deux temps à moins de 15 s
const DELAI_CONNEXION := 300.0    # au-delà, on cesse d'attendre le retour du navigateur

signal change                     # tableau reçu, connexion, envoi : l'écran affiché se repeint

var cache := {}                   # circuit → { t, par = { voiture: { temps, pilote } } }
var erreur := ""
var session := {}                 # { token, refresh, expire, nom, sub }
var envoyes := {}                 # "circuit|voiture" déjà partis
var inconnus := {}                # refusés comme inconnus du serveur
var dernierRefus := {}            # { raison, circuit, voiture }
var detailRefus := ""
var envoi := {}                   # le rattrapage : { total, faits, rien, attente }
var enCours := false              # une connexion attend son retour du navigateur
var erreurConnexion := ""
var _lectures := {}
var _serveurs: Array[TCPServer] = []
var _clients: Array = []          # [{ c: StreamPeerTCP, recu: String }]
var _verificateur := ""
var _depuis := 0.0
var _rattrapeEnCours := false
# Le palmarès du compte (js/palmares.js, PalmaresSync) : "" pas tenté, en-cours, ok, indisponible, erreur.
var etatPalmares := ""
var _palmaresEnCours := false
# Ouvre la page de connexion dans le navigateur de l'appareil ; un essai la remplace par une requête.
var ouvreLien := func(u: String) -> void: OS.shell_open(u)


func _ready() -> void:
	_charge()
	if connecte(): synchroPalmares.call_deferred()
	# la version Steam se connecte toute seule, par le ticket Steam du joueur
	elif SalleSteam.active(): entrerSteam.call_deferred()


## L'adresse du service : celle de Supabase, ou un faux service local pour les essais.
func url() -> String:
	var e := OS.get_environment("GRIP_MONDIAL_URL")
	return e.trim_suffix("/") if e != "" else URL


## La version publiée seule écrit au tableau mondial (TEMPS_PUBLIES dans js/mondial.js).
func publie() -> bool:
	return String(ProjectSettings.get_setting("grip/canal", "recette")) == "prod" or OS.get_environment("GRIP_MONDIAL_PUBLIE") == "1"


## La connexion Google demande un navigateur à côté du jeu : pas dans la version web de Godot.
func connexionPossible() -> bool:
	return not OS.has_feature("web")


func connecte() -> bool:
	return String(session.get("refresh", "")) != "" or (String(session.get("token", "")) != "" and float(session.get("expire", 0)) > Time.get_unix_time_from_system() + 60)


func nom() -> String:
	return String(session.get("nom", ""))


# ------------------------------------------------------------------ la lecture

## Le meilleur temps du monde par voiture sur ce circuit, ou null tant qu'il n'est pas arrivé.
## Une seule requête par circuit, gardée trois minutes (js/mondial.js, records).
func meilleurs(circuit: String) -> Variant:
	var vu = cache.get(circuit)
	if vu == null or Time.get_ticks_msec() - int(vu.t) > 180000:
		_lis(circuit)
	return vu.par if vu else null


func _lis(circuit: String) -> void:
	if _lectures.has(circuit): return
	_lectures[circuit] = true
	var r := await _http(HTTPClient.METHOD_GET, "%s/rest/v1/records?select=voiture,temps,pilote&circuit=eq.%s&order=temps.asc" % [url(), circuit.uri_encode()],
		["apikey: " + CLE, "Authorization: Bearer " + CLE])
	_lectures.erase(circuit)
	if r.ok and r.rep is Array:
		var par := {}
		for l in r.rep:
			if not (l is Dictionary): continue
			var v := String(l.get("voiture", ""))
			if not par.has(v) or float(l.temps) < float(par[v].temps): par[v] = { temps = float(l.temps), pilote = String(l.get("pilote", "")) }
		cache[circuit] = { t = Time.get_ticks_msec(), par = par }
		erreur = ""
	else:
		erreur = "HTTP %d" % r.status
		# pas de tableau, et c'est tout ; on ne relit pas à chaque image
		if not cache.has(circuit): cache[circuit] = { t = Time.get_ticks_msec(), par = {} }
	change.emit()


# ------------------------------------------------------------------ la connexion Google

## Part se connecter chez Google, dans le navigateur de l'appareil. Le jeu écoute sur une adresse
## locale le retour du navigateur, qui porte un code ; il l'échange contre une session (PKCE).
func entrer() -> void:
	if not connexionPossible(): return
	annuler()
	erreurConnexion = ""
	var s := TCPServer.new()
	if s.listen(0, "127.0.0.1") != OK:
		erreurConnexion = "port"
		change.emit()
		return
	_serveurs = [s]
	var port := s.get_local_port()
	# « localhost » peut viser ::1 ou 127.0.0.1 selon le navigateur : on écoute les deux si on peut
	var s6 := TCPServer.new()
	if s6.listen(port, "::1") == OK: _serveurs.append(s6)
	_verificateur = _hasard(64)
	var defi := Marshalls.raw_to_base64(_verificateur.sha256_buffer()).replace("+", "-").replace("/", "_").replace("=", "")
	var retour := "http://localhost:%d" % port
	ouvreLien.call("%s/auth/v1/authorize?provider=google&redirect_to=%s&code_challenge=%s&code_challenge_method=s256" % [url(), retour.uri_encode(), defi])
	enCours = true
	_depuis = 0.0
	change.emit()


## LA VERSION STEAM : la session vient du ticket Steam du joueur, vérifié par Valve côté serveur
## (fonction `steam`, supabase/functions/steam) — sans navigateur ni compte à créer. Ensuite tout
## passe par les mêmes chemins qu'une connexion Google : un seul tableau mondial, un seul palmarès.
func entrerSteam(st = null) -> void:
	var s = st if st != null else SalleSteam.singleton()
	if s == null or enCours: return
	enCours = true
	erreurConnexion = ""
	change.emit()
	s.get_ticket_for_web_api.connect(_ticketSteam, CONNECT_ONE_SHOT)
	s.getAuthTicketForWebApi("grip-records")


func _ticketSteam(_ticket, resultat, _taille, tampon) -> void:
	enCours = false
	var octets := PackedByteArray(tampon) if tampon is Array else (tampon as PackedByteArray)
	if int(resultat) != 1 or octets.is_empty():
		erreurConnexion = "steam"
		change.emit()
		return
	var r := await _http(HTTPClient.METHOD_POST, url() + "/functions/v1/steam", ["apikey: " + CLE, "Content-Type: application/json"],
		JSON.stringify({ ticket = octets.hex_encode() }))
	if r.ok and r.rep is Dictionary and r.rep.has("access_token"):
		_prendSession(r.rep)
		session.fournisseur = "steam"
		_sauve()
		rattrape()
		synchroPalmares()
	else:
		erreurConnexion = "steam"
	change.emit()


func annuler() -> void:
	for s in _serveurs: s.stop()
	_serveurs.clear()
	for c in _clients: c.c.disconnect_from_host()
	_clients.clear()
	if enCours:
		enCours = false
		change.emit()


func sortir() -> void:
	session = {}
	_sauve()
	change.emit()


func _process(dt: float) -> void:
	if _serveurs.is_empty(): return
	_depuis += dt
	if _depuis > DELAI_CONNEXION:
		annuler()
		erreurConnexion = "delai"
		change.emit()
		return
	for s in _serveurs:
		while s.is_connection_available():
			_clients.append({ c = s.take_connection(), recu = "" })
	for k in range(_clients.size() - 1, -1, -1):
		var cl: Dictionary = _clients[k]
		var c: StreamPeerTCP = cl.c
		c.poll()
		if c.get_status() != StreamPeerTCP.STATUS_CONNECTED:
			_clients.remove_at(k)
			continue
		var n := c.get_available_bytes()
		if n > 0: cl.recu += c.get_utf8_string(n)
		if "\r\n\r\n" in cl.recu or cl.recu.length() > 16384:
			_clients.remove_at(k)
			_requete(c, cl.recu)
			if _serveurs.is_empty(): return


## Une requête du navigateur sur l'adresse locale. Seule celle qui porte `code` ou `error` compte ;
## les autres (l'icône de l'onglet, une connexion d'avance) reçoivent une page vide.
func _requete(c: StreamPeerTCP, texte: String) -> void:
	var ligne := texte.get_slice("\r\n", 0)
	var chemin := ligne.get_slice(" ", 1)
	var q := _parametres(chemin.get_slice("?", 1) if "?" in chemin else "")
	var code := String(q.get("code", ""))
	var err := String(q.get("error_description", q.get("error", "")))
	if code == "" and err == "":
		_repond(c, 404, "")
		return
	var fr := String(App.reglages.get("langue", "fr")) == "fr"
	if err != "":
		_repond(c, 200, _page(("Connexion refusée : " if fr else "Sign-in refused: ") + err.xml_escape()))
		erreurConnexion = err
	else:
		_repond(c, 200, _page("Connecté. Tu peux fermer cet onglet et revenir au jeu." if fr else "Signed in. You can close this tab and go back to the game."))
	var verif := _verificateur
	annuler()
	if code != "": _echange(code, verif)
	else: change.emit()


func _echange(code: String, verif: String) -> void:
	var r := await _http(HTTPClient.METHOD_POST, url() + "/auth/v1/token?grant_type=pkce",
		["apikey: " + CLE, "Content-Type: application/json"], JSON.stringify({ auth_code = code, code_verifier = verif }))
	if r.ok and r.rep is Dictionary and r.rep.has("access_token"):
		_prendSession(r.rep)
		rattrape()
		synchroPalmares()
	else:
		erreurConnexion = String((r.rep if r.rep is Dictionary else {}).get("error_description", "HTTP %d" % r.status))
	change.emit()


func _prendSession(rep: Dictionary) -> void:
	var u: Dictionary = rep.get("user", {}) if rep.get("user") is Dictionary else {}
	var meta: Dictionary = u.get("user_metadata", {}) if u.get("user_metadata") is Dictionary else {}
	var expire := float(rep.get("expires_at", 0))
	if expire <= 0: expire = Time.get_unix_time_from_system() + float(rep.get("expires_in", 3600))
	session = { token = String(rep.access_token), refresh = String(rep.get("refresh_token", "")), expire = expire,
		sub = String(u.get("id", "")), nom = String(meta.get("full_name", u.get("email", ""))) }
	erreurConnexion = ""
	_sauve()


## Un jeton valide pour la prochaine minute : on le renouvelle s'il expire (le jeu web, lui, redemande
## la connexion au bout d'une heure ; une application garde sa session comme le fait supabase-js).
func _jetonFrais() -> bool:
	if String(session.get("token", "")) != "" and float(session.get("expire", 0)) > Time.get_unix_time_from_system() + 60: return true
	if String(session.get("refresh", "")) == "": return false
	var r := await _http(HTTPClient.METHOD_POST, url() + "/auth/v1/token?grant_type=refresh_token",
		["apikey: " + CLE, "Content-Type: application/json"], JSON.stringify({ refresh_token = session.refresh }))
	if r.ok and r.rep is Dictionary and r.rep.has("access_token"):
		_prendSession(r.rep)
		return true
	if not r.reseau: sortir()       # session révoquée : on redemandera la connexion
	return false


# ------------------------------------------------------------------ l'écriture

## Propose un temps. Le serveur décide (js/mondial.js, propose).
func propose(circuit: String, voiture: String, temps: float) -> Dictionary:
	if not publie(): return { ok = false, raison = "recette" }
	if not connecte(): return { ok = false, raison = "anonyme" }
	if not await _jetonFrais():
		dernierRefus = { raison = "session", circuit = circuit, voiture = voiture }
		change.emit()
		return { ok = false, raison = "session" }
	var r := await _http(HTTPClient.METHOD_POST, url() + "/functions/v1/record",
		["apikey: " + CLE, "Authorization: Bearer " + String(session.token), "Content-Type: application/json"],
		JSON.stringify({ circuit = circuit, voiture = voiture, temps = temps, pilote = String(App.reglages.get("nom", "")) }))
	if r.reseau:
		dernierRefus = { raison = "reseau", circuit = circuit, voiture = voiture }
		change.emit()
		return { ok = false, raison = "reseau" }
	var rep: Dictionary = r.rep if r.rep is Dictionary else {}
	var raison := String(rep.get("raison", rep.get("message", "HTTP %d" % r.status)))
	if r.ok:
		cache.erase(circuit)
		envoyes[circuit + "|" + voiture] = true
		_sauve()
	if r.status == 401: sortir()
	detailRefus = "" if r.ok else String(rep.get("detail", ""))
	dernierRefus = {} if r.ok else { raison = raison, circuit = circuit, voiture = voiture }
	change.emit()
	return { ok = r.ok, raison = raison }


## Rattraper les tours nets d'avant la connexion (js/mondial.js, rattrape), espacés de seize secondes.
func rattrape() -> void:
	if not publie() or not connecte() or _rattrapeEnCours: return
	_rattrapeEnCours = true
	var aFaire := []
	var nets: Dictionary = App.reglages.get("recordsNets", {})
	for cle in nets:
		var m := String(cle).split("/")
		if m.size() != 2: continue
		var k := m[0] + "|" + m[1]
		if envoyes.has(k) or inconnus.has(k): continue
		aFaire.append({ circuit = m[0], voiture = m[1], temps = float(nets[cle]) })
	envoi = { total = aFaire.size(), faits = 0, rien = aFaire.is_empty(), attente = 0 }
	change.emit()
	for i in aFaire.size():
		var t: Dictionary = aFaire[i]
		var r := await propose(t.circuit, t.voiture, t.temps)
		if r.ok: envoi.faits += 1
		if not r.ok and r.raison == "trop_rapide": envoyes[t.circuit + "|" + t.voiture] = true
		if not r.ok and r.raison == "inconnu": inconnus[t.circuit + "|" + t.voiture] = true
		_sauve()
		change.emit()
		# un refus qui ne dépend pas du temps touchera les suivants à l'identique : on s'arrête
		if not r.ok and r.raison in ["anonyme", "session", "pseudo", "pseudo_pris", "pseudo_forme", "reseau", "recette"]: break
		if i == aFaire.size() - 1: break
		for w in range(int(ENTRE_DEUX), 0, -1):
			envoi.attente = w
			change.emit()
			await get_tree().create_timer(1.0).timeout
		envoi.attente = 0
	_rattrapeEnCours = false
	change.emit()


## Un tour net vient d'être bouclé : il bat le meilleur tour net de l'appareil ? Il part au tableau.
## Net = sans le guide de freinage et hors entraînement (js/career.js, tourNet).
func tourNet(circuit: String, voiture: String, temps: float, entrainement: bool) -> void:
	if entrainement or App.reglages.get("guide", false):
		dernierRefus = { raison = "entrainement" if entrainement else "aides", circuit = circuit, voiture = voiture } if connecte() else {}
		return
	var R: Dictionary = App.reglages
	if not R.has("recordsNets"): R.recordsNets = {}
	var cle := circuit + "/" + voiture
	if R.recordsNets.has(cle) and temps >= float(R.recordsNets[cle]): return
	R.recordsNets[cle] = temps
	App.sauve()
	envoyes.erase(circuit + "|" + voiture)
	if connecte(): propose(circuit, voiture, temps)


# ------------------------------------------------------------------ le palmarès du compte

## Un seul appel envoie ce que l'appareil a de mieux et rend tout le palmarès du compte, gagné ici
## ou ailleurs (la fonction synchro_palmares de la base, la même que le jeu web). La recette et le
## jeu publié ont chacun le leur.
func synchroPalmares() -> void:
	if not connecte() or _palmaresEnCours: return
	_palmaresEnCours = true
	etatPalmares = "en-cours"
	change.emit()
	if not await _jetonFrais():
		_palmaresEnCours = false
		etatPalmares = "erreur"
		change.emit()
		return
	var lignes := []
	var p: Dictionary = App.reglages.get("palmares", {})
	for cle in p:
		var cv := String(cle).split("|")
		if cv.size() == 2 and int(p[cle]) >= 0 and int(p[cle]) < Palmares.TROPHEES.size():
			lignes.append({ c = cv[0], v = cv[1], n = int(p[cle]) })
	var r := await _http(HTTPClient.METHOD_POST, url() + "/rest/v1/rpc/synchro_palmares",
		["apikey: " + CLE, "Authorization: Bearer " + String(session.token), "Content-Type: application/json"],
		JSON.stringify({ p_canal = "prod" if publie() else "recette", p_lignes = lignes }))
	_palmaresEnCours = false
	if r.status == 401: sortir()
	if r.status == 404:
		etatPalmares = "indisponible"
	elif r.ok and r.rep is Array:
		if not App.reglages.has("palmares"): App.reglages.palmares = {}
		var modifie := false
		for l in r.rep:
			var cle := "%s|%s" % [l.get("circuit", ""), l.get("voiture", "")]
			var n := int(l.get("niveau", -1))
			if n >= 0 and n < Palmares.TROPHEES.size() and not (int(App.reglages.palmares.get(cle, -1)) >= n):
				App.reglages.palmares[cle] = n
				modifie = true
		if modifie: App.sauve()
		etatPalmares = "ok"
	else:
		etatPalmares = "erreur"
	change.emit()


## L'état du nuage : local, synchro, ok ou erreur.
func nuage() -> String:
	if not connecte(): return "local"
	match etatPalmares:
		"ok": return "ok"
		"erreur": return "erreur"
		"indisponible", "": return "local" if etatPalmares == "indisponible" else "synchro"
	return "synchro"


# ------------------------------------------------------------------ ce que l'écran en dit

## La ligne d'état du tableau (js/ui.js, etatMondial) : où l'on en est, en une phrase.
## { texte, alerte } — alerte : un refus ou un échec, à lire.
func etat() -> Dictionary:
	if enCours: return { texte = Textes.t("signInTab"), alerte = false }
	if erreurConnexion == "port": return { texte = Textes.t("authPort"), alerte = true }
	if erreurConnexion == "delai": return { texte = Textes.t("authDelai"), alerte = true }
	if erreurConnexion == "steam": return { texte = Textes.t("authSteam"), alerte = true }
	if erreurConnexion != "": return { texte = Textes.t("authFail", erreurConnexion), alerte = true }
	if not connexionPossible(): return { texte = Textes.t("worldFromApp"), alerte = false }
	if not connecte(): return { texte = Textes.t("worldNeedsAccount"), alerte = false }
	if not dernierRefus.is_empty(): return { texte = messageRefus(String(dernierRefus.raison)), alerte = true }
	if not envoi.is_empty() and not envoi.rien and int(envoi.faits) < int(envoi.total):
		return { texte = Textes.t("sendingWait", [envoi.faits, envoi.total, envoi.attente]) if int(envoi.attente) > 0 else Textes.t("sending", [envoi.faits, envoi.total]), alerte = false }
	if not envoi.is_empty() and int(envoi.faits) > 0: return { texte = Textes.t("sent", int(envoi.faits)), alerte = false }
	if not publie(): return { texte = Textes.t("recetteHorsTableau"), alerte = false }
	return { texte = Textes.t("signedInSteam" if session.get("fournisseur") == "steam" else "signedInAs"), alerte = false }


## Une raison du serveur dite au joueur ; une raison inconnue est nommée telle quelle.
static func messageRefus(raison: String) -> String:
	var cle := "refus_" + raison
	return Textes.t(cle) if Textes.FR.has(cle) else Textes.t("refus_autre", raison)


# ------------------------------------------------------------------ outils

func _http(methode: int, adresse: String, entetes: PackedStringArray, corps := "") -> Dictionary:
	var h := HTTPRequest.new()
	h.timeout = 20
	# Dans un navigateur, fetch() décompresse déjà la réponse mais laisse « Content-Encoding: gzip » :
	# HTTPRequest la décompresserait une seconde fois, échouerait, et le tableau resterait vide
	# (comme pour les décors, decor.gd).
	h.accept_gzip = not OS.has_feature("web")
	add_child(h)
	if h.request(adresse, entetes, methode, corps) != OK:
		h.queue_free()
		return { ok = false, status = 0, rep = null, reseau = true }
	var r: Array = await h.request_completed
	h.queue_free()
	var code: int = r[1]
	var texte: String = (r[3] as PackedByteArray).get_string_from_utf8()
	var j = JSON.parse_string(texte) if texte != "" else null
	var reseau: bool = r[0] != HTTPRequest.RESULT_SUCCESS
	return { ok = not reseau and code >= 200 and code < 300, status = code, rep = j, reseau = reseau }


func _repond(c: StreamPeerTCP, statut: int, html: String) -> void:
	var corps := html.to_utf8_buffer()
	var tete := "HTTP/1.1 %d %s\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: %d\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n" % [statut, "OK" if statut == 200 else "Not Found", corps.size()]
	c.put_data(tete.to_utf8_buffer())
	c.put_data(corps)
	c.disconnect_from_host()


func _page(message: String) -> String:
	return "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>SLOTLESS</title>" \
		+ "<body style='background:#17171c;color:#f2e6ca;font:20px sans-serif;display:grid;place-items:center;height:90vh;text-align:center'>" \
		+ "<div><b style='font-size:44px;font-style:italic'>SLOTLESS</b><p>%s</p></div>" % message


static func _parametres(q: String) -> Dictionary:
	var d := {}
	for p in q.split("&", false):
		var kv := p.split("=", true, 1)
		d[kv[0].uri_decode()] = (kv[1] if kv.size() > 1 else "").replace("+", " ").uri_decode()
	return d


static func _hasard(n: int) -> String:
	const C := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
	var octets := Crypto.new().generate_random_bytes(n)
	var s := ""
	for b in octets: s += C[b % C.length()]
	return s


func _charge() -> void:
	if not FileAccess.file_exists(FICHIER): return
	var d = JSON.parse_string(FileAccess.get_file_as_string(FICHIER))
	if not (d is Dictionary): return
	session = d.get("session", {}) if d.get("session") is Dictionary else {}
	for k in d.get("envoyes", []): envoyes[String(k)] = true
	for k in d.get("inconnus", []): inconnus[String(k)] = true


func _sauve() -> void:
	var f := FileAccess.open(FICHIER, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify({ session = session, envoyes = envoyes.keys(), inconnus = inconnus.keys() }))
