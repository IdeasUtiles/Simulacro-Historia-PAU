const BANK = window.HISTORIA_BANK || [];
const META = window.HISTORIA_META || {blocks:[], block_order:[], study_cards:{}, simulacro_size:28, default_simulacro_minutes:90};

const STATS_KEY = "hist_pau_stats_v1";
const SESSION_KEY = "hist_pau_session_v1"; // current session (study or simulacro)
const TIMER_KEY = "hist_pau_timer_v1"; // timer state

function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(v===null || v===undefined) continue;
    if(k==="class") e.className = v;
    else if(k==="html") e.innerHTML = v;
    else if(k==="onclick") e.onclick = v;
    else e.setAttribute(k,v);
  }
  for(const c of children){
    if(typeof c==="string") e.appendChild(document.createTextNode(c));
    else if(c) e.appendChild(c);
  }
  return e;
}
function $(sel){ return document.querySelector(sel); }

function loadJSON(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch{ return fallback; }
}
function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function normalize(s){
  return (s||"")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\p{L}\p{N}\s]/gu," ")
    .replace(/\s+/g," ")
    .trim();
}

function initStats(){
  const s = loadJSON(STATS_KEY, {});
  for(const q of BANK){
    if(!s[q.id]) s[q.id] = {seen:0, ok:0, fail:0, bloque:q.bloque, tema:q.tema, tipo:q.tipo, last:0};
  }
  saveJSON(STATS_KEY, s);
}
function updateStats(qid, ok){
  const s = loadJSON(STATS_KEY, {});
  if(!s[qid]) s[qid] = {seen:0, ok:0, fail:0, bloque:"", tema:"", tipo:"", last:0};
  s[qid].seen += 1;
  if(ok) s[qid].ok += 1; else s[qid].fail += 1;
  s[qid].last = Date.now();
  saveJSON(STATS_KEY, s);
}

function qById(id){ return BANK.find(q=>q.id===id); }

function playFeedbackSound(kind){
  // kind: "ok" | "bad" | "warn"
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";

    if(kind==="ok"){
      o.frequency.setValueAtTime(660, now);
      o.frequency.setValueAtTime(880, now + 0.07);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.13, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + 0.17);
    }else if(kind==="warn"){
      o.frequency.setValueAtTime(440, now);
      o.frequency.setValueAtTime(330, now + 0.09);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + 0.23);
    }else{
      o.frequency.setValueAtTime(220, now);
      o.frequency.setValueAtTime(165, now + 0.08);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.13, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + 0.19);
    }
    setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 420);
  }catch(e){}
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickIntelligent(ids, n){
  const s = loadJSON(STATS_KEY, {});
  const now = Date.now();
  const candidates = ids.map(id=>{
    const st = s[id] || {seen:0, ok:0, fail:0, last:0};
    const unseen = st.seen===0 ? 1 : 0;
    const failRate = st.seen ? (st.fail/st.seen) : 0.85;
    const age = st.last ? Math.min(1, (now - st.last) / (1000*60*60*24*5)) : 1;
    const w = 0.55*unseen + 0.30*failRate + 0.15*age + Math.random()*0.03;
    return {id, w};
  }).sort((a,b)=>b.w-a.w);
  return candidates.slice(0, Math.min(n, candidates.length)).map(x=>x.id);
}

function setSession(sess){ saveJSON(SESSION_KEY, sess); }
function getSession(){ return loadJSON(SESSION_KEY, null); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); stopTimer(); }

// ---------- Timer (90 min simulacro) ----------
let timerInterval = null;

