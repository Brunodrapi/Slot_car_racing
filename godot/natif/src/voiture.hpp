// La voiture : la physique de js/car.js, transcrite de godot/scripts/voiture.gd ligne pour ligne.
#pragma once
#include "piste.hpp"
#include <vector>

namespace grip {

struct Hasard {
	uint32_t etat = 1;
	double random() {
		etat = etat ^ (etat << 13);
		etat = etat ^ (etat >> 17);
		etat = etat ^ (etat << 5);
		return double(etat) / 4294967296.0;
	}
};

struct Modele {
	double vmax, accel, brake, grip, df, laneK, rearBias, cliff, slipPeak, length, width;
	bool aCourbe = false;
	double dcFrom = 0, dcTo = 0, dcLow = 1, dcHigh = 1;
	double driveFactor(double speed) const {
		if (!aCourbe) return 1.0;
		double t = maxf(0, minf(1, (speed - dcFrom) / (dcTo - dcFrom)));
		return dcLow + (dcHigh - dcLow) * t * t * (3 - 2 * t);
	}
};

// Les constantes de js/car.js
namespace K {
const double KERB_ADHERENCE = 0.88, ARRET_LIBRE = 0.55, TRANSFERT_AV = 0.62, FREIN_MIN = 0.5, FREIN_MAX = 1.6;
const double B_rebond = 1.05, B_douceur = 9.0, B_pneus = 0.62, B_glisseRail = 0.78, B_glissePneus = 0.52, B_lacet = 0.35, B_seuil = 5.0;
const double P_ldK = 0.45, P_ldMin = 6.0, P_ff = 0.3, P_slip = 1.0, P_cliff = 1.0, P_steerRate = 6.0, P_yawK = 2.0, P_wLim = 0.95,
	P_liftOff = 0.16, P_motricite = 1.25, P_drivePriority = 0.15, P_relax = 0.2, P_circle = 0.25, P_selRate = 0.7;
const double L_part = 0.5, L_aMin = 0.8, L_aMax = 6.0, L_vMax = 5.0;
const double M_tauMontee = 0.22, M_tauRetour = 0.10, M_seuil = 0.12, M_perte = 0.38;
const bool G_rattrapage = true;
const double G_seuilTravers = 0.15, G_freinTravers = 0.3;
const double A_k = 1.4, A_c = 1.0, A_devant = 0.0, A_max = 0.3, A_lache = 1.0, A_reprend = 0.5, A_derive = 1.3;
const double IA_aimant = 1.0;
const double AI_GLISSE0 = 0.28, AI_GLISSE1 = 0.55, AI_USAGE = 0.8;
const double RESSENTI[4][2] = {{0.00, 0.62}, {0.80, 1.30}, {1.30, 2.50}, {0.44, 0.87}};
// les dégâts et les stands (js/car.js, essai des dégâts)
const double FLANC_SEUIL = 6.0, ABANDON_VITESSE = 100.0 / 3.6, CHOC_SEUIL_USURE = 3.5;
const int E_zones = 8;
const double E_creux = 0.0075, E_max = 0.3, E_voisines = 0.35;
const double E_durete[8] = {0.3, 0.6, 1.4, 0.6, 0.3, 0.6, 1.4, 0.6};
const double S_vitesse = 22.0, S_reparationBase = 1.5, S_reparation = 6.5, S_seuilArret = 3.0;
}

// La tôle (DEGATS) : vide quand la course n'a pas de dégâts.
struct Tole { bool ok = false; double chocSeuil = 3.5, vmax = 0.35; bool abandon = false; };
// Un choc, pour le dessin seulement (le rendu les lit puis les vide) : dans le repère de la voiture.
struct Choc { double nx, ny, v, frotte; int sorte; bool epave; };   // sorte : 0 rail, 1 pneus, 2 voiture

// js/car.js, zoneEnfonce ; Math.round : le demi vers +∞.
inline int zoneEnfonce(double lx, double ly) {
	int n = K::E_zones;
	double px = -clamp_(lx * 1.8, -1, 1), py = -clamp_(ly * 1.8, -1, 1);
	int z = int(std::floor(std::atan2(py, px) / (2 * PI_ / n) + 0.5));
	return ((z % n) + n) % n;
}

struct Voiture {
	const Piste *track = nullptr;
	Modele cls{};
	Hasard *hasard = nullptr;
	double gripBoost = 1.0, freinRatio = 1.0;
	double s = 0, lat = 0, x = 0, y = 0, th = 0, v = 0, vl = 0, w = 0, delta = 0, beta = 0, usage = 0;
	double Ff = 0, Fr = 0, alphaF = 0, alphaR = 0, slide = 0, patine = 0, glisseArr = 0, patineFx = 0, ressenti = 0;
	bool surKerb = false, herbe = false;
	double grassT = 0;
	int rejoined = 0, crashes = 0, barrierHits = 0;
	double engineCut = 0;
	bool engineStopped = false;
	double lastImpact = 0, sel = 0, selS = 0, selV = 0, laneTarget = 0;
	bool started = false, checkpoint = false;
	int lap = 0;
	std::vector<double> lapTimes;
	std::vector<bool> lapOk;
	bool lapSale = false;
	double bestLap = -1.0, lapStart = 0, throttle = 0, offT = 0;
	bool braking = false;
	// la course
	bool isPlayer = false, finished = false, fantome = false, blueFlag = false, draft = false, aiDriven = false, accroche = true, aiLeve = false;
	double skill = 0.5, finishTime = -1.0, repris = 0, sortieS0 = NAN, sortieT = 0;
	int fautes = 0, sortieI = 0, passSide = 0;
	double bestLapBrut = -1.0, gridLat = NAN, passTimer = 0, aiTimer = 0, aiNoise = 0, aiAllow = INFINITY, ecartAv = NAN, aimantF = 0;
	// les dégâts et les stands
	Tole degats;
	float enfoncement[8] = {0, 0, 0, 0, 0, 0, 0, 0};   // Float32Array dans le jeu web
	double damage = 0, tyre = 1, abandonT = 0, pitT = 0, pitT0 = 0;
	bool abandon = false, pitAsk = false, pitServi = false, inPit = false;
	int pitState = 0;   // 0 aucun, 1 voie, 2 arrêt
	int pitsDone = 0, reculChoc = 0;
	std::vector<Choc> chocs;

