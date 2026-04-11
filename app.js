
(function () {
  var BANK = window.HISTORIA_BANK || [];
  var META = window.HISTORIA_META || {};
  var STATS_KEY = "hist10_stats_v12";
  var SESSION_KEY = "hist10_sess_v12";
  var TIMER_KEY = "hist10_timer_v12";
  var timerInt = null;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    children = children || [];
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined) return;
      if (k === "class") node.className = v;
      else if (k === "onclick") node.onclick = v;
      else node.setAttribute(k, v);
    });
    children.forEach(function (c) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function loadJSON(k, fallback) {
    try {
      var v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  }

  function byId(id) {
    for (var i = 0; i < BANK.length; i++) {
      if (BANK[i].id === id) return BANK[i];
    }
    return null;
  }

  function norm(s) {
    s = (s || "").toLowerCase();
    try {
      s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) {}
    return s.replace(/[^a-z0-9áéíóúüñ\s]/gi, " ").replace(/\s+/g, " ").trim();
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function initStats() {
    var s = loadJSON(STATS_KEY, {});
    BANK.forEach(function (q) {
      if (!s[q.id]) s[q.id] = { seen: 0, ok: 0, fail: 0, bloque: q.bloque, tipo: q.tipo, last: 0 };
    });
    saveJSON(STATS_KEY, s);
  }

  function updateStats(id, ok) {
    var s = loadJSON(STATS_KEY, {});
    if (!s[id]) s[id] = { seen: 0, ok: 0, fail: 0, bloque: "", tipo: "", last: 0 };
    s[id].seen += 1;
    if (ok) s[id].ok += 1;
    else s[id].fail += 1;
    s[id].last = Date.now();
    saveJSON(STATS_KEY, s);
  }

  function pickIntelligent(ids, n) {
    var s = loadJSON(STATS_KEY, {});
    var now = Date.now();
    var weighted = ids.map(function (id) {
      var st = s[id] || { seen: 0, ok: 0, fail: 0, last: 0 };
      var unseen = st.seen === 0 ? 1 : 0;
      var failRate = st.seen ? st.fail / st.seen : 0.85;
      var age = st.last ? Math.min(1, (now - st.last) / (1000 * 60 * 60 * 24 * 5)) : 1;
      return { id: id, w: 0.55 * unseen + 0.30 * failRate + 0.15 * age + Math.random() * 0.03 };
    });
    weighted.sort(function (a, b) { return b.w - a.w; });
    return weighted.slice(0, Math.min(n, weighted.length)).map(function (x) { return x.id; });
  }

  function play(kind) {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      var c = new AudioCtx();
      var n = c.currentTime;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      if (kind === "ok") {
        o.frequency.setValueAtTime(660, n);
        o.frequency.setValueAtTime(920, n + 0.07);
      } else if (kind === "warn") {
        o.frequency.setValueAtTime(450, n);
        o.frequency.setValueAtTime(330, n + 0.09);
      } else {
        o.frequency.setValueAtTime(220, n);
        o.frequency.setValueAtTime(170, n + 0.08);
      }
      g.gain.setValueAtTime(0.0001, n);
      g.gain.exponentialRampToValueAtTime(0.12, n + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.18);
      o.connect(g);
      g.connect(c.destination);
      o.start(n);
      o.stop(n + 0.22);
      setTimeout(function () { try { c.close(); } catch (e) {} }, 400);
    } catch (e) {}
  }

  function setSession(s) { saveJSON(SESSION_KEY, s); }
  function getSession() { return loadJSON(SESSION_KEY, null); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); stopTimer(); }

  function startTimer(min) {
    saveJSON(TIMER_KEY, { start: Date.now(), duration: min * 60, paused: false, pauseAt: null, pausedTotal: 0 });
    tickTimer();
    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(tickTimer, 1000);
  }

  function stopTimer() {
    if (timerInt) clearInterval(timerInt);
    timerInt = null;
    localStorage.removeItem(TIMER_KEY);
  }

  function pauseTimer() {
    var t = loadJSON(TIMER_KEY, null);
    if (!t) return;
    if (t.paused) {
      t.paused = false;
      t.pausedTotal += (Date.now() - t.pauseAt);
      t.pauseAt = null;
    } else {
      t.paused = true;
      t.pauseAt = Date.now();
    }
    saveJSON(TIMER_KEY, t);
    tickTimer();
  }

  function remaining() {
    var t = loadJSON(TIMER_KEY, null);
    if (!t) return null;
    var now = t.paused ? t.pauseAt : Date.now();
    var elapsed = Math.floor((now - t.start - t.pausedTotal) / 1000);
    return Math.max(0, t.duration - elapsed);
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function tickTimer() {
    var sess = getSession();
    if (!sess || sess.mode !== "simulacro") return;
    var r = remaining();
    var e = document.getElementById("timerText");
    var b = document.getElementById("timerBar");
    if (e) e.textContent = "⏱️ " + fmtTime(r) + " / " + (META.default_simulacro_minutes || 90) + ":00";
    var t = loadJSON(TIMER_KEY, null);
    if (b && t) b.style.width = ((1 - r / t.duration) * 100) + "%";
    if (r === 0) {
      play("warn");
      if (timerInt) clearInterval(timerInt);
      timerInt = null;
      finish(true);
    }
  }

  function show(node) {
    var app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(node);
  }

  function mini(k, v) {
    return el("div", { "class": "mini" }, [
      el("div", { "class": "k" }, [k]),
      el("div", { "class": "v" }, [v])
    ]);
  }

  function stat(k, v, s) {
    return el("div", { "class": "stat" }, [
      el("span", { "class": "small" }, [k]),
      el("strong", {}, [v]),
      el("div", { "class": "small" }, [s])
    ]);
  }

  function intro() {
    initStats();
    var sess = getSession();
    var stats = loadJSON(STATS_KEY, {});
    var done = Object.keys(stats).filter(function (k) { return stats[k].seen > 0; }).length;

    var heroLeft = el("div", { "class": "card" }, [
      el("div", { "class": "hero-title" }, ["Historia Global · Simulacro Visual"]),
      el("div", { "class": "note" }, [
        "Actualizado a 10 temas. Esta versión usa una portada más visual con tarjetas, panel rápido y simulacro global."
      ]),
      el("div", { "class": "row", "style": "margin-top:12px" }, [
        el("button", { "class": "btn primary", "onclick": themeMenu }, ["📘 Entrenamiento por tema"]),
        el("button", { "class": "btn", "onclick": startGlobal }, ["🧠 Entrenamiento global"]),
        el("button", { "class": "btn primary", "onclick": startSim }, ["🏁 Simulacro global"])
      ]),
      el("div", { "class": "timeline" }, [
        mini("Bloques", "10 temas"),
        mini("Banco", String(BANK.length) + " preguntas"),
        mini("Simulacro", "32 preguntas / 90 min"),
        mini("Progreso", String(done) + " vistas")
      ])
    ]);

    var heroRight = el("div", { "class": "card" }, [
      el("h3", {}, ["Panel rápido"]),
      el("div", { "class": "grid2" }, [
        stat("Etapa A", "Temas 1-3", "Prehistoria a Edad Moderna"),
        stat("Etapa B", "Temas 4-7", "Siglo XIX español"),
        stat("Etapa C", "Temas 8-10", "Del 98 a la Guerra Civil"),
        stat("Sesión", sess ? "Reanudable" : "Nueva", sess ? "Hay progreso guardado" : "Sin sesión activa")
      ]),
      el("div", { "class": "row", "style": "margin-top:12px" }, [
        sess ? el("button", { "class": "btn", "onclick": resumeSession }, ["Continuar donde lo dejaste"]) : el("span", {}, []),
        el("button", { "class": "btn", "onclick": statsScreen }, ["Ver estadísticas"]),
        el("button", { "class": "btn bad", "onclick": resetAll }, ["Reset"])
      ])
    ]);

    var topicCards = (META.blocks || []).map(function (b) {
      return el("div", { "class": "topic-card" }, [
        el("div", { "class": "row" }, [
          el("div", { "class": "n" }, [String(b.order)]),
          el("div", {}, [
            el("div", {}, [b.title]),
            el("div", { "class": "small", "style": "margin-top:4px" }, [(META.cards && META.cards[b.id]) ? META.cards[b.id][0] : ""])
          ])
        ]),
        el("div", { "class": "small", "style": "margin-top:8px" }, [(META.cards && META.cards[b.id]) ? META.cards[b.id][1] : ""])
      ]);
    });

    show(el("div", {}, [
      el("div", { "class": "hero" }, [heroLeft, heroRight]),
      el("div", { "class": "card" }, [
        el("h3", {}, ["Temario visual"]),
        el("div", { "class": "themegrid" }, topicCards)
      ])
    ]));
  }

  function themeMenu() {
    var cards = (META.blocks || []).map(function (b) {
      var count = BANK.filter(function (q) { return q.bloque === b.id; }).length;
      return el("div", { "class": "topic-card" }, [
        el("div", { "class": "row" }, [
          el("div", { "class": "n" }, [String(b.order)]),
          el("div", {}, [
            el("div", {}, [b.title]),
            el("div", { "class": "small", "style": "margin-top:4px" }, ["Preguntas: " + count])
          ])
        ]),
        el("div", { "class": "small", "style": "margin-top:8px" }, [(META.cards && META.cards[b.id]) ? META.cards[b.id][0] : ""]),
        el("div", { "class": "row", "style": "margin-top:10px" }, [
          el("button", { "class": "btn primary", "onclick": function () { startTheme(b.id); } }, ["Entrenar"])
        ])
      ]);
    });

    show(el("div", {}, [
      el("div", { "class": "card" }, [
        el("h2", {}, ["Entrenamiento por tema"]),
        el("div", { "class": "note" }, ["Cada tema abre un recordatorio visual y preguntas mezcladas del bloque."]),
        el("div", { "class": "row", "style": "margin-top:10px" }, [
          el("button", { "class": "btn", "onclick": intro }, ["← Volver"]),
          el("button", { "class": "btn primary", "onclick": startGlobal }, ["Entrenamiento global"])
        ])
      ]),
      el("div", { "class": "themegrid" }, cards)
    ]));
  }

  function startTheme(block) {
    var ids = BANK.filter(function (x) { return x.bloque === block; }).map(function (x) { return x.id; });
    setSession({ mode: "train-theme", block: block, idx: 0, score: 0, items: pickIntelligent(ids, ids.length).map(function (id) { return { id: id, ok: null, answer: null, meta: {} }; }) });
    stopTimer();
    render(true);
  }

  function startGlobal() {
    var ids = BANK.map(function (x) { return x.id; });
    setSession({ mode: "train-global", block: null, idx: 0, score: 0, items: pickIntelligent(ids, Math.min(36, ids.length)).map(function (id) { return { id: id, ok: null, answer: null, meta: {} }; }) });
    stopTimer();
    render(true);
  }

  function startSim() {
    var ids = BANK.map(function (x) { return x.id; });
    var base = [];
    (META.blocks || []).forEach(function (b) {
      var from = BANK.filter(function (x) { return x.bloque === b.id; }).map(function (x) { return x.id; });
      base = base.concat(pickIntelligent(from, Math.min(3, from.length)));
    });
    var rest = ids.filter(function (id) { return base.indexOf(id) === -1; });
    var order = shuffle(base.concat(pickIntelligent(rest, Math.max(0, (META.simulacro_size || 32) - base.length)))).slice(0, META.simulacro_size || 32);
    setSession({ mode: "simulacro", block: null, idx: 0, score: 0, items: order.map(function (id) { return { id: id, ok: null, answer: null, meta: {} }; }) });
    startTimer(META.default_simulacro_minutes || 90);
    render(true);
  }

  function resumeSession() {
    var s = getSession();
    if (!s) { alert("No hay sesión guardada."); return; }
    render(false);
  }

  function renderHeader(s) {
    var done = s.items.filter(function (i) { return i.ok !== null; }).length;
    return el("div", { "class": "card" }, [
      el("div", { "class": "row" }, [
        el("span", { "class": "pill" }, [s.mode === "simulacro" ? "🏁 Simulacro" : (s.mode === "train-global" ? "🧠 Global" : "📘 Por tema")]),
        s.block ? el("span", { "class": "pill" }, ["Bloque: " + s.block]) : el("span", {}, []),
        el("span", { "class": "pill" }, ["Progreso: " + done + "/" + s.items.length]),
        el("span", { "class": "pill" }, ["Puntos: " + s.score]),
        s.mode === "simulacro" ? el("span", { "class": "pill", "id": "timerText" }, ["⏱️ --:-- / 90:00"]) : el("span", {}, []),
        el("span", { "style": "flex:1" }, [""]),
        s.mode === "simulacro" ? el("button", { "class": "btn", "onclick": pauseTimer }, ["⏯ Pausa"]) : el("span", {}, [])
      ]),
      s.mode === "simulacro" ? el("div", { "class": "progressbar", "style": "margin-top:10px" }, [el("div", { "id": "timerBar", "style": "width:0%" }, [])]) : el("div", {}, [])
    ]);
  }

  function render(force) {
    var s = getSession();
    if (!s) { intro(); return; }
    var item = s.items[s.idx];
    var x = byId(item.id);
    if (!x) { intro(); return; }

    var wrap = el("div", {}, []);
    wrap.appendChild(renderHeader(s));

    if (force && s.mode === "train-theme" && META.cards && META.cards[s.block]) {
      wrap.appendChild(el("div", { "class": "card" }, [
        el("div", { "class": "pill" }, ["🧩 Recordatorio visual"]),
        el("div", { "class": "note", "style": "margin-top:8px" }, [META.cards[s.block][0] + "\n" + META.cards[s.block][1]])
      ]));
    }

    var body = el("div", { "class": "card" }, [
      el("div", { "class": "row" }, [
        el("span", { "class": "pill" }, ["Bloque: " + x.bloque]),
        el("span", { "class": "pill" }, ["Tema: " + x.tema]),
        el("span", { "class": "pill" }, [x.tipo === "mc" ? "Test" : x.tipo === "cloze" ? "Huecos" : x.tipo === "match" ? "Emparejar" : "Abierta (PAU)"])
      ]),
      el("p", { "class": "q" }, [x.pregunta || x.texto || ""])
    ]);

    if (x.tipo === "mc") mcView(x, s, body);
    else if (x.tipo === "cloze") clozeView(x, s, body);
    else if (x.tipo === "match") matchView(x, s, body);
    else openView(x, s, body);

    wrap.appendChild(body);
    wrap.appendChild(el("div", { "class": "card" }, [
      el("div", { "class": "row" }, [
        el("button", { "class": "btn warn", "onclick": goHome }, ["Inicio"]),
        el("button", { "class": "btn", "onclick": prevQ, "disabled": s.idx === 0 ? "true" : null }, ["← Anterior"]),
        el("button", { "class": "btn", "onclick": nextQ, "disabled": s.idx === s.items.length - 1 ? "true" : null }, ["Siguiente →"]),
        el("button", { "class": "btn primary", "onclick": function () { finish(false); } }, ["Finalizar"])
      ])
    ]));

    show(wrap);
    if (s.mode === "simulacro") tickTimer();
  }

  function goHome() {
    var s = getSession();
    if (!s) { intro(); return; }
    var msg = s.mode === "simulacro" ? "Si vuelves al inicio, perderás el puntaje del simulacro actual. ¿Volver?" : "¿Volver al inicio?";
    if (confirm(msg)) { clearSession(); intro(); }
  }

  function prevQ() {
    var s = getSession();
    s.idx = Math.max(0, s.idx - 1);
    setSession(s);
    render(false);
  }

  function nextQ() {
    var s = getSession();
    s.idx = Math.min(s.items.length - 1, s.idx + 1);
    setSession(s);
    render(false);
  }

  function mcView(x, s, body) {
    var it = s.items[s.idx];
    if (!it.meta.order) { it.meta.order = shuffle(x.opciones.map(function (_, i) { return i; })); setSession(s); }
    body.appendChild(el("div", { "class": "note", "style": "margin-top:10px" }, ["Cómo se responde: toca una opción y luego pulsa “Comprobar”."]));
    var form = el("div", {}, []);
    var fb = el("div", { "style": "margin-top:10px" }, []);
    var btn = el("button", { "class": "btn primary" }, ["Comprobar"]);
    it.meta.order.forEach(function (orig, disp) {
      var row = el("div", { "class": "opt" }, [
        el("input", { "type": "radio", "name": "opt", "value": String(disp) }),
        el("div", {}, [x.opciones[orig]])
      ]);
      row.onclick = function () { row.querySelector("input").checked = true; };
      form.appendChild(row);
    });
    btn.onclick = function () {
      var ch = form.querySelector('input[name="opt"]:checked');
      if (!ch) { play("warn"); alert("Elige una opción."); return; }
      var ok = it.meta.order[Number(ch.value)] === x.correcta;
      play(ok ? "ok" : "bad");
      it.ok = ok;
      setSession(s);
      updateStats(x.id, ok);
      if (ok) s.score++;
      setSession(s);
      fb.innerHTML = "";
      fb.appendChild(el("div", { "class": "pill" }, [ok ? "✅ Correcto" : "❌ Incorrecto · Correcta: " + x.opciones[x.correcta]]));
      fb.appendChild(el("div", { "class": "note", "style": "margin-top:8px" }, ["📚 Explicación: " + x.exp]));
      btn.disabled = true;
    };
    body.appendChild(form);
    body.appendChild(el("div", { "class": "row", "style": "margin-top:10px" }, [btn]));
    body.appendChild(fb);
  }

  function clozeView(x, s, body) {
    var it = s.items[s.idx];
    if (!it.meta.fill) {
      it.meta.fill = new Array(x.blanks.length).fill(null);
      it.meta.used = {};
      it.meta.sel = null;
      setSession(s);
    }
    body.appendChild(el("div", { "class": "note", "style": "margin-top:10px" }, ["Cómo se responde: toca una palabra del banco y luego el hueco."]));
    var parts = x.texto.split("________");
    var line = el("div", { "class": "note", "style": "font-size:14px;color:rgba(236,244,255,.96);margin-top:10px;line-height:1.6" }, []);
    for (var i = 0; i < parts.length; i++) {
      line.appendChild(document.createTextNode(parts[i]));
      if (i < x.blanks.length) {
        (function (idx) {
          var b = el("span", { "class": "blank" }, [it.meta.fill[idx] || "________"]);
          b.onclick = function () {
            if (it.meta.sel && !it.meta.fill[idx]) {
              it.meta.fill[idx] = it.meta.sel;
              it.meta.used[it.meta.sel] = true;
              it.meta.sel = null;
              setSession(s);
              render(false);
            }
          };
          line.appendChild(b);
        })(i);
      }
    }
    var bank = el("div", { "class": "bank" }, x.bank.map(function (w) {
      var chip = el("span", { "class": "word" + (it.meta.used[w] ? " used" : "") }, [w]);
      chip.onclick = function () { if (it.meta.used[w]) return; it.meta.sel = w; setSession(s); };
      return chip;
    }));
    var fb = el("div", { "style": "margin-top:10px" }, []);
    var btn = el("button", { "class": "btn primary" }, ["Comprobar"]);
    btn.onclick = function () {
      if (it.meta.fill.some(function (v) { return !v; })) { play("warn"); alert("Completa todos los huecos."); return; }
      var ok = true;
      for (var i = 0; i < x.blanks.length; i++) if (it.meta.fill[i] !== x.blanks[i].a) ok = false;
      play(ok ? "ok" : "bad");
      it.ok = ok;
      setSession(s);
      updateStats(x.id, ok);
      if (ok) s.score++;
      setSession(s);
      fb.innerHTML = "";
      fb.appendChild(el("div", { "class": "pill" }, [ok ? "✅ Todo correcto" : "❌ Hay errores en los huecos"]));
      fb.appendChild(el("div", { "class": "note", "style": "margin-top:8px" }, ["📚 Explicación: " + x.exp]));
      btn.disabled = true;
    };
    body.appendChild(line);
    body.appendChild(bank);
    body.appendChild(el("div", { "class": "row", "style": "margin-top:10px" }, [btn]));
    body.appendChild(fb);
  }

  function matchView(x, s, body) {
    var it = s.items[s.idx];
    if (!it.meta.left) {
      it.meta.left = shuffle(x.pairs.map(function (p) { return p[0]; }));
      it.meta.right = shuffle(x.pairs.map(function (p) { return p[1]; }));
      it.meta.map = {};
      it.meta.done = {};
      it.meta.selL = null;
      setSession(s);
    }
    body.appendChild(el("div", { "class": "note", "style": "margin-top:10px" }, ["Cómo se responde: toca un elemento de la izquierda y luego su pareja de la derecha."]));
    var fb = el("div", { "style": "margin-top:10px" }, []);
    var left = el("div", { "class": "matchcol" }, it.meta.left.map(function (t) {
      var d = !!it.meta.done["L:" + t];
      var n = el("div", { "class": "matchitem" + (d ? " done" : "") }, [t]);
      n.onclick = function () { if (!d) { it.meta.selL = t; setSession(s); } };
      return n;
    }));
    var right = el("div", { "class": "matchcol" }, it.meta.right.map(function (t) {
      var d = !!it.meta.done["R:" + t];
      var n = el("div", { "class": "matchitem" + (d ? " done" : "") }, [t]);
      n.onclick = function () {
        if (d || !it.meta.selL) return;
        var ok = x.pairs.some(function (p) { return p[0] === it.meta.selL && p[1] === t; });
        if (ok) {
          play("ok");
          it.meta.done["L:" + it.meta.selL] = true;
          it.meta.done["R:" + t] = true;
          it.meta.map[it.meta.selL] = t;
          it.meta.selL = null;
          setSession(s);
          render(false);
        } else {
          play("bad");
        }
      };
      return n;
    }));
    var btn = el("button", { "class": "btn primary" }, ["Finalizar y comprobar"]);
    btn.onclick = function () {
      var ok = Object.keys(it.meta.map).length === x.pairs.length;
      play(ok ? "ok" : "bad");
      it.ok = ok;
      setSession(s);
      updateStats(x.id, ok);
      if (ok) s.score++;
      setSession(s);
      fb.innerHTML = "";
      fb.appendChild(el("div", { "class": "pill" }, [ok ? "✅ Todo emparejado" : "❌ Faltan parejas por resolver"]));
      fb.appendChild(el("div", { "class": "note", "style": "margin-top:8px" }, ["📚 Explicación: " + x.exp]));
      btn.disabled = true;
    };
    body.appendChild(el("div", { "class": "matchgrid" }, [left, right]));
    body.appendChild(el("div", { "class": "row", "style": "margin-top:10px" }, [btn]));
    body.appendChild(fb);
  }

  function openView(x, s, body) {
    var it = s.items[s.idx];
    var min = x.min_chars || 170;
    body.appendChild(el("div", { "class": "note", "style": "margin-top:10px" }, [
      "Cómo se responde:\n1) Escribe tu respuesta.\n2) Pulsa “Corregir por checklist”.\n3) Lee el modelo y mejora tu texto.\n4) Marca “Me salió” o “No todavía”."
    ]));
    body.appendChild(el("div", { "class": "note", "style": "margin-top:10px" }, ["🧩 Pistas: " + (x.must_include || []).join(", ")]));
    var ta = el("textarea", { "placeholder": "Escribe aquí (mínimo " + min + " caracteres)." }, []);
    var counter = el("div", { "class": "small", "style": "margin-top:6px" }, ["0 / " + min]);
    ta.oninput = function () { counter.textContent = ta.value.length + " / " + min; };
    var fb = el("div", { "style": "margin-top:10px" }, []);
    var btn = el("button", { "class": "btn primary" }, ["Corregir por checklist"]);
    btn.onclick = function () {
      var t = ta.value || "";
      if (t.trim().length < min) { play("warn"); alert("Escribe al menos " + min + " caracteres."); return; }
      var n = norm(t);
      var must = (x.must_include || []).map(norm);
      var hits = [];
      var miss = [];
      must.forEach(function (k) { if (n.indexOf(k) !== -1) hits.push(k); else miss.push(k); });
      var ok = hits.length >= Math.ceil(must.length * 0.60);
      play(ok ? "ok" : "bad");
      it.answer = t;
      setSession(s);
      fb.innerHTML = "";
      fb.appendChild(el("div", { "class": "pill" }, [ok ? "✅ Checklist OK (" + hits.length + "/" + must.length + ")" : "❌ Checklist flojo (" + hits.length + "/" + must.length + ")"]));
      fb.appendChild(el("div", { "class": "note", "style": "margin-top:8px" }, [
        "✅ Incluiste: " + (hits.length ? hits.join(", ") : "—") + "\n❌ Faltó: " + (miss.length ? miss.join(", ") : "—") + "\n📚 Explicación: " + x.exp
      ]));
      fb.appendChild(el("div", { "class": "note", "style": "margin-top:10px" }, ["🧾 Respuesta modelo:\n" + x.respuesta_modelo]));
    };

    function mark(ok) {
      var t = ta.value || "";
      if (t.trim().length < min) { play("warn"); alert("Antes de marcar, escribe al menos " + min + " caracteres."); return; }
      play(ok ? "ok" : "bad");
      it.ok = ok;
      it.answer = t;
      setSession(s);
      updateStats(x.id, ok);
      if (ok) s.score++;
      setSession(s);
      alert("Guardado ✅");
    }

    body.appendChild(ta);
    body.appendChild(counter);
    body.appendChild(el("div", { "class": "row", "style": "margin-top:10px" }, [
      btn,
      el("button", { "class": "btn good", "onclick": function () { mark(true); } }, ["✅ Me salió"]),
      el("button", { "class": "btn bad", "onclick": function () { mark(false); } }, ["❌ No todavía"])
    ]));
    body.appendChild(fb);
  }

  function finish(auto) {
    var s = getSession();
    if (!s) { intro(); return; }
    stopTimer();
    var total = s.items.length;
    var done = s.items.filter(function (i) { return i.ok !== null; }).length;
    var ok = s.items.filter(function (i) { return i.ok === true; }).length;
    var by = {};
    s.items.forEach(function (it) {
      var x = byId(it.id);
      if (!by[x.bloque]) by[x.bloque] = { t: 0, ok: 0, d: 0 };
      by[x.bloque].t += 1;
      if (it.ok === true) by[x.bloque].ok += 1;
      if (it.ok !== null) by[x.bloque].d += 1;
    });

    show(el("div", { "class": "card" }, [
      el("div", { "class": "pill" }, ["🏁 Fin"]),
      el("h2", {}, [s.mode === "simulacro" ? "Resumen del simulacro global" : "Resumen del entrenamiento"]),
      el("div", { "class": "note" }, [auto ? "⏱️ Se acabó el tiempo: simulacro finalizado automáticamente." : "Sesión finalizada."]),
      el("div", { "class": "row", "style": "margin-top:8px" }, [
        el("span", { "class": "pill" }, ["Hechas: " + done + "/" + total]),
        el("span", { "class": "pill" }, ["Aciertos: " + ok + "/" + total]),
        el("span", { "class": "pill" }, ["Puntos: " + s.score])
      ]),
      el("table", { "style": "margin-top:10px" }, [
        el("thead", {}, [el("tr", {}, [el("th", {}, ["Bloque"]), el("th", {}, ["Aciertos"]), el("th", {}, ["Hechas"])])]),
        el("tbody", {}, Object.keys(by).map(function (b) {
          var r = by[b];
          return el("tr", {}, [el("td", {}, [b]), el("td", {}, [r.ok + "/" + r.t]), el("td", {}, [r.d + "/" + r.t])]);
        }))
      ]),
      el("div", { "class": "row", "style": "margin-top:12px" }, [
        s.mode === "simulacro"
          ? el("button", { "class": "btn primary", "onclick": function () { clearSession(); startSim(); } }, ["Repetir simulacro"])
          : el("button", { "class": "btn primary", "onclick": function () { clearSession(); intro(); } }, ["Volver al menú"]),
        el("button", { "class": "btn", "onclick": statsScreen }, ["Ver estadísticas"]),
        el("button", { "class": "btn", "onclick": function () { clearSession(); intro(); } }, ["Inicio"])
      ])
    ]));
  }

  function tableFrom(obj, isBlock) {
    return el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", {}, [isBlock ? "Bloque" : "Tipo"]),
        el("th", {}, ["Vistas"]),
        el("th", {}, ["OK"]),
        el("th", {}, ["Fallo"]),
        el("th", {}, ["Acierto"])
      ])]),
      el("tbody", {}, Object.keys(obj).map(function (k) {
        var r = obj[k];
        var name = isBlock ? k : (k === "mc" ? "Test" : k === "cloze" ? "Huecos" : k === "match" ? "Emparejar" : "Abierta");
        return el("tr", {}, [
          el("td", {}, [name]),
          el("td", {}, [String(r.seen)]),
          el("td", {}, [String(r.ok)]),
          el("td", {}, [String(r.fail)]),
          el("td", {}, [r.seen ? Math.round(r.ok / r.seen * 100) + "%" : "—"])
        ]);
      }))
    ]);
  }

  function statsScreen() {
    var s = loadJSON(STATS_KEY, {});
    var by = {}, ty = {};
    Object.keys(s).forEach(function (k) {
      var st = s[k];
      if (!st || !st.bloque) return;
      if (!by[st.bloque]) by[st.bloque] = { seen: 0, ok: 0, fail: 0 };
      by[st.bloque].seen += st.seen;
      by[st.bloque].ok += st.ok;
      by[st.bloque].fail += st.fail;
      if (!ty[st.tipo]) ty[st.tipo] = { seen: 0, ok: 0, fail: 0 };
      ty[st.tipo].seen += st.seen;
      ty[st.tipo].ok += st.ok;
      ty[st.tipo].fail += st.fail;
    });

    show(el("div", {}, [
      el("div", { "class": "card" }, [
        el("div", { "class": "pill" }, ["📊 Estadísticas"]),
        el("div", { "class": "row", "style": "margin-top:10px" }, [
          el("button", { "class": "btn", "onclick": intro }, ["← Volver"])
        ])
      ]),
      el("div", { "class": "card" }, [el("h3", {}, ["Por bloque"]), tableFrom(by, true)]),
      el("div", { "class": "card" }, [el("h3", {}, ["Por tipo"]), tableFrom(ty, false)])
    ]));
  }

  function resetAll() {
    if (!confirm("¿Seguro? Se borran estadísticas y sesión guardada.")) return;
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(SESSION_KEY);
    stopTimer();
    intro();
  }

  function boot() {
    try {
      intro();
    } catch (err) {
      var app = document.getElementById("app");
      if (app) {
        app.innerHTML = '<div class="card"><h2>Error al arrancar la app</h2><div class="note">' + String(err) + '</div></div>';
      }
      console.error(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
