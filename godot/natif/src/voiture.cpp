// js/car.js, update / steer / _versLigne — transcrits de godot/scripts/voiture.gd.
#include "voiture.hpp"

namespace grip {

void Voiture::update(double dt, double throttleIn, double raceTime, std::vector<int> &cand) {
	const Piste &T = *track;
	const Modele &c = cls;
	if (abandon) abandonT += dt;
	bool wasStopped = engineStopped;
	engineCut = maxf(0, engineCut - dt);
	engineStopped = engineCut > 1e-6;
	if (wasStopped && !engineStopped) { th = T.headingAt(s); delta = 0; Ff = 0; Fr = 0; }
	double thr = throttleIn;
	// la voie des stands, AVANT l'accélérateur (voir voiture.gd)
	ZoneStand zone = degats.ok ? T.pitAt(s) : ZoneStand();
	inPit = zone.ok && (pitAsk || pitState != 0);
	if (inPit) {
		if (pitState == 0) pitState = 1;
		if (pitState == 1 && !pitServi && zone.dansZone && std::fabs(v) < K::S_seuilArret) {
			pitState = 2;
			pitT = K::S_reparationBase + K::S_reparation * damage;
			pitT0 = pitT;
		}
	} else if (pitState == 1 && !zone.ok) {
		pitState = 0;
		pitAsk = false;
	}
	if (!zone.ok) pitServi = false;
	if (inPit && aiDriven) {
		if (pitState == 1 && zone.boite < 0 && !pitServi) {
			double reste = maxf(0, -zone.boite);
			double vCible = minf(K::S_vitesse, std::sqrt(2 * c.brake * 0.8 * reste));
			thr = v < vCible * 0.92 ? 1.0 : 0.0;
		} else if (pitState == 1) thr = v < K::S_vitesse * 0.95 ? 1.0 : 0.0;
		else thr = 0.0;
	}
	if (inPit && pitState != 2 && v > K::S_vitesse) thr = 0.0;
	if (pitState == 2) {
		pitT -= dt;
		v = 0; vl = 0; w = 0;
		if (pitT <= 0) {
			tyre = 1; damage = 0;
			for (int z = 0; z < K::E_zones; z++) enfoncement[z] = 0;
			pitsDone += 1;
			pitState = 1;
			pitAsk = false;
			pitServi = true;
		}
	}
	if (engineStopped) thr = 0;
	thr = clamp_(thr, 0, 1);
	throttle = thr;
	offT = thr != 0.0 ? 0.0 : offT + dt;
	braking = thr == 0.0 && offT > 0.05 && v > 2;
	double hwLs = T.hwLeftAt(s), hwRs = T.hwRightAt(s), kb = T.kerbAt(s);
	double marge = c.width * 0.3;
	bool horsRoute = !inPit && (lat > hwLs + marge || lat < -(hwRs + marge));
	bool off = !inPit && (lat > hwLs + kb + marge || lat < -(hwRs + kb + marge));
	bool loose = off && !T.runoffAsphaltAt(s, lat);
	surKerb = horsRoute && !off;
	if (off) leaveTrack();
	if (!off && !engineStopped) herbe = false;
	if (herbe) grassT += dt;
	if (grassT > 8 && !engineStopped) {
		double edge = clamp_(lat, -(T.hwRightAt(s) - c.width), T.hwLeftAt(s) - c.width);
		place(s, edge, minf(8, std::fabs(v)));
		herbe = false; grassT = 0; rejoined += 1;
		return;
	}
	if (engineStopped) {
		double frein = std::exp(-dt / K::ARRET_LIBRE);
		v *= frein; vl *= frein; w *= frein;
		if (std::fabs(v) < 0.05) v = 0;
		if (std::fabs(vl) < 0.05) vl = 0;
		if (std::fabs(w) < 0.02) w = 0;
		th = wrapAngle(th + w * dt);
		double cs0 = std::cos(th), sn0 = std::sin(th);
		double ax0 = x, ay0 = y, ath0 = th;
		x += (v * cs0 + vl * sn0) * dt;
		y += (v * sn0 - vl * cs0) * dt;
		if (T.nb && barrierContact(ax0, ay0, ath0, raceTime, cand)) return;
		Projection prc = T.project(x, y, s, 30);
		if (std::fabs(T.diff(s, prc.s)) < 6) { s = prc.s; lat = prc.lat; }
		return;
	}
	double surface = loose ? 0.42 : (surKerb ? K::KERB_ADHERENCE : 1.0);
	double L = c.length * 0.6, a = L / 2, b = L / 2;
	double kk = std::pow(0.28 * c.length, 2) * (5 / c.laneK);
	bool enTravers = K::G_rattrapage && std::fabs(beta) > K::G_seuilTravers;
	double brakeFrac = thr != 0.0 ? 0.0 : clamp_(offT / 0.1, 0, 1) * (enTravers ? K::G_freinTravers : 1.0);
	double vv = maxf(3, std::fabs(v));
	double peak = c.slipPeak * K::P_slip;
	double gTot = gripAt(std::fabs(v)) * surface;
	double kDes = desiredCurvature();
	if (K::G_rattrapage && (std::fabs(alphaR) > peak || std::fabs(alphaF) > peak)) {
		double kLigne = T.lineCurv(s + 3, selS);
		if (sgn(kDes) == sgn(kLigne) && std::fabs(kDes) > std::fabs(kLigne)) kDes = kLigne;
	}
	double wLim = K::P_wLim * gTot / vv;
	double wDes = clamp_(v * kDes, -wLim, wLim);
	double gAxle = gTot * 0.5 / minf(1, c.rearBias);
	double ayFront = v * v * kDes * 0.5;
	double aFff = peak * ayFront / maxf(1e-3, gAxle);
	double aFdes = clamp_(aFff + K::P_yawK * peak * (wDes - w), -peak * 1.3, peak * 1.3);
	double ufront = (vl - a * w) / vv;
	double steerTarget = std::atan(std::tan(aFdes) - ufront * dir());
	double dMax = 0.5, rate = K::P_steerRate;
	delta += clamp_(clamp_(steerTarget, -dMax, dMax) - delta, -rate * dt, rate * dt);
	usage = v * v * std::fabs(kDes) / maxf(1e-3, gTot);
	double aF = std::atan((vl - a * w + v * std::tan(delta)) / vv);
	double aR = std::atan((vl + b * w) / vv);
	double base = gAxle;
	double cliffF = 1 - c.cliff * K::P_cliff * smoothstep_(std::fabs(aF), peak * 1.5, peak * 5);
	double cliffR = 1 - c.cliff * K::P_cliff * smoothstep_(std::fabs(aR), peak * 1.5, peak * 5);
	double dmg = damageFactor();
	double vmax = c.vmax * dmg * (draft ? 1.05 : 1.0);
	double accDem = thr != 0.0 ? thr * c.accel * c.driveFactor(maxf(0, v)) * dmg * maxf(0, 1 - std::pow(maxf(0, v) / vmax, 2.5)) * (draft ? 1.08 : 1.0) : 0.0;
	double transfert = K::P_liftOff * brakeFrac * clamp_(freinRatio != 0.0 ? freinRatio : 1.0, K::FREIN_MIN, K::FREIN_MAX);
	double gF = base * cliffF * (1 + transfert * K::TRANSFERT_AV);
	double gArrBrut = base * c.rearBias * (1 - transfert);
	double latPris = minf(1, std::fabs(aR) / peak);
	double longDispo = gArrBrut * K::P_motricite * std::sqrt(maxf(0, 1 - latPris * latPris));
	double qy = clamp_(aR / peak, -1, 1);
	double qx = accDem / maxf(1e-3, gArrBrut * cliffR * K::P_motricite);
	double share = loose ? 1.0 : 1 / maxf(1, hypot_(qx, qy));
	double sature = (loose || accDem <= 0) ? 0.0 : clamp_((1 - share) / K::M_seuil, 0, 1);
	double tau = sature > glisseArr ? K::M_tauMontee : K::M_tauRetour;
	glisseArr += (sature - glisseArr) * (1 - std::exp(-dt / tau));
	double priority = K::P_drivePriority;
	double safeDrive = minf(accDem, longDispo * cliffR);
	double accReel = loose ? accDem : safeDrive * (1 - priority) + accDem * share * priority;
	patine = (loose || accDem <= 0) ? 0.0 : clamp_(1 - accReel / accDem, 0, 1);
	double spinFx = (!loose && !inPit && accDem > 0) ? clamp_(1 - accReel / accDem, 0, 1) : 0.0;
	double spinTau = spinFx > patineFx ? 0.035 : 0.08;
	patineFx += (spinFx - patineFx) * (1 - std::exp(-dt / spinTau));
	double gR = gArrBrut * cliffR * (loose ? 1.0 : 1 - priority + priority * share) * (loose ? 1.0 : 1 - K::M_perte * glisseArr);
	double FfT = -gF * clamp_(aF / peak, -1, 1);
	double FrT = -gR * clamp_(aR / peak, -1, 1);
	double relax = minf(1, dt * vv / K::P_relax);
	Ff += (FfT - Ff) * relax;
	Fr += (FrT - Fr) * relax;
	double Fm = 0.0;
	double aim = aimant();
	if (aim > 0 && !off && std::fabs(v) > 3 && !inPit) {
		double latCible = !std::isnan(gridLat) ? gridLat : T.targetLat(s, selS);
		double ecart = latCible - lat;
		double dEcart = std::isnan(ecartAv) ? 0.0 : (ecart - ecartAv) / maxf(1e-4, dt);
		double plafond = K::A_max * gTot * aim;
		double tension = K::A_k * ecart;
		double demande = tension + K::A_c * dEcart;
		if (accroche) {
			if (std::fabs(tension) > plafond * K::A_lache) accroche = false;
			else Fm = clamp_(demande, -plafond, plafond);
		} else if (std::fabs(tension) < plafond * K::A_reprend && std::fabs(aR) < peak * K::A_derive) {
			accroche = true;
			Fm = clamp_(demande, -plafond, plafond);
		}
		ecartAv = ecart;
	} else { accroche = true; ecartAv = NAN; }
	aimantF = Fm;
	double aAim = L / 2;
	double FmAv = Fm * (1 + K::A_devant / aAim) / 2;
	double FmAr = Fm * (1 - K::A_devant / aAim) / 2;
	double useF = std::fabs(Ff) / maxf(1e-3, gF), useR = std::fabs(Fr) / maxf(1e-3, gR);
	double u = minf(1, maxf(useF, useR));
	double acc;
	double dr = dir();
	if (thr != 0.0) acc = accReel * (loose ? maxf(0.3, 1 - K::P_circle * u * u) : 1.0);
	else acc = -(1.5 + c.brake * brakeFrac) * (1 - K::P_circle * u * u) * (v > 1 ? 1.0 : maxf(0, v));
	double latDrag = 0.0;
	if (loose) {
		double sp = hypot_(v, vl);
		if (sp == 0.0) sp = 1e-6;
		double dragA = 5 + 0.15 * sp;
		acc -= dragA * v / sp;
		latDrag = -dragA * vl / sp;
	}
	acc -= (std::fabs(Ff * std::sin(aF)) + std::fabs(Fr * std::sin(aR))) * 0.8 * dr;
	double bx0 = x, by0 = y, bth0 = th;
	double wDot = (-a * (Ff + FmAv) + b * (Fr + FmAr)) / kk;
	w = clamp_(w + wDot * dt, -4, 4);
	th = wrapAngle(th + w * dt);
	double v0 = v, vl0 = vl;
	v = clamp_(v0 + (acc - vl0 * w) * dt, -0.25 * c.vmax, c.vmax * dmg * 1.05);
	if (inPit && v > K::S_vitesse) v = K::S_vitesse;
	if (pitState == 2) v = 0;
	vl = vl0 + (v0 * w + Ff + Fm + Fr) * dt;
	if (latDrag != 0.0) vl += clamp_(latDrag * dt, -std::fabs(vl0), std::fabs(vl0));
	beta = std::atan2(vl, vv) * dir();
	alphaF = aF; alphaR = aR;
	slide = clamp_((maxf(std::fabs(aF), std::fabs(aR)) - peak * 0.8) / (peak * 2.5), 0, 1);
	double gDispo = maxf(1e-3, gTot);
	double charge = std::fabs(Ff + Fr) / gDispo;
	double glisse = maxf(std::fabs(aF), std::fabs(aR)) / maxf(1e-4, peak);
	double travers = th - T.headingAt(s);
	while (travers > PI_) travers -= PI_ * 2;
	while (travers < -PI_) travers += PI_ * 2;
	ressenti = minf(1, 0.25 * (pente(charge, 0) + pente(glisse, 1) + pente(glisse, 2) + pente(std::fabs(travers), 3)));
	double cs = std::cos(th), sn = std::sin(th);
	x += (v * cs + vl * sn) * dt;
	y += (v * sn - vl * cs) * dt;
	if (T.nb && barrierContact(bx0, by0, bth0, raceTime, cand)) return;
	Projection pr = T.project(x, y, s);
	double dss = T.diff(s, pr.s);
	if (std::fabs(dss) < 6) {
		if (dss > 0) advance(dss, raceTime);
		else s = pr.s;
		lat = pr.lat;
	} else advance(maxf(0, v) * dt, raceTime);
}

void Voiture::steer(const std::vector<Voiture *> &cars, double dt, bool ai) {
	const Piste &T = *track;
	const Modele &c = cls;
	if (!std::isnan(gridLat)) { laneTarget = gridLat; selS = sel; return; }
	if (pitAsk || pitState != 0) {
		selS += clamp_(-2 - selS, -K::P_selRate * dt, K::P_selRate * dt); selV = 0;
		laneTarget = T.targetLat(s, selS);
		return;
	}
	Voiture *bl = nullptr, *vo = nullptr;
	double bd = INFINITY, vdl = INFINITY;
	double portee = c.length * 3 + maxf(0, v) * 1.0;
	for (Voiture *o : cars) {
		if (o == this || blueFlag || o->blueFlag) continue;
		double d = T.diff(s, o->s);
		if (d > portee) continue;
		double lenSum = (c.length + o->cls.length) / 2;
		double dl = o->lat - lat;
		double demiLarg = (c.width + o->cls.width) / 2;
		if (std::fabs(d) < lenSum) {
			if (std::fabs(dl) < demiLarg + 0.6 && std::fabs(dl) < std::fabs(vdl)) { vo = o; vdl = dl; }
			continue;
		}
		if (d < lenSum || d >= bd) continue;
		if (o->v > v + 2.5 && d > c.length * 1.5) continue;
		if (std::fabs(dl) < demiLarg * 1.5 + 0.4) { bl = o; bd = d; }
	}
	draft = bl != nullptr && bd < c.length * 3.5 && std::fabs(bl->lat - lat) < c.width * 0.9;
	if (ai) {
		passTimer -= dt;
		if (bl) {
			if (passSide == 0 || passTimer <= 0) {
				double sAv = s + 15;
				int meilleur = 0;
				double place_ = -INFINITY;
				for (int cote : {-1, 1}) {
					double latC = T.targetLat(sAv, cote);
					double room = std::fabs(latC - T.targetLat(sAv, bl->selS));
					for (Voiture *o : cars) {
						if (o == this || o == bl) continue;
						double d = T.diff(s, o->s);
						if (d > -c.length * 2 && d < 40) room = minf(room, std::fabs(latC - T.targetLat(sAv, o->selS)));
					}
					if (room > place_) { place_ = room; meilleur = cote; }
				}
				passSide = place_ > c.width * 0.9 ? meilleur : 0;
				passTimer = 2 + hasard->random() * 1.5;
			}
			sel = passSide;
		} else if (passSide != 0 && passTimer <= 0) { passSide = 0; sel = 0; }
		else if (bl == nullptr && passSide == 0) sel = 0;
		if (vo) {
			double versVoisin = sgn(vdl);
			double latVise = T.targetLat(s, sel);
			if (sgn(latVise - lat) == versVoisin && std::fabs(latVise - lat) > std::fabs(vdl) - (c.width + vo->cls.width) / 2) sel = selS;
		}
	}
	versLigne(sel, dt);
	laneTarget = T.targetLat(s, selS);
}

void Voiture::versLigne(double cible, double dt) {
	const Piste &T = *track;
	double reste = cible - selS;
	if (std::fabs(reste) < 1e-3 && std::fabs(selV) < 0.05) { selS = cible; selV = 0; return; }
	double latIci = T.targetLat(s, selS), latVise = T.targetLat(s, cible);
	double D = maxf(0.5, std::fabs(reste) > 1e-3 ? std::fabs(latVise - latIci) / std::fabs(reste) : 1.0);
	double vp = maxf(0, v);
	double g = clamp_(glisseArr, 0, 1);
	double aTot = gripAt(vp) * std::sqrt(1 - g * g);
	double kIci = std::fabs(T.lineCurv(s, selS));
	double budget = clamp_(K::L_part * (aTot - vp * vp * kIci), K::L_aMin, K::L_aMax);
	double resteM = reste * D;
	double vVoulue = sgn(resteM) * minf(K::L_vMax, std::sqrt(2 * budget * std::fabs(resteM)));
	double kApres = std::fabs(T.lineCurv(s, selS + sgn(reste) * 0.05));
	if (kApres > kIci && vp * vp * kApres > aTot) vVoulue = 0;
	selV += clamp_(vVoulue - selV, -budget * dt, budget * dt);
	selS += selV / D * dt;
	if ((cible - selS) * reste <= 0) { selS = cible; selV = 0; }
}

} // namespace grip
