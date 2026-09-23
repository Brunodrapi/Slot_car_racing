/* Eyes On Line — the online lobby, over WebRTC.
 *
 * The game is served from GitHub Pages or opened as a local file: there is no server to ask who
 * is playing. The two browsers therefore have to find each other on their own, which is what
 * WebRTC does — race data goes straight from one device to the other, and a public directory (the
 * PeerJS broker) only introduces them to each other at the moment of joining.
 *
 * This module knows nothing about racing. All it offers is a board of presences: everyone posts
 * their own, everyone sees the others, and a presence is sent whole every time — so a lost
 * message repairs itself on the next send.
 *
 * Two limits worth knowing: the directory is a free public service, it can be slow or down; and
 * with no relay server, two devices behind very closed networks may never manage to reach each
 * other. The game says so rather than waiting for ever.
 *
 * Taken from Botminton, where the same surface also stands in for the claude.ai `room` capability.
 */
(function (root) {
  'use strict';

  const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
  const PREFIX = 'slot-racer-v1-';
  /** Optional settings, set before the game loads:
   *  `window.SLOT_RACER_RTC = { lib: '…/peerjs.min.js', peer: { host, port, path, secure } }`.
   *  Without them we take the library from cdnjs and the public PeerJS directory; with them you
   *  can point at your own signalling server, which only ever sees introductions. */
  const cfg = () => root.SLOT_RACER_RTC || {};
  const OPEN_TIMEOUT = 12000;     // past this, the directory is not answering
  const DIAL_TIMEOUT = 15000;     // past this, the table does not exist or the peer is unreachable

  let libPromise = null;
  function loadLib() {
    if (root.Peer) return Promise.resolve(root.Peer);
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = cfg().lib || LIB;
      s.onload = () => (root.Peer ? resolve(root.Peer) : reject(new Error('peerjs absent')));
      s.onerror = () => reject(new Error('peerjs introuvable'));
      document.head.appendChild(s);
    }).catch((e) => { libPromise = null; throw e; });
    return libPromise;
  }

  class RoomRTC {
    constructor() {
      this.peer = null;
      this.conns = [];
      this.mine = {};
      this.others = new Map();      // label -> { presence, updatedAt }
      this.label = null;
      this.peerHandlers = [];
      this.connHandlers = [];
      this.open = false;
      this.error = null;
    }

    /** The host's label starts with 0 and a guest's with 1, so the sort the net layer applies to
     *  pick a host always lands on whoever opened the table. */
    static labelFor(code, asHost) {
      return (asHost ? '0-' : '1-') + code + '-' + Math.random().toString(36).slice(2, 8);
    }

    /** Opens table `code`: as host we claim the id, as guest we dial it. */
    async claim(code, asHost) {
      await loadLib();
      this.close();
      this.label = RoomRTC.labelFor(code, asHost);
      const id = PREFIX + code;
      const peer = new root.Peer(asHost ? id : undefined, Object.assign({ debug: 0 }, cfg().peer));
      this.peer = peer;

      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('annuaire injoignable')), OPEN_TIMEOUT);
        peer.on('open', () => { clearTimeout(t); resolve(); });
        peer.on('error', (e) => {
          clearTimeout(t);
          // 'id unavailable' means this table code is already in use.
          reject(new Error(e && e.type === 'unavailable-id' ? 'code déjà pris' : (e && e.type) || 'erreur'));
        });
      });

      peer.on('error', (e) => {
        const t = e && e.type;
        if (t === 'peer-unavailable') this.fail('table introuvable');
        else if (t === 'network' || t === 'server-error' || t === 'socket-error') this.fail('annuaire injoignable');
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (_) { /* we retry later */ } });

      if (asHost) {
        peer.on('connection', (c) => this.wire(c));
      } else {
        const c = peer.connect(id, { reliable: false, serialization: 'json' });
        await new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('table introuvable')), DIAL_TIMEOUT);
          c.on('open', () => { clearTimeout(t); resolve(); });
          c.on('error', () => { clearTimeout(t); reject(new Error('table introuvable')); });
        });
        this.wire(c);
      }
      this.open = true;
      this.fire();
      for (const h of this.connHandlers) h(true);
      return code;
    }

    /** Wires a connection: we introduce ourselves, then each message replaces that peer's presence. */
    wire(c) {
      this.conns.push(c);
      c.on('open', () => { this.send(c, this.mine); this.fire(); });
      if (c.open) this.send(c, this.mine);
      c.on('data', (d) => {
        if (!d || typeof d !== 'object' || typeof d.from !== 'string') return;
        // A presence is sent whole every frame, so a lost message repairs itself.
        this.others.set(d.from, { presence: d.p && typeof d.p === 'object' ? d.p : {}, updatedAt: Date.now() });
        // The host relays to the others, so everyone sees everyone.
        for (const o of this.conns) if (o !== c && o.open) { try { o.send(d); } catch (_) { /* ignore */ } }
        this.fire();
      });
      const gone = () => {
        this.conns = this.conns.filter((x) => x !== c);
        for (const [k, v] of this.others) if (v.conn === c) this.others.delete(k);
        // With no registry of labels, drop the ones no connection carries any more.
        if (!this.conns.length) this.others.clear();
        this.fire();
      };
      c.on('close', gone);
      c.on('error', gone);
    }

    send(c, presence) {
      if (!c || !c.open) return;
      try { c.send({ from: this.label, p: presence }); } catch (_) { /* the next frame retries */ }
    }

    fail(msg) {
      this.error = msg;
      this.open = false;
      for (const h of this.connHandlers) h(false);
      this.fire();
    }

    /* ------------------------------------------------------------------ the presence board */

    presence(patch) {
      for (const k in patch) { if (patch[k] === null) delete this.mine[k]; else this.mine[k] = patch[k]; }
      for (const c of this.conns) this.send(c, this.mine);
      this.fire();
      return Promise.resolve();
    }

    peers() {
      const list = [{ peer: this.label, by: null, isMe: true, sameTab: true, kind: 'viewer',
                      presence: this.mine, updatedAt: Date.now() }];
      for (const [k, v] of this.others)
        list.push({ peer: k, by: null, isMe: false, sameTab: false, kind: 'viewer',
                    presence: v.presence, updatedAt: v.updatedAt });
      return list;
    }

    fire() {
      const p = this.peers();
      for (const h of this.peerHandlers) h({ peers: p, joined: p, left: [], updated: [] });
    }

    onPeers(h) {
      this.peerHandlers.push(h);
      setTimeout(() => h({ peers: this.peers(), joined: this.peers(), left: [], updated: [] }), 0);
      return () => { this.peerHandlers = this.peerHandlers.filter((x) => x !== h); };
    }

    onConnection(h) {
      this.connHandlers.push(h);
      setTimeout(() => h(this.open), 0);
      return () => { this.connHandlers = this.connHandlers.filter((x) => x !== h); };
    }

    connected() { return this.open && this.conns.some((c) => c.open); }

    close() {
      for (const c of this.conns) { try { c.close(); } catch (_) { /* ignore */ } }
      this.conns = [];
      this.others.clear();
      if (this.peer) { try { this.peer.destroy(); } catch (_) { /* ignore */ } }
      this.peer = null;
      this.open = false;
    }
  }

  RoomRTC.available = () => typeof RTCPeerConnection !== 'undefined';
  root.RoomRTC = RoomRTC;
  if (typeof module !== 'undefined') module.exports = { RoomRTC };
})(typeof window !== 'undefined' ? window : globalThis);
