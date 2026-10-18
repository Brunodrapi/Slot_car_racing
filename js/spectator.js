'use strict';

// Race-local telemetry, authored only by the simulator. No identity or analytics database.
class RaceBroadcast {
  constructor(race) {
    this.history = [];
    this.maxSpeed = race.cars.map(() => 0);
    this.lastSample = -5;
    this.initial = race.standings().map(c => race.cars.indexOf(c));
  }
  sample(race) {
    if (race.state === 'countdown') return;
    race.cars.forEach((c, i) => { this.maxSpeed[i] = Math.max(this.maxSpeed[i], c.v * 3.6); });
    if (race.time - this.lastSample >= 5 || race.state === 'finished' && !this.finished) {
      this.lastSample = race.time;
      this.history.push([Math.round(race.time), ...race.standings().map(c => race.cars.indexOf(c))]);
      // Keep the entire race timeline at progressively coarser resolution for long sessions.
      if (this.history.length > 360) this.history = this.history.filter((_, i) => i % 2 === 0);
    }
    this.finished = race.state === 'finished';
  }
  packet(race) {
    return { initial: this.initial, history: this.history, maxSpeed: this.maxSpeed,
      laps: race.cars.map(c => c.lapTimes.map((time, i) => [time, c.lapOk[i] !== false])) };
  }
  receive(data, race) {
    if (!data || !Array.isArray(data.laps) || data.laps.length !== race.cars.length) return;
    this.history = Array.isArray(data.history) ? data.history.slice(-360) : [];
    this.initial = Array.isArray(data.initial) ? data.initial : this.initial;
    this.maxSpeed = Array.isArray(data.maxSpeed) ? data.maxSpeed : this.maxSpeed;
    data.laps.forEach((laps, i) => {
      if (!Array.isArray(laps)) return;
      const valid = laps.slice(0, 999).filter(x => Array.isArray(x) && Number.isFinite(x[0]) && x[0] > 0);
      race.cars[i].lapTimes = valid.map(x => x[0]);
      race.cars[i].lapOk = valid.map(x => x[1] !== false);
    });
  }
  html(race) {
    const rows = race.results || [];
    const e = escapeHtml;
    const stats = rows.map(r => {
      const c = r.car, i = race.cars.indexOf(c), clean = c.lapTimes.filter((_, n) => c.lapOk[n] !== false);
      const mean = clean.length ? clean.reduce((a,b) => a+b,0) / clean.length : null;
      const sd = clean.length > 1 ? Math.sqrt(clean.reduce((a,b) => a+(b-mean)**2,0)/clean.length) : null;
      const gain = this.initial.indexOf(i) + 1 - r.pos;
      return `<tr><td>${e(c.name)}</td><td>${gain > 0 ? '+' : ''}${gain}</td><td>${mean == null ? '—' : fmtTime(mean)}</td><td>${sd == null ? '—' : sd.toFixed(3) + ' s'}</td><td>${clean.length}/${c.lapTimes.length}</td><td>${Math.round(this.maxSpeed[i] || 0)} km/h</td><td>${c.fautes || 0}</td></tr>`;
    }).join('');
    const colors = ['#e9be37','#55cbea','#f58282','#a8d672','#c3a0ef','#f5aa66','#dadada','#78d2b4','#eb99cf','#a8b4da','#e0ca96','#b8d8e0'];
    const last = Math.max(1, this.history.at(-1)?.[0] || 1);
    const lines = race.cars.map((c,i) => {
      const points = this.history.map(row => `${20 + row[0]/last*760},${20+Math.max(0,row.slice(1).indexOf(i))*18}`).join(' ');
      return `<polyline fill="none" stroke="${colors[i % colors.length]}" stroke-width="2" points="${points}"><title>${e(c.name)}</title></polyline>`;
    }).join('');
    return `<section class="race-analysis"><h3>Bilan de course</h3>
      <div class="table-scroll"><table class="tbl"><thead><tr><th>Pilote</th><th>Places gagnées</th><th>Tour moyen valide</th><th>Régularité σ</th><th>Tours valides</th><th>Vitesse maxi</th><th>Sorties</th></tr></thead><tbody>${stats}</tbody></table></div>
      <p class="muted">Régularité : écart-type des tours valides (plus petit = plus régulier), à partir de deux tours. Les places gagnées incluent les pénalités du classement final.</p>
      <h3>Évolution des positions</h3><svg role="img" aria-label="Positions au fil de la course, première place en haut" viewBox="0 0 800 ${40+race.cars.length*18}">${lines}</svg>
      <p>${race.cars.map((c,i)=>`<span style="color:${colors[i%colors.length]}">● ${e(c.name)}</span>`).join(' · ')}</p>
      <p class="muted">Départ à gauche, arrivée à droite · première place en haut · positions échantillonnées toutes les 5 secondes, espacées davantage pour les longues courses.</p>
      <details><summary>Tous les temps au tour</summary>${rows.map(r=>`<h4>${e(r.car.name)}</h4><p>${r.car.lapTimes.map((v,i)=>`${i+1} : ${fmtTime(v)}${r.car.lapOk[i] === false ? ' (annulé)' : ''}`).join(' · ') || 'Aucun tour terminé'}</p>`).join('')}</details></section>`;
  }
}

