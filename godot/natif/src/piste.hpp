// La piste : les lectures de js/track.js dont la physique a besoin, transcrites de
// godot/scripts/piste.gd dans le même ordre d'opérations (flottants 64 bits partout).
#pragma once
#include <cmath>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace grip {

inline double clamp_(double v, double a, double b) { return v < a ? a : (v > b ? b : v); }
inline double minf(double a, double b) { return a < b ? a : b; }
inline double maxf(double a, double b) { return a > b ? a : b; }
inline double sgn(double x) { return x > 0 ? 1.0 : (x < 0 ? -1.0 : 0.0); }
const double PI_ = 3.14159265358979323846;

// Math.hypot de V8 : normalisé par le plus grand, sommé avec compensation de Kahan.
inline double hypot_(double a, double b) {
	double x = std::fabs(a), y = std::fabs(b);
	double m = x > y ? x : y;
	if (m == 0.0) return 0.0;
	double n1 = x / m;
	double somme = n1 * n1;
	double comp = (somme - 0.0) - somme;
	double n2 = y / m;
	double terme = n2 * n2 - comp;
	somme = somme + terme;
	return std::sqrt(somme) * m;
}

struct Coup { double t, nx, ny, depth; int b; bool ok = false; };
// Où est la voie des stands à une abscisse (track.js, pitAt) : ok = faux hors de la voie.
struct ZoneStand { bool ok = false; double u = 0, ecart = 0, interne = 0, externe = 0, lat = 0, boite = 0; bool dansZone = false; };
struct Projection { double s; int i; double lat; };

struct Piste {
	int n = 0;
	double ds = 1, length = 0, halfWidth = 0, barrierCell = 16;
	bool asphalte = true;
	std::vector<double> xs, ys, th, nx, ny, k, hwL, hwR, kerb;
	std::vector<double> lRacing, lJaune, lBleu, kRacing, kJaune, kBleu;
	std::vector<double> asphL, asphR, bacL, bacR, crossings;
	// les protections
	int nb = 0;
	std::vector<double> bax, bay, bbx, bby, btx, bty, bnx, bny, blen, bhalf, bs, bside, blevel;
	std::vector<uint8_t> bpneus;
	std::unordered_map<int64_t, std::vector<int>> grille;
	mutable std::vector<int> vu;     // marques pour dédoublonner les candidats
	mutable int tampon = 0;
	struct Plaque { bool gravier; double b[4]; std::vector<double> poly; };
	std::vector<Plaque> plaques;
	// la voie des stands (track.pit) : absente si `aStand` est faux
	bool aStand = false;
	double pEntree = 0, pBoite = 0, pSortie = 0, pLong = 0, pSeparation = 1.2, pLargeur = 6, pZone = 26;

	static int64_t cle(int x, int y) { return (int64_t(x) << 32) ^ int64_t(uint32_t(y)); }

	void construitGrille() {
		grille.clear();
		double C = barrierCell;
		for (int id = 0; id < nb; id++) {
			double h = bhalf[id];
			int x0 = int(std::floor((minf(bax[id], bbx[id]) - h) / C)), x1 = int(std::floor((maxf(bax[id], bbx[id]) + h) / C));
			int y0 = int(std::floor((minf(bay[id], bby[id]) - h) / C)), y1 = int(std::floor((maxf(bay[id], bby[id]) + h) / C));
			for (int x = x0; x <= x1; x++)
				for (int y = y0; y <= y1; y++) grille[cle(x, y)].push_back(id);
		}
		vu.assign(nb, 0);
	}

