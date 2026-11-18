(function () {
  'use strict';

  /* ================= Tirage équilibré ================= */
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }
  function avg(t) { return t.reduce((s, p) => s + p.level, 0) / t.length; }
  function spreadOf(teams) {
    const a = teams.map(avg);
    return Math.max.apply(null, a) - Math.min.apply(null, a);
  }
  function tensPairs(teams) {
    return teams.reduce((s, t) => {
      const c = t.filter(p => p.level === 10).length;
      return s + c * (c - 1) / 2;
    }, 0);
  }
  /* Profils de jeu : en plus de la note, le tirage répartit chaque profil entre les équipes. */
  const TAGS = [
    { id: 'passeur', label: 'Passeur', plural: 'passeurs' },
    { id: 'attaquant', label: 'Attaquant', plural: 'attaquants' },
    { id: 'defenseur', label: 'Défenseur', plural: 'défenseurs' },
    { id: 'sprinter', label: 'Sprinter', plural: 'sprinters' },
    { id: 'endurant', label: 'Cardio', plural: 'cardio' },
    { id: 'cardio', label: 'Pas de cardio', plural: 'sans cardio' }
  ];
  /* « Cardio » et « Pas de cardio » s'excluent : choisir l'un retire l'autre. */
  const TAG_OPPOSITE = { endurant: 'cardio', cardio: 'endurant' };
  const TAG_IDS = TAGS.map(t => t.id);
  const cleanTags = v => (Array.isArray(v) ? TAG_IDS.filter(id => v.includes(id)) : []);
  const tagSig = p => (p.tags || []).join(',');
  /* Écart de chaque profil entre l'équipe qui en a le plus et celle qui en a le moins, au-delà de l'inévitable. */
  function profileGap(teams) {
    let gap = 0;
    TAG_IDS.forEach(id => {
      const c = teams.map(t => t.filter(p => p.tags && p.tags.includes(id)).length);
      const total = c.reduce((a, b) => a + b, 0);
      if (!total) return;
      const floor = total % teams.length ? 1 : 0;
      gap += Math.max(0, Math.max.apply(null, c) - Math.min.apply(null, c) - floor);
    });
    return gap;
  }
  /* La note reste prioritaire : un profil mal réparti pèse comme 0,3 point d'écart de moyenne. */
  const PROFILE_WEIGHT = 0.3;
  function costOf(teams) { return spreadOf(teams) + 10 * tensPairs(teams) + PROFILE_WEIGHT * profileGap(teams); }
  function improve(teams) {
    let cur = costOf(teams), changed = true, guard = 0;
    while (changed && guard++ < 200) {
      changed = false;
      outer:
      for (let a = 0; a < teams.length; a++) {
        for (let b = a + 1; b < teams.length; b++) {
          for (let i = 0; i < teams[a].length; i++) {
            for (let j = 0; j < teams[b].length; j++) {
              const x = teams[a][i], y = teams[b][j];
              if (x.level === y.level && tagSig(x) === tagSig(y)) continue;
              teams[a][i] = y; teams[b][j] = x;
              const s = costOf(teams);
              if (s < cur - 1e-9) { cur = s; changed = true; break outer; }
              teams[a][i] = x; teams[b][j] = y;
            }
          }
        }
      }
    }
    return cur;
  }
  function sizesFor(n, k) {
    const base = Math.floor(n / k), rem = n % k;
    return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
  }
  function sigOf(teams) {
    return teams.map(t => t.map(p => p.id).sort().join(',')).sort().join('|');
  }
  function generate(pool, k, lastSig) {
    const sizes = sizesFor(pool.length, k);
    const found = [];
    for (let r = 0; r < 80; r++) {
      const arr = shuffle(pool);
      let idx = 0;
      const teams = sizes.map(s => { const t = arr.slice(idx, idx + s); idx += s; return t; });
      const sc = improve(teams);
      found.push({ teams: teams, sc: sc, sig: sigOf(teams) });
    }
    const min = Math.min.apply(null, found.map(f => f.sc));
    let good = found.filter(f => f.sc <= min + 1e-9);
    if (new Set(good.map(f => f.sig)).size < 2) good = found.filter(f => f.sc <= min + 0.2 + 1e-9);
    const fresh = good.filter(f => f.sig !== lastSig);
    const list = fresh.length ? fresh : good;
    const pick = list[Math.floor(Math.random() * list.length)];
    const teams = shuffle(pick.teams).map(t => t.slice().sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'fr')));
    return { teams: teams, spread: spreadOf(pick.teams), sig: pick.sig, warn: tensPairs(pick.teams) > 0, gap: profileGap(pick.teams) };
  }

  /* ================= Classement ================= */
  /* MVP : à 2 équipes, 3 joueurs élus par vote ; à 3 ou 4 équipes, toute l'équipe gagnante. */
  const MVP_VOTES = 3;
  /* Périodes : une saison = 2 semestres. Les données saisies avant cette notion comptent pour le semestre 2 de 2026. */
  const INITIAL = { season: '2026', sem: 2 };
  const pkey = (season, sem) => season + '-' + sem;
  const matchSeason = m => String(m.season || INITIAL.season);
  const matchSem = m => (m.sem === 1 || m.sem === 2 ? m.sem : INITIAL.sem);
  function cleanPts(raw, legacyBonus) {
    const out = {};
    if (raw && typeof raw === 'object') Object.keys(raw).forEach(k => {
      const v = Math.round(Number(raw[k]));
      if (/^[A-Za-z0-9 ._-]{1,20}-[12]$/.test(k) && v > 0) out[k] = Math.min(v, 999);
    });
    const b = Math.round(Number(legacyBonus));
    const k0 = pkey(INITIAL.season, INITIAL.sem);
    if (b > 0 && !(k0 in out)) out[k0] = Math.min(b, 999);
    return out;
  }
  function cleanPeriod(d) {
    return d && typeof d.season === 'string' && /^[A-Za-z0-9 ._-]{1,20}$/.test(d.season) && (d.sem === 1 || d.sem === 2)
      ? { season: d.season, sem: d.sem } : null;
  }
  function mvpsOf(m) {
    if (Array.isArray(m.mvps)) return m.mvps;
    return m.teams.length > 2 && m.winner !== -1 ? m.teams[m.winner].map(p => p.id) : [];
  }
  function standings(matches, players, keys) {
    const byId = new Map();
    const current = new Map(players.map(p => [p.id, p]));
    matches.forEach(m => {
      const mvps = new Set(mvpsOf(m));
      m.teams.forEach((team, i) => {
        team.forEach(pl => {
          let s = byId.get(pl.id);
          if (!s) { s = { id: pl.id, name: pl.name, played: 0, wins: 0, mvp: 0 }; byId.set(pl.id, s); }
          s.name = pl.name;
          s.played++;
          if (m.winner === i) s.wins++;
          if (mvps.has(pl.id)) s.mvp++;
        });
      });
    });
    /* Points saisis à la main pour les périodes demandées. */
    players.forEach(p => {
      const extra = keys.reduce((t, k) => t + ((p.pts && p.pts[k]) || 0), 0);
      if (!extra) return;
      let s = byId.get(p.id);
      if (!s) { s = { id: p.id, name: p.name, played: 0, wins: 0, mvp: 0 }; byId.set(p.id, s); }
      s.mvp += extra;
    });
    const rows = [...byId.values()].map(s => {
      const cur = current.get(s.id);
      return Object.assign(s, { name: cur ? cur.name : s.name, gone: !cur });
    });
    rows.sort((a, b) => b.mvp - a.mvp || b.wins - a.wins || a.played - b.played || a.name.localeCompare(b.name, 'fr'));
    let rank = 0;
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      if (!prev || prev.mvp !== r.mvp || prev.wins !== r.wins || prev.played !== r.played) rank = i + 1;
      r.rank = rank;
    });
    return rows;
  }

  /* ================= Outils ================= */
  const $ = s => document.querySelector(s);
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k of Object.keys(props)) {
      const v = props[k];
      if (k === 'class') e.className = v;
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    const add = c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  }
  const fmt = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const plural = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  const BIBS = [
    { name: 'Rouge', bg: '#CF3434', ink: '#FFFFFF', dot: '🔴' },
    { name: 'Bleu', bg: '#2F6FD0', ink: '#FFFFFF', dot: '🔵' },
    { name: 'Blanc', bg: '#F6F6F3', ink: '#15191C', dot: '⚪' },
    { name: 'Noir', bg: '#14181B', ink: '#FFFFFF', dot: '⚫' }
  ];
  function paint(el, i) {
    el.style.setProperty('--bib', BIBS[i].bg);
    el.style.setProperty('--ink', BIBS[i].ink);
    return el;
  }

  /* ================= État, gardé sur l'appareil ================= */
  /* Deux modes : « local » (site autonome, données dans le navigateur) et « db »
     (page Claude partagée : joueurs, matchs et tirage sont communs à tous, en direct). */
  const LS_KEY = 'fc-boissons-v1';
  const PREFS_KEY = 'fc-boissons-prefs';
  const state = { players: [], matches: [], draw: null, period: null, k: 2, kAuto: true, showLevels: true, sort: 'alpha' };
  const curPeriod = () => state.period || INITIAL;
  let storageOk = true;
  let mode = 'local';
  let db = null;
  let readOnly = false;
  let playersLoaded = true;
  let loadTimer = null;
  let flushTimer = null;

  function readPrefs(s) {
    if (!s || typeof s !== 'object') return;
    if ([2, 3, 4].includes(s.k)) state.k = s.k;
    if (typeof s.kAuto === 'boolean') state.kAuto = s.kAuto;
    if (typeof s.showLevels === 'boolean') state.showLevels = s.showLevels;
    if (typeof s.sort === 'string') state.sort = s.sort;
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && typeof s === 'object') {
        if (Array.isArray(s.players)) state.players = s.players.filter(p => p && p.id).map(p => { p.pts = cleanPts(p.pts, p.bonus); p.tags = cleanTags(p.tags); delete p.bonus; return p; });
        state.period = cleanPeriod(s.period);
        if (Array.isArray(s.matches)) state.matches = s.matches.filter(validMatch);
        if (s.draw && Array.isArray(s.draw.teams)) state.draw = s.draw;
        readPrefs(s);
      }
      readPrefs(JSON.parse(localStorage.getItem(PREFS_KEY)));
    } catch (e) { storageOk = false; }
  }
  function persist() {
    if (mode !== 'local') {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify({ k: state.k, kAuto: state.kAuto, showLevels: state.showLevels, sort: state.sort })); } catch (e) { /* préférences seulement */ }
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 300);
      return;
    }
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); storageOk = true; }
    catch (e) { storageOk = false; }
    setSync(storageOk ? '' : 'Impossible d’enregistrer sur cet appareil : les changements seront perdus à la fermeture.');
  }
  function setSync(text) {
    const el = $('#sync');
    el.textContent = text || '';
    el.hidden = !text;
  }
  function validMatch(m) {
    return m && Array.isArray(m.teams) && m.teams.length >= 2 && m.teams.length <= 4 && m.teams.every(Array.isArray) &&
      Number.isInteger(m.winner) && m.winner >= -1 && m.winner < m.teams.length;
  }

  /* ---------- synchronisation partagée ---------- */
  const COLLS = ['players', 'matches', 'state'];
  const mirror = { players: new Map(), matches: new Map(), state: new Map() };   /* ce que le serveur a (ou va recevoir) */
  const remote = { players: new Map(), matches: new Map(), state: new Map() };   /* dernier état reçu du serveur */
  const chains = new Map();
  const clone = v => JSON.parse(JSON.stringify(v));
  function canon(v) {
    if (v === undefined) return '';
    return JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x)
      ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);
  }
  function localDocs(c) {
    const m = new Map();
    if (c === 'players') state.players.forEach(p => {
      const d = { name: p.name, level: p.level, present: !!p.present };
      if (p.tags && p.tags.length) d.tags = p.tags;
      if (p.pts && Object.keys(p.pts).length) d.pts = p.pts;
      m.set(p.id, d);
    });
    else if (c === 'matches') state.matches.forEach(x => { const d = Object.assign({}, x); delete d.id; m.set(x.id, d); });
    else {
      if (state.draw) m.set('draw', state.draw);
      if (state.period) m.set('period', state.period);
    }
    return m;
  }
  function applyDocs(c, m) {
    if (c === 'players') {
      state.players = [...m].map(([id, d]) => ({ id: id, name: String(d.name || '?').slice(0, 30), level: clamp(Math.round(Number(d.level)) || 5, 1, 10), present: !!d.present, pts: cleanPts(d.pts, d.bonus), tags: cleanTags(d.tags) }));
    } else if (c === 'matches') {
      state.matches = [...m].map(([id, d]) => Object.assign(clone(d), { id: id })).filter(validMatch)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    } else {
      const d = m.get('draw');
      state.draw = d && Array.isArray(d.teams) && d.teams.length >= 2 && d.teams.length <= 4 ? clone(d) : null;
      state.period = cleanPeriod(m.get('period'));
    }
  }
  function flush() {
    if (mode !== 'db' || readOnly) return;
    COLLS.forEach(c => {
      const loc = localDocs(c), mir = mirror[c];
      new Set([...loc.keys(), ...mir.keys()]).forEach(id => {
        const l = loc.get(id);
        if (canon(l) === canon(mir.get(id))) return;
        if (l === undefined) mir.delete(id); else mir.set(id, clone(l));
        const key = c + '/' + id;
        /* Une écriture à la fois par document ; chacune envoie la valeur la plus récente. */
        chains.set(key, (chains.get(key) || Promise.resolve()).then(() => {
          const v = mirror[c].get(id);
          const ref = db.collection(c).doc(id);
          return v === undefined ? ref.delete() : ref.set(v);
        }).catch(onWriteError));
      });
    });
  }
  function onWriteError(e) {
    const code = e && e.code;
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked' || code === 'permission-denied') {
      if (readOnly) return;
      readOnly = true;
      COLLS.forEach(c => { mirror[c] = new Map(remote[c]); applyDocs(c, remote[c]); });
      renderAll();
      setSync('Tu peux consulter, mais pas modifier : demande au propriétaire de la page de te donner le droit de modification.');
    } else if (code === 'quota_exceeded') {
      setSync('L’espace partagé est plein : supprime d’anciens matchs pour pouvoir enregistrer.');
    } else {
      setSync('Une modification n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.');
    }
  }
  let unsubs = [];
  function subscribe(c) {
    const off = db.collection(c).onSnapshot(snap => {
      if (!snap.metadata.fromCache) { clearTimeout(loadTimer); if (!readOnly) setSync(''); }
      const next = new Map();
      snap.docs.forEach(d => next.set(d.id, clone(d.data() || {})));
      /* Fusion : ce qu'on vient de modifier ici et qui n'est pas encore parti reste prioritaire. */
      const loc = localDocs(c), mir = mirror[c], merged = new Map();
      new Set([...loc.keys(), ...mir.keys(), ...next.keys()]).forEach(id => {
        const l = loc.get(id);
        const v = canon(l) === canon(mir.get(id)) ? next.get(id) : l;
        if (v !== undefined) merged.set(id, v);
      });
      remote[c] = next;
      mirror[c] = new Map(next);
      applyDocs(c, merged);
      if (c === 'players') playersLoaded = true;
      renderAll();
      flush();
    }, e => {
      clearTimeout(loadTimer);
      if (c === 'players') playersLoaded = true;
      renderAll();
      setSync(e && e.code === 'permission-denied'
        ? 'Ce compte n’est pas autorisé à voir les données. Demande à l’organisateur d’ajouter ton adresse e-mail.'
        : 'Les données partagées sont inaccessibles pour le moment.');
    });
    if (typeof off === 'function') unsubs.push(off);
  }

  /* ---------- Firebase (site autonome) : connexion Google + Firestore ---------- */
  /* Firestore refuse les tableaux imbriqués : les équipes sont emballées à l'écriture, déballées à la lecture. */
  function fsEncode(v) {
    const d = clone(v);
    if (Array.isArray(d.teams)) d.teams = d.teams.map(t => ({ players: t }));
    return d;
  }
  function fsDecode(d) {
    const v = clone(d || {});
    if (Array.isArray(v.teams)) v.teams = v.teams.map(t => (t && Array.isArray(t.players) ? t.players : t));
    return v;
  }
  function firestoreAdapter(fs) {
    return {
      collection: c => ({
        onSnapshot: (next, err) => fs.collection(c).onSnapshot(
          snap => next({ metadata: snap.metadata, docs: snap.docs.map(d => ({ id: d.id, data: () => fsDecode(d.data()) })) }), err),
        /* Hors connexion, Firestore met l'écriture en attente : on ne bloque pas la file dessus. */
        doc: id => ({
          set: v => { fs.collection(c).doc(id).set(fsEncode(v)).catch(onWriteError); return Promise.resolve(); },
          delete: () => { fs.collection(c).doc(id).delete().catch(onWriteError); return Promise.resolve(); }
        })
      })
    };
  }
  function resetShared() {
    unsubs.forEach(off => off());
    unsubs = [];
    clearTimeout(loadTimer);
    COLLS.forEach(c => { mirror[c] = new Map(); remote[c] = new Map(); });
    state.players = []; state.matches = []; state.draw = null; state.period = null;
    readOnly = false;
  }
  function startFirebase(cfg) {
    const bar = $('#auth'), who = $('#auth-who'), btn = $('#auth-btn');
    mode = 'loading';
    state.players = []; state.matches = []; state.draw = null; state.period = null;
    if (!window.firebase) {
      playersLoaded = true;
      setSync('Connexion au serveur impossible. Vérifie ta connexion internet puis recharge la page.');
      return;
    }
    playersLoaded = false;
    firebase.initializeApp(cfg);
    const auth = firebase.auth();
    const fs = firebase.firestore();
    bar.hidden = false;
    btn.addEventListener('click', () => {
      if (auth.currentUser) { auth.signOut(); return; }
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch(e => {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return auth.signInWithRedirect(provider);
        if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return;
        setSync('La connexion a échoué. Réessaie.');
      });
    });
    auth.onAuthStateChanged(user => {
      resetShared();
      if (!user) {
        mode = 'loading';
        playersLoaded = true;
        who.textContent = '';
        btn.textContent = 'Se connecter avec Google';
        renderAll();
        setSync('Connecte-toi pour voir les joueurs et le classement.');
        return;
      }
      who.textContent = user.displayName || user.email || 'Connecté';
      btn.textContent = 'Se déconnecter';
      setSync('');
      db = firestoreAdapter(fs);
      mode = 'db';
      playersLoaded = false;
      renderAll();
      $('#sub').textContent = 'Les joueurs, le tirage, le classement. Partagés en direct.';
      loadTimer = setTimeout(() => setSync('Les données partagées ne répondent pas encore. Ce qui est affiché peut être en retard.'), 10000);
      COLLS.forEach(subscribe);
    });
  }
  async function startShared() {
    if (!(window.claude && window.claude.use)) {
      if (window.FC_FIREBASE) startFirebase(window.FC_FIREBASE);
      return;
    }
    const backup = { players: state.players, matches: state.matches, draw: state.draw, period: state.period };
    mode = 'loading';
    playersLoaded = false;
    state.players = []; state.matches = []; state.draw = null; state.period = null;
    let d = null;
    try { d = await window.claude.use('db'); } catch (e) { d = null; }
    if (!d) {
      mode = 'local';
      playersLoaded = true;
      state.players = backup.players.concat(state.players);
      state.matches = backup.matches.concat(state.matches);
      state.draw = state.draw || backup.draw;
      state.period = backup.period;
      renderAll();
      return;
    }
    db = d;
    mode = 'db';
    $('#sub').textContent = 'Les joueurs, le tirage, le classement. Partagés en direct.';
    loadTimer = setTimeout(() => setSync('Les données partagées ne répondent pas encore. Ce qui est affiché peut être en retard.'), 10000);
    COLLS.forEach(subscribe);
  }
  function renderAll() { renderPlayers(true); renderDraw(); renderSummary(); renderRanking(); }

  const player = id => state.players.find(p => p.id === id);

  /* ================= Joueurs ================= */
  const rows = new Map();

  function makeRow(id) {
    const cb = h('input', { type: 'checkbox', class: 'chk' });
    const nameIn = h('input', { type: 'text', class: 'nm', autocomplete: 'off', maxlength: '30', 'aria-label': 'Nom du joueur' });
    const val = h('span', { class: 'lv' });
    const dec = h('button', { type: 'button', class: 'sbtn' }, '−');
    const inc = h('button', { type: 'button', class: 'sbtn' }, '+');
    const del = h('button', { type: 'button', class: 'sbtn del' }, '×');
    const prof = h('div', { class: 'prof' });
    const el = h('li', { class: 'row' }, cb, nameIn, h('div', { class: 'step' }, dec, val, inc), del, prof);
    cb.addEventListener('change', () => {
      player(id).present = cb.checked;
      persist();
      el.classList.toggle('off', !cb.checked);
      renderSummary();
    });
    nameIn.addEventListener('change', () => {
      const p = player(id);
      const v = nameIn.value.trim();
      if (!v) { nameIn.value = p.name; return; }
      p.name = v;
      persist();
      renderPlayers();
      renderSummary();
    });
    const bump = d => {
      const p = player(id);
      const next = clamp(p.level + d, 1, 10);
      if (next === p.level) return;
      p.level = next;
      persist();
      val.textContent = next;
      renderSummary();
    };
    prof.addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      const p = player(id);
      if (b.dataset.tag) {
        const on = (p.tags || []).includes(b.dataset.tag);
        const t = b.dataset.tag;
        p.tags = cleanTags(on ? p.tags.filter(x => x !== t) : (p.tags || []).filter(x => x !== TAG_OPPOSITE[t]).concat(t));
        persist();
        renderSummary();
      } else {
        editing = editing === id ? null : id;
      }
      renderProfile(rows.get(id), p);
    });
    dec.addEventListener('click', () => bump(-1));
    inc.addEventListener('click', () => bump(1));
    del.addEventListener('click', () => {
      state.players = state.players.filter(p => p.id !== id);
      persist();
      renderPlayers();
      renderSummary();
    });
    return { el: el, cb: cb, nameIn: nameIn, val: val, dec: dec, inc: inc, del: del, prof: prof };
  }

  /* Tri de la liste. L'ordre ne bouge pas pendant qu'on coche (ni quand un autre appareil modifie) :
     il est recalculé quand on change de tri, d'onglet, ou qu'on ajoute, renomme ou retire un joueur. */
  const SORTS = {
    alpha: () => 0,
    present: (a, b) => (b.present ? 1 : 0) - (a.present ? 1 : 0),
    played: (a, b, n) => (n.get(b.id) || 0) - (n.get(a.id) || 0),
    level: (a, b) => b.level - a.level,
    mvp: (a, b, n, rank) => (rank.get(a.id) || 1e9) - (rank.get(b.id) || 1e9)
  };
  let orderCache = [];
  function sortedPlayers(keepOrder) {
    const byId = new Map(state.players.map(p => [p.id, p]));
    if (keepOrder && orderCache.length) {
      const kept = orderCache.filter(id => byId.has(id)).map(id => byId.get(id));
      const known = new Set(orderCache);
      return kept.concat(state.players.filter(p => !known.has(p.id)));
    }
    const played = new Map();
    state.matches.forEach(m => m.teams.forEach(t => t.forEach(pl => played.set(pl.id, (played.get(pl.id) || 0) + 1))));
    const cmp = SORTS[state.sort] || SORTS.alpha;
    /* Rang au classement MVP du semestre en cours (même ordre que l'onglet Classement). */
    const rank = new Map();
    if (state.sort === 'mvp') {
      const cur = curPeriod();
      const ms = state.matches.filter(m => matchSeason(m) === cur.season && matchSem(m) === cur.sem);
      standings(ms, state.players, [pkey(cur.season, cur.sem)]).forEach((r, i) => rank.set(r.id, i + 1));
    }
    return state.players.slice().sort((a, b) => cmp(a, b, played, rank) || a.name.localeCompare(b.name, 'fr'));
  }
  /* Profils d'un joueur : badges des profils choisis, ou les 4 boutons quand on modifie. */
  let editing = null;
  function renderProfile(r, p) {
    const tags = p.tags || [];
    const open = editing === p.id;
    const sig = (open ? 'e:' : 'v:') + tags.join(',') + ':' + p.name;
    if (r.prof.dataset.sig === sig) return;
    r.prof.dataset.sig = sig;
    r.prof.textContent = '';
    if (open) {
      TAGS.forEach(t => r.prof.append(h('button', { type: 'button', class: 'tag tag-' + t.id, 'data-tag': t.id, 'aria-pressed': String(tags.includes(t.id)) }, t.label)));
      r.prof.append(h('button', { type: 'button', class: 'tag-edit' }, 'OK'));
    } else {
      tags.forEach(id => { const t = TAGS.find(x => x.id === id); r.prof.append(h('span', { class: 'tag tag-' + id }, t.label)); });
      r.prof.append(h('button', { type: 'button', class: 'tag-edit', 'aria-label': 'Profil de ' + p.name }, tags.length ? 'Modifier' : '+ Profil'));
    }
  }
  function renderPlayers(keepOrder) {
    const arr = sortedPlayers(keepOrder);
    orderCache = arr.map(p => p.id);
    $('#sort').value = SORTS[state.sort] ? state.sort : 'alpha';
    const ids = new Set(arr.map(p => p.id));
    for (const [id, r] of rows) {
      if (!ids.has(id)) { r.el.remove(); rows.delete(id); }
    }
    const list = $('#list');
    let ref = list.firstChild;
    arr.forEach(p => {
      let r = rows.get(p.id);
      if (!r) { r = makeRow(p.id); rows.set(p.id, r); }
      r.cb.checked = !!p.present;
      r.el.classList.toggle('off', !p.present);
      if (document.activeElement !== r.nameIn) r.nameIn.value = p.name;
      r.val.textContent = p.level;
      renderProfile(r, p);
      r.cb.setAttribute('aria-label', 'Présent : ' + p.name);
      r.dec.setAttribute('aria-label', 'Baisser la note de ' + p.name);
      r.inc.setAttribute('aria-label', 'Monter la note de ' + p.name);
      r.del.setAttribute('aria-label', 'Retirer ' + p.name);
      if (ref === r.el) { ref = ref.nextSibling; } else { list.insertBefore(r.el, ref); }
    });
    list.hidden = arr.length === 0;
    $('#empty').hidden = arr.length !== 0;
    $('#empty').textContent = playersLoaded ? 'Aucun joueur pour le moment. Ajoute ton groupe ci-dessus.' : 'Chargement des joueurs…';
    $('#tools').hidden = arr.length === 0;
    $('#sort-wrap').hidden = arr.length < 2;
  }

  /* ================= Liste collée : cocher les présents depuis un message ================= */
  const normName = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  function parseList(text) {
    const seen = new Set(), out = [];
    String(text).split(/[\n,;]+/).forEach(raw => {
      /* On enlève la numérotation, les puces et les emojis en début de ligne, et les « +1 » ou parenthèses en fin. */
      const label = raw.replace(/^[^\p{L}\p{N}]*(\d+\s*[.)\-:/]\s*)?[^\p{L}\p{N}]*/u, '')
        .replace(/\s*(\(.*\)|\+\s*\d+)\s*$/u, '').replace(/[^\p{L}\p{N}.' _-]+/gu, ' ').trim().slice(0, 30);
      const key = normName(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ label: label, key: key });
    });
    return out;
  }
  /* Du plus strict au plus large : nom exact, même prénom, mots communs, début de mot. */
  function candidatesFor(key) {
    const words = key.split(' ');
    const list = state.players.map(p => ({ p: p, n: normName(p.name) })).filter(x => x.n);
    const tiers = [
      x => x.n === key,
      x => x.n.split(' ')[0] === words[0] && (words.length === 1 || x.n.split(' ').length === 1),
      x => { const w = x.n.split(' '); return words.every(k => w.includes(k)) || w.every(k => words.includes(k)); },
      x => key.length >= 3 && x.n.split(' ').some(w => w.startsWith(key))
    ];
    for (const t of tiers) {
      const hit = list.filter(t).map(x => x.p);
      if (hit.length) return hit;
    }
    return [];
  }
  function applyPastedList(text, uncheckOthers) {
    const items = parseList(text);
    if (!items.length) return null;
    const found = new Map(), unsure = [], unknown = [];
    items.forEach(it => {
      const c = candidatesFor(it.key);
      if (c.length === 1) found.set(c[0].id, c[0]);
      else if (c.length > 1) unsure.push({ label: it.label, options: c });
      else unknown.push(it.label);
    });
    if (uncheckOthers) state.players.forEach(p => { p.present = false; });
    found.forEach(p => { p.present = true; });
    persist();
    renderPlayers();
    renderSummary();
    return { found: found.size, unsure: unsure, unknown: unknown };
  }
  function renderPasteResult(r) {
    const box = $('#paste-result');
    box.textContent = '';
    box.hidden = false;
    if (!r) { box.append(h('p', { class: 'note' }, 'Aucun nom trouvé dans ce texte.')); return; }
    box.append(h('p', { class: 'note' }, plural(r.found, 'joueur') + ' coché' + (r.found > 1 ? 's' : '') + '.' +
      (r.unsure.length || r.unknown.length ? ' Il reste ' + plural(r.unsure.length + r.unknown.length, 'nom') + ' à traiter ci-dessous.' : '')));
    const present = id => { const p = player(id); if (p) { p.present = true; persist(); renderPlayers(); renderSummary(); } };
    r.unsure.forEach(u => {
      const row = h('div', { class: 'paste-row' }, h('span', null, '« ' + u.label + ' » : lequel ?'));
      u.options.forEach(p => {
        const b = h('button', { type: 'button', class: 'btn small' }, p.name);
        b.addEventListener('click', () => { present(p.id); row.textContent = ''; row.append(h('span', null, '« ' + u.label + ' » : ' + p.name + ' coché.')); });
        row.append(b);
      });
      box.append(row);
    });
    r.unknown.forEach(label => {
      const row = h('div', { class: 'paste-row' }, h('span', null, '« ' + label + ' » : introuvable.'));
      const b = h('button', { type: 'button', class: 'btn small' }, 'Ajouter comme nouveau joueur');
      b.addEventListener('click', () => {
        state.players.push({ id: newId('p'), name: label, level: 5, present: true, pts: {}, tags: [] });
        persist(); renderPlayers(); renderSummary();
        row.textContent = ''; row.append(h('span', null, label + ' ajouté avec la note 5.'));
      });
      row.append(b);
      box.append(row);
    });
  }

  /* ================= Tirage ================= */
  function poolNow() { return state.players.filter(p => p.present); }
  function keyFor(pool, k) { return pool.map(p => p.id + ':' + p.level + ':' + tagSig(p)).sort().join(',') + '|' + k; }

  function renderSummary() {
    const pool = poolNow();
    const n = pool.length;
    $('#count').textContent = plural(n, 'présent') + ' sur ' + state.players.length;
    if (state.kAuto) state.k = clamp(Math.round(n / 5), 2, 4);
    const k = state.k;

    $('#seg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.k) === k)));

    const hint = $('#hint');
    const go = $('#go');
    if (n < 2 * k) {
      hint.textContent = 'Il faut au moins ' + (2 * k) + ' joueurs présents pour ' + k + ' équipes. Coche les présents dans l’onglet Joueurs.';
      go.disabled = true;
    } else {
      const s = sizesFor(n, k);
      const equal = s.every(x => x === s[0]);
      hint.textContent = n + ' présents : ' + k + ' équipes ' + (equal ? 'de ' + s[0] + ' joueurs.' : '(' + s.join(' / ') + ' joueurs).');
      go.disabled = false;
    }
    go.textContent = state.draw ? 'Tirer à nouveau' : 'Générer les équipes';
    $('#to-match').disabled = n < 4;

    const stale = document.getElementById('stale');
    if (stale) stale.hidden = !state.draw || state.draw.key === keyFor(pool, k);
  }

  function mixOf(team) {
    const parts = TAGS.map(t => ({ t: t, n: team.filter(p => cleanTags(p.tags).includes(t.id)).length })).filter(x => x.n)
      .map(x => x.n + ' ' + (x.n > 1 ? x.t.plural : x.t.label.toLowerCase()));
    return parts.length ? h('p', { class: 'mix' }, parts.join(' · ')) : null;
  }
  function renderDraw() {
    const box = $('#result');
    const draw = state.draw;
    box.textContent = '';
    if (!draw) { box.hidden = true; renderEnd(); return; }
    box.hidden = false;
    const sp = draw.spread;
    const verdict = sp <= 0.31 ? 'Très équilibré' : sp <= 0.81 ? 'Équilibré' : 'Écart marqué';
    const kids = [];
    kids.push(h('div', { class: 'verdict' },
      h('strong', null, verdict),
      h('span', null, 'Écart entre la meilleure et la moins bonne moyenne : ' + fmt(sp))
    ));
    if (draw.warn) {
      kids.push(h('p', { class: 'note' }, 'Il y a plus de joueurs à 10 que d’équipes : impossible d’éviter que deux 10/10 se retrouvent ensemble.'));
    }
    if (draw.gap > 0) {
      kids.push(h('p', { class: 'note' }, 'Les profils ne sont pas parfaitement répartis : équilibrer les notes passe avant. Relance le tirage pour une autre proposition.'));
    }
    kids.push(h('p', { class: 'note', id: 'stale', hidden: true }, 'La liste ou le nombre d’équipes a changé depuis ce tirage. Relance le tirage pour le mettre à jour.'));
    const grid = h('div', { class: 'teams' + (state.showLevels ? '' : ' levels-off') });
    draw.teams.forEach((t, i) => {
      const total = t.reduce((s, p) => s + p.level, 0);
      grid.append(paint(h('article', { class: 'team' },
        h('header', null, h('h3', null, BIBS[i].name), h('span', null, t.length + ' joueurs')),
        h('ul', null, t.map(p => h('li', null,
          h('span', { class: 'who' }, p.name, cleanTags(p.tags).map(id => h('span', { class: 'tag tag-' + id }, TAGS.find(x => x.id === id).label))),
          h('span', { class: 'n' }, p.level)))),
        mixOf(t),
        h('footer', null, 'Total ' + total + ' · moyenne ' + fmt(total / t.length))
      ), i));
    });
    kids.push(grid);

    const copyBtn = h('button', { type: 'button', class: 'btn' }, 'Copier pour WhatsApp');
    const lv = h('input', { type: 'checkbox', id: 'show-levels' });
    lv.checked = state.showLevels;
    lv.addEventListener('change', () => {
      state.showLevels = lv.checked;
      persist();
      grid.classList.toggle('levels-off', !state.showLevels);
    });
    const fallback = h('textarea', { class: 'fallback', readonly: true, hidden: true, 'aria-label': 'Texte à copier' });
    kids.push(h('div', { class: 'res-actions' }, copyBtn, h('label', { class: 'check', for: 'show-levels' }, lv, 'Afficher les notes')));
    kids.push(fallback);
    box.append.apply(box, kids);

    copyBtn.addEventListener('click', async () => {
      const lines = ['⚽ FC Boissons', ''];
      draw.teams.forEach((t, i) => lines.push(BIBS[i].dot + ' ' + BIBS[i].name + ' : ' + t.map(p => p.name).join(', ')));
      const text = lines.join('\n');
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copié';
        setTimeout(() => { copyBtn.textContent = 'Copier pour WhatsApp'; }, 1800);
      } catch (e) {
        fallback.hidden = false;
        fallback.value = text;
        fallback.focus();
        fallback.select();
      }
    });
    renderEnd();
  }

  function runDraw() {
    const pool = poolNow();
    const k = state.k;
    if (pool.length < 2 * k) return;
    const r = generate(pool.map(p => ({ id: p.id, name: p.name, level: p.level, tags: cleanTags(p.tags) })), k, state.draw ? state.draw.sig : null);
    state.draw = { teams: r.teams, spread: r.spread, sig: r.sig, warn: r.warn, gap: r.gap, key: keyFor(pool, k), recorded: null, vote: null };
    persist();
    renderDraw();
    renderSummary();
    $('#result').scrollIntoView({ block: 'start' });
  }

  /* ================= Fin du match ================= */
  function recordMatch(winner, mvps) {
    const draw = state.draw;
    if (!draw || draw.recorded) return;
    const m = {
      id: newId('m'),
      date: new Date().toISOString(),
      winner: winner,
      mvps: mvps,
      season: curPeriod().season,
      sem: curPeriod().sem,
      teams: draw.teams.map(t => t.map(p => ({ id: p.id, name: p.name })))
    };
    state.matches.push(m);
    draw.recorded = m.id;
    draw.vote = null;
    persist();
    renderEnd();
    renderRanking();
  }
  function pickWinner(winner) {
    const draw = state.draw;
    if (draw.teams.length > 2) {
      recordMatch(winner, winner === -1 ? [] : draw.teams[winner].map(p => p.id));
      return;
    }
    draw.vote = { winner: winner, mvps: [] };
    persist();
    renderEnd();
  }
  function namesOf(m, ids) {
    const all = new Map();
    m.teams.forEach(t => t.forEach(p => all.set(p.id, p.name)));
    return ids.map(id => all.get(id)).filter(Boolean);
  }
  function deleteMatch(id) {
    state.matches = state.matches.filter(m => m.id !== id);
    if (state.draw && state.draw.recorded === id) state.draw.recorded = null;
    persist();
    renderEnd();
    renderRanking();
  }
  function outcomeLabel(m) { return m.winner === -1 ? 'Match nul' : 'Victoire ' + BIBS[m.winner].name; }

  function renderEnd() {
    const sec = $('#end');
    const body = $('#end-body');
    const draw = state.draw;
    body.textContent = '';
    if (!draw) { sec.hidden = true; return; }
    sec.hidden = false;

    const done = draw.recorded && state.matches.find(m => m.id === draw.recorded);
    if (done) {
      const mvpNames = namesOf(done, mvpsOf(done));
      const card = h('div', { class: 'recorded' },
        h('strong', null, outcomeLabel(done)),
        h('p', null, mvpNames.length ? 'MVP : ' + mvpNames.join(', ') + '.' : 'Pas de MVP pour ce match.')
      );
      if (done.winner !== -1) paint(card, done.winner);
      const undo = h('button', { type: 'button', class: 'btn small' }, 'Annuler ce résultat');
      const again = h('button', { type: 'button', class: 'btn small' }, 'Rejouer avec les mêmes équipes');
      const see = h('button', { type: 'button', class: 'btn small' }, 'Voir le classement');
      undo.addEventListener('click', () => deleteMatch(done.id));
      again.addEventListener('click', () => { draw.recorded = null; persist(); renderEnd(); });
      see.addEventListener('click', () => show('ranking'));
      card.append(h('div', { class: 'tools' }, see, again, undo));
      body.append(card);
      return;
    }

    const two = draw.teams.length === 2;

    /* Étape 2 (2 équipes) : le vote des 3 MVP. */
    if (two && draw.vote) {
      const vote = draw.vote;
      const total = draw.teams.reduce((s, t) => s + t.length, 0);
      const need = Math.min(MVP_VOTES, total);
      const head = h('div', { class: 'recorded' }, h('strong', null, outcomeLabel(vote)));
      if (vote.winner !== -1) paint(head, vote.winner);
      const counter = h('p', { 'aria-live': 'polite' });
      head.append(counter);
      body.append(head);
      const ok = h('button', { type: 'button', class: 'go' }, 'Valider les MVP');
      const sync = () => {
        const left = need - vote.mvps.length;
        counter.textContent = left > 0
          ? 'Vote des MVP : choisis ' + need + ' joueurs, toutes équipes confondues. Encore ' + left + '.'
          : 'Les ' + need + ' MVP sont choisis.';
        ok.disabled = left !== 0;
      };
      const grid = h('div', { class: 'teams' });
      draw.teams.forEach((t, i) => {
        grid.append(paint(h('article', { class: 'team' },
          h('header', null, h('h3', null, BIBS[i].name)),
          h('ul', null, t.map(p => {
            const b = h('button', { type: 'button', class: 'pick', 'aria-pressed': String(vote.mvps.includes(p.id)) }, h('span', null, p.name), h('span', { class: 'star', 'aria-hidden': 'true' }, '★'));
            b.addEventListener('click', () => {
              const on = vote.mvps.includes(p.id);
              if (!on && vote.mvps.length >= need) return;
              vote.mvps = on ? vote.mvps.filter(x => x !== p.id) : vote.mvps.concat(p.id);
              b.setAttribute('aria-pressed', String(!on));
              persist();
              sync();
            });
            return h('li', { class: 'pick-li' }, b);
          }))
        ), i));
      });
      body.append(grid);
      const back = h('button', { type: 'button', class: 'btn small' }, 'Changer le vainqueur');
      back.addEventListener('click', () => { draw.vote = null; persist(); renderEnd(); });
      ok.addEventListener('click', () => recordMatch(vote.winner, vote.mvps.slice()));
      body.append(ok, h('div', { class: 'tools' }, back));
      sync();
      return;
    }

    /* Étape 1 : le vainqueur. */
    body.append(h('p', { class: 'legend' }, two
      ? 'Qui a gagné ? Ensuite, vous votez pour les 3 MVP du match.'
      : 'Qui a gagné ? Tous les joueurs de l’équipe gagnante sont MVP.'));
    const grid = h('div', { class: 'winners' });
    draw.teams.forEach((t, i) => {
      const b = paint(h('button', { type: 'button', class: 'win' }, BIBS[i].name, h('small', null, 'a gagné')), i);
      b.addEventListener('click', () => pickWinner(i));
      grid.append(b);
    });
    const nul = h('button', { type: 'button', class: 'win draw' }, 'Match nul', h('small', null, two ? 'puis vote des MVP' : 'pas de MVP'));
    nul.addEventListener('click', () => pickWinner(-1));
    grid.append(nul);
    body.append(grid);
  }

  /* ================= Classement ================= */
  const rv = { season: null, scope: null };   /* période affichée ; null = la période en cours */
  function viewed() {
    const cur = curPeriod();
    const season = rv.season || cur.season;
    const scope = rv.scope || String(cur.sem);
    const sems = scope === 'year' ? [1, 2] : [Number(scope)];
    return {
      season: season, scope: scope, sems: sems,
      keys: sems.map(x => pkey(season, x)),
      label: scope === 'year' ? 'Année ' + season : 'Semestre ' + scope + ' · ' + season,
      isCurrent: season === cur.season && scope === String(cur.sem)
    };
  }
  function seasonsKnown() {
    const set = new Set([curPeriod().season]);
    state.matches.forEach(m => set.add(matchSeason(m)));
    state.players.forEach(p => Object.keys(p.pts || {}).forEach(k => set.add(k.slice(0, -2))));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  }
  function nextSeason(label) { return /^\d+$/.test(label) ? String(Number(label) + 1) : (label + ' bis').slice(0, 20); }

  function renderRanking() {
    const box = $('#ranking');
    box.textContent = '';
    const cur = curPeriod();
    const v = viewed();
    const ms = state.matches.filter(m => matchSeason(m) === v.season && v.sems.includes(matchSem(m)));
    const n = ms.length;

    /* Sélecteurs de période */
    const seasons = seasonsKnown();
    const ssel = $('#rank-season');
    const ssig = seasons.join('|');
    if (ssel.dataset.sig !== ssig) {
      ssel.dataset.sig = ssig;
      ssel.textContent = '';
      seasons.forEach(x => ssel.append(h('option', { value: x }, 'Saison ' + x)));
    }
    ssel.value = v.season;
    ssel.hidden = seasons.length < 2;
    $('#rank-seg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === v.scope)));

    $('#match-count').textContent = plural(n, 'match') + ' joué' + (n > 1 ? 's' : '');
    $('#history-sec').hidden = n === 0;
    $('#reset-season').hidden = v.scope === 'year';
    renderBonusForm();
    renderClose();

    const table = standings(ms, state.players, v.keys);
    if (!table.length) {
      box.append(h('div', { class: 'empty' }, v.isCurrent
        ? 'Pas encore de match ce semestre. Génère les équipes, puis désigne les vainqueurs à la fin du match : le classement se remplit tout seul.'
        : 'Rien d’enregistré pour cette période.'));
    } else {
      const leaders = table.filter(r => r.rank === 1 && r.mvp > 0);
      if (leaders.length) box.append(h('div', { class: 'podium' },
        h('span', { class: 'medal', 'aria-hidden': 'true' }, '🏆'),
        h('div', { class: 'who' },
          h('div', { class: 'lab' }, (leaders.length > 1 ? 'MVP ex æquo' : 'MVP') + ' · ' + v.label),
          h('div', { class: 'name' }, leaders.map(r => r.name).join(' · ')),
          h('div', { class: 'stat' }, plural(leaders[0].mvp, 'point') + ' MVP · ' + plural(leaders[0].wins, 'victoire') + ' en ' + plural(leaders[0].played, 'match'))
        )
      ));
      box.append(h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, '#'), h('th', { scope: 'col' }, 'Joueur'),
          h('th', { scope: 'col', title: 'Matchs joués' }, 'J'), h('th', { scope: 'col', title: 'Victoires' }, 'V'),
          h('th', { scope: 'col', title: 'Points MVP' }, 'MVP'))),
        h('tbody', null, table.map(r => h('tr', { class: r.rank === 1 && r.mvp > 0 ? 'first' : '' },
          h('td', null, r.rank),
          h('td', null, r.name, r.gone ? h('span', { class: 'gone' }, ' (retiré)') : null),
          h('td', null, r.played), h('td', null, r.wins),
          h('td', { class: 'pts' }, r.mvp)
        )))
      )));
    }

    const hist = $('#history');
    hist.textContent = '';
    ms.slice().reverse().forEach(m => {
      const when = new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      const mv = namesOf(m, mvpsOf(m));
      const who = mv.length ? 'MVP : ' + mv.join(', ') : 'pas de MVP';
      const del = h('button', { type: 'button', class: 'sbtn del', 'aria-label': 'Supprimer ce match' }, '×');
      del.addEventListener('click', () => deleteMatch(m.id));
      const dot = h('span', { class: 'dot' });
      if (m.winner !== -1) paint(dot, m.winner);
      hist.append(h('li', { class: 'hrow' }, dot,
        h('div', null, h('div', { class: 'what' }, outcomeLabel(m)), h('div', { class: 'when' }, when + ' · ' + who)),
        del));
    });
  }

  /* Points saisis à la main pour le semestre affiché (matchs joués hors appli). */
  let bonusSig = null;
  function renderBonusForm() {
    const v = viewed();
    const sel = $('#bonus-player'), input = $('#bonus-value');
    const arr = state.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    $('#bonus-sec').hidden = arr.length === 0 || v.scope === 'year';
    $('#bonus-legend').textContent = 'Points MVP gagnés hors de l’appli pendant le ' + v.label.toLowerCase().replace(' · ', ' ') + ' : ils s’ajoutent à ceux des matchs enregistrés ici.';
    const sig = arr.map(p => p.id + ':' + p.name).join('|');
    if (sig !== bonusSig) {
      bonusSig = sig;
      const keep = sel.value;
      sel.textContent = '';
      arr.forEach(p => sel.append(h('option', { value: p.id }, p.name)));
      if (arr.some(p => p.id === keep)) sel.value = keep;
    }
    const p = player(sel.value);
    if (p && document.activeElement !== input) input.value = (p.pts && p.pts[v.keys[0]]) || 0;
  }

  /* Liste de points collée (« +8 Morgan ») pour le semestre affiché. */
  function parsePoints(text) {
    const out = [];
    String(text).split(/[\n,;]+/).forEach(raw => {
      const m = raw.match(/^[^\p{L}\p{N}+]*\+?\s*(\d{1,3})\s*(?:pts?|points?)?\s*[-:.)]?\s*(\p{L}.*)$/u)
        || raw.match(/^[^\p{L}\p{N}]*(\p{L}.*?)\s*[-:]?\s*\+?\s*(\d{1,3})\s*(?:pts?|points?)?\s*$/u);
      if (!m) return;
      const first = /^\d/.test(m[1]);
      const label = (first ? m[2] : m[1]).replace(/[^\p{L}\p{N}.' _-]+/gu, ' ').trim().slice(0, 30);
      const pts = Number(first ? m[1] : m[2]);
      if (label && normName(label)) out.push({ label: label, key: normName(label), pts: pts });
    });
    return out;
  }
  function applyPointsList(text) {
    const v = viewed();
    const k = v.keys[0];
    const items = parsePoints(text);
    const box = $('#points-result');
    box.textContent = '';
    box.hidden = false;
    if (v.scope === 'year') return;
    if (!items.length) { box.append(h('p', { class: 'note' }, 'Aucune ligne du type « +3 Prénom » trouvée dans ce texte.')); return; }
    const setPts = (p, n) => { p.pts = p.pts || {}; if (n > 0) p.pts[k] = n; else delete p.pts[k]; };
    let done = 0;
    const later = [];
    items.forEach(it => {
      const c = candidatesFor(it.key);
      if (c.length === 1) { setPts(c[0], it.pts); done++; } else later.push({ it: it, options: c });
    });
    persist();
    renderRanking();
    box.append(h('p', { class: 'note' }, plural(done, 'joueur') + ' mis à jour pour le ' + v.label.toLowerCase().replace(' · ', ' ') + '.' +
      (later.length ? ' Il reste ' + plural(later.length, 'nom') + ' à traiter ci-dessous.' : '')));
    later.forEach(l => {
      const it = l.it;
      const row = h('div', { class: 'paste-row' });
      const finish = text => { row.textContent = ''; row.append(h('span', null, text)); };
      if (l.options.length) {
        row.append(h('span', null, '« ' + it.label + ' » (+' + it.pts + ') : lequel ?'));
        l.options.forEach(p => {
          const b = h('button', { type: 'button', class: 'btn small' }, p.name);
          b.addEventListener('click', () => {
            const cur = player(p.id);
            if (cur) { setPts(cur, it.pts); persist(); renderRanking(); }
            finish(p.name + ' : ' + plural(it.pts, 'point') + '.');
          });
          row.append(b);
        });
      } else {
        row.append(h('span', null, '« ' + it.label + ' » (+' + it.pts + ') : introuvable.'));
      }
      const add = h('button', { type: 'button', class: 'btn small' }, l.options.length ? 'Aucun : nouveau joueur' : 'Ajouter comme nouveau joueur');
      add.addEventListener('click', () => {
        const p = { id: newId('p'), name: it.label, level: 5, present: false, pts: {} };
        setPts(p, it.pts);
        state.players.push(p);
        persist(); renderPlayers(); renderSummary(); renderRanking();
        finish(it.label + ' ajouté avec ' + plural(it.pts, 'point') + '.');
      });
      row.append(add);
      box.append(row);
    });
  }

  /* Clôture : rien n'est effacé, les prochains matchs comptent pour la période suivante. */
  let closeArmed = false, closeTimer = null;
  function closeLabel() {
    const cur = curPeriod();
    return cur.sem === 1 ? 'Clôturer le semestre 1' : 'Clôturer le semestre 2 et la saison ' + cur.season;
  }
  function renderClose() {
    const cur = curPeriod();
    $('#close-now').textContent = 'Période en cours : semestre ' + cur.sem + ' de la saison ' + cur.season + '. ' + (cur.sem === 1
      ? 'À la clôture, les prochains matchs compteront pour le semestre 2.'
      : 'À la clôture, une nouvelle saison ' + nextSeason(cur.season) + ' démarre au semestre 1. Les classements passés restent consultables.');
    if (!closeArmed) $('#close-period').textContent = closeLabel();
  }
  function closePeriod() {
    const cur = curPeriod();
    state.period = cur.sem === 1 ? { season: cur.season, sem: 2 } : { season: nextSeason(cur.season), sem: 1 };
    if (state.draw) { state.draw.recorded = null; state.draw.vote = null; }
    rv.season = null; rv.scope = null;
    persist();
    renderEnd();
    renderRanking();
    $('#close-status').textContent = (cur.sem === 1 ? 'Semestre 1 clôturé.' : 'Saison ' + cur.season + ' clôturée.') +
      ' Les prochains matchs comptent pour le semestre ' + state.period.sem + ' de la saison ' + state.period.season + '.';
  }

  /* Sauvegarde : tout copier en texte, ou importer un texte copié depuis une autre installation. */
  function exportText() {
    return JSON.stringify({ app: 'fc-boissons', version: 1, players: state.players, matches: state.matches, period: state.period });
  }
  function importText(text) {
    let d = null;
    try { d = JSON.parse(text); } catch (e) { d = null; }
    if (!d || d.app !== 'fc-boissons' || !Array.isArray(d.players)) return null;
    const idOk = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(x);
    const players = new Map(state.players.map(p => [p.id, p]));
    let np = 0, nm = 0;
    d.players.forEach(p => {
      if (!p || !idOk(p.id)) return;
      players.set(p.id, { id: p.id, name: String(p.name || '?').slice(0, 30), level: clamp(Math.round(Number(p.level)) || 5, 1, 10), present: !!p.present, pts: cleanPts(p.pts, p.bonus), tags: cleanTags(p.tags) });
      np++;
    });
    const matches = new Map(state.matches.map(m => [m.id, m]));
    (Array.isArray(d.matches) ? d.matches : []).forEach(m => { if (m && idOk(m.id) && validMatch(m)) { matches.set(m.id, clone(m)); nm++; } });
    state.players = [...players.values()];
    state.matches = [...matches.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const per = cleanPeriod(d.period);
    if (per) state.period = per;
    persist();
    renderAll();
    return { players: np, matches: nm };
  }

  /* ================= Navigation ================= */
  const VIEWS = ['players', 'match', 'ranking'];
  function show(view) {
    if (!VIEWS.includes(view)) view = 'players';
    if (view === 'ranking') renderRanking();
    if (view === 'players') renderPlayers();
    VIEWS.forEach(v => { $('#view-' + v).hidden = v !== view; });
    document.querySelectorAll('.tabs button').forEach(b => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    window.scrollTo(0, 0);
  }

  /* ================= Démarrage ================= */
  function init() {
    load();

    const sel = $('#new-level');
    for (let i = 1; i <= 10; i++) sel.append(h('option', { value: i }, 'Note ' + i));
    sel.value = '5';

    [2, 3, 4].forEach(n => {
      const b = h('button', { type: 'button', 'data-k': n, 'aria-pressed': 'false', 'aria-label': n + ' équipes' }, n);
      b.addEventListener('click', () => { state.k = n; state.kAuto = false; persist(); renderSummary(); });
      $('#seg').append(b);
    });

    $('#add').addEventListener('submit', ev => {
      ev.preventDefault();
      const input = $('#new-name');
      const name = input.value.trim();
      if (!name) return;
      state.players.push({ id: newId('p'), name: name, level: Number(sel.value), present: true, pts: {}, tags: [] });
      persist();
      renderPlayers();
      renderSummary();
      input.value = '';
      input.focus();
    });
    const setAll = v => { state.players.forEach(p => { p.present = v; }); persist(); renderPlayers(); renderSummary(); };
    $('#all').addEventListener('click', () => setAll(true));
    $('#none').addEventListener('click', () => setAll(false));
    $('#to-match').addEventListener('click', () => show('match'));
    $('#sort').addEventListener('change', ev => { state.sort = ev.target.value; persist(); renderPlayers(); });
    $('#paste-open').addEventListener('click', () => {
      const panel = $('#paste-panel');
      panel.hidden = !panel.hidden;
      if (!panel.hidden) $('#paste-text').focus();
    });
    $('#paste-apply').addEventListener('click', () => {
      const box = $('#paste-text');
      const r = applyPastedList(box.value, $('#paste-uncheck').checked);
      renderPasteResult(r);
      if (r) box.value = '';
    });
    $('#go').addEventListener('click', runDraw);

    let confirmReset = false, confirmTimer = null;
    $('#reset-season').addEventListener('click', ev => {
      const btn = ev.currentTarget;
      const label = 'Remettre ce semestre à zéro';
      if (!confirmReset) {
        confirmReset = true;
        btn.textContent = 'Confirmer : effacer les matchs et points de ce semestre';
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => { confirmReset = false; btn.textContent = label; }, 4000);
        return;
      }
      confirmReset = false;
      clearTimeout(confirmTimer);
      btn.textContent = label;
      const v = viewed();
      if (v.scope === 'year') return;
      state.matches = state.matches.filter(m => !(matchSeason(m) === v.season && matchSem(m) === v.sems[0]));
      state.players.forEach(p => { if (p.pts) delete p.pts[v.keys[0]]; });
      if (state.draw && !state.matches.some(m => m.id === state.draw.recorded)) { state.draw.recorded = null; state.draw.vote = null; }
      persist();
      renderEnd();
      renderRanking();
    });

    $('#rank-seg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { rv.scope = b.dataset.scope; $('#bonus-status').textContent = ''; $('#points-result').hidden = true; renderRanking(); }));
    $('#rank-season').addEventListener('change', ev => { rv.season = ev.target.value; renderRanking(); });
    $('#close-period').addEventListener('click', ev => {
      const btn = ev.currentTarget;
      if (!closeArmed) {
        closeArmed = true;
        btn.textContent = 'Confirmer : ' + closeLabel().toLowerCase();
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => { closeArmed = false; btn.textContent = closeLabel(); }, 4000);
        return;
      }
      closeArmed = false;
      clearTimeout(closeTimer);
      closePeriod();
    });

    $('#backup-copy').addEventListener('click', async ev => {
      const btn = ev.currentTarget, box = $('#backup-text');
      const text = exportText();
      try {
        await navigator.clipboard.writeText(text);
        $('#backup-status').textContent = 'Données copiées : ' + plural(state.players.length, 'joueur') + ', ' + plural(state.matches.length, 'match') + '.';
      } catch (e) {
        box.value = text; box.focus(); box.select();
        $('#backup-status').textContent = 'Copie automatique impossible : le texte est dans la zone ci-dessous, copie-le à la main.';
      }
      btn.blur();
    });
    $('#backup-import').addEventListener('click', () => {
      const box = $('#backup-text');
      if (!box.value.trim()) { $('#backup-status').textContent = 'Colle d’abord dans la zone le texte copié depuis l’autre appli.'; box.focus(); return; }
      const r = importText(box.value);
      if (!r) { $('#backup-status').textContent = 'Ce texte n’est pas une sauvegarde FC Boissons.'; return; }
      box.value = '';
      $('#backup-status').textContent = 'Import terminé : ' + plural(r.players, 'joueur') + ' et ' + plural(r.matches, 'match') + ' ajoutés ou mis à jour.';
    });

    $('#points-open').addEventListener('click', () => {
      const panel = $('#points-panel');
      panel.hidden = !panel.hidden;
      if (!panel.hidden) $('#points-text').focus();
    });
    $('#points-apply').addEventListener('click', () => {
      const box = $('#points-text');
      if (!box.value.trim()) { box.focus(); return; }
      applyPointsList(box.value);
      box.value = '';
    });

    $('#bonus-player').addEventListener('change', () => { $('#bonus-value').blur(); renderBonusForm(); });
    $('#bonus-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const p = player($('#bonus-player').value);
      const input = $('#bonus-value');
      const val = Math.round(Number(input.value));
      const v = viewed();
      if (!p || v.scope === 'year' || input.value === '' || !Number.isFinite(val) || val < 0 || val > 999) { $('#bonus-status').textContent = 'Indique un nombre de points entre 0 et 999.'; return; }
      p.pts = p.pts || {};
      if (val > 0) p.pts[v.keys[0]] = val; else delete p.pts[v.keys[0]];
      persist();
      input.blur();
      renderRanking();
      $('#bonus-status').textContent = p.name + ' : ' + plural(val, 'point') + ' enregistré' + (val > 1 ? 's' : '') + ' pour le semestre ' + v.scope + '.';
    });

    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));

    startShared();
    renderAll();
    show(location.hash.slice(1) || 'players');

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* l'appli marche aussi sans */ });
    }
  }

  init();
})();
