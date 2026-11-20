#include "moteur.hpp"
#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/variant/packed_float32_array.hpp>

using namespace godot;

static std::vector<double> vec(const Variant &v) {
	std::vector<double> out;
	if (v.get_type() == Variant::PACKED_FLOAT64_ARRAY) {
		PackedFloat64Array a = v;
		out.resize(a.size());
		for (int64_t i = 0; i < a.size(); i++) out[i] = a[i];
	} else if (v.get_type() == Variant::PACKED_FLOAT32_ARRAY) {
		PackedFloat32Array a = v;
		out.resize(a.size());
		for (int64_t i = 0; i < a.size(); i++) out[i] = double(a[i]);
	}
	return out;
}

void MoteurNatif::piste(const Dictionary &d) {
	grip::Piste &T = c.track;
	T.n = int(d["n"]); T.ds = d["ds"]; T.length = d["length"]; T.halfWidth = d["halfWidth"]; T.barrierCell = d["barrierCell"];
	T.asphalte = bool(d["asphalte"]);
	T.xs = vec(d["xs"]); T.ys = vec(d["ys"]); T.th = vec(d["th"]); T.nx = vec(d["nx"]); T.ny = vec(d["ny"]); T.k = vec(d["k"]);
	T.hwL = vec(d["hwL"]); T.hwR = vec(d["hwR"]); T.kerb = vec(d["kerb"]);
	T.lRacing = vec(d["ligne_racing"]); T.lJaune = vec(d["ligne_jaune"]); T.lBleu = vec(d["ligne_bleu"]);
	T.kRacing = vec(d["lineK_racing"]); T.kJaune = vec(d["lineK_jaune"]); T.kBleu = vec(d["lineK_bleu"]);
	T.asphL = vec(d["asphaltW_L"]); T.asphR = vec(d["asphaltW_R"]); T.bacL = vec(d["bacW_L"]); T.bacR = vec(d["bacW_R"]);
	T.crossings = vec(d["croisements"]);
	std::vector<double> b = vec(d["barrieres"]);
	const int L = 14;
	T.nb = int(b.size()) / L;
	auto col = [&](std::vector<double> &dst, int k) { dst.resize(T.nb); for (int i = 0; i < T.nb; i++) dst[i] = b[i * L + k]; };
	col(T.bax, 0); col(T.bay, 1); col(T.bbx, 2); col(T.bby, 3); col(T.btx, 4); col(T.bty, 5); col(T.bnx, 6); col(T.bny, 7);
	col(T.blen, 8); col(T.bhalf, 9); col(T.bs, 10); col(T.bside, 11); col(T.blevel, 12);
	T.bpneus.resize(T.nb);
	for (int i = 0; i < T.nb; i++) T.bpneus[i] = uint8_t(int(b[i * L + 13]));
	std::vector<double> pl = vec(d["plaques"]);
	T.plaques.clear();
	for (size_t o = 0; o < pl.size();) {
		grip::Piste::Plaque p;
		p.gravier = pl[o] == 1;
		int nb = int(pl[o + 1]);
		for (int k = 0; k < 4; k++) p.b[k] = pl[o + 2 + k];
		p.poly.assign(pl.begin() + o + 6, pl.begin() + o + 6 + nb * 2);
		T.plaques.push_back(p);
		o += 6 + nb * 2;
	}
	T.construitGrille();
}

// Les champs d'état d'une voiture, dans l'ordre de etats() et de pose().
static const char *CHAMPS[] = {
	"x", "y", "th", "v", "vl", "w", "delta", "s", "lat", "sel", "selS", "selV", "beta", "slide", "patine", "patineFx", "glisseArr",
	"usage", "ressenti", "Ff", "Fr", "alphaF", "alphaR", "offT", "grassT", "engineCut", "throttle", "lapStart", "bestLap", "bestLapBrut",
	"finishTime", "repris", "sortieT", "sortieS0", "laneTarget", "gridLat", "aiTimer", "aiNoise", "aiAllow", "passTimer", "ecartAv", "aimantF",
	"lastImpact", "herbe", "engineStopped", "braking", "started", "checkpoint", "lapSale", "finished", "blueFlag", "surKerb", "draft", "accroche",
	"aiLeve", "lap", "crashes", "barrierHits", "fautes", "rejoined", "passSide", "sortieI", "nTours"
};
static const int NCHAMPS = sizeof(CHAMPS) / sizeof(CHAMPS[0]);