function startTimer(minutes){
  const duration = minutes*60;
  const t = {start: Date.now(), duration, paused:false, pauseAt:null, pausedTotal:0};
  saveJSON(TIMER_KEY, t);
  tickTimer();
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
}
function stopTimer(){
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  localStorage.removeItem(TIMER_KEY);
}
function pauseTimer(){
  const t = loadJSON(TIMER_KEY, null);
  if(!t || t.paused) return;
  t.paused = true;
  t.pauseAt = Date.now();
  saveJSON(TIMER_KEY, t);
}
function resumeTimer(){
  const t = loadJSON(TIMER_KEY, null);
  if(!t || !t.paused) return;
  t.paused = false;
  t.pausedTotal += (Date.now() - t.pauseAt);
  t.pauseAt = null;
  saveJSON(TIMER_KEY, t);
}
function getRemaining(){
  const t = loadJSON(TIMER_KEY, null);
  if(!t) return null;
  const now = Date.now();
  const effectiveNow = t.paused ? t.pauseAt : now;
  const elapsed = Math.floor((effectiveNow - t.start - t.pausedTotal)/1000);
  return Math.max(0, t.duration - elapsed);
}
function fmtTime(sec){
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function tickTimer(){
  const rem = getRemaining();
  const sess = getSession();
  if(rem===null || !sess || sess.mode!=="simulacro") return;
  const timerEl = $("#timerText");
  const bar = $("#timerBar");
  if(timerEl) timerEl.textContent = `⏱️ ${fmtTime(rem)} / ${META.default_simulacro_minutes}:00`;
  const t = loadJSON(TIMER_KEY, null);
  if(bar && t){
    const done = 1 - (rem / t.duration);
    bar.style.width = `${Math.max(0, Math.min(1, done))*100}%`;
  }
  if(rem===0){
    playFeedbackSound("warn");
    if(timerInterval){ clearInterval(timerInterval); timerInterval=null; }
    // Auto-finish
    finishSession(true);
  }
}

// ---------- Screens ----------
function show(node){
  const app = $("#app");
  app.innerHTML = "";
  app.appendChild(node);
}

function home(){
  initStats();
  const box = el("div",{class:"card"},[
    el("div",{class:"pill"},["🧠 Estudiar + 🏁 Simulacro PAU · Historia"]),
    el("h2",{style:"margin:10px 0 6px 0;"},["Elige modo"]),
    el("div",{class:"note"},[
      "• Estudiar: microresumen + mnemotecnia + preguntas por bloques.\n"+
      "• Simulacro 90 min: preguntas mixtas, respuestas abiertas obligatorias y corrección por checklist."
    ]),
    el("div",{class:"grid2",style:"margin-top:12px"},[
      el("div",{class:"card",style:"margin:0;background:rgba(0,0,0,.10)"},[
        el("h3",{style:"margin:0 0 8px 0;"},["📘 Estudiar (por bloques)"]),
        el("div",{class:"note"},["Ideal para aprender por primera vez."]),
        el("div",{class:"row",style:"margin-top:10px"},[
          el("button",{class:"btn primary",onclick:studyChooseBlock},["Elegir bloque"]),
          el("button",{class:"btn",onclick:resume},["Reanudar"]),
        ])
      ]),
      el("div",{class:"card",style:"margin:0;background:rgba(0,0,0,.10)"},[
        el("h3",{style:"margin:0 0 8px 0;"},["🏁 Simulacro PAU (90 min)"]),
        el("div",{class:"note"},["Lo más parecido a examen: mezcla y cronología."]),
        el("div",{class:"row",style:"margin-top:10px"},[
          el("button",{class:"btn primary",onclick:startSimulacro},["Empezar simulacro"]),
          el("button",{class:"btn",onclick:statsScreen},["Ver estadísticas"]),
        ])
      ]),
    ]),
    el("hr"),
    el("div",{class:"row"},[
      el("button",{class:"btn",onclick:statsScreen},["📊 Estadísticas"]),
      el("button",{class:"btn",onclick:exportStats},["Exportar JSON"]),
      el("button",{class:"btn bad",onclick:resetAll},["Reset (borrar todo)"]),
    ])
  ]);
  show(box);
}

function resume(){
  const sess = getSession();
  if(!sess){ alert("No hay sesión guardada."); return; }
  renderQuestion();
}

function studyChooseBlock(){
  const rows = META.blocks.map(b=>{
    return el("div",{class:"card",style:"margin:0;background:rgba(0,0,0,.10)"},[
      el("div",{class:"pill"},[`#${b.order} · ${b.id}`]),
      el("div",{style:"margin-top:6px"},[el("strong",{},[b.title])]),
      el("div",{class:"row",style:"margin-top:10px"},[
        el("button",{class:"btn primary",onclick:()=>startStudyBlock(b.id)},["Empezar este bloque"]),
      ])
    ]);
  });
  show(el("div",{},[
    el("div",{class:"card"},[
      el("h2",{style:"margin:0 0 6px 0;"},["Elegir bloque"]),
      el("div",{class:"note"},["Consejo: ve en orden cronológico para que el relato histórico encaje."]),
      el("div",{class:"row",style:"margin-top:10px"},[
        el("button",{class:"btn",onclick:home},["← Volver"]),
      ])
    ]),
    el("div",{class:"grid2"},rows)
  ]));
}

function startStudyBlock(blockId){
  initStats();
  const ids = BANK.filter(q=>q.bloque===blockId).map(q=>q.id);
  const order = pickIntelligent(ids, ids.length);
  const sess = {mode:"study", blockId, idx:0, score:0, items: order.map(id=>({id, ok:null, answer:null, meta:{}}))};
  setSession(sess);
  stopTimer();
  renderQuestion(true);
}

function startSimulacro(){
  initStats();
  // Mix by chronological blocks: take proportional from each block but prioritize intelligent weights
  const all = META.block_order.flatMap(bid => BANK.filter(q=>q.bloque===bid).map(q=>q.id));
  const order = pickIntelligent(all, META.simulacro_size);
  const sess = {mode:"simulacro", idx:0, score:0, items: order.map(id=>({id, ok:null, answer:null, meta:{}}))};
  setSession(sess);
  startTimer(META.default_simulacro_minutes);
  renderQuestion(true);
}

function topBar(sess){
  const done = sess.items.filter(i=>i.ok!==null).length;
  const total = sess.items.length;
  const rem = getRemaining();
  const pills = [
    el("span",{class:"pill"},[sess.mode==="simulacro" ? "🏁 Simulacro" : `📘 Estudiar · ${sess.blockId}`]),
    el("span",{class:"pill"},[`Progreso: ${done}/${total}`]),
    el("span",{class:"pill"},[`Puntos: ${sess.score}`]),
  ];
  if(sess.mode==="simulacro"){
    pills.push(el("span",{class:"pill timer",id:"timerText"},["⏱️ --:-- / 90:00"]));
  }
  const bar = el("div",{class:"progressbar",style:"margin-top:10px"},[ el("div",{id:"timerBar",style:"width:0%"},[]) ]);

  const row = el("div",{class:"row"},[
    ...pills,
    el("span",{style:"flex:1"},[""]),
    sess.mode==="simulacro" ? el("button",{class:"btn",onclick:togglePause},["⏯ Pausa"]) : el("span",{},[""]),
  ]);

  return el("div",{class:"card"},[
    row,
    sess.mode==="simulacro" ? bar : el("div",{},[]),
    el("div",{class:"small",style:"margin-top:8px"},[
      "Navegación: puedes volver atrás. Si vuelves a Inicio, se reinicia el puntaje del simulacro.\n⏯ La pausa detiene el contador (puedes reanudar)."
    ])
  ]);
}

function togglePause(){
  const t = loadJSON(TIMER_KEY, null);
  if(!t) return;
  if(t.paused) resumeTimer();
  else pauseTimer();
  tickTimer();
}

// ---------- Rendering ----------
function renderQuestion(force=false){
  const sess = getSession();
  if(!sess){ home(); return; }
  const item = sess.items[sess.idx];
  const q = qById(item.id);
  if(!q){ clearSession(); home(); return; }

  const wrapper = el("div",{},[]);
  wrapper.appendChild(topBar(sess));

  // Study cards on top for study mode
  if(sess.mode==="study" && force){
    const cards = (META.study_cards && META.study_cards[sess.blockId]) ? META.study_cards[sess.blockId] : [];
    if(cards.length){
      const c = el("div",{class:"card"},[
        el("div",{class:"pill"},["🧩 Microresumen + mnemotecnia"]),
        ...cards.map(x=> el("div",{style:"margin-top:10px"},[
          el("div",{class:"pill"},[x.t]),
          el("div",{class:"note",style:"margin-top:6px"},[x.b])
        ]))
      ]);
      wrapper.appendChild(c);
    }
  }

  const body = el("div",{class:"card"},[
    el("div",{class:"row"},[
      el("span",{class:"pill"},[`Bloque: ${q.bloque}`]),
      el("span",{class:"pill"},[`Tema: ${q.tema}`]),
      el("span",{class:"pill"},[`Tipo: ${labelTipo(q.tipo)}`]),
    ]),
    el("p",{class:"q"},[q.pregunta || q.texto || q.prompt || ""]),
    q.mnemo ? el("div",{class:"note",style:"margin-top:8px"},["🧠 Mnemotecnia: "+q.mnemo]) : el("span",{},[])
  ]);

  if(q.tipo==="mc") renderMC(q, sess, body);
  else if(q.tipo==="cloze") renderCloze(q, sess, body);
  else if(q.tipo==="match") renderMatch(q, sess, body);
  else if(q.tipo==="order") renderOrder(q, sess, body);
  else renderOpen(q, sess, body);

  const nav = el("div",{class:"card"},[
    el("div",{class:"row"},[
      el("button",{class:"btn warn",onclick:goHomeConfirm},["Inicio"]),
      el("button",{class:"btn",onclick:prevQ, disabled: sess.idx===0 ? "true":null},["← Anterior"]),
      el("button",{class:"btn",onclick:nextQ, disabled: sess.idx===sess.items.length-1 ? "true":null},["Siguiente →"]),
      el("button",{class:"btn primary",onclick:()=>finishSession(false)},["Finalizar"]),
    ]),
    el("div",{class:"small",style:"margin-top:8px"},[
      "Tip: en abiertas, escribe primero (obligatorio). Luego revisa el modelo y mira tu checklist."
    ])
  ]);

  wrapper.appendChild(body);
  wrapper.appendChild(nav);
  show(wrapper);
  if(sess.mode==="simulacro") tickTimer();
}

function goHomeConfirm(){
  const sess = getSession();
  if(!sess){ home(); return; }
  const msg = sess.mode==="simulacro"
    ? "Si vuelves a Inicio, se reinicia el puntaje del simulacro (pero NO se borran estadísticas históricas). ¿Volver?"
    : "¿Volver a Inicio? (No se borran estadísticas.)";
  if(confirm(msg)){
    // reset only current session score if simulacro
    clearSession();
    home();
  }
}
function prevQ(){
  const sess = getSession();
  sess.idx = Math.max(0, sess.idx-1);
  setSession(sess);
  renderQuestion();
}
function nextQ(){
  const sess = getSession();
  sess.idx = Math.min(sess.items.length-1, sess.idx+1);
  setSession(sess);
  renderQuestion();
}

function labelTipo(t){
  if(t==="mc") return "Test";
  if(t==="cloze") return "Huecos";
  if(t==="match") return "Emparejar";
  if(t==="order") return "Ordenar";
  return "Abierta (PAU)";
}

// ---------- Question Types ----------
function renderMC(q, sess, body){
  const item = sess.items[sess.idx];
  if(!item.meta.order){
    item.meta.order = shuffle([...Array(q.opciones.length)].map((_,i)=>i));
    setSession(sess);
  }

  body.appendChild(el("div",{class:"note",style:"margin-top:10px"},[
    "Cómo se responde: toca una opción. Luego pulsa “Comprobar”."
  ]));

  const form = el("div",{},[]);
  item.meta.order.forEach((origIdx, displayIdx)=>{
    const row = el("div",{class:"opt"},[
      el("input",{type:"radio",name:"opt",value:String(displayIdx)}),
      el("div",{},[q.opciones[origIdx]])
    ]);
    row.addEventListener("click",()=>row.querySelector("input").checked=true);
    form.appendChild(row);
  });
  const fb = el("div",{style:"margin-top:10px"},[]);
  const btn = el("button",{class:"btn primary"},["Comprobar"]);

  btn.onclick = ()=>{
    const checked = form.querySelector("input[name=opt]:checked");
    if(!checked){ playFeedbackSound("warn"); alert("Elige una opción."); return; }
    const displayIdx = Number(checked.value);
    const chosenOrigIdx = item.meta.order[displayIdx];
    const ok = chosenOrigIdx === q.correcta;

    playFeedbackSound(ok ? "ok" : "bad");

    item.ok = ok;
    item.answer = displayIdx;
    setSession(sess);
    updateStats(q.id, ok);

    if(ok) sess.score += 1;
    setSession(sess);

    fb.innerHTML = "";
    fb.appendChild(el("div",{class:"pill",style:`border-color:${ok?"rgba(52,211,153,.45)":"rgba(251,113,133,.45)"};color:${ok?"#bff7d0":"#ffd0d7"}`},[
      ok ? "✅ Correcto" : `❌ Incorrecto · Correcta: ${q.opciones[q.correcta]}`
    ]));
    fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},[
      (ok ? "📚 Explicación: " : "📚 Explicación: ")+(q.exp || "")
    ]));
    btn.disabled = true;
  };

  body.appendChild(form);
  body.appendChild(el("div",{class:"row",style:"margin-top:10px"},[btn]));
  body.appendChild(fb);
}

