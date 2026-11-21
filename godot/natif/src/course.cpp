#include "course.hpp"

namespace grip {

void Course::step(double gaz) {
	evenements.clear();
	if (state == 0) {
		countdown -= dt;
		if (countdown <= 0) {
			state = 1;
			evenements.push_back({0, -1});
			for (auto *car : cars) car->gridLat = NAN;
		}
		for (auto *car : cars) car->throttle = car->isPlayer ? gaz : (countdown < 1.2 ? 1.0 : 0.0);
		return;
	}
	if (state == 3) return;
	simulate(gaz);
	// le joueur a abandonné : l'épave reste à l'écran sept secondes, puis la course se termine
	if (state == 1 && cars[player]->abandon) { state = 2; finishTimer = 7.0; }
	if (state == 2) {
		finishTimer -= dt;
		if (finishTimer <= 0 || tousArrives()) finish();
	}
}

void Course::decidePit(Voiture &car) {
	if (car.pitAsk || car.pitState != 0 || (car.tyre > 0.999 && car.damage < 0.001)) return;
	int reste = laps - car.lap;
	if (reste < 3) return;
	double seuil = 0.24 + car.skill * 0.16;
	if (car.tyre < seuil || car.damage > 0.45) car.pitAsk = true;
}

void Course::projetteArrivees() {
	double total = laps * track.length;
	for (auto *c : cars) {
		if (c->finished || c->abandon) continue;
		double moyenne = maxf(5, c->progress() / maxf(1, time));
		c->finishTime = time + maxf(0, total - c->progress()) / moyenne;
		c->finished = true;
	}
}

void Course::simulate(double gaz) {
	const Piste &T = track;
	Voiture &P = *cars[player];
	if (fantome >= 0 && time >= sillageN * sillagePas) {
		sillageJoueur.push_back(P.progress()); sillageFantome.push_back(cars[fantome]->progress()); sillageN += 1;
	}
	time += dt;
	flagsUpdate();
	double pp = P.progress();
	// le trafic que l'IA regarde : ni le fantôme, ni une épave
	bool epave = false;
	for (auto *k : sansFantome) if (k->abandon) { epave = true; break; }
	std::vector<Voiture *> filtre;
	if (epave) for (auto *k : sansFantome) if (!k->abandon) filtre.push_back(k);
	const std::vector<Voiture *> &trafic = epave ? filtre : sansFantome;
	for (int ic = 0; ic < int(cars.size()); ic++) {
		Voiture &car = *cars[ic];
		car.aiDriven = !car.isPlayer;
		car.steer(car.fantome ? vide : trafic, dt, car.aiDriven);
		if (stands && car.aiDriven && !car.finished && !car.abandon) decidePit(car);
		double thr;
		if (car.isPlayer) thr = car.finished ? (car.v < 15 ? 1.0 : 0.0) : gaz;
		else if (car.fantome) thr = aiThrottle(car, vide, dt, difficile, 0.0) ? 1.0 : 0.0;
		else {
			double gapM = car.progress() - pp;
			double rubber = (car.finished || P.finished) ? 0.0 : clamp_(-gapM / 4000, -0.05, 0.03);
			thr = (aiThrottle(car, trafic, dt, difficulte, rubber) && !car.finished) ? 1.0 : 0.0;
			if (car.finished) thr = car.v < 15 ? 1.0 : 0.0;
		}
		bool wasOff = car.herbe;
		int hitsBefore = car.barrierHits, lapBefore = car.lap;
		car.update(dt, thr, time, cand);
		if (car.barrierHits > hitsBefore || (!wasOff && car.herbe)) evenements.push_back({1, ic});
		comptePenalite(car);
		flagsInspect(car, ic);
		if (car.lap != lapBefore) {
			evenements.push_back({2, ic});
			if (modeCourse && car.lap >= laps && !car.finished) {
				car.finished = true;
				car.finishTime = time;
				evenements.push_back({3, ic});
				if (car.isPlayer && state == 1) { state = 2; finishTimer = 4.0; }
			}
		}
	}
	flagsUpdate();
	if (modeCourse) {
		std::vector<double> avant;
		if (T.nb) for (auto *k : cars) { avant.push_back(k->x); avant.push_back(k->y); avant.push_back(k->th); }
		resolveCollisions(cars, T);
		if (T.nb) {
			for (int i = 0; i < int(cars.size()); i++) {
				Voiture &car = *cars[i];
				int hits = car.barrierHits;
				car.barrierContact(avant[i * 3], avant[i * 3 + 1], avant[i * 3 + 2], -1, cand);
				if (car.engineStopped) { car.v = 0; car.vl = 0; car.w = 0; }
				if (car.barrierHits > hits) evenements.push_back({1, i});
			}
		}
	}
}

void Course::finish() {
	double extra = 0.0;
	bool parti = cars[player]->abandon;
	while (!parti && !tousArrives() && extra < 180) { simulate(0.0); extra += dt; }
	if (parti) projetteArrivees();
	evenements.clear();
	state = 3;
}

void Course::comptePenalite(Voiture &car) {
	if (car.finished) return;
	if (car.herbe) {
		if (std::isnan(car.sortieS0)) { car.sortieS0 = car.progress(); car.sortieT = 0; car.sortieI = track.idx(car.s); }
		car.sortieT += dt;
		return;
	}
	if (std::isnan(car.sortieS0)) return;
	double gagnes = car.progress() - car.sortieS0;
	double ref = tempsSurPiste(car.sortieI, gagnes);
	car.repris += maxf(0, ref - car.sortieT);
	car.sortieS0 = NAN;
}

double Course::tempsSurPiste(int i0, double d) const {
	if (!(d > 0)) return 0.0;
	int N = track.n;
	double t = 0.0;
	long long m = (long long)std::llround(d / track.ds);
	// roundi de GDScript : au plus proche, les demis vers l'extérieur — comme llround.
	for (long long k = 0; k < m; k++) t += track.ds / maxf(4, profilRacing[(i0 + k) % N]);
	return t;
}

void Course::flagsInspect(Voiture &c, int i) {
	bool pen = c.fautes > obsFautes[i] || c.repris > obsRepris[i] + .001;
	bool invalid = !modeCourse && c.lapSale && obsInvalid[i] == 0;
	if ((pen || invalid) && state != 0 && !c.finished) penalties[i] = time + 5.0;
	obsFautes[i] = c.fautes; obsRepris[i] = c.repris; obsInvalid[i] = c.lapSale ? 1 : 0;
}

void Course::flagsUpdate() {
	double now = time;
	bool actif = state == 1 || state == 2;
	zones = 0; zonesS.clear();
	for (int i = 0; i < int(cars.size()); i++) {
		Voiture &c = *cars[i];
		if (c.fantome) { c.blueFlag = false; continue; }
		flagsInspect(c, i);
		if (actif && c.herbe && !c.finished) {
			if (!offSince.count(i)) offSince[i] = now;
			if (now - offSince[i] >= 3.0) { zones++; zonesS.push_back(c.s); }
		} else offSince.erase(i);
		bool bleu = false;
		if (actif && modeCourse && !c.finished) {
			for (auto *o : cars) {
				if (o == &c || o->finished || !o->started) continue;
				if (o->progress() - c.progress() < track.length * .5) continue;
				double gap = track.diff(o->s, c.s);
				double longueur = (c.cls.length + o->cls.length) / 2;
				double closing = maxf(0, o->v - c.v);
				double portee = clamp_(closing * 2 + longueur * 2, 12, 100);
				if ((gap >= 0 && gap < portee && (closing > .5 || gap < longueur * 2)) || std::fabs(gap) < longueur * 1.5) { bleu = true; break; }
			}
			if (bleu) blueUntil[i] = now + 1.2;
			auto it = blueUntil.find(i);
			bleu = (it != blueUntil.end() ? it->second : 0.0) > now;
			if (!bleu && c.blueFlag) {
				for (auto *o : cars) {
					if (o != &c && std::fabs(track.diff(c.s, o->s)) < (c.cls.length + o->cls.length) / 2 + .3
							&& std::fabs(c.lat - o->lat) < (c.cls.width + o->cls.width) / 2 + .2) {
						blueUntil[i] = now + .25; bleu = true; break;
					}
				}
			}
		}
		c.blueFlag = bleu;
	}
	if (actif && modeCourse)
		for (auto *c : cars) if (c->started && c->lap >= laps - 1) { chequered = true; break; }
}

double Course::ecartFantome() const {
	if (fantome < 0 || sillageN < 2) return 0.0;
	const Voiture &f = *cars[fantome], &p = *cars[player];
	bool fDevant = f.progress() >= p.progress();
	const std::vector<double> &trace = fDevant ? sillageFantome : sillageJoueur;
	double ici = fDevant ? p.progress() : f.progress();
	int k = sillageN - 1;
	while (k > 0 && trace[k] > ici) k -= 1;
	bool dernier = k + 1 >= sillageN;
	double suite = dernier ? (fDevant ? f.progress() : p.progress()) : trace[k + 1];
	double tSuite = dernier ? time : (k + 1) * sillagePas;
	double part = suite > trace[k] ? clamp_((ici - trace[k]) / (suite - trace[k]), 0, 1) : 0.0;
	double ecart = maxf(0, time - (k * sillagePas + part * (tSuite - k * sillagePas)));
	return fDevant ? ecart : -ecart;
}

bool Course::aiThrottle(Voiture &car, const std::vector<Voiture *> &cars_, double dt_, const Niveau &opts, double rubber) {
	const Modele &c = car.cls;
	const Piste &T = *car.track;
	if (std::fabs(car.beta) > 0.6 || car.v < -0.5) return false;
	car.aiTimer -= dt_;
	if (car.aiTimer <= 0) {
		car.aiTimer = 0.12;
		car.aiNoise = (car.hasard->random() - 0.5) * 0.03;
		double margin = minf(opts.maxMargin, (opts.marginBase + car.skill * opts.marginSpread) + car.aiNoise + rubber);
		double brake = c.brake * 0.88;
		double v = maxf(0, car.v);
		double allow = c.vmax * minf(1, (std::isnan(opts.paceBase) ? 1.0 : opts.paceBase + car.skill * opts.paceSpread) + rubber);
		double maxD = v * v / (2 * brake) + 40;
		for (int d = 0; d < maxD; d += 3) {
			double k = std::fabs(d < 6 ? T.curvAtLat(car.s + d, car.lat) : T.lineCurv(car.s + d, car.selS));
			if (k >= 1e-4) {
				double vc = car.cornerSpeed(k) * margin;
				if (vc < c.vmax) { double a = std::sqrt(vc * vc + 2 * brake * d); if (a < allow) allow = a; }
			}
		}
		for (auto *o : cars_) {
			if (o == &car) continue;
			double dd = T.diff(car.s, o->s);
			double lenSum = (c.length + o->cls.length) / 2;
			if (dd >= lenSum && dd < c.length * 1.2 + v * 0.15 && std::fabs(o->lat - car.lat) < (c.width + o->cls.width) * 0.5 + 0.3)
				if (o->v + 0.5 < allow) allow = minf(allow, o->v + 0.5);
		}
		car.aiAllow = allow;
	}
	if (car.glisseArr > K::AI_GLISSE1) car.aiLeve = true;
	else if (car.glisseArr < K::AI_GLISSE0) car.aiLeve = false;
	if (car.aiLeve) return false;
	if (car.usage > K::AI_USAGE) return false;
	return car.v < car.aiAllow - 0.3;
}

void Course::resolveCollisions(std::vector<Voiture *> &cs, const Piste &T) {
	int n = int(cs.size());
	for (auto *c : cs) if (c->reculChoc > 0) c->reculChoc--;
	for (int i = 0; i < n; i++) {
		Voiture &a = *cs[i];
		for (int j = i + 1; j < n; j++) {
			Voiture &b = *cs[j];
			if (a.blueFlag || b.blueFlag) continue;
			if (a.abandon || b.abandon) continue;
			if (a.inPit || b.inPit) continue;
			double d = T.diff(a.s, b.s);
			double lenSum = (a.cls.length + b.cls.length) / 2;
			if (std::fabs(d) >= lenSum) continue;
			double dl = b.lat - a.lat;
			double wSum = (a.cls.width + b.cls.width) / 2;
			if (std::fabs(dl) >= wSum) continue;
			double longOverlap = lenSum - std::fabs(d), latOverlap = wSum - std::fabs(dl);
			double h = T.headingAt(a.s);
			double tx = std::cos(h), ty = std::sin(h), nx = std::sin(h), ny = -std::cos(h);
			if (longOverlap < latOverlap * 2.2) {
				Voiture &rear = d > 0 ? a : b, &front = d > 0 ? b : a;
				if (rear.v > front.v) {
					double dv = rear.v - front.v;
					const Tole &ur = rear.degats, &uf = front.degats;
					double fort = maxf(0, dv - (ur.ok ? ur.chocSeuil : 0.0));
					bool enFace = latOverlap > 0.5 * minf(a.cls.width, b.cls.width);
					double ux = front.x - rear.x, uy = front.y - rear.y, ul = hypot_(ux, uy);
					if (ul == 0.0) ul = 1;
					double rx = enFace ? -std::cos(rear.th) : -ux / ul, ry = enFace ? -std::sin(rear.th) : -uy / ul;
					double fx = enFace ? std::cos(front.th) : ux / ul, fy = enFace ? std::sin(front.th) : uy / ul;
					bool ra = rear.abandon, fa = front.abandon;
					if (ur.ok) rear.enfonce(rx, ry, fort);
					if (uf.ok) front.enfonce(fx, fy, fort * 0.6);
					rear.marque(rx, ry, dv, 0, 2, rear.abandon && !ra);
					front.marque(fx, fy, dv, 0, 2, front.abandon && !fa);
					front.v += dv * 0.35;
					rear.v = front.v - dv * 0.1;
					double push = minf(longOverlap / 2, 0.1);
					rear.x -= tx * push; rear.y -= ty * push;
					front.x += tx * push; front.y += ty * push;
				}
			} else {
				double dir = dl >= 0 ? 1.0 : -1.0, sep = minf(latOverlap / 2, 0.1);
				if (a.reculChoc <= 0 && b.reculChoc <= 0) {
					double vxa = a.v * std::cos(a.th) + a.vl * std::sin(a.th), vya = a.v * std::sin(a.th) - a.vl * std::cos(a.th);
					double vxb = b.v * std::cos(b.th) + b.vl * std::sin(b.th), vyb = b.v * std::sin(b.th) - b.vl * std::cos(b.th);
					double rapproche = ((vxa - vxb) * nx + (vya - vyb) * ny) * dir;
					double glisse = std::fabs((vxa - vxb) * tx + (vya - vyb) * ty);
					if (rapproche > 1.5 || glisse > 6) {
						Voiture *paire[2] = {&a, &b};
						double sgs[2] = {-1.0, 1.0};
						for (int q = 0; q < 2; q++) {
							Voiture &c = *paire[q];
							double sg = sgs[q];
							const Tole &u = c.degats;
							double fort = maxf(0, rapproche - K::FLANC_SEUIL);
							bool ca = c.abandon;
							if (u.ok) c.enfonce(nx * dir * sg, ny * dir * sg, fort);
							double vu = maxf(0, rapproche - (K::FLANC_SEUIL - (u.ok ? u.chocSeuil : K::CHOC_SEUIL_USURE)));
							c.marque(nx * dir * sg, ny * dir * sg, vu, glisse, 2, c.abandon && !ca);
							c.reculChoc = 30;
						}
					}
				}
				a.x -= nx * dir * sep; a.y -= ny * dir * sep;
				b.x += nx * dir * sep; b.y += ny * dir * sep;
				a.vl = clamp_(a.vl - dir * 0.25, -3, 3); b.vl = clamp_(b.vl + dir * 0.25, -3, 3);
				a.w = clamp_(a.w - dir * 0.05, -3, 3); b.w = clamp_(b.w + dir * 0.05, -3, 3);
				a.v *= 0.995; b.v *= 0.995;
			}
		}
	}
}

} // namespace grip
