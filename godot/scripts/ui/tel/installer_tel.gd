## INSTALLER LE JEU, au téléphone (js/ui.js, installScreen) : pourquoi le poser sur l'écran d'accueil,
## puis le chemin, étape par étape, avec les icônes que le téléphone affiche.
##
## Il n'y a pas de bouton « Installer » sur iPhone : Safari ne laisse aucune page le proposer, il faut
## passer par Partager. Chrome sur Android, lui, offre parfois l'installation directe
## (beforeinstallprompt, gardé par la page dans window.gripInvite : html/head_include de l'export web) :
## le bouton n'apparaît que dans ce cas. Les explications de l'appareil qu'on tient viennent en premier ;
## les autres restent dépliables, pour qui aide un ami.
class_name InstallerTel
extends EcranTel

# les pictogrammes du jeu web (PICTOS), sur la pastille blanche des icônes du téléphone (.picto-os)
const PICTO := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3.5 -3.5 31 31"><rect x="-3" y="-3" width="30" height="30" rx="6.5" fill="#fff" stroke="#20251f" stroke-opacity="0.2"/>%s</svg>'
const PARTAGER := '<path d="M12 3.5v11M7.8 7.6 12 3.5l4.2 4.1" fill="none" stroke="#0a7cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 10H6.6a1.1 1.1 0 0 0-1.1 1.1v8.3a1.1 1.1 0 0 0 1.1 1.1h10.8a1.1 1.1 0 0 0 1.1-1.1v-8.3a1.1 1.1 0 0 0-1.1-1.1h-1.9" fill="none" stroke="#0a7cff" stroke-width="2" stroke-linecap="round"/>'
const AJOUTER := '<rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="#171b19" stroke-width="2"/><path d="M12 8.2v7.6M8.2 12h7.6" stroke="#171b19" stroke-width="2" stroke-linecap="round"/>'
const MENU_ANDROID := '<circle cx="12" cy="5.5" r="2" fill="#171b19"/><circle cx="12" cy="12" r="2" fill="#171b19"/><circle cx="12" cy="18.5" r="2" fill="#171b19"/>'
const INSTALLER := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="8.5" y="2.5" width="15" height="27" rx="3.2" fill="#fff0d2" stroke="#171b19" stroke-width="2.6"/><path d="M16 8.5v10m-4.2-4.2L16 18.5l4.2-4.2" fill="none" stroke="#12a96a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.6 25h4.8" stroke="#171b19" stroke-width="2.2" stroke-linecap="round"/></svg>'
const FICHE := Color("#fff0d2")
const FICHE_BORD := Color("#20251f")
const LARGEUR := 390.0 - 2 * 12 - 2 * 18     # le défilé, puis la fiche (bord et marge)

var deplie := false                  # les explications de l'autre appareil
var _attend := false                 # l'invitation du navigateur est ouverte


func _init() -> void:
	nom = "accueil"


static func plateforme() -> String:
	var e := OS.get_environment("GRIP_PLATEFORME")
	if e != "": return e
	if not OS.has_feature("web"): return "autre"
	return String(JavaScriptBridge.eval("(function(){var u=navigator.userAgent||'';if(/iPhone|iPad|iPod/i.test(u)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))return 'ios';return /Android/i.test(u)?'android':'autre';})()", true))


static func installe() -> bool:
	if not OS.has_feature("web"): return OS.get_environment("GRIP_INSTALLE") == "1"
	return bool(JavaScriptBridge.eval("navigator.standalone === true || ['standalone','minimal-ui'].some(function(m){return matchMedia('(display-mode: ' + m + ')').matches;}) || window.gripInstalle === true", true))


static func invitation() -> bool:
	if not OS.has_feature("web"): return OS.get_environment("GRIP_INVITATION") == "1"
	return bool(JavaScriptBridge.eval("!!window.gripInvite", true))


func construit(v: Control) -> void:
	var col := colonne(v, Tel.t("installTitre"), Tel.t("retour"), retour)
	var defile := DefileTel.new(14, 12, 14, 12, 20)
	col.add_child(defile)
	var c := defile.contenu
	# pourquoi
	var h := Tel.boite(false, 12)
	h.add_child(Tel.image(Accueil._svg(INSTALLER), Vector2(40, 40)))
	var l := Tel.texte(Tel.t("installPourquoi"), 18, Color("#20261e"))
	h.add_child(l)
	c.add_child(_fiche(h))
	# déjà fait, ou le bouton du navigateur
	if installe():
		c.add_child(_fiche(Tel.texte(Tel.t("installFait"), 20, Color("#0f7a4c"))))
	elif invitation():
		var b := Tel.gros(Tel.t("installMaintenant"), _installeMaintenant, false, Tel.ROUGE, 30)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		c.add_child(b)
	var os := plateforme()
	var ios := [Tel.t("installIos"), [[Tel.t("installIos1"), PARTAGER], [Tel.t("installIos2"), AJOUTER], [Tel.t("installIos3"), ""]]]
	var android := [Tel.t("installAndroid"), [[Tel.t("installAnd1"), MENU_ANDROID], [Tel.t("installAnd2"), ""], [Tel.t("installAnd3"), ""]]]
	var premier: Array = android if os == "android" else ios
	var second: Array = ios if os == "android" else android
	c.add_child(_section(premier, true, false))
	c.add_child(_section(second, os == "autre" or deplie, os != "autre"))
	c.add_child(Tel.texte(Tel.t("installAppli"), 15, Color("#4a4e45")))


