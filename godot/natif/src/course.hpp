// La course : js/race.js (grille faite côté GDScript), aiThrottle, resolveCollisions, js/flags.js,
// les pénalités et le fantôme — transcrits de godot/scripts/course.gd.
#pragma once
#include "voiture.hpp"
#include <map>
#include <vector>

namespace grip {

struct Niveau { double marginBase = 0.83, marginSpread = 0.09, paceBase = NAN, paceSpread = 0, maxMargin = 0.98; };
struct Evenement { int type; int car; };   // 0 départ, 1 choc, 2 tour, 3 arrivée

struct Course {
	Piste track;
	std::vector<Voiture> voitures;
	std::vector<Voiture *> cars, sansFantome, vide;
	int player = -1, fantome = -1;
	Hasard hasard;
	Niveau difficulte, difficile;
	bool modeCourse = true, entrainement = false;
	// les dégâts (js/race.js, essai) : la tôle partagée par toutes les voitures, et les stands
	Tole degats;
	bool stands = false;
	int laps = 3;
	double time = 0, countdown = 3.6, finishTimer = 0, dt = 1.0 / 120;
	int state = 0;   // 0 countdown, 1 racing, 2 finishing, 3 finished
	std::vector<double> profilRacing;
	std::vector<Evenement> evenements;
	std::vector<int> cand;
	// les drapeaux
	std::map<int, double> offSince, penalties, blueUntil;
	std::vector<int> obsFautes;
	std::vector<double> obsRepris;
	std::vector<uint8_t> obsInvalid;
	int zones = 0;
	std::vector<double> zonesS;
	bool chequered = false;
	// le fantôme
	double sillagePas = 0.1;
	int sillageN = 0;
	std::vector<double> sillageJoueur, sillageFantome;

	void prepare() {
		cars.clear(); sansFantome.clear();
		for (auto &v : voitures) { v.track = &track; v.hasard = &hasard; v.degats = degats; cars.push_back(&v); }
		for (int i = 0; i < int(cars.size()); i++) if (i != fantome) sansFantome.push_back(cars[i]);
		obsFautes.assign(cars.size(), 0); obsRepris.assign(cars.size(), 0); obsInvalid.assign(cars.size(), 0);
	}

	bool tousArrives() const { for (auto *c : cars) if (!c->finished && !c->abandon) return false; return true; }
	void decidePit(Voiture &car);
	void projetteArrivees();

	void step(double gaz);
	void simulate(double gaz);
	void finish();
	void comptePenalite(Voiture &car);
	double tempsSurPiste(int i0, double d) const;
	void flagsInspect(Voiture &c, int i);
	void flagsUpdate();
	double ecartFantome() const;
	static bool aiThrottle(Voiture &car, const std::vector<Voiture *> &cars_, double dt_, const Niveau &opts, double rubber);
	static void resolveCollisions(std::vector<Voiture *> &cs, const Piste &T);
	// Une voiture seule, pour les parcours de référence : steer puis update.
	void pasSeul(double gaz, double temps) { Voiture &p = *cars[player]; std::vector<Voiture *> seul{&p}; p.steer(seul, dt, false); p.update(dt, gaz, temps, cand); }
};

} // namespace grip