function renderCloze(q, sess, body){
  const item = sess.items[sess.idx];
  if(!item.meta.filled) item.meta.filled = Array(q.blanks.length).fill(null);
  if(!item.meta.used) item.meta.used = {};
  if(item.meta.selected===undefined) item.meta.selected = null;
  if(item.meta.activeBlank===undefined) item.meta.activeBlank = null;

  body.appendChild(el("div",{class:"note",style:"margin-top:10px"},[
    "Cómo se responde:\n1) Toca una palabra del banco (se ilumina).\n2) Toca el hueco donde quieres ponerla.\n(Truco: también puedes tocar primero el hueco y luego la palabra)."
  ]));

  const parts = q.texto.split("________");
  const line = el("div",{class:"note",style:"font-size:14px;color:rgba(232,242,255,.92); margin-top:10px; line-height:1.6"},[]);
  for(let i=0;i<parts.length;i++){
    line.appendChild(document.createTextNode(parts[i]));
    if(i < q.blanks.length){
      const b = el("span",{class:"blank"+(item.meta.filled[i]?" filled":"") + (item.meta.activeBlank===i ? " sel":""), "data-idx":String(i)},[
        item.meta.filled[i] ? item.meta.filled[i] : "________"
      ]);
      b.onclick = ()=>{
        if(item.meta.filled[i]) return;
        if(item.meta.selected!==null){
          const w = item.meta.selected;
          item.meta.filled[i] = w;
          item.meta.used[w] = true;
          item.meta.selected = null;
          item.meta.activeBlank = null;
          setSession(sess);
          renderQuestion();
          return;
        }
        item.meta.activeBlank = (item.meta.activeBlank===i) ? null : i;
        setSession(sess);
        renderQuestion();
      };
      line.appendChild(b);
    }
  }

  const bank = el("div",{class:"bank"}, (q.bank||[]).map(w=>{
    const used = !!item.meta.used[w];
    const cls = "word" + (item.meta.selected===w ? " sel" : "") + (used ? " used":"");
    const chip = el("span",{class:cls},[w]);
    chip.onclick = ()=>{
      if(used) return;
      if(item.meta.activeBlank!==null){
        const i = item.meta.activeBlank;
        if(!item.meta.filled[i]){
          item.meta.filled[i] = w;
          item.meta.used[w] = true;
          item.meta.activeBlank = null;
          item.meta.selected = null;
          setSession(sess);
          renderQuestion();
          return;
        }else{
          item.meta.activeBlank = null;
        }
      }
      item.meta.selected = (item.meta.selected===w) ? null : w;
      setSession(sess);
      renderQuestion();
    };
    return chip;
  }));

  const fb = el("div",{style:"margin-top:10px"},[]);
  const btnCheck = el("button",{class:"btn primary"},["Comprobar"]);
  const btnReset = el("button",{class:"btn"},["Vaciar"]);

  btnReset.onclick = ()=>{
    item.meta.filled = Array(q.blanks.length).fill(null);
    item.meta.used = {};
    item.meta.selected = null;
    item.meta.activeBlank = null;
    setSession(sess);
    renderQuestion();
  };

  btnCheck.onclick = ()=>{
    if(item.meta.filled.some(x=>!x)){ playFeedbackSound("warn"); alert("Completa todos los huecos."); return; }
    let okAll = true;
    const wrong = [];
    for(let i=0;i<q.blanks.length;i++){
      const ans = q.blanks[i].a;
      if(item.meta.filled[i] !== ans){
        okAll = false;
        wrong.push({i, correct: ans, got: item.meta.filled[i]});
      }
    }

    playFeedbackSound(okAll ? "ok" : "bad");
    item.ok = okAll;
    item.answer = item.meta.filled.slice();
    setSession(sess);
    updateStats(q.id, okAll);
    if(okAll) sess.score += 1;
    setSession(sess);

    fb.innerHTML = "";
    fb.appendChild(el("div",{class:"pill",style:`border-color:${okAll?"rgba(52,211,153,.45)":"rgba(251,113,133,.45)"};color:${okAll?"#bff7d0":"#ffd0d7"}`},[
      okAll ? "✅ Todo correcto" : `❌ Hay ${wrong.length} hueco(s) mal`
    ]));
    if(!okAll){
      fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},[
        "Correcciones:\n" + wrong.map(w=>`• Hueco ${w.i+1}: era "${w.correct}" (pusiste "${w.got}")`).join("\n")
      ]));
    }
    fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},[
      (okAll ? "📚 Explicación: " : "📚 Explicación: ")+(q.exp || "")
    ]));
    // Full solution
    const solParts = (q.texto||"").split("________");
    let full = "";
    for(let i=0;i<solParts.length;i++){
      full += solParts[i];
      if(i<q.blanks.length) full += q.blanks[i].a;
    }
    fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},["Modelo completo: "+full]));
    btnCheck.disabled = true;
  };

  body.appendChild(line);
  body.appendChild(bank);
  body.appendChild(el("div",{class:"row",style:"margin-top:10px"},[btnCheck, btnReset]));
  body.appendChild(fb);
}

