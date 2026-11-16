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
  function costOf(teams) { return spreadOf(teams) + 10 * tensPairs(teams); }
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
              if (x.level === y.level) continue;
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
    return { teams: teams, spread: spreadOf(pick.teams), sig: pick.sig, warn: tensPairs(pick.teams) > 0 };
  }

  /* ================= Classement ================= */
  /* MVP : à 2 équipes, 3 joueurs élus par vote ; à 3 ou 4 équipes, toute l'équipe gagnante. */
  const MVP_VOTES = 3;
  function mvpsOf(m) {
    if (Array.isArray(m.mvps)) return m.mvps;
    return m.teams.length > 2 && m.winner !== -1 ? m.teams[m.winner].map(p => p.id) : [];
  }
  function standings(matches, players) {
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
  const state = { players: [], matches: [], draw: null, k: 2, kAuto: true, showLevels: true };
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
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && typeof s === 'object') {
        if (Array.isArray(s.players)) state.players = s.players.filter(p => p && p.id);
        if (Array.isArray(s.matches)) state.matches = s.matches.filter(validMatch);
        if (s.draw && Array.isArray(s.draw.teams)) state.draw = s.draw;
        readPrefs(s);
      }
      readPrefs(JSON.parse(localStorage.getItem(PREFS_KEY)));
    } catch (e) { storageOk = false; }
  }
  function persist() {
    if (mode !== 'local') {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify({ k: state.k, kAuto: state.kAuto, showLevels: state.showLevels })); } catch (e) { /* préférences seulement */ }
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
    if (c === 'players') state.players.forEach(p => m.set(p.id, { name: p.name, level: p.level, present: !!p.present }));
    else if (c === 'matches') state.matches.forEach(x => { const d = Object.assign({}, x); delete d.id; m.set(x.id, d); });
    else if (state.draw) m.set('draw', state.draw);
    return m;
  }
  function applyDocs(c, m) {
    if (c === 'players') {
      state.players = [...m].map(([id, d]) => ({ id: id, name: String(d.name || '?').slice(0, 30), level: clamp(Math.round(Number(d.level)) || 5, 1, 10), present: !!d.present }));
    } else if (c === 'matches') {
      state.matches = [...m].map(([id, d]) => Object.assign(clone(d), { id: id })).filter(validMatch)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    } else {
      const d = m.get('draw');
      state.draw = d && Array.isArray(d.teams) && d.teams.length >= 2 && d.teams.length <= 4 ? clone(d) : null;
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
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked') {
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
  function subscribe(c) {
    db.collection(c).onSnapshot(snap => {
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
    }, () => {
      clearTimeout(loadTimer);
      if (c === 'players') playersLoaded = true;
      renderAll();
      setSync('Les données partagées sont inaccessibles pour le moment.');
    });
  }
  async function startShared() {
    if (!(window.claude && window.claude.use)) return;
    const backup = { players: state.players, matches: state.matches, draw: state.draw };
    mode = 'loading';
    playersLoaded = false;
    state.players = []; state.matches = []; state.draw = null;
    let d = null;
    try { d = await window.claude.use('db'); } catch (e) { d = null; }
    if (!d) {
      mode = 'local';
      playersLoaded = true;
      state.players = backup.players.concat(state.players);
      state.matches = backup.matches.concat(state.matches);
      state.draw = state.draw || backup.draw;
      renderAll();
      return;
    }
    db = d;
    mode = 'db';
    $('#sub').textContent = 'Les joueurs, le tirage, le classement. Partagés en direct.';
    loadTimer = setTimeout(() => setSync('Les données partagées ne répondent pas encore. Ce qui est affiché peut être en retard.'), 10000);
    COLLS.forEach(subscribe);
  }
  function renderAll() { renderPlayers(); renderDraw(); renderSummary(); renderRanking(); }

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
    const el = h('li', { class: 'row' }, cb, nameIn, h('div', { class: 'step' }, dec, val, inc), del);
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
    dec.addEventListener('click', () => bump(-1));
    inc.addEventListener('click', () => bump(1));
    del.addEventListener('click', () => {
      state.players = state.players.filter(p => p.id !== id);
      persist();
      renderPlayers();
      renderSummary();
    });
    return { el: el, cb: cb, nameIn: nameIn, val: val, dec: dec, inc: inc, del: del };
  }

  function renderPlayers() {
    const arr = state.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
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
  }

  /* ================= Tirage ================= */
  function poolNow() { return state.players.filter(p => p.present); }
  function keyFor(pool, k) { return pool.map(p => p.id + ':' + p.level).sort().join(',') + '|' + k; }

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
    kids.push(h('p', { class: 'note', id: 'stale', hidden: true }, 'La liste ou le nombre d’équipes a changé depuis ce tirage. Relance le tirage pour le mettre à jour.'));
    const grid = h('div', { class: 'teams' + (state.showLevels ? '' : ' levels-off') });
    draw.teams.forEach((t, i) => {
      const total = t.reduce((s, p) => s + p.level, 0);
      grid.append(paint(h('article', { class: 'team' },
        h('header', null, h('h3', null, BIBS[i].name), h('span', null, t.length + ' joueurs')),
        h('ul', null, t.map(p => h('li', null, h('span', null, p.name), h('span', { class: 'n' }, p.level)))),
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
    const r = generate(pool.map(p => ({ id: p.id, name: p.name, level: p.level })), k, state.draw ? state.draw.sig : null);
    state.draw = { teams: r.teams, spread: r.spread, sig: r.sig, warn: r.warn, key: keyFor(pool, k), recorded: null, vote: null };
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
  let confirmReset = false, confirmTimer = null;

  function renderRanking() {
    const box = $('#ranking');
    box.textContent = '';
    const n = state.matches.length;
    $('#match-count').textContent = plural(n, 'match') + ' joué' + (n > 1 ? 's' : '');
    $('#history-sec').hidden = n === 0;
    if (n === 0) {
      box.append(h('div', { class: 'empty' }, 'Pas encore de match. Génère les équipes, puis désigne les vainqueurs à la fin du match : le classement se remplit tout seul.'));
      return;
    }
    const table = standings(state.matches, state.players);
    const leaders = table.filter(r => r.rank === 1 && r.mvp > 0);
    if (leaders.length) box.append(h('div', { class: 'podium' },
      h('span', { class: 'medal', 'aria-hidden': 'true' }, '🏆'),
      h('div', { class: 'who' },
        h('div', { class: 'lab' }, leaders.length > 1 ? 'MVP ex æquo' : 'MVP'),
        h('div', { class: 'name' }, leaders.map(r => r.name).join(' · ')),
        h('div', { class: 'stat' }, leaders[0].mvp + ' fois MVP · ' + plural(leaders[0].wins, 'victoire') + ' en ' + plural(leaders[0].played, 'match'))
      )
    ));
    box.append(h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, '#'), h('th', { scope: 'col' }, 'Joueur'),
        h('th', { scope: 'col', title: 'Matchs joués' }, 'J'), h('th', { scope: 'col', title: 'Victoires' }, 'V'),
        h('th', { scope: 'col', title: 'Nombre de fois MVP' }, 'MVP'))),
      h('tbody', null, table.map(r => h('tr', { class: r.rank === 1 && r.mvp > 0 ? 'first' : '' },
        h('td', null, r.rank),
        h('td', null, r.name, r.gone ? h('span', { class: 'gone' }, ' (retiré)') : null),
        h('td', null, r.played), h('td', null, r.wins),
        h('td', { class: 'pts' }, r.mvp)
      )))
    )));

    const hist = $('#history');
    hist.textContent = '';
    state.matches.slice().reverse().forEach(m => {
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

  /* ================= Navigation ================= */
  const VIEWS = ['players', 'match', 'ranking'];
  function show(view) {
    if (!VIEWS.includes(view)) view = 'players';
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
      state.players.push({ id: newId('p'), name: name, level: Number(sel.value), present: true });
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
    $('#go').addEventListener('click', runDraw);

    $('#reset-season').addEventListener('click', ev => {
      const btn = ev.currentTarget;
      const label = 'Remettre le classement à zéro';
      if (!confirmReset) {
        confirmReset = true;
        btn.textContent = 'Confirmer : effacer tous les matchs';
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => { confirmReset = false; btn.textContent = label; }, 4000);
        return;
      }
      confirmReset = false;
      clearTimeout(confirmTimer);
      btn.textContent = label;
      state.matches = [];
      if (state.draw) { state.draw.recorded = null; state.draw.vote = null; }
      persist();
      renderEnd();
      renderRanking();
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
