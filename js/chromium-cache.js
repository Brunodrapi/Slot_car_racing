// Cache rollout: desktop Chrome/Edge only. Diagnostic pages manage their own renderer.
window.addEventListener('DOMContentLoaded', async () => {
  if (new URLSearchParams(location.search).has('diagnostic')) return;
  if (mobileDevice() || !/Chrome\/|Edg\//.test(navigator.userAgent) || /OPR\/|SamsungBrowser\//.test(navigator.userAgent)) return;
  const app = window.app;
  if (!app) return;
  try {
    if (!window.installChromiumCacheFix(app, 8)) return;
  } catch (error) {
    console.warn('Cache indisponible, rendu habituel conservé.', error);
    return;
  }
  let shown = false;
  const startRace = app._startRace;
  app._startRace = function(...args) {
    const result = startRace.apply(this, args);
    if (!shown) {
      shown = true;
      const notice = document.createElement('div');
      notice.id = 'browser-performance-notice';
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'position:fixed;z-index:10000;top:100px;left:50%;transform:translateX(-50%);max-width:80vw;padding:12px 18px;background:#191c20ee;color:#f3e5c6;font:14px system-ui;border:1px solid #d5c39e;border-radius:8px;box-shadow:0 3px 12px #0005';
      const text = document.createElement('span');
      text.textContent = 'Pour une expérience optimisée, utilisez Firefox.';
      const close = document.createElement('button');
      close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Fermer');
      close.style.cssText = 'margin-left:12px;background:none;border:0;color:inherit;font-size:20px;cursor:pointer';
      close.onclick = () => notice.remove();
      notice.append(text, close); document.body.append(notice);
      setTimeout(() => notice.remove(), 8000);
    }
    return result;
  };
});