#define CHAMPS_DOUBLES(X) X(x) X(y) X(th) X(v) X(vl) X(w) X(delta) X(s) X(lat) X(sel) X(selS) X(selV) X(beta) X(slide) X(patine) X(patineFx) \
	X(glisseArr) X(usage) X(ressenti) X(Ff) X(Fr) X(alphaF) X(alphaR) X(offT) X(grassT) X(engineCut) X(throttle) X(lapStart) X(bestLap) \
	X(bestLapBrut) X(finishTime) X(repris) X(sortieT) X(sortieS0) X(laneTarget) X(gridLat) X(aiTimer) X(aiNoise) X(aiAllow) X(passTimer) \
	X(ecartAv) X(aimantF) X(lastImpact)
#define CHAMPS_BOOLS(X) X(herbe) X(engineStopped) X(braking) X(started) X(checkpoint) X(lapSale) X(finished) X(blueFlag) X(surKerb) X(draft) \
	X(accroche) X(aiLeve)
#define CHAMPS_INTS(X) X(lap) X(crashes) X(barrierHits) X(fautes) X(rejoined) X(passSide) X(sortieI)

static void litEtat(grip::Voiture &v, const Dictionary &e) {
#define LD(n) if (e.has(#n)) v.n = double(e[#n]);
#define LB(n) if (e.has(#n)) v.n = bool(e[#n]);
#define LI(n) if (e.has(#n)) v.n = int(e[#n]);
	CHAMPS_DOUBLES(LD) CHAMPS_BOOLS(LB) CHAMPS_INTS(LI)
	if (e.has("isPlayer")) v.isPlayer = bool(e["isPlayer"]);
	if (e.has("fantome")) v.fantome = bool(e["fantome"]);
	if (e.has("skill")) v.skill = double(e["skill"]);
	if (e.has("gripBoost")) v.gripBoost = double(e["gripBoost"]);
	if (e.has("freinRatio")) v.freinRatio = double(e["freinRatio"]);
	if (e.has("lapTimes")) { v.lapTimes = vec(e["lapTimes"]); }
	if (e.has("lapOk")) { std::vector<double> o = vec(e["lapOk"]); v.lapOk.clear(); for (double q : o) v.lapOk.push_back(q != 0); }
}

int MoteurNatif::ajoute(const Dictionary &m, const Dictionary &e) {
	grip::Voiture v;
	grip::Modele &M = v.cls;
	M.vmax = m["vmax"]; M.accel = m["accel"]; M.brake = m["brake"]; M.grip = m["grip"]; M.df = m["df"]; M.laneK = m["laneK"];
	M.rearBias = m["rearBias"]; M.cliff = m["cliff"]; M.slipPeak = m["slipPeak"]; M.length = m["length"]; M.width = m["width"];
	M.aCourbe = bool(m["aCourbe"]); M.dcFrom = m["dcFrom"]; M.dcTo = m["dcTo"]; M.dcLow = m["dcLow"]; M.dcHigh = m["dcHigh"];
	litEtat(v, e);
	c.voitures.push_back(v);
	return int(c.voitures.size()) - 1;
}

static grip::Niveau niveau(const Dictionary &d) {
	grip::Niveau n;
	n.marginBase = d.get("marginBase", 0.83); n.marginSpread = d.get("marginSpread", 0.09);
	n.paceBase = d.has("paceBase") ? double(d["paceBase"]) : NAN; n.paceSpread = d.get("paceSpread", 0.0);
	n.maxMargin = d.get("maxMargin", 0.98);
	return n;
}

void MoteurNatif::regle(const Dictionary &p) {
	c.modeCourse = bool(p["modeCourse"]); c.laps = int(p["laps"]); c.entrainement = bool(p["entrainement"]);
	c.player = int(p["player"]); c.fantome = int(p["fantome"]);
	c.difficulte = niveau(p["difficulte"]); c.difficile = niveau(p["difficile"]);
	c.profilRacing = vec(p["profil"]);
	c.hasard.etat = uint32_t(int64_t(p["hasard"]));
	c.countdown = p["countdown"]; c.time = p["time"]; c.state = int(p["state"]);
}