## Une fiche (.fiche) : le papier crème, le bord d'encre, l'ombre décalée.
func _fiche(dedans: Control) -> Control:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = FICHE
	sb.border_color = FICHE_BORD
	sb.set_border_width_all(2)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	sb.shadow_color = Color(0x17 / 255.0, 0x1b / 255.0, 0x19 / 255.0, 0x44 / 255.0)
	sb.shadow_offset = Vector2(4, 5)
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_PASS
	p.add_child(dedans)
	return p


## Les explications d'un appareil : son titre, ses étapes numérotées. Pliée, elle ne montre que son
## titre, qu'on touche pour la déplier (details / summary).
func _section(s: Array, ouverte: bool, pliable: bool) -> Control:
	var col := Tel.boite(true, 10)
	if pliable:
		var t := ToucheTel.new(Color(0, 0, 0, 0))
		var hh := Tel.boite(false, 8)
		hh.add_child(Tel.glyphe("bas" if ouverte else "droite", 14, Color("#20261e")))
		hh.add_child(Tel.titre(String(s[0]), 24, Color("#20261e")))
		t.ajoute(hh)
		t.pressed.connect(func():
			deplie = not deplie
			rafraichit())
		col.add_child(t)
	else:
		col.add_child(Tel.titre(String(s[0]), 24, Color("#20261e")))
	if ouverte:
		var n := 0
		for e in s[1]:
			n += 1
			col.add_child(_etape(n, String(e[0]), String(e[1])))
	return _fiche(col)


## Une étape (.etapes li) : le numéro sur sa pastille rouge coupée en biais, la phrase, et dans la
## phrase l'icône du téléphone.
func _etape(n: int, phrase: String, picto: String) -> Control:
	var h := Tel.boite(false, 12)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	var num := Control.new()
	num.custom_minimum_size = Vector2(32, 32)
	num.mouse_filter = Control.MOUSE_FILTER_IGNORE
	num.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	num.draw.connect(func():
		var pts := PackedVector2Array([Vector2(32 * 0.18, 0), Vector2(32, 0), Vector2(32 * 0.82, 32), Vector2(0, 32)])
		Style.plein(num, pts, Color("#c82520"))
		var tx := str(n)
		var w := Style.largeur(tx, 20)
		Style.texte(num, tx, Vector2((32 - w) / 2, 16 + 20 * 0.36), 20, Color("#fff1d5")))
	h.add_child(num)
	var r := RichTextLabel.new()
	r.bbcode_enabled = false
	r.fit_content = true
	r.scroll_active = false
	r.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	r.custom_minimum_size = Vector2(LARGEUR - 32 - 12, 0)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	r.add_theme_font_override("normal_font", ThemeDB.fallback_font)
	r.add_theme_font_size_override("normal_font_size", 17)
	r.add_theme_color_override("default_color", Color("#3a3f37"))
	r.add_theme_constant_override("line_separation", 4)
	var morceaux := phrase.split("%s")
	r.add_text(morceaux[0])
	if morceaux.size() > 1:
		r.add_image(Accueil._svg(PICTO % picto), 26, 26, Color.WHITE, INLINE_ALIGNMENT_CENTER)
		r.add_text(morceaux[1])
	h.add_child(r)
	return h


func _installeMaintenant() -> void:
	if not OS.has_feature("web"): return
	_attend = true
	JavaScriptBridge.eval("(function(){var i=window.gripInvite;if(!i)return;window.gripInvite=null;window.gripInstallFini=0;"
		+ "Promise.resolve(i.prompt()).then(function(){return i.userChoice;}).then(function(r){if(r&&r.outcome==='accepted')window.gripInstalle=true;})"
		+ ".catch(function(){}).finally(function(){window.gripInstallFini=Date.now();});})()", true)


func _process(_dt: float) -> void:
	# le navigateur a répondu : l'écran montre ce qu'il en est (fait, ou de nouveau les étapes)
	if _attend and OS.has_feature("web") and float(JavaScriptBridge.eval("window.gripInstallFini || 0", true)) > 0:
		_attend = false
		rafraichit()