	double damageFactor() const { return degats.ok ? 1.0 - degats.vmax * damage : 1.0; }
	void enfonce(double nx, double ny, double force) {
		if (!(force > 0)) return;
		double cs = std::cos(th), sn = std::sin(th);
		double lx = nx * cs + ny * sn, ly = -nx * sn + ny * cs;
		int k = zoneEnfonce(lx, ly);
		double creux = K::E_creux * force;
		int zs[3] = {k, (k + 1) % K::E_zones, (k + K::E_zones - 1) % K::E_zones};
		double parts[3] = {1.0, K::E_voisines, K::E_voisines};
		for (int q = 0; q < 3; q++) {
			int z = zs[q];
			enfoncement[z] = float(minf(K::E_max, double(enfoncement[z]) + creux * parts[q] * K::E_durete[z]));
		}
		double m = 0;
		for (int z = 0; z < K::E_zones; z++) m = maxf(m, double(enfoncement[z]));
		damage = clamp_(m / K::E_max, 0, 1);
	}
	void marque(double nx, double ny, double vitesse, double frotte, int sorte, bool epave = false) {
		if (chocs.size() >= 12 || fantome) return;
		double cs = std::cos(th), sn = std::sin(th);
		chocs.push_back({nx * cs + ny * sn, -nx * sn + ny * cs, vitesse, frotte, sorte, epave});
	}