function renderMatch(q, sess, body){
  const item = sess.items[sess.idx];
  if(!item.meta.state){
    const left = q.pairs.map(p=>p[0]);
    const right = q.pairs.map(p=>p[1]);
    item.meta.left = shuffle(left);
    item.meta.right = shuffle(right);
    item.meta.map = {};
    item.meta.done = {};
    item.meta.selL = null;
    item.meta.selR = null;
    item.meta.state = 1;
    setSession(sess);
  }

  body.appendChild(el("div",{class:"note",style:"margin-top:10px"},[
    "Cómo se responde: toca un concepto (columna izquierda) y luego su pareja (columna derecha)."
  ]));

  const fb = el("div",{style:"margin-top:10px"},[]);
  const leftCol = el("div",{class:"matchcol"}, item.meta.left.map(t=>{
    const done = !!item.meta.done["L:"+t];
    const cls = "matchitem" + (item.meta.selL===t ? " sel":"") + (done ? " done":"");
    const it = el("div",{class:cls},[t]);
    it.onclick = ()=>{
      if(done) return;
      item.meta.selL = (item.meta.selL===t) ? null : t;
      setSession(sess); renderQuestion();
    };
    return it;
  }));
  const rightCol = el("div",{class:"matchcol"}, item.meta.right.map(t=>{
    const done = !!item.meta.done["R:"+t];
    const cls = "matchitem" + (item.meta.selR===t ? " sel":"") + (done ? " done":"");
    const it = el("div",{class:cls},[t]);
    it.onclick = ()=>{
      if(done) return;
      item.meta.selR = (item.meta.selR===t) ? null : t;
      if(item.meta.selL && item.meta.selR){
        const L = item.meta.selL, R = item.meta.selR;
        const ok = q.pairs.some(p=>p[0]===L && p[1]===R);
        if(ok){
          playFeedbackSound("ok");
          item.meta.done["L:"+L] = true;
          item.meta.done["R:"+R] = true;
          item.meta.map[L] = R;
          item.meta.selL = null; item.meta.selR = null;
        }else{
          playFeedbackSound("bad");
          item.meta.selR = null;
        }
        setSession(sess); renderQuestion();
      }else{
        setSession(sess); renderQuestion();
      }
    };
    return it;
  }));
  const grid = el("div",{class:"matchgrid"},[leftCol, rightCol]);

  const btnCheck = el("button",{class:"btn primary"},["Finalizar y comprobar"]);
  btnCheck.onclick = ()=>{
    const doneCount = Object.keys(item.meta.map).length;
    const okAll = doneCount === q.pairs.length;
    playFeedbackSound(okAll ? "ok" : "bad");

    item.ok = okAll;
    item.answer = item.meta.map;
    setSession(sess);
    updateStats(q.id, okAll);
    if(okAll) sess.score += 1;
    setSession(sess);

    fb.innerHTML = "";
    fb.appendChild(el("div",{class:"pill",style:`border-color:${okAll?"rgba(52,211,153,.45)":"rgba(251,113,133,.45)"};color:${okAll?"#bff7d0":"#ffd0d7"}`},[
      okAll ? "✅ Todo emparejado" : `⚠️ Te faltan ${q.pairs.length-doneCount} emparejamientos`
    ]));
    fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},[
      (okAll ? "📚 Explicación: " : "📚 Explicación: ")+(q.exp || "")
    ]));
    btnCheck.disabled = true;
  };

  body.appendChild(grid);
  body.appendChild(el("div",{class:"row",style:"margin-top:10px"},[btnCheck]));
  body.appendChild(fb);
}

