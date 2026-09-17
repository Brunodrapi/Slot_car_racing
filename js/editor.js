// Track editor: background image + three driving lines drawn as closed Catmull-Rom curves.
// Coordinates are image pixels; `scale` (metres per pixel) comes from the lap length typed by the user.
'use strict';

const LINE_STYLE = { racing: '#ffffff', inside: '#50c8ff', outside: '#ffc83c' };

const ed = {
  cv: document.getElementById('cv'),
  g: null,
  doc: null,
  img: null,
  view: { x: 0, y: 0, scale: 1 },
  active: 'racing',
  drag: null,           // { line, idx } | { pan: [x, y, vx, vy] }
  placingStart: false,
  space: false,
  undo: [],
  preview: null,        // Track built from the current doc (debounced)
  previewTimer: null,
  dirty: false,
};

function newDoc() {
  return { id: null, name: 'Mon circuit', flag: '🏁', lengthM: 3000, laps: 3, drawRoad: true, image: null, lines: { racing: [], inside: [], outside: [] }, startIndex: 0 };
}

// ---------- geometry helpers ----------
function toWorld(px, py) { return [(px - ed.view.x) / ed.view.scale, (py - ed.view.y) / ed.view.scale]; }
function toScreen(x, y) { return [x * ed.view.scale + ed.view.x, y * ed.view.scale + ed.view.y]; }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
  return dist(p, [a[0] + dx * t, a[1] + dy * t]);
}
function pushUndo() { ed.undo.push(JSON.stringify(ed.doc.lines)); if (ed.undo.length > 60) ed.undo.shift(); ed.dirty = true; }

// convert the document into a track definition the game can load
function docToDef(doc) {
  const racing = doc.lines.racing;
  if (racing.length < 3) return null;
  const rot = (arr, k) => arr.slice(k).concat(arr.slice(0, k));
  const center = rot(racing, clamp(doc.startIndex, 0, racing.length - 1));
  const pxLen = Track.polyLength(Track.spline(center, 24));
  const scale = doc.lengthM / pxLen;
  const def = {
    id: doc.id, name: doc.name, flag: doc.flag, laps: doc.laps, custom: true,
    scale, center,
    lines: { racing: center, inside: doc.lines.inside.length >= 3 ? doc.lines.inside : null, outside: doc.lines.outside.length >= 3 ? doc.lines.outside : null },
    image: doc.image ? { src: doc.image.src, w: doc.image.w, h: doc.image.h } : null,
    drawRoad: doc.drawRoad,
    editor: { lines: doc.lines, startIndex: doc.startIndex, lengthM: doc.lengthM },
  };
  // missing side lines: derived from the racing line by the game's auto generator? No: offset copies.
  if (!def.lines.inside) def.lines.inside = offsetLine(center, -8 / scale, doc);
  if (!def.lines.outside) def.lines.outside = offsetLine(center, 8 / scale, doc);
  return def;
}

// crude offset of a closed polyline by d pixels (left normal in y-down coordinates)
function offsetLine(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    out.push([pts[i][0] + dy / l * d, pts[i][1] - dx / l * d]);
  }
  return out;
}

// inside/outside derived from the racing line: use the game's own generator, then sample back to points
function deriveSideLines() {
  const def = docToDef(ed.doc);
  if (!def) return;
  const tmp = { ...def, lines: null, width: 24 };     // auto lines on a nominal 24 px-metre road
  const T = new Track(tmp);
  const sampleBack = (name) => {
    const pts = [];
    const step = Math.max(8, Math.round(T.n / 60));
    for (let i = 0; i < T.n; i += step) {
      const lat = T.lines[name][i];
      pts.push([(T.xs[i] + T.nx[i] * lat) / T.unitScale, (T.ys[i] + T.ny[i] * lat) / T.unitScale]);
    }
    return pts;
  };
  pushUndo();
  ed.doc.lines.inside = sampleBack('inside');
  ed.doc.lines.outside = sampleBack('outside');
  schedulePreview(); draw();
}