	static double wrapAngle(double a) { while (a > PI_) a -= 2 * PI_; while (a < -PI_) a += 2 * PI_; return a; }
	static double smoothstep_(double xx, double a, double b) { double t = clamp_((xx - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
	static double cornerSpeedFor(const Modele &c, double kk, double boost = 1.0) {
		if (kk < 1e-5) return INFINITY;
		double g = c.grip * boost, capped = std::sqrt(2.8 * g / kk);
		if (kk - c.df > 1e-6) return minf(std::sqrt(g / (kk - c.df)), capped);
		return capped;
	}
	static double pente(double val, int i) { return clamp_((val - K::RESSENTI[i][0]) / (K::RESSENTI[i][1] - K::RESSENTI[i][0]), 0, 1); }
	double aimant() const { return isPlayer ? 0.0 : K::IA_aimant; }
	double cornerSpeed(double kk) const { return cornerSpeedFor(cls, kk, gripBoost); }
	double progress() const { return (lap - (started ? 0 : 1)) * track->length + track->wrap_(s); }
	double dir() const { return v == 0.0 ? 1.0 : sgn(v); }
	double gripAt(double vv) const { double g = cls.grip * gripBoost; return g + minf(cls.df * vv * vv, g * 1.8); }

	void place(double s0, double lat0, double v0) {
		double px, py; track->pos2(s0, lat0, px, py);
		s = track->wrap_(s0); lat = lat0; x = px; y = py; th = track->headingAt(s0);
		v = v0; vl = 0; w = 0; delta = 0; beta = 0; usage = 0; slide = 0; ressenti = 0; Ff = 0; Fr = 0;
		selS = sel; selV = 0; accroche = true; aimantF = 0; ecartAv = NAN;
		patine = 0; patineFx = 0; glisseArr = 0;
		engineCut = 0; engineStopped = false;
	}

	void advance(double dss, double raceTime) {
		const Piste &T = *track;
		double before = T.wrap_(s), after = before + dss;
		if (finished) { s = T.wrap_(after); return; }
		if (before < T.length / 2 && after >= T.length / 2) checkpoint = true;
		if (after >= T.length) {
			if (!checkpoint && started) { s = T.wrap_(after); return; }
			checkpoint = false;
			if (started) {
				double lt = raceTime - lapStart;
				lapTimes.push_back(lt);
				lapOk.push_back(!lapSale);
				if (!lapSale && (bestLap < 0 || lt < bestLap)) bestLap = lt;
				if (bestLapBrut < 0 || lt < bestLapBrut) bestLapBrut = lt;
				lap += 1;
				lapSale = false;
			} else { started = true; lapSale = false; }
			lapStart = raceTime;
		}
		s = T.wrap_(after);
	}

	double desiredCurvature() const {
		const Piste &T = *track;
		double sp = maxf(0, v);
		double Ld = clamp_(K::P_ldK * sp + 4, K::P_ldMin, 45);
		double sAhead = s + Ld;
		double latT = !std::isnan(gridLat) ? gridLat : T.targetLat(sAhead, selS);
		double px, py; T.pos2(sAhead, latT, px, py);
		double dx = px - x, dy = py - y;
		double dist = hypot_(dx, dy);
		if (dist == 0.0) dist = 1e-6;
		double alpha = wrapAngle(std::atan2(dy, dx) - th);
		if (std::fabs(alpha) > PI_ / 2) return sgn(alpha) * 0.25;
		double kPursuit = 2 * std::sin(alpha) / dist;
		double ff = K::P_ff;
		double kFF = ff ? T.lineCurv(s + Ld * 0.4, selS) : 0.0;
		return clamp_(kPursuit + ff * kFF, -0.25, 0.25);
	}

	void leaveTrack() {
		if (herbe) return;
		herbe = true; grassT = 0; crashes += 1;
		if (!finished) fautes += 1;
		lapSale = true;
	}

	Coup barrierHit(double fx, double fy, double fth, std::vector<int> &cand) const {
		const Piste &T = *track;
		double pad = cls.length / 2 + cls.width / 2;
		T.barrierCandidates(fx, fy, x, y, pad, cand);
		Coup best;
		if (cand.empty()) return best;
		double r = cls.width / 2, arm = maxf(0, cls.length / 2 - r);
		int niveau = T.barrierLevelAt(s);
		for (double d : {-arm, 0.0, arm}) {
			double bx = fx + std::cos(fth) * d, by = fy + std::sin(fth) * d;
			double dx = x + std::cos(th) * d - bx, dy = y + std::sin(th) * d - by;
			for (int b : cand) {
				if (int(T.blevel[b]) != niveau) continue;
				Coup hit = T.sweepBarrier(bx, by, dx, dy, b, r);
				if (hit.ok && (!best.ok || hit.t < best.t)) { best = hit; best.b = b; }
			}
		}
		return best;
	}

	bool barrierContact(double fx, double fy, double fth, double raceTime, std::vector<int> &cand) {
		const Piste &T = *track;
		Coup hit = barrierHit(fx, fy, fth, cand);
		if (!hit.ok) return false;
		double hnx = hit.nx, hny = hit.ny;
		int b = hit.b;
		double vx = v * std::cos(th) + vl * std::sin(th);
		double vy = v * std::sin(th) - vl * std::cos(th);
		double impact = maxf(0, -vx * hnx - vy * hny);
		bool pneus = T.bpneus[b] == 1;
		x = fx + (x - fx) * hit.t + hnx * (hit.depth + .035);
		y = fy + (y - fy) * hit.t + hny * (hit.depth + .035);
		th = wrapAngle(fth + wrapAngle(th - fth) * hit.t);
		double tx = -hny, ty = hnx;
		double vt = vx * tx + vy * ty;
		double rendu = impact * K::B_rebond * std::exp(-impact / K::B_douceur) * (pneus ? K::B_pneus : 1.0);
		double glisse = vt * (pneus ? K::B_glissePneus : K::B_glisseRail);
		double wx = hnx * rendu + tx * glisse, wy = hny * rendu + ty * glisse;
		double cs = std::cos(th), sn = std::sin(th);
		v = wx * cs + wy * sn; vl = wx * sn - wy * cs;
		w *= K::B_lacet; Ff = 0; Fr = 0;
		slide = 0; patine = 0; patineFx = 0; throttle = 0; braking = false;
		bool fatal = false;
		if (!engineStopped) {
			double effective = impact * (pneus ? .55 : 1.0);
			barrierHits += 1;
			lastImpact = impact;
			if (impact > K::B_seuil) {
				engineCut = clamp_(.25 + 2 * std::pow(effective / 20, 2), .25, 5);
				engineStopped = true;
			}
			leaveTrack();
			if (degats.ok) {
				enfonce(hnx, hny, effective - degats.chocSeuil);
				if (degats.abandon && effective >= K::ABANDON_VITESSE) {
					fatal = true; abandon = true; damage = 1.0;
					for (int z = 0; z < K::E_zones; z++) enfoncement[z] = float(K::E_max);
					engineCut = INFINITY; engineStopped = true;
				}
			}
		}
		marque(hnx, hny, impact * (pneus ? .55 : 1.0), std::fabs(vt), pneus ? 1 : 0, fatal);
		Projection pr = T.project(x, y, s, 30);
		double dss = T.diff(s, pr.s);
		if (raceTime >= 0 && dss > 0 && dss < 6) advance(dss, raceTime);
		else s = pr.s;
		lat = pr.lat;
		return true;
	}

	void update(double dt, double throttleIn, double raceTime, std::vector<int> &cand);
	void steer(const std::vector<Voiture *> &cars, double dt, bool ai);
	void versLigne(double cible, double dt);
};

} // namespace grip