class SpectatorView {
  constructor(app) {
    this.app = app; this.rotation = app.renderer.rotate; this.mode = 'auto'; this.index = 0; this.fixed = 0; this.lastCut = -10; this.paintAt = -1;
    const track = app.race.track;
    this.stations = [0];
    const bends = Array.from({length: 160}, (_, i) => i * track.length / 160).sort((a,b) => Math.abs(track.curvAt(b))-Math.abs(track.curvAt(a)));
    for (const station of bends) { if (this.stations.every(s => Math.abs(track.diff(s, station)) > track.length / 12)) this.stations.push(station); if (this.stations.length === 8) break; }
    this.stations.sort((a,b)=>a-b);
    this.root = document.createElement('aside'); this.root.className = 'spectator-panel';
    this.root.innerHTML = `<div class="spectator-controls"><b>Spectateur</b><select aria-label="Vue spectateur">${[['auto','Réalisateur'],['follow','Suivi pilote'],['full','Circuit complet'],['fixed','Caméras fixes'],['duel','Duel']].map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select><button type="button" data-step="-1" aria-label="Précédent">◀</button><button type="button" data-step="1" aria-label="Suivant">▶</button><button type="button" data-hide>Chronos</button><button type="button" data-leave>Quitter</button></div><div class="spectator-timing"></div>`;
    document.body.append(this.root);
    this.root.querySelector('select').onchange = e => { this.mode = e.target.value; };
    this.root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.step) this.step(+b.dataset.step);
      if (b.dataset.car != null) { this.index = +b.dataset.car; this.mode = 'follow'; this.root.querySelector('select').value = this.mode; }
      if (b.hasAttribute('data-leave')) app.toMenu();
      if (b.hasAttribute('data-hide')) this.root.classList.toggle('timing-hidden');
    };
    this.key = e => { if (['SELECT','INPUT','BUTTON'].includes(e.target.tagName)) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); this.step(e.key === 'ArrowRight' ? 1 : -1); } };
    window.addEventListener('keydown', this.key);
  }
  close() { this.app.renderer.rotate = this.rotation; this.root.remove(); window.removeEventListener('keydown', this.key); }
  drawMap(g, race) {
    if (this.mode !== 'full') return;
    const r = this.app.renderer;
    race.standings().forEach((c, i) => {
      const x = r.w / 2 + (c.x-r.cam.x)*r.cam.zoom, y = r.h / 2 + (c.y-r.cam.y)*r.cam.zoom;
      g.fillStyle=c.livery.body;g.strokeStyle='#101820';g.lineWidth=2;
      g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();g.stroke();
      g.font='bold 12px sans-serif';g.textAlign='center';g.strokeText(String(i+1),x,y-9);g.fillStyle='#fff';g.fillText(String(i+1),x,y-9);
    });
  }
  step(d) {
    if (this.mode === 'fixed') this.fixed = (this.fixed + d + this.stations.length) % this.stations.length;
    else { this.index = (this.index+d+this.app.race.cars.length)%this.app.race.cars.length; if (this.mode === 'auto') this.mode='follow'; }
    this.root.querySelector('select').value = this.mode;
  }
  gap(a,b,race) {
    if (!a || !b) return '—';
    if (a.finished && b.finished) return `+${Math.max(0,(b.finishTime+Race.penalite(b))-(a.finishTime+Race.penalite(a))).toFixed(3)} s`;
    const distance = Math.max(0,a.progress-b.progress);
    if (distance >= race.track.length) return `+${Math.floor(distance/race.track.length)} tour(s)`;
    const pace = a.bestLap || b.bestLap;
    return pace ? `≈ +${(distance/race.track.length*pace).toFixed(1)} s` : `+${Math.round(distance)} m`;
  }
  update(dt) {
    const app=this.app, race=app.race, r=app.renderer, order=race.standings();
    // Hold shots for at least eight seconds; prefer incidents, otherwise the closest contest.
    if (this.mode === 'auto' && race.time-this.lastCut >= 8) {
      let target=order.find(c=>c.state==='grass' || c.engineStopped), best=Infinity;
      if (!target) for(let i=1;i<order.length;i++) { const gap=order[i-1].progress-order[i].progress; if(gap<best && !order[i].finished) {best=gap;target=order[i];} }
      this.index=race.cars.indexOf(target || order[0]); this.lastCut=race.time;
    }
    const c=race.cars[this.index] || order[0];
    const cameraKey=`${this.mode}:${this.index}:${this.fixed}`;
    if(cameraKey!==this.cameraKey){r.cam.init=false;this.cameraKey=cameraKey;}
    r.rotate = (this.mode === 'follow' || this.mode === 'auto') && this.rotation;
    // Do not mutate Race.player: spectators must never acquire a driver's identity or controls.
    if(this.mode==='follow' || this.mode==='auto') r.updateCamera(Object.assign(Object.create(race),{player:c}),dt);
    else {
      let x,y,zoom;
      if(this.mode==='full') { const b=race.track.bounds; x=(b.minX+b.maxX)/2;y=(b.minY+b.maxY)/2;const reserved=Math.min(r.h*.5,this.root.getBoundingClientRect().height+20);zoom=Math.min(r.w/(b.maxX-b.minX+100),(r.h-reserved-20)/(b.maxY-b.minY+100));y-=reserved/2/zoom; }
      else if(this.mode==='fixed') { const p=race.track.pos(this.stations[this.fixed], 0);x=p.x;y=p.y;zoom=Math.min(r.w,r.h)/140; }
      else { const n=order.indexOf(c), other=order[n>0?n-1:1] || c;x=(c.x+other.x)/2;y=(c.y+other.y)/2;zoom=Math.min(r.w/(Math.abs(c.x-other.x)+85),(r.h-160)/(Math.abs(c.y-other.y)+85)); }
      r.cam.x=x;r.cam.y=y;r.cam.zoom=Math.max(.02,zoom);r.cam.init=true;r.camAngle=0;
    }
    const pad=Array.from(navigator.getGamepads?.() || []).find(p=>p?.connected);
    const dir=pad && (pad.buttons[15]?.pressed || pad.buttons[5]?.pressed ? 1 : pad.buttons[14]?.pressed || pad.buttons[4]?.pressed ? -1 : 0);
    if(dir && !this.padDir)this.step(dir);this.padDir=dir;
    const cycle=!!pad?.buttons[0]?.pressed, hide=!!pad?.buttons[2]?.pressed;
    if(cycle&&!this.padCycle){const modes=['auto','follow','full','fixed','duel'];this.mode=modes[(modes.indexOf(this.mode)+1)%modes.length];this.root.querySelector('select').value=this.mode;}
    if(hide&&!this.padHide)this.root.classList.toggle('timing-hidden');
    this.padCycle=cycle;this.padHide=hide;
    if(performance.now()-this.paintAt<250)return;this.paintAt=performance.now();
    this.root.querySelector('.spectator-timing').innerHTML=`<p>${escapeHtml(c.name)} · ${Math.round(c.v*3.6)} km/h · ${race.state === 'countdown' ? 'Départ en attente' : 'Tour ' + Math.max(1,c.lap)} · ${app.net.silence()>2?'⚠ Liaison interrompue':''}</p><div class="table-scroll"><table><thead><tr><th>Pilote</th><th>Leader</th><th>Précédent</th><th>Dernier</th><th>Meilleur</th><th>En cours</th></tr></thead><tbody>${order.map((car,i)=>`<tr><td><button data-car="${race.cars.indexOf(car)}">${i+1}. ${escapeHtml(car.name)}</button></td><td>${i?this.gap(order[0],car,race):'—'}</td><td>${i?this.gap(order[i-1],car,race):'—'}</td><td>${car.lapTimes.length?fmtTime(car.lapTimes.at(-1))+(car.lapOk.at(-1)===false?' ×':''):'—'}</td><td>${fmtTime(car.bestLap)}</td><td>${car.started&&!car.finished?fmtTime(Math.max(0,race.time-car.lapStart)):'—'}</td></tr>`).join('')}</tbody></table></div><small>≈ Écarts estimés selon la distance et le meilleur tour · × tour annulé · Manette : A vue, LB/RB pilote/caméra, X chronos</small>`;
  }
}
