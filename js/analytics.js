/* Mesure d'audience indépendante de la sauvegarde et du tableau des records.
   Un identifiant aléatoire par navigateur, aucun pseudo, compte, IP ou URL collecté par le jeu.
   Les statistiques sont indicatives : effacer le stockage crée un nouveau visiteur.
   L'échec du réseau ne doit jamais attendre ni interrompre une course. */
'use strict';

class GameAnalytics {
  constructor(options = {}) {
    this.enabled = (options.enabled ?? (location.protocol.startsWith('http')
      && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)))
      && typeof globalThis.crypto?.randomUUID === 'function';
    this.url = options.url || MONDIAL_URL;
    this.key = options.key || MONDIAL_KEY;
    this.fetch = options.fetch || window.fetch.bind(window);
    this.queue = []; this.current = null; this.sending = false; this.retryAfter = 0;
    this.timer = null;
    if (!this.enabled) return;
    const storedVisitor = this._read('eol.analytics.visitor');
    this.visitor = this._validId(storedVisitor) ? storedVisitor : crypto.randomUUID();
    this._write('eol.analytics.visitor', this.visitor);
    try { this.queue = JSON.parse(localStorage.getItem('eol.analytics.queue') || '[]').slice(-200); } catch (_) {}
    this._session();
    this.timer = setInterval(() => this.flush(), 15000);
    window.addEventListener('pagehide', () => { this.finish('abandoned'); this.flush(true); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this._play(); this.flush(true); }
    });
    this.flush();
  }

  _read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  _write(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  _validId(value) { return typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value); }
  _session() {
    let s;
    try { s = JSON.parse(this._read('eol.analytics.session')); } catch (_) {}
    if (!this._validId(s?.id) || !Number.isFinite(s?.last) || s.last > Date.now() + 300000
      || Date.now() - s.last > 1800000) {
      s = { id: crypto.randomUUID(), last: Date.now() };
      this.session = s;
      this._emit('visit');
    }
    this.session = s; this.session.last = Date.now();
    this._write('eol.analytics.session', JSON.stringify(this.session));
  }
  _device() {
    return !mobileDevice() ? 'desktop' : Math.min(screen.width, screen.height) >= 600 ? 'tablet' : 'mobile';
  }
  _emit(event, data = {}) {
    if (!this.enabled) return;
    const row = { id: crypto.randomUUID(), visitor: this.visitor, session: this.session.id,
      at: new Date().toISOString(), event, device: this._device(), version: APP_VERSION,
      ...(this.current?.meta || {}), ...data };
    this.queue.push(row); this.queue = this.queue.slice(-200);
    this._persist();
  }
  _persist() { this._write('eol.analytics.queue', JSON.stringify(this.queue)); }

  begin(race, meta) {
    if (!this.enabled) return;
    this.finish('abandoned'); this._session();
    this.current = { race, meta: { ...meta, race: crypto.randomUUID() }, started: false,
      lap: 0, lapStart: 0, faults: 0, seconds: 0 };
  }
  observe(race, dt, playing, control) {
    const c = this.current, p = race?.player;
    if (!c || c.race !== race || !p) return;
    if (!c.started && race.state !== 'countdown') {
      c.meta.control = control; c.started = true; this._emit('race_start');
    }
    if (!c.started) return;
    if (playing && !race.attente && !p.finished) {
      if (Date.now() - this.session.last > 1800000) this._session();
      c.seconds += Math.max(0, Math.min(dt, 1));
      if (c.seconds >= 30) this._play();
      this.session.last = Date.now();
      // Pas d'écriture localStorage à chaque image.
    }
    if (p.lap > c.lap) {
      for (let lap = c.lap + 1; lap <= Math.min(p.lap, c.lap + 20); lap++) {
        const time = p.lapTimes[lap - 1];
        this._emit('lap', { lap, lap_s: Number.isFinite(time) ? time : null,
          clean: typeof p.lapOk?.[lap - 1] === 'boolean' ? p.lapOk[lap - 1] : null });
      }
      c.lap = p.lap;
    }
    if (p.fautes > c.faults) {
      this._emit('offtrack', { value: Math.min(20, p.fautes - c.faults) }); c.faults = p.fautes;
    }
    if (p.finished) this.finish('completed');
  }
  _play() {
    const c = this.current;
    if (c?.started && c.seconds > 0) {
      this._emit('play', { seconds: Math.min(60, c.seconds) }); c.seconds = 0;
      this._write('eol.analytics.session', JSON.stringify(this.session));
    }
  }
  finish(outcome) {
    const c = this.current;
    if (!c) return;
    if (c.started) { this._play(); this._emit('race_end', { outcome }); }
    this.current = null; this.flush();
  }
  async flush(keepalive = false) {
    if (!this.enabled || this.sending || !this.queue.length || Date.now() < this.retryAfter) return;
    const batch = this.queue.slice(0, 25); this.sending = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await this.fetch(`${this.url}/rest/v1/rpc/analytics_ingest`, {
        method: 'POST', headers: { apikey: this.key, Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json' }, body: JSON.stringify({ p_events: batch }), keepalive, signal: controller.signal,
      });
      if (!response.ok) {
        // La migration peut ne pas encore être installée : ne pas marteler une API absente.
        this.retryAfter = Date.now() + (response.status === 404 ? 3600000 : 60000);
        return;
      }
      const ids = new Set(batch.map(e => e.id));
      this.queue = this.queue.filter(e => !ids.has(e.id)); this._persist();
    } catch (_) { this.retryAfter = Date.now() + 60000; }
    finally { clearTimeout(timeout); this.sending = false; }
  }
}