// ---------- preview track ----------
function schedulePreview() {
  clearTimeout(ed.previewTimer);
  ed.previewTimer = setTimeout(() => {
    try { const def = docToDef(ed.doc); ed.preview = def ? new Track(def) : null; }
    catch (e) { ed.preview = null; console.warn(e); }
    draw();
  }, 150);
}

// ---------- drawing ----------
function draw() {
  const g = ed.g, cv = ed.cv, dpr = window.devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
  g.save();
  g.translate(ed.view.x, ed.view.y); g.scale(ed.view.scale, ed.view.scale);
  if (ed.img) g.drawImage(ed.img, 0, 0);
  else { g.fillStyle = '#3a4a2c'; g.fillRect(-5000, -5000, 10000, 10000); g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1 / ed.view.scale; for (let x = -5000; x <= 5000; x += 100) { g.beginPath(); g.moveTo(x, -5000); g.lineTo(x, 5000); g.stroke(); g.beginPath(); g.moveTo(-5000, x); g.lineTo(5000, x); g.stroke(); } }
  const s = 1 / ed.view.scale;
  // road preview from the built track (in px: divide metres by unitScale)
  const T = ed.preview;
  if (T && ed.doc.drawRoad) {
    const u = 1 / T.unitScale;
    g.beginPath();
    for (let i = 0; i < T.n; i += 3) { const x = (T.xs[i] + T.nx[i] * T.hwL[i]) * u, y = (T.ys[i] + T.ny[i] * T.hwL[i]) * u; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    for (let i = T.n - 1; i >= 0; i -= 3) { g.lineTo((T.xs[i] - T.nx[i] * T.hwR[i]) * u, (T.ys[i] - T.ny[i] * T.hwR[i]) * u); }
    g.closePath();
    g.fillStyle = 'rgba(75,75,82,0.75)'; g.fill();
    g.strokeStyle = 'rgba(230,230,235,0.8)'; g.lineWidth = 1.5 * s; g.stroke();
  }
  // lines
  for (const name of ['inside', 'outside', 'racing']) {
    const pts = ed.doc.lines[name];
    if (!pts.length) continue;
    if (pts.length >= 3) {
      const sp = Track.spline(pts, 12);
      g.beginPath(); sp.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.strokeStyle = LINE_STYLE[name]; g.lineWidth = (name === ed.active ? 3 : 1.6) * s; g.setLineDash(name === ed.active ? [] : [6 * s, 6 * s]); g.stroke(); g.setLineDash([]);
    } else {
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.strokeStyle = LINE_STYLE[name]; g.lineWidth = 2 * s; g.stroke();
    }
    // points
    const r = (name === ed.active ? 6 : 4) * s;
    pts.forEach((p, i) => {
      g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2);
      g.fillStyle = name === ed.active ? LINE_STYLE[name] : 'rgba(255,255,255,0.5)'; g.fill();
      if (name === 'racing' && i === ed.doc.startIndex) { g.strokeStyle = '#ffd400'; g.lineWidth = 3 * s; g.beginPath(); g.arc(p[0], p[1], r + 5 * s, 0, Math.PI * 2); g.stroke(); }
      if (name === ed.active && ed.view.scale > 0.6) { g.fillStyle = '#000'; g.font = `${10 * s}px sans-serif`; g.fillText(String(i), p[0] + r + 2 * s, p[1] - r); }
    });
  }
  // direction arrows on the racing line
  const rp = ed.doc.lines.racing;
  if (rp.length >= 3) {
    const sp = Track.spline(rp, 12);
    for (let i = 0; i < sp.length; i += 60) {
      const a = sp[i], b = sp[(i + 4) % sp.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.save(); g.translate(a[0], a[1]); g.rotate(ang);
      g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(10 * s, 0); g.lineTo(-4 * s, 6 * s); g.lineTo(-4 * s, -6 * s); g.closePath(); g.fill(); g.restore();
    }
  }
  g.restore();
  updateInfo();
}

function updateInfo() {
  const el = document.getElementById('info');
  const doc = ed.doc, T = ed.preview;
  const n = (k) => doc.lines[k].length;
  let s = `Points — idéale ${n('racing')}, intérieure ${n('inside')}, extérieure ${n('outside')}.`;
  if (T) s += ` Longueur ${Math.round(T.length)} m, échelle ${(T.unitScale).toFixed(3)} m/px, largeur moyenne ${(2 * (avg(T.hwL) + avg(T.hwR)) / 2).toFixed(1)} m.`;
  else s += ' Trace au moins 3 points sur la ligne idéale.';
  el.textContent = s;
}
function avg(a) { let s = 0; for (const v of a) s += v; return s / a.length; }

// ---------- interaction ----------
function resize() {
  const dpr = window.devicePixelRatio || 1, cv = ed.cv;
  cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
  draw();
}

function nearestPoint(wp, radiusPx) {
  let best = null, bd = radiusPx / ed.view.scale;
  for (const name of ['racing', 'inside', 'outside']) {
    ed.doc.lines[name].forEach((p, i) => { const d = dist(p, wp); if (d < bd) { bd = d; best = { line: name, idx: i }; } });
  }
  return best;
}
function nearestSegment(wp, line, radiusPx) {
  const pts = ed.doc.lines[line]; let best = -1, bd = radiusPx / ed.view.scale;
  for (let i = 0; i < pts.length; i++) { const d = segDist(wp, pts[i], pts[(i + 1) % pts.length]); if (d < bd) { bd = d; best = i; } }
  return best;
}

function onPointerDown(e) {
  ed.cv.setPointerCapture(e.pointerId);
  const wp = toWorld(e.clientX, e.clientY);
  if (e.button === 1 || ed.space || (e.pointerType === 'touch' && e.isPrimary === false)) { ed.drag = { pan: [e.clientX, e.clientY, ed.view.x, ed.view.y] }; return; }
  const hit = nearestPoint(wp, 12);
  if (e.button === 2) { if (hit) { pushUndo(); ed.doc.lines[hit.line].splice(hit.idx, 1); if (hit.line === 'racing' && ed.doc.startIndex >= ed.doc.lines.racing.length) ed.doc.startIndex = 0; schedulePreview(); draw(); } return; }
  if (ed.placingStart) {
    if (hit && hit.line === 'racing') { ed.doc.startIndex = hit.idx; ed.placingStart = false; setStatus('Départ placé.'); ed.dirty = true; schedulePreview(); draw(); }
    return;
  }
  if (hit) { pushUndo(); if (hit.line !== ed.active) setActive(hit.line); ed.drag = { line: hit.line, idx: hit.idx, moved: false }; return; }
  pushUndo();
  const pts = ed.doc.lines[ed.active];
  if (e.shiftKey && pts.length >= 2) {
    const seg = nearestSegment(wp, ed.active, 20);
    if (seg >= 0) { pts.splice(seg + 1, 0, wp); ed.drag = { line: ed.active, idx: seg + 1 }; schedulePreview(); draw(); return; }
  }
  pts.push(wp);
  ed.drag = { line: ed.active, idx: pts.length - 1 };
  schedulePreview(); draw();
}
function onPointerMove(e) {
  if (!ed.drag) return;
  if (ed.drag.pan) { ed.view.x = ed.drag.pan[2] + (e.clientX - ed.drag.pan[0]); ed.view.y = ed.drag.pan[3] + (e.clientY - ed.drag.pan[1]); draw(); return; }
  const wp = toWorld(e.clientX, e.clientY);
  ed.doc.lines[ed.drag.line][ed.drag.idx] = wp;
  ed.drag.moved = true;
  draw();
}
function onPointerUp(e) { if (ed.drag && !ed.drag.pan) schedulePreview(); ed.drag = null; }
function onWheel(e) {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const wp = toWorld(e.clientX, e.clientY);
  ed.view.scale = clamp(ed.view.scale * f, 0.05, 20);
  const sp = toScreen(wp[0], wp[1]);
  ed.view.x += e.clientX - sp[0]; ed.view.y += e.clientY - sp[1];
  draw();
}

function setActive(name) {
  ed.active = name;
  for (const n of ['racing', 'inside', 'outside']) document.getElementById('t-' + n).classList.toggle('sel', n === name);
  draw();
}
function setStatus(s) { document.getElementById('status').textContent = s; }

function fitView() {
  const cv = ed.cv, W = cv.clientWidth, H = cv.clientHeight;
  let w = 1000, h = 1000, x0 = 0, y0 = 0;
  if (ed.img) { w = ed.img.naturalWidth; h = ed.img.naturalHeight; }
  else {
    const all = [].concat(ed.doc.lines.racing, ed.doc.lines.inside, ed.doc.lines.outside);
    if (all.length) { const xs = all.map(p => p[0]), ys = all.map(p => p[1]); x0 = Math.min(...xs) - 50; y0 = Math.min(...ys) - 50; w = Math.max(...xs) - x0 + 50; h = Math.max(...ys) - y0 + 50; }
  }
  ed.view.scale = Math.min(W / w, H / h) * 0.95;
  ed.view.x = (W - w * ed.view.scale) / 2 - x0 * ed.view.scale;
  ed.view.y = (H - h * ed.view.scale) / 2 - y0 * ed.view.scale;
  draw();
}

// ---------- document I/O ----------
function readForm() {
  const d = ed.doc;
  d.name = document.getElementById('inp-name').value.trim() || 'Circuit';
  d.flag = document.getElementById('inp-flag').value.trim() || '🏁';
  d.lengthM = Math.max(200, +document.getElementById('inp-length').value || 3000);
  d.laps = clamp(Math.round(+document.getElementById('inp-laps').value || 3), 1, 20);
  d.drawRoad = document.getElementById('chk-road').checked;
}
function fillForm() {
  const d = ed.doc;
  document.getElementById('inp-name').value = d.name;
  document.getElementById('inp-flag').value = d.flag;
  document.getElementById('inp-length').value = d.lengthM;
  document.getElementById('inp-laps').value = d.laps;
  document.getElementById('chk-road').checked = d.drawRoad !== false;
}
async function loadDoc(doc) {
  ed.doc = doc; ed.undo = []; ed.preview = null; ed.img = null; ed.dirty = false;
  if (doc.image && doc.image.src) { try { ed.img = await loadImage(doc.image.src); } catch (e) { ed.img = null; } }
  fillForm(); fitView(); schedulePreview();
}
function defToDoc(def) {
  const e = def.editor || {};
  return { id: def.id, name: def.name, flag: def.flag || '🏁', lengthM: e.lengthM || def.length || 3000, laps: def.laps || 3, drawRoad: def.drawRoad !== false, image: def.image || null,
    lines: e.lines ? JSON.parse(JSON.stringify(e.lines)) : { racing: def.center.slice(), inside: (def.lines && def.lines.inside) || [], outside: (def.lines && def.lines.outside) || [] }, startIndex: e.startIndex || 0 };
}
async function refreshList(selectId) {
  const sel = document.getElementById('sel-track');
  const list = await Store.list('tracks');
  sel.innerHTML = '<option value="">— nouveau —</option>' + list.map(t => `<option value="${t.id}" ${t.id === selectId ? 'selected' : ''}>${escapeText(t.name)}</option>`).join('');
}
function escapeText(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function saveDoc() {
  readForm();
  if (ed.doc.lines.racing.length < 3) { setStatus('Il faut au moins 3 points sur la ligne idéale.'); return null; }
  if (!ed.doc.id) ed.doc.id = uid('track');
  const def = docToDef(ed.doc);
  try { await Store.put('tracks', def); }
  catch (e) { setStatus('Sauvegarde impossible : ' + e.message); return null; }
  ed.dirty = false;
  await refreshList(def.id);
  setStatus(`« ${def.name} » sauvegardé.`);
  return def;
}

// ---------- init ----------
function init() {
  ed.g = ed.cv.getContext('2d');
  ed.doc = newDoc();
  window.addEventListener('resize', resize);
  resize(); fitView();
  ed.cv.addEventListener('pointerdown', onPointerDown);
  ed.cv.addEventListener('pointermove', onPointerMove);
  ed.cv.addEventListener('pointerup', onPointerUp);
  ed.cv.addEventListener('pointercancel', onPointerUp);
  ed.cv.addEventListener('wheel', onWheel, { passive: false });
  ed.cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { ed.space = true; e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && ed.undo.length) { ed.doc.lines = JSON.parse(ed.undo.pop()); schedulePreview(); draw(); }
    if (e.key === '1') setActive('racing'); if (e.key === '2') setActive('inside'); if (e.key === '3') setActive('outside');
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') ed.space = false; });
  for (const n of ['racing', 'inside', 'outside']) document.getElementById('t-' + n).onclick = () => setActive(n);
  document.getElementById('btn-start').onclick = () => { ed.placingStart = true; setActive('racing'); setStatus('Clique sur un point de la ligne idéale pour y placer le départ.'); };
  document.getElementById('btn-reverse').onclick = () => { pushUndo(); for (const n of ['racing', 'inside', 'outside']) ed.doc.lines[n].reverse(); ed.doc.startIndex = Math.max(0, ed.doc.lines.racing.length - 1 - ed.doc.startIndex); schedulePreview(); draw(); };
  document.getElementById('btn-clear').onclick = () => { pushUndo(); ed.doc.lines[ed.active] = []; if (ed.active === 'racing') ed.doc.startIndex = 0; schedulePreview(); draw(); };
  document.getElementById('btn-derive').onclick = deriveSideLines;
  document.getElementById('btn-new').onclick = () => { if (ed.dirty && !confirm('Abandonner les modifications ?')) return; loadDoc(newDoc()); refreshList(''); };
  document.getElementById('btn-delete').onclick = async () => { if (!ed.doc.id) return; if (!confirm('Supprimer ce circuit ?')) return; await Store.del('tracks', ed.doc.id); await loadDoc(newDoc()); refreshList(''); setStatus('Circuit supprimé.'); };
  document.getElementById('sel-track').onchange = async (e) => { const id = e.target.value; if (!id) { loadDoc(newDoc()); return; } const def = await Store.get('tracks', id); if (def) loadDoc(defToDoc(def)); };
  document.getElementById('inp-image').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const src = await readFileAsDataURL(f);
    const img = await loadImage(src);
    ed.img = img; ed.doc.image = { src, w: img.naturalWidth, h: img.naturalHeight }; ed.dirty = true;
    fitView(); schedulePreview();
  };
  document.getElementById('chk-road').onchange = () => { readForm(); schedulePreview(); };
  for (const id of ['inp-length', 'inp-laps', 'inp-name', 'inp-flag']) document.getElementById(id).onchange = () => { readForm(); schedulePreview(); };
  document.getElementById('btn-save').onclick = saveDoc;
  document.getElementById('btn-test').onclick = async () => { const def = await saveDoc(); if (def) location.href = `index.html?track=${encodeURIComponent(def.id)}`; };
  document.getElementById('btn-export').onclick = () => { readForm(); const def = docToDef(ed.doc); if (!def) { setStatus('Rien à exporter.'); return; } if (!def.id) def.id = uid('track'); downloadJSON(def, `${def.name.replace(/[^\w-]+/g, '_')}.slottrack.json`); };
  document.getElementById('btn-import').onclick = () => document.getElementById('inp-import').click();
  document.getElementById('inp-import').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const def = JSON.parse(await f.text()); if (!def.center) throw new Error('format'); if (!def.id) def.id = uid('track'); await loadDoc(defToDoc(def)); setStatus('Importé. Pense à sauvegarder.'); }
    catch (err) { setStatus('Fichier invalide.'); }
  };
  refreshList('');
}
init();