	double wrap_(double s) const { s = std::fmod(s, length); return s < 0.0 ? s + length : s; }
	int idx(double s) const { return int(std::floor(wrap_(s) / ds)) % n; }
	double lerp_(const std::vector<double> &arr, double s) const {
		double w = wrap_(s) / ds, fl = std::floor(w);
		int i = int(fl) % n, j = (i + 1) % n;
		return arr[i] + (arr[j] - arr[i]) * (w - fl);
	}
	double curvAt(double s) const { return lerp_(k, s); }
	double headingAt(double s) const {
		double w = wrap_(s) / ds, fl = std::floor(w);
		int i = int(fl) % n, j = (i + 1) % n;
		double d = th[j] - th[i];
		while (d > PI_) d -= 2 * PI_;
		while (d < -PI_) d += 2 * PI_;
		return th[i] + d * (w - fl);
	}
	double curvAtLat(double s, double lat) const { double kk = curvAt(s); return kk / maxf(0.25, 1 + kk * lat); }
	double kerbAt(double s) const { return lerp_(kerb, s); }
	double hwLeftAt(double s) const { return lerp_(hwL, s); }
	double hwRightAt(double s) const { return lerp_(hwR, s); }
	ZoneStand pitAt(double s) const {
		ZoneStand z;
		if (!aStand) return z;
		double span = wrap_(pSortie - pEntree), d = wrap_(s - pEntree);
		if (d > span) return z;
		double u = d / span;
		double ecart = minf(1, minf(u / 0.12, (1 - u) / 0.14));
		double dBoite = wrap_(s - pBoite);
		double bord = hwRightAt(s);
		double interne = -(bord + pSeparation * ecart);
		double externe = interne - pLargeur * (0.4 + 0.6 * ecart);
		double boite = dBoite > length / 2 ? dBoite - length : dBoite;
		z.ok = true; z.u = u; z.ecart = ecart; z.interne = interne; z.externe = externe; z.lat = (interne + externe) / 2;
		z.boite = boite; z.dansZone = std::fabs(boite) < pZone;
		return z;
	}
	double targetLat(double s, double sel) const {
		double r = lerp_(lRacing, s);
		if (sel >= 0) return r + (lerp_(lJaune, s) - r) * minf(1, sel);
		double dedans = r + (lerp_(lBleu, s) - r) * minf(1, -sel);
		if (sel > -1) return dedans;
		ZoneStand p = pitAt(s);
		if (!p.ok) return dedans;
		return dedans + (p.lat - dedans) * minf(1, -sel - 1);
	}
	double lineCurv(double s, double sel) const {
		double r = lerp_(kRacing, s);
		if (sel < 0) return r + (lerp_(kBleu, s) - r) * minf(1, -sel);
		return r + (lerp_(kJaune, s) - r) * minf(1, sel);
	}
	double lineLatRacing(double s) const { return lerp_(lRacing, s); }
	Projection project(double x, double y, double nearS, int window = 8) const {
		int N = n, W = window, i0 = idx(nearS), best = i0;
		double bd = INFINITY;
		for (int d = -W; d <= W; d++) {
			int i = ((i0 + d) % N + N) % N;
			double dx = x - xs[i], dy = y - ys[i], dd = dx * dx + dy * dy;
			if (dd < bd) { bd = dd; best = i; }
		}
		int i = best, j = (i + 1) % N, h = (i - 1 + N) % N, bi = i;
		double t = 0.0;
		int paires[2][2] = {{h, i}, {i, j}};
		for (auto &p : paires) {
			int a = p[0], b = p[1];
			double ax = xs[a], ay = ys[a], vx = xs[b] - ax, vy = ys[b] - ay;
			double l2 = vx * vx + vy * vy;
			if (l2 == 0.0) l2 = 1e-9;
			double u = clamp_(((x - ax) * vx + (y - ay) * vy) / l2, 0, 1);
			double px = ax + vx * u, py = ay + vy * u;
			double dd = (x - px) * (x - px) + (y - py) * (y - py);
			if (dd < bd) { bd = dd; bi = a; t = u; }
		}
		return { (bi + t) * ds, bi, (x - xs[bi]) * nx[bi] + (y - ys[bi]) * ny[bi] };
	}
	void pos2(double s, double lat, double &ox, double &oy) const {
		double w = wrap_(s) / ds, fl = std::floor(w);
		int i = int(fl) % n, j = (i + 1) % n;
		double f = w - fl;
		double x = xs[i] + (xs[j] - xs[i]) * f, y = ys[i] + (ys[j] - ys[i]) * f;
		double nnx = nx[i] + (nx[j] - nx[i]) * f, nny = ny[i] + (ny[j] - ny[i]) * f;
		ox = x + nnx * lat; oy = y + nny * lat;
	}
	double diff(double a, double b) const {
		double d = wrap_(b) - wrap_(a), L = length;
		if (d > L / 2) d -= L;
		if (d <= -L / 2) d += L;
		return d;
	}
	// 0 bitume, 1 gravier, 2 herbe, -1 aucune plaque
	int padAt(double x, double y) const {
		for (int k = int(plaques.size()) - 1; k >= 0; k--) {
			const Plaque &p = plaques[k];
			if (x < p.b[0] || x > p.b[1] || y < p.b[2] || y > p.b[3]) continue;
			int m = int(p.poly.size()) / 2;
			bool dedans = false;
			int j = m - 1;
			for (int i = 0; i < m; i++) {
				double xi = p.poly[i * 2], yi = p.poly[i * 2 + 1], xj = p.poly[j * 2], yj = p.poly[j * 2 + 1];
				if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dedans = !dedans;
				j = i;
			}
			if (dedans) return p.gravier ? 1 : 0;
		}
		return -1;
	}
	int surfaceAt(double s, double lat) const {
		bool gauche = lat >= 0;
		double d = std::fabs(lat) - (gauche ? hwLeftAt(s) : hwRightAt(s));
		if (d <= 0) return 0;
		if (!plaques.empty()) {
			double qx, qy; pos2(s, lat, qx, qy);
			int sur = padAt(qx, qy);
			if (sur >= 0) return sur;
		}
		if (asphalte && d <= lerp_(gauche ? asphL : asphR, s)) return 0;
		if (d <= lerp_(gauche ? bacL : bacR, s)) return 1;
		return 2;
	}
	bool runoffAsphaltAt(double s, double lat) const {
		if (!asphalte) return false;
		return surfaceAt(s, lat) == 0;
	}
	int barrierLevelAt(double s) const {
		for (double over : crossings)
			if (std::fabs(diff(s, over * ds)) < 24) return 1;
		return 0;
	}
	void barrierCandidates(double x0, double y0, double x1, double y1, double pad, std::vector<int> &out) const {
		out.clear();
		if (nb == 0) return;
		tampon++;
		if (tampon == 0x7fffffff) { tampon = 1; vu.assign(nb, 0); }
		double C = barrierCell;
		int ix0 = int(std::floor((minf(x0, x1) - pad) / C)), ix1 = int(std::floor((maxf(x0, x1) + pad) / C));
		int iy0 = int(std::floor((minf(y0, y1) - pad) / C)), iy1 = int(std::floor((maxf(y0, y1) + pad) / C));
		for (int x = ix0; x <= ix1; x++)
			for (int y = iy0; y <= iy1; y++) {
				auto it = grille.find(cle(x, y));
				if (it == grille.end()) continue;
				for (int id : it->second)
					if (vu[id] != tampon) { vu[id] = tampon; out.push_back(id); }
			}
	}
	static void accepte(Coup &best, double t, double nnx, double nny, double depth, double dx, double dy) {
		if (t < 0 || t > 1 || dx * nnx + dy * nny >= -1e-9) return;
		if (!best.ok || t < best.t) { best.t = t; best.nx = nnx; best.ny = nny; best.depth = depth; best.ok = true; }
	}
	Coup sweepBarrier(double x, double y, double dx, double dy, int b, double r) const {
		r += bhalf[b];
		double tx = btx[b], ty = bty[b], ln = blen[b];
		double u = (x - bax[b]) * tx + (y - bay[b]) * ty;
		double v = (x - bax[b]) * -ty + (y - bay[b]) * tx;
		double du = dx * tx + dy * ty, dv = dx * -ty + dy * tx;
		Coup best;
		double q = clamp_(u, 0, ln), ex = u - q, dist = hypot_(ex, v);
		if (dist < r) {
			double nnx = dist > 1e-8 ? (ex * tx - v * ty) / dist : bnx[b];
			double nny = dist > 1e-8 ? (ex * ty + v * tx) / dist : bny[b];
			accepte(best, 0, nnx, nny, r - dist, dx, dy);
		}
		if (std::fabs(dv) > 1e-10) {
			for (double sg : {-1.0, 1.0}) {
				double t = (sg * r - v) / dv, along = u + du * t;
				if (along >= 0 && along <= ln) accepte(best, t, -ty * sg, tx * sg, 0, dx, dy);
			}
		}
		double aa = dx * dx + dy * dy;
		if (aa > 1e-12) {
			for (double fin : {0.0, ln}) {
				double e2 = u - fin;
				double bb = 2 * (e2 * du + v * dv);
				double cc = e2 * e2 + v * v - r * r;
				double disc = bb * bb - 4 * aa * cc;
				if (disc < 0) continue;
				double t = (-bb - std::sqrt(disc)) / (2 * aa);
				double px = e2 + du * t, py = v + dv * t;
				accepte(best, t, (px * tx - py * ty) / r, (px * ty + py * tx) / r, 0, dx, dy);
			}
		}
		return best;
	}
};

} // namespace grip