function renderOrder(q, sess, body){
  const item = sess.items[sess.idx];
  if(!item.meta.list){
    item.meta.list = shuffle(q.items_ordered);
    setSession(sess);
  }

  body.appendChild(el("div",{class:"note",style:"margin-top:10px"},[
    "Cómo se responde: usa ↑ ↓ para ordenar. Luego pulsa “Comprobar”."
  ]));

  const listEl = el("div",{style:"margin-top:10px"},[]);
  function redraw(){
    listEl.innerHTML = "";
    item.meta.list.forEach((txt, i)=>{
      const up = el("button",{class:"btn",onclick:()=>{ if(i===0) return; [item.meta.list[i-1], item.meta.list[i]]=[item.meta.list[i], item.meta.list[i-1]]; setSession(sess); redraw(); }},["↑"]);
      const dn = el("button",{class:"btn",onclick:()=>{ if(i===item.meta.list.length-1) return; [item.meta.list[i+1], item.meta.list[i]]=[item.meta.list[i], item.meta.list[i+1]]; setSession(sess); redraw(); }},["↓"]);
      listEl.appendChild(el("div",{class:"opt",style:"align-items:center"},[
        el("div",{style:"min-width:30px;color:rgba(232,242,255,.75)"},[String(i+1)+"."]),
        el("div",{style:"flex:1"},[txt]),
        el("div",{class:"row"},[up,dn])
      ]));
    });
  }
  redraw();

  const fb = el("div",{style:"margin-top:10px"},[]);
  const btn = el("button",{class:"btn primary"},["Comprobar"]);
  btn.onclick = ()=>{
    const okAll = item.meta.list.join("||") === q.items_ordered.join("||");
    playFeedbackSound(okAll ? "ok" : "bad");
    item.ok = okAll;
    item.answer = item.meta.list.slice();
    setSession(sess);
    updateStats(q.id, okAll);
    if(okAll) sess.score += 1;
    setSession(sess);

    fb.innerHTML = "";
    fb.appendChild(el("div",{class:"pill",style:`border-color:${okAll?"rgba(52,211,153,.45)":"rgba(251,113,133,.45)"};color:${okAll?"#bff7d0":"#ffd0d7"}`},[
      okAll ? "✅ Orden correcto" : "❌ Orden incorrecto"
    ]));
    fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},[
      (okAll ? "📚 Explicación: " : "📚 Explicación: ")+(q.exp || "")
    ]));
    if(!okAll){
      fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},["Orden correcto: "+q.items_ordered.join(" → ")]));
    }
    btn.disabled = true;
  };

  body.appendChild(listEl);
  body.appendChild(el("div",{class:"row",style:"margin-top:10px"},[btn]));
  body.appendChild(fb);
}

