## Le doigt sur une page du jeu web au téléphone (le paddock, le salon) : un glissé de côté sur un rail
## fait défiler ce rail, tout autre glissé fait défiler la page ; dès que le doigt glisse, la carte qu'il
## avait touchée ne se choisit plus (comme une page web qu'on fait défiler) ; lâché, ce qui défilait
## file encore et ralentit, comme sous Safari.
##
## Les rails sont des vues qui coupent ce qui dépasse, avec leurs cartes dedans ; à la première
## ouverture, chacun se place sur la carte choisie (js/ui.js, _centrerRail), puis garde sa place.
class_name Doigt
extends RefCounted

var cadre: Control          # la page, à l'échelle du jeu web
var page: Callable          # page.call(d) : fait défiler la page de d points
var rails := {}             # nom -> { vue, contenu, maxi }
var railX := {}             # leur défilement ; absent : centré sur ce qui est choisi
var etat := {}              # le doigt posé : départ, axe choisi, rail dessous, vitesse
var elan := Vector2.ZERO    # la page (y) ou le rail (x) qui file encore, en points par seconde
var elanRail := ""


func _init(c: Control, p: Callable) -> void:
	cadre = c
	page = p


func actif() -> bool:
	return etat.get("actif", false)


## Un rail : `r` dans la page, `largeur` de son contenu, `centre` le milieu de la carte choisie.
## Rend le contrôle où poser les cartes.
func rail(nom: String, r: Rect2, largeur: float, centre: float) -> Control:
	var vue := Control.new()
	vue.clip_contents = true
	vue.mouse_filter = Control.MOUSE_FILTER_PASS
	vue.position = r.position
	vue.size = r.size
	cadre.add_child(vue)
	var contenu := Control.new()
	contenu.mouse_filter = Control.MOUSE_FILTER_PASS
	contenu.size = Vector2(largeur, r.size.y)
	vue.add_child(contenu)
	rails[nom] = { vue = vue, contenu = contenu, maxi = maxf(0, largeur - r.size.x) }
	pose(nom, float(railX.get(nom, centre - r.size.x / 2)))
	return contenu


func pose(nom: String, x: float) -> void:
	if not rails.has(nom): return
	var R: Dictionary = rails[nom]
	if R.get("natif", false):
		var vue: ScrollContainer = R.vue
		var barre := vue.get_h_scroll_bar()
		var maxi := maxf(0.0, barre.max_value - barre.page)
		x = clampf(x, 0.0, maxi)
		if (x <= 0 or x >= maxi) and nom == elanRail: elan = Vector2.ZERO
		railX[nom] = x
		vue.scroll_horizontal = roundi(x)
		return
	x = clampf(x, 0, R.maxi)
	if (x <= 0 or x >= R.maxi) and nom == elanRail: elan = Vector2.ZERO
	railX[nom] = x
	(R.contenu as Control).position.x = -x


func railNatif(nom: String, vue: ScrollContainer) -> void:
	rails[nom] = { vue = vue, natif = true }


## Le rail fait voir le contrôle `c` (la manette, le clavier).
func montre(c: Control) -> void:
	for nom in rails:
		var R: Dictionary = rails[nom]
		if (R.contenu as Control).is_ancestor_of(c):
			var x: float = railX.get(nom, 0.0)
			var w: float = (R.vue as Control).size.x
			if c.position.x < x + 4: pose(nom, c.position.x - 4)
			elif c.position.x + c.size.x > x + w - 4: pose(nom, c.position.x + c.size.x - w + 4)


func entree(e: InputEvent) -> void:
	var k := cadre.scale.x
	# Le doigt suivi est celui qui s'est posé le premier, quel que soit son numéro : la version web de
	# Godot donne le numéro du navigateur, et Safari sur iPhone ne commence pas à 0 (filtrer le doigt 0
	# empêchait toute la page de défiler sur iPhone).
	if e is InputEventScreenTouch:
		if e.pressed:
			# un nouveau doigt prend la main (un doigt dont on n'aurait pas su qu'il s'est levé ne bloque rien)
			elan = Vector2.ZERO
			var nom := _railSous(e.position)
			if nom != "" and rails[nom].get("natif", false): railX[nom] = float(rails[nom].vue.scroll_horizontal)
			etat = { actif = true, index = e.index, depart = e.position, axe = "", rail = nom, t = Time.get_ticks_usec(), v = Vector2.ZERO }
		elif actif() and e.index == int(etat.index):
			if etat.axe != "":
				elanRail = etat.rail if etat.axe == "x" else ""
				elan = etat.v if Time.get_ticks_usec() - int(etat.t) < 100000 else Vector2.ZERO
			etat.actif = false
	elif e is InputEventScreenDrag and actif() and e.index == int(etat.index):
		var d: Vector2 = e.position - etat.depart
		if etat.axe == "":
			if d.length() < 8.0 * k: return
			etat.axe = "x" if absf(d.x) > absf(d.y) and etat.rail != "" else "y"
			_annuleAppui.call_deferred()
		var maintenant := Time.get_ticks_usec()
		var dt := maxf(0.004, (maintenant - int(etat.t)) / 1e6)
		etat.t = maintenant
		var pas: Vector2 = -e.relative / k
		etat.v = (etat.v as Vector2).lerp(pas / dt, 0.6)
		if etat.axe == "x": pose(etat.rail, float(railX.get(etat.rail, 0.0)) + pas.x)
		else: page.call(pas.y)


## Ce qui file encore, à chaque image.
func avance(dt: float) -> void:
	if elan == Vector2.ZERO or actif(): return
	if elanRail != "": pose(elanRail, float(railX.get(elanRail, 0.0)) + elan.x * dt)
	else: page.call(elan.y * dt)
	elan *= pow(0.135, dt)
	if elan.length() < 20: elan = Vector2.ZERO


func _railSous(p: Vector2) -> String:
	for nom in rails:
		var vue: Control = rails[nom].vue
		if not is_instance_valid(vue): continue
		var t := vue.get_global_transform()
		if Rect2(t.origin, vue.size * t.get_scale()).has_point(p): return nom
	return ""


## La carte touchée par un doigt qui glisse ne se choisit pas : on lui fait lâcher le bouton hors de
## lui, avant que le doigt ne se lève.
func _annuleAppui() -> void:
	if not is_instance_valid(cadre) or not cadre.is_inside_tree(): return
	var vp := cadre.get_viewport()
	vp.gui_release_focus()
	var m := InputEventMouseMotion.new()
	m.position = Vector2(-10000, -10000)
	m.global_position = m.position
	m.button_mask = MOUSE_BUTTON_MASK_LEFT
	vp.push_input(m)
	var r := InputEventMouseButton.new()
	r.button_index = MOUSE_BUTTON_LEFT
	r.pressed = false
	r.position = m.position
	r.global_position = m.position
	vp.push_input(r)