void MoteurNatif::prepare() { c.prepare(); }

PackedInt32Array MoteurNatif::pas(double gaz, double selJoueur) {
	if (c.player >= 0) c.cars[c.player]->sel = selJoueur;
	c.step(gaz);
	PackedInt32Array out;
	for (auto &e : c.evenements) { out.push_back(e.type); out.push_back(e.car); }
	return out;
}

void MoteurNatif::pas_seul(double gaz, double sel, double temps) {
	c.cars[c.player]->sel = sel;
	c.pasSeul(gaz, temps);
}

PackedStringArray MoteurNatif::champs() const {
	PackedStringArray a;
	for (int i = 0; i < NCHAMPS; i++) a.push_back(CHAMPS[i]);
	return a;
}

PackedFloat64Array MoteurNatif::etats() const {
	PackedFloat64Array a;
	a.resize(int64_t(c.cars.size()) * NCHAMPS);
	double *p = a.ptrw();
	for (auto *v : c.cars) {
#define ED(n) *p++ = v->n;
#define EB(n) *p++ = v->n ? 1.0 : 0.0;
#define EI(n) *p++ = double(v->n);
		CHAMPS_DOUBLES(ED) CHAMPS_BOOLS(EB) CHAMPS_INTS(EI)
		*p++ = double(v->lapTimes.size());
	}
	return a;
}

PackedFloat64Array MoteurNatif::tours(int i) const {
	PackedFloat64Array a;
	const grip::Voiture &v = *c.cars[i];
	for (size_t k = 0; k < v.lapTimes.size(); k++) { a.push_back(v.lapTimes[k]); a.push_back(v.lapOk[k] ? 1.0 : 0.0); }
	return a;
}

Dictionary MoteurNatif::course() const {
	Dictionary d;
	static const char *ETATS[] = {"countdown", "racing", "finishing", "finished"};
	d["state"] = ETATS[c.state]; d["time"] = c.time; d["countdown"] = c.countdown; d["finishTimer"] = c.finishTimer;
	d["chequered"] = c.chequered; d["zones"] = c.zones; d["hasard"] = int64_t(c.hasard.etat);
	PackedFloat64Array pen;
	for (int i = 0; i < int(c.cars.size()); i++) { auto it = c.penalties.find(i); pen.push_back(it == c.penalties.end() ? -1.0 : it->second); }
	d["penalites"] = pen;
	return d;
}

double MoteurNatif::ecart_fantome() const { return c.ecartFantome(); }

void MoteurNatif::pose(int i, const Dictionary &e) { litEtat(*c.cars[i], e); }

void MoteurNatif::_bind_methods() {
	ClassDB::bind_method(D_METHOD("piste", "d"), &MoteurNatif::piste);
	ClassDB::bind_method(D_METHOD("ajoute", "modele", "etat"), &MoteurNatif::ajoute);
	ClassDB::bind_method(D_METHOD("regle", "p"), &MoteurNatif::regle);
	ClassDB::bind_method(D_METHOD("prepare"), &MoteurNatif::prepare);
	ClassDB::bind_method(D_METHOD("pas", "gaz", "selJoueur"), &MoteurNatif::pas);
	ClassDB::bind_method(D_METHOD("pas_seul", "gaz", "sel", "temps"), &MoteurNatif::pas_seul);
	ClassDB::bind_method(D_METHOD("etats"), &MoteurNatif::etats);
	ClassDB::bind_method(D_METHOD("champs"), &MoteurNatif::champs);
	ClassDB::bind_method(D_METHOD("tours", "i"), &MoteurNatif::tours);
	ClassDB::bind_method(D_METHOD("course"), &MoteurNatif::course);
	ClassDB::bind_method(D_METHOD("ecart_fantome"), &MoteurNatif::ecart_fantome);
	ClassDB::bind_method(D_METHOD("pose", "i", "e"), &MoteurNatif::pose);
	ClassDB::bind_method(D_METHOD("hasard"), &MoteurNatif::hasard);
	ClassDB::bind_method(D_METHOD("pose_hasard", "e"), &MoteurNatif::pose_hasard);
}