function renderOpen(q, sess, body){
  const item = sess.items[sess.idx];
  const minChars = q.min_chars || 280;

  body.appendChild(el("div",{class:"note",style:"margin-top:10px"},[
    "Cómo se responde:\n1) Escribe un párrafo (obligatorio).\n2) Pulsa “Corregir por checklist”.\n3) Lee el modelo y mejora tu texto.\n4) Marca: “Me salió” o “No todavía”."
  ]));

  const hint = (q.must_include && q.must_include.length)
    ? ("Tu respuesta debería considerar al menos estas palabras/ideas: " + q.must_include.join(", ") + ".")
    : null;

  if(hint){
    body.appendChild(el("div",{class:"note",style:"margin-top:10px"},["🧩 Pistas: "+hint]));
  }

  const ta = el("textarea",{placeholder:`Escribe aquí (mínimo ${minChars} caracteres). Consejo: 8–12 líneas.`},[]);
  const counter = el("div",{class:"small",style:"margin-top:6px"},[`0 / ${minChars}`]);
  ta.addEventListener("input", ()=>{
    counter.textContent = `${ta.value.length} / ${minChars}`;
  });

  const fb = el("div",{style:"margin-top:10px"},[]);

  const btnCheck = el("button",{class:"btn primary"},["Corregir por checklist"]);
  btnCheck.onclick = ()=>{
    const text = ta.value || "";
    if(text.trim().length < minChars){
      playFeedbackSound("warn");
      alert(`Escribe al menos ${minChars} caracteres antes de corregir.`);
      return;
    }
    const ntext = normalize(text);
    const must = (q.must_include || []).map(normalize).filter(Boolean);
    const hits = [];
    const miss = [];
    for(const k of must){
      if(ntext.includes(k)) hits.push(k);
      else miss.push(k);
    }
    // Threshold: at least 60% of must_include
    const needed = must.length ? Math.ceil(must.length*0.60) : 0;
    const okAuto = must.length ? (hits.length >= needed) : true;

    playFeedbackSound(okAuto ? "ok" : "bad");

    // Save partial scoring (not final OK yet; final is "me salio/no")
    item.meta.check = {hits, miss, needed, okAuto};
    item.answer = text;
    setSession(sess);

    fb.innerHTML = "";
    fb.appendChild(el("div",{class:"pill",style:`border-color:${okAuto?"rgba(52,211,153,.45)":"rgba(251,113,133,.45)"};color:${okAuto?"#bff7d0":"#ffd0d7"}`},[
      okAuto ? `✅ Checklist OK (${hits.length}/${must.length})` : `❌ Checklist flojo (${hits.length}/${must.length})`
    ]));
    fb.appendChild(el("div",{class:"note",style:"margin-top:8px"},[
      "✅ Incluiste: " + (hits.length? hits.join(", ") : "—") + "\n" +
      "❌ Faltó: " + (miss.length? miss.join(", ") : "—") + "\n" +
      (q.exp ? ("📚 Explicación: "+q.exp) : "")
    ]));
    fb.appendChild(el("div",{class:"note",style:"margin-top:10px"},["🧾 Respuesta modelo (para comparar y mejorar):\n"+(q.respuesta_modelo||"")]));
  };

  const got = el("button",{class:"btn good"},["✅ Me salió"]);
  const nogo = el("button",{class:"btn bad"},["❌ No todavía"]);

  function mark(ok){
    const text = ta.value || "";
    if(text.trim().length < minChars){
      playFeedbackSound("warn");
      alert(`Antes de marcar, escribe al menos ${minChars} caracteres.`);
      return;
    }
    playFeedbackSound(ok ? "ok" : "bad");
    item.ok = ok;
    item.answer = text;
    setSession(sess);
    updateStats(q.id, ok);
    if(ok) sess.score += 1;
    setSession(sess);
    alert("Guardado ✅");
  }
  got.onclick = ()=>mark(true);
  nogo.onclick = ()=>mark(false);

  body.appendChild(ta);
  body.appendChild(counter);
  body.appendChild(el("div",{class:"row",style:"margin-top:10px"},[btnCheck, got, nogo]));
  body.appendChild(fb);
}

