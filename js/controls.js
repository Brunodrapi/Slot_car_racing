// Commandes PC. La molette mémorise un niveau ; RT le mesure à chaque image.
'use strict';

/* LA MANETTE EST MISE DE CÔTÉ (0.49). Le jeu revient à un seul bouton, sur ordinateur aussi : Espace
pour les gaz, ↑ / ↓ pour la ligne — comme le pouce sur un téléphone. Tout le code de la manette et de
la molette reste ici, entier (modes, frein LT, navigation des menus) ; il revient en passant cet
interrupteur à `true`, et les réglages retrouvent alors leur choix de commande. */
const MANETTE = false;

class DesktopControls {
  constructor({ throttle, line, pause, activity, connected = () => {}, navigate = () => {}, brake = () => {} }) {
    this.onThrottle = throttle; this.onLine = line; this.onPause = pause; this.onActivity = activity;
    this.onConnected = connected; this.onNavigate = navigate;
    this.onBrake = brake;
    this.mode = 'keyboard'; this.status = 'disconnected';
    this.padIndex = null; this.startHeld = false;
    this.buttonsHeld = []; this.menuDirection = ''; this.menuRepeatAt = 0;
    this.reset();
  }
  setMode(mode) {
    this.mode = MANETTE && ['keyboard', 'wheel', 'gamepad'].includes(mode) ? mode : 'keyboard';
    this.reset();
  }
  reset() {
    this.wheelThrottle = 0; this.armed = false; this.lineHeld = 0;
    this.onThrottle(0);
    this.onBrake(0);
  }
  wheel(event) {
    if (this.mode !== 'wheel' || !Number.isFinite(event.deltaY) || !event.deltaY) return;
    // 100 pixels = 10 %, également pour une souris exprimant ses crans en lignes/pages.
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
    this.wheelThrottle = Math.round(clamp(this.wheelThrottle - clamp(pixels, -200, 200) / 1000, 0, 1) * 1000) / 1000;
    this.onThrottle(this.wheelThrottle);
    if (this.wheelThrottle) this.onActivity();
  }
  brake() { this.wheelThrottle = 0; this.onThrottle(0); }
  suspend() { this.blockButtons = true; this.menuDirection = ''; }
  poll(active, getPads = () => navigator.getGamepads?.(), menu = false, now = 0) {
    if (!MANETTE) return;
    let pads;
    try { pads = getPads(); } catch (_) { /* API absente ou interdite par le navigateur. */ }
    if (!pads) {
      const lost = this.padIndex != null;
      this.padIndex = null; this.armed = false;
      this.status = 'unsupported';
      if (this.mode === 'gamepad') { this.onThrottle(0); this.onBrake(0); if (lost && active) this.onPause(); }
      return;
    }
    let pad = this.padIndex == null ? null : pads[this.padIndex];
    if (!pad || !pad.connected || pad.mapping !== 'standard') {
      const lost = this.padIndex != null;
      this.padIndex = null; this.armed = false; this.lineHeld = 0;
      this.status = 'disconnected';
      if (this.mode === 'gamepad') {
        this.onThrottle(0);
        this.onBrake(0);
        if (lost && active) { this.onPause(); return; }
      }
      pad = Array.from(pads).find(p => p?.connected && p.mapping === 'standard');
      if (!pad) return;
      this.padIndex = pad.index;
      this.buttonsHeld = []; this.menuDirection = '';
      this.onConnected(pad);
    }
    const rt = throttleAmount(pad.buttons[7]?.value);
    if (rt <= 0.05) this.armed = true;
    this.status = this.armed ? 'ready' : 'release';
    const pressed = pad.buttons.map(b => !!b.pressed || b.value > 0.5);
    const edge = i => pressed[i] && !this.buttonsHeld[i];
    const blocked = this.blockButtons;
    if (blocked && !pressed.some(Boolean) && pad.axes.every(v => Math.abs(v) < 0.25)) this.blockButtons = false;
    const start = !!pad.buttons[9]?.pressed;
    if (!blocked && start && !this.startHeld && (active || menu)) { this.onActivity(); this.onPause(); }
    this.startHeld = start;
    if (menu && !blocked && !start) {
      let direction = pressed[14] ? 'left' : pressed[15] ? 'right' : pressed[12] ? 'up' : pressed[13] ? 'down' : '';
      const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
      if (!direction && Math.max(Math.abs(x), Math.abs(y)) > 0.55) direction = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
      if (!direction && this.menuDirection && Math.max(Math.abs(x), Math.abs(y)) > 0.25) direction = this.menuDirection;
      const command = edge(0) ? 'accept' : edge(1) ? 'back' : edge(2) ? 'delete' : edge(4) ? 'previous' : edge(5) ? 'next' : null;
      if (command) { this.onActivity(); this.onNavigate(command); }
      else if (direction && (direction !== this.menuDirection || now >= this.menuRepeatAt)) {
        this.onNavigate(direction);
        this.menuRepeatAt = now + (direction === this.menuDirection ? 130 : 380);
      }
      this.menuDirection = direction;
    } else this.menuDirection = '';
    this.buttonsHeld = pressed;
    if (this.mode !== 'gamepad') return;
    if (!active || start || blocked) { this.onThrottle(0); this.onBrake(0); return; }
    const lt = throttleAmount(pad.buttons[6]?.value);
    this.onBrake(clamp((lt - 0.05) / 0.95, 0, 1));
    this.onThrottle(this.armed ? clamp((rt - 0.05) / 0.95, 0, 1) : 0);
    if (this.armed && rt > 0.05) this.onActivity();
    const x = pad.axes[0] || 0;
    let line = pad.buttons[15]?.pressed || pad.buttons[12]?.pressed || x > 0.55 ? 1
      : pad.buttons[14]?.pressed || pad.buttons[13]?.pressed || x < -0.55 ? -1 : 0;
    // Revenir au centre avant le cran suivant évite les changements répétés sur un stick qui tremble.
    if (!line && Math.abs(x) > 0.25 && Math.sign(x) === this.lineHeld) line = this.lineHeld;
    if (line && line !== this.lineHeld) this.onLine(line);
    this.lineHeld = line;
  }
}
