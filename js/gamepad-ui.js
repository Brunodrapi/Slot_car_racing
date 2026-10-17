// Navigation des vrais éléments DOM : mêmes actions et mêmes sauvegardes qu'au clic.
'use strict';
class GamepadUI {
  constructor(ui) { this.ui = ui; this.active = false; this.enabled = false; this.panel = null; }
  connected() { return this.ui.app.desktop && this.ui.app.controls?.padIndex != null; }
  scope() { return this.panel?.node || this.ui.root; }
  items(scope = this.scope()) {
    return [...scope.querySelectorAll('button,select,input:not([type="hidden"]),textarea,a[href]')]
      .filter(el => !el.disabled && el.tabIndex >= 0 && !el.classList.contains('railarrow')
        && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }
  key(el) { return el?.id ? 'id:' + el.id : el?.dataset.action ? JSON.stringify(el.dataset) : null; }
  remember() { return this.active && !this.panel ? this.key(document.activeElement) : null; }
  restore(key) {
    this.closePanel(false);
    if (this.active && this.connected()) this.focus(this.items().find(el => key && this.key(el) === key) || this.preferred());
    this.sync();
  }
  preferred(scope = this.scope()) {
    const items = this.items(scope);
    return items.find(el => el.classList.contains('primary')) || items.find(el => el.classList.contains('sel')) || items[0];
  }
  focus(el) {
    if (!el) return;
    document.querySelectorAll('.pad-focus').forEach(e => e.classList.remove('pad-focus'));
    el.classList.add('pad-focus'); el.focus({preventScroll:true});
    el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  }
  mouse() {
    this.active = false;
    document.querySelectorAll('.pad-focus').forEach(e => e.classList.remove('pad-focus'));
  }
  sync() {
    const connected = this.connected(), menu = connected && !this.ui.root.classList.contains('hidden');
    document.body.classList.toggle('gamepad-menu', menu);
    if (!this.guide && menu) {
      this.guide = document.createElement('div'); this.guide.className = 'pad-guide'; this.guide.setAttribute('role','note');
      document.body.appendChild(this.guide);
    }
    if (this.guide) {
      this.guide.hidden = !menu;
      const text = this.ui.t(this.panel?.kind === 'text' ? 'padTextGuide' : 'padGuide');
      if (this.guide.textContent !== text) this.guide.textContent = text;
    }
    if (!connected) { this.closePanel(false); this.mouse(); }
    if (menu && !this.enabled) { this.active = true; this.focus(this.preferred()); }
    this.enabled = connected;
  }
  command(command) {
    if (!this.connected() || this.ui.root.classList.contains('hidden')) return;
    this.active = true;
    if (command === 'back') { this.back(); return; }
    if (command === 'delete') { if (this.panel?.kind === 'text') this.textKey('delete'); return; }
    if (!this.items().includes(document.activeElement)) this.focus(this.preferred());
    if (command === 'accept') { this.accept(document.activeElement); return; }
    if (command === 'next' || command === 'previous') { this.section(command === 'next' ? 1 : -1); return; }
    this.move(command);
  }
  inRail(el) {
    const rail = el.closest('[data-rail]');
    if (!rail) return true;
    const r = el.getBoundingClientRect(), b = rail.getBoundingClientRect(), x = r.x + r.width / 2;
    return x >= b.left && x <= b.right;
  }
  move(direction) {
    const el = document.activeElement, horizontal = direction === 'left' || direction === 'right', sign = ['left','up'].includes(direction) ? -1 : 1;
    if (horizontal && el.tagName === 'SELECT') { this.changeSelect(el, sign); return; }
    if (horizontal && el.type === 'number') {
      sign > 0 ? el.stepUp() : el.stepDown(); el.dispatchEvent(new Event('change',{bubbles:true})); return;
    }
    const rail = el.closest('[data-rail]');
    if (horizontal && rail) {
      const row = this.items(rail), next = row[row.indexOf(el) + sign];
      if (next) { this.focus(next); return; }
    }
    const a = el.getBoundingClientRect(), ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    let best = null, score = Infinity;
    for (const candidate of this.items()) {
      if (candidate === el || !this.inRail(candidate)) continue;
      const b = candidate.getBoundingClientRect(), dx = b.x + b.width / 2 - ax, dy = b.y + b.height / 2 - ay;
      const main = (horizontal ? dx : dy) * sign, cross = Math.abs(horizontal ? dy : dx);
      if (main <= 4) continue;
      const beam = horizontal ? a.top < b.bottom && b.top < a.bottom : a.left < b.right && b.left < a.right;
      const cost = main + cross * 2 + (beam ? 0 : 1200);
      if (cost < score) { score = cost; best = candidate; }
    }
    this.focus(best);
  }
  section(sign) {
    const selector = '[data-pad-group],[data-rail],.seg,.pc-controls,.form>label,.row.end,.topbar,.menu';
    const groups = [];
    for (const el of this.items()) {
      const group = el.closest(selector) || el;
      if (!groups.includes(group)) groups.push(group);
    }
    const current = document.activeElement.closest(selector) || document.activeElement;
    const next = groups[(groups.indexOf(current) + sign + groups.length) % groups.length];
    if (next) this.focus(this.items().includes(next) ? next : this.items(next).find(el => el.classList.contains('sel')) || this.preferred(next));
  }
  accept(el) {
    if (!el || el.disabled) return;
    if (el.tagName === 'SELECT') { this.openSelect(el); return; }
    if (el.matches('input,textarea')) { this.openText(el); return; }
    if (['resetAll','wsDelete'].includes(el.dataset.action)) { this.openConfirm(el); return; }
    el.click();
  }
  back() {
    if (this.panel) { this.closePanel(); return; }
    if (this.ui.app.state === 'paused') { this.ui.app.resume(); return; }
    if (this.ui.root.querySelector('.desktop-home,.poster,.splash')) return;
    const button = this.ui.root.querySelector('.topbar [data-action], [data-action="setup"], [data-action="menu"], [data-action="toLobby"]');
    if (button) button.click();
  }
  changeSelect(el, sign) {
    const options = [...el.options].filter(o => !o.disabled && !o.parentElement.disabled);
    const i = options.indexOf(el.selectedOptions[0]), option = options[clamp(i + sign, 0, options.length - 1)];
    if (option && option !== el.selectedOptions[0]) { el.value = option.value; el.dispatchEvent(new Event('change',{bubbles:true})); }
  }
  label(el) {
    const label = el.labels?.[0]?.cloneNode(true);
    if (label) { label.querySelectorAll('input,select,textarea').forEach(e => e.remove()); return label.textContent.trim(); }
    return el.getAttribute('aria-label') || this.ui.t('settings');
  }
  openPanel(target, kind, html) {
    this.closePanel(false);
    const node = document.createElement('div'); node.className = 'pad-modal';
    node.innerHTML = `<div class="pad-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(this.label(target))}">${html}</div>`;
    node.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (e.target === node || button?.hasAttribute('data-pad-close')) { this.closePanel(); return; }
      if (!button) return;
      if (button.hasAttribute('data-pad-option')) {
        const value = button.dataset.padOption; this.closePanel(); target.value = value;
        target.dispatchEvent(new Event('change',{bubbles:true}));
      } else if (button.hasAttribute('data-pad-confirm')) { this.closePanel(); this.ui._act(target,true); }
      else if (button.hasAttribute('data-pad-commit')) this.commitText();
      else if (button.hasAttribute('data-pad-key')) this.textKey(button.dataset.padKey);
    });
    node.addEventListener('keydown',e=>{ if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.closePanel();} });
    this.panel = {node,target,kind,value:target.value || ''}; document.body.appendChild(node);
    this.focus(kind === 'text' ? this.items()[0] : this.preferred()); this.sync();
  }
  closePanel(restore = true) {
    if (!this.panel) return;
    const {node,target} = this.panel; this.panel = null; node.remove();
    if (restore && target.isConnected) this.focus(target);
  }
  openSelect(el) {
    const options = [...el.options].filter(o => !o.disabled && !o.parentElement.disabled);
    this.openPanel(el,'select',`<h2>${escapeHtml(this.label(el))}</h2><div class="pad-options" data-pad-group>
      ${options.map(o => `<button data-pad-option="${escapeHtml(o.value)}" class="${o.selected?'primary':''}">${escapeHtml(o.textContent)}</button>`).join('')}</div>
      <button data-pad-close>${this.ui.t('padCancel')}</button>`);
  }
  openText(el) {
    const alphabet = el.type === 'number' ? '0123456789' : el.id === 'inp-code' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    this.openPanel(el,'text',`<h2>${escapeHtml(this.label(el))}</h2><output data-pad-text aria-live="polite">${escapeHtml(el.value)}</output>
      <div class="pad-keys" data-pad-group>${[...alphabet].map(k=>`<button data-pad-key="${k}">${k}</button>`).join('')}</div>
      <div class="row" data-pad-group><button data-pad-key="delete">${this.ui.t('padDelete')}</button><button data-pad-key="clear">${this.ui.t('padClear')}</button>
      ${['inp-nom','inp-name','inp-code'].includes(el.id)?'':`<button data-pad-key=" ">${this.ui.t('padSpace')}</button>`}</div>
      <div class="row" data-pad-group><button data-pad-commit class="primary">${this.ui.t('padDone')}</button><button data-pad-close>${this.ui.t('padCancel')}</button></div>`);
  }
  textKey(key) {
    const p = this.panel;
    if (!p || p.kind !== 'text') return;
    const max = p.target.maxLength > 0 ? p.target.maxLength : 24;
    p.value = key === 'delete' ? p.value.slice(0,-1) : key === 'clear' ? '' : (p.value + key).slice(0,max);
    p.node.querySelector('[data-pad-text]').textContent = p.value;
  }
  commitText() {
    const {target,value} = this.panel; this.closePanel(); target.value = value;
    target.dispatchEvent(new Event('input',{bubbles:true})); target.dispatchEvent(new Event('change',{bubbles:true}));
  }
  openConfirm(el) {
    this.openPanel(el,'confirm',`<h2>${this.ui.t(el.dataset.action === 'resetAll' ? 'resetConfirm' : 'confirmDelete')}</h2>
      <div class="row"><button data-pad-close class="primary">${this.ui.t('padCancel')}</button><button data-pad-confirm>${this.ui.t('padConfirm')}</button></div>`);
  }
}