// ---------- Finish / Stats ----------
function finishSession(auto=false){
  const sess = getSession();
  if(!sess){ home(); return; }
  // stop timer always when finishing
  stopTimer();

  const total = sess.items.length;
  const done = sess.items.filter(i=>i.ok!==null).length;
  const ok = sess.items.filter(i=>i.ok===true).length;

  const byBlock = {};
  for(const it of sess.items){
    const q = qById(it.id);
    if(!q) continue;
    const k = q.bloque;
    byBlock[k] = byBlock[k] || {t:0, ok:0, d:0};
    byBlock[k].t += 1;
    if(it.ok===true) byBlock[k].ok += 1;
    if(it.ok!==null) byBlock[k].d += 1;
  }

  const rows = Object.entries(byBlock)
    .sort((a,b)=> META.block_order.indexOf(a[0]) - META.block_order.indexOf(b[0]))
    .map(([b, r])=> el("tr",{},[
      el("td",{},[b]), el("td",{},[`${r.ok}/${r.t}`]), el("td",{},[`${r.d}/${r.t}`])
    ]));

  const table = el("table",{},[
    el("thead",{},[el("tr",{},[ el("th",{},["Bloque"]), el("th",{},["Aciertos"]), el("th",{},["Hechas"]) ])]),
    el("tbody",{},rows)
  ]);

  const msg = auto ? "⏱️ Se acabó el tiempo: simulacro finalizado automáticamente." : "Sesión finalizada.";
  const box = el("div",{class:"card"},[
    el("div",{class:"pill"},["🏁 Fin"]),
    el("h2",{style:"margin:10px 0 6px 0;"},["Resumen"]),
    el("div",{class:"note"},[msg]),
    el("div",{class:"row",style:"margin-top:8px"},[
      el("span",{class:"pill"},[`Hechas: ${done}/${total}`]),
      el("span",{class:"pill"},[`Aciertos: ${ok}/${total}`]),
      el("span",{class:"pill"},[`Puntos: ${sess.score}`]),
    ]),
    el("div",{style:"margin-top:10px"},[table]),
    el("hr"),
    el("div",{class:"row"},[
      el("button",{class:"btn primary",onclick:()=>{ clearSession(); startSimulacro(); }},["Repetir simulacro (inteligente)"]),
      el("button",{class:"btn",onclick:statsScreen},["Ver estadísticas"]),
      el("button",{class:"btn",onclick:()=>{ clearSession(); home(); }},["Inicio"]),
    ])
  ]);
  show(box);
}

function statsScreen(){
  const s = loadJSON(STATS_KEY, {});
  const byBlock = {};
  const byType = {};

  for(const st of Object.values(s)){
    if(!st || !st.bloque) continue;
    byBlock[st.bloque] = byBlock[st.bloque] || {seen:0, ok:0, fail:0};
    byBlock[st.bloque].seen += st.seen;
    byBlock[st.bloque].ok += st.ok;
    byBlock[st.bloque].fail += st.fail;

    byType[st.tipo] = byType[st.tipo] || {seen:0, ok:0, fail:0};
    byType[st.tipo].seen += st.seen;
    byType[st.tipo].ok += st.ok;
    byType[st.tipo].fail += st.fail;
  }

  const blockRows = Object.entries(byBlock)
    .sort((a,b)=> META.block_order.indexOf(a[0]) - META.block_order.indexOf(b[0]))
    .map(([b, r])=>{
      const acc = r.seen ? Math.round((r.ok/r.seen)*100) : 0;
      return el("tr",{},[ el("td",{},[b]), el("td",{},[String(r.seen)]), el("td",{},[String(r.ok)]), el("td",{},[String(r.fail)]), el("td",{},[r.seen? (acc+"%"):"—"]) ]);
    });

  const typeRows = Object.entries(byType)
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([t, r])=>{
      const acc = r.seen ? Math.round((r.ok/r.seen)*100) : 0;
      return el("tr",{},[ el("td",{},[labelTipo(t)]), el("td",{},[String(r.seen)]), el("td",{},[String(r.ok)]), el("td",{},[String(r.fail)]), el("td",{},[r.seen? (acc+"%"):"—"]) ]);
    });

  const t1 = el("table",{},[
    el("thead",{},[el("tr",{},[ el("th",{},["Bloque"]), el("th",{},["Vistas"]), el("th",{},["OK"]), el("th",{},["Fallo"]), el("th",{},["Acierto"]) ])]),
    el("tbody",{},blockRows)
  ]);

  const t2 = el("table",{},[
    el("thead",{},[el("tr",{},[ el("th",{},["Tipo"]), el("th",{},["Vistas"]), el("th",{},["OK"]), el("th",{},["Fallo"]), el("th",{},["Acierto"]) ])]),
    el("tbody",{},typeRows)
  ]);

  show(el("div",{},[
    el("div",{class:"card"},[
      el("div",{class:"pill"},["📊 Estadísticas"]),
      el("div",{class:"row",style:"margin-top:10px"},[
        el("button",{class:"btn",onclick:home},["← Volver"]),
        el("button",{class:"btn",onclick:exportStats},["Exportar JSON"]),
      ]),
      el("div",{class:"note",style:"margin-top:10px"},["Usa esto para saber qué bloque te está costando y repetir simulacro."])
    ]),
    el("div",{class:"card"},[ el("h3",{style:"margin:0 0 10px 0;"},["Por bloque"]), t1 ]),
    el("div",{class:"card"},[ el("h3",{style:"margin:0 0 10px 0;"},["Por tipo"]), t2 ]),
  ]));
}

function exportStats(){
  const data = localStorage.getItem(STATS_KEY) || "{}";
  navigator.clipboard.writeText(data).then(()=>alert("Stats JSON copiado ✅")).catch(()=>prompt("Copia el JSON:", data));
}

function resetAll(){
  if(!confirm("¿Seguro? Se borran estadísticas y cualquier sesión guardada.")) return;
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(SESSION_KEY);
  stopTimer();
  home();
}

window.addEventListener("load", home);
