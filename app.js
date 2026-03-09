
const B=window.HISTORIA_BANK||[], M=window.HISTORIA_META||{};
const SK='histdual_stats_v4', XK='histdual_sess_v4', TK='histdual_timer_v4';
const $=s=>document.querySelector(s);
function el(t,a={},c=[]){const e=document.createElement(t);for(const[k,v]of Object.entries(a)){if(v==null)continue;if(k==='class')e.className=v;else if(k==='onclick')e.onclick=v;else e.setAttribute(k,v)}for(const x of c){if(typeof x==='string')e.appendChild(document.createTextNode(x));else if(x)e.appendChild(x)}return e}
const load=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}}, save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const q=id=>B.find(x=>x.id===id);
function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()}
function init(){const s=load(SK,{});for(const x of B){if(!s[x.id])s[x.id]={seen:0,ok:0,fail:0,bloque:x.bloque,tipo:x.tipo,last:0}}save(SK,s)}
function upd(id,ok){const s=load(SK,{});s[id].seen++;ok?s[id].ok++:s[id].fail++;s[id].last=Date.now();save(SK,s)}
function snd(k){try{const A=window.AudioContext||window.webkitAudioContext,c=new A(),n=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='sine';if(k==='ok'){o.frequency.setValueAtTime(660,n);o.frequency.setValueAtTime(880,n+.07)}else if(k==='warn'){o.frequency.setValueAtTime(440,n);o.frequency.setValueAtTime(330,n+.09)}else{o.frequency.setValueAtTime(220,n);o.frequency.setValueAtTime(165,n+.08)}g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.12,n+.02);g.gain.exponentialRampToValueAtTime(.0001,n+.18);o.connect(g);g.connect(c.destination);o.start(n);o.stop(n+.22);setTimeout(()=>{try{c.close()}catch{}},400)}catch{}}
function sh(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function pick(ids,n){const s=load(SK,{}),now=Date.now();return ids.map(id=>{const st=s[id]||{seen:0,ok:0,fail:0,last:0};const unseen=st.seen===0?1:0,fr=st.seen?(st.fail/st.seen):.85,age=st.last?Math.min(1,(now-st.last)/(1000*60*60*24*5)):1;return{id,w:.55*unseen+.3*fr+.15*age+Math.random()*.03}}).sort((a,b)=>b.w-a.w).slice(0,Math.min(n,ids.length)).map(x=>x.id)}
function setSess(s){save(XK,s)} function getSess(){return load(XK,null)} function clearSession(){localStorage.removeItem(XK);stopTimer()}
let timerInt=null;
function startTimer(min){save(TK,{start:Date.now(),duration:min*60,paused:false,pauseAt:null,pausedTotal:0});tick();if(timerInt)clearInterval(timerInt);timerInt=setInterval(tick,1000)}
function stopTimer(){if(timerInt)clearInterval(timerInt);timerInt=null;localStorage.removeItem(TK)}
function pause(){const t=load(TK,null);if(!t)return;if(t.paused){t.paused=false;t.pausedTotal+=Date.now()-t.pauseAt;t.pauseAt=null}else{t.paused=true;t.pauseAt=Date.now()}save(TK,t);tick()}
function rem(){const t=load(TK,null);if(!t)return null;const now=t.paused?t.pauseAt:Date.now();return Math.max(0,t.duration-Math.floor((now-t.start-t.pausedTotal)/1000))}
function fmt(sec){const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function tick(){const r=rem(),s=getSess();if(r===null||!s||s.mode!=='simulacro')return;const e=$('#timerText'),b=$('#timerBar');if(e)e.textContent=`⏱️ ${fmt(r)} / ${M.default_simulacro_minutes}:00`;const t=load(TK,null);if(b&&t)b.style.width=`${(1-r/t.duration)*100}%`;if(r===0){snd('warn');if(timerInt)clearInterval(timerInt);timerInt=null;finish(true)}}
function show(n){const app=$('#app');app.innerHTML='';app.appendChild(n)}

function intro(){
  init();
  const sess=getSess();
  show(el('div',{},[
    el('div',{class:'card'},[
      el('div',{class:'hero-title'},['Historia PAU · Entrenador Inteligente']),
      el('div',{class:'note'},['Estudiar Historia para la PAU requiere tres habilidades:\n\n📚 conocer contenidos\n🧠 relacionar procesos y fechas\n✍️ redactar respuestas claras'])
    ]),
    el('div',{class:'grid2'},[
      el('div',{class:'card',style:'margin:0'},[
        el('h3',{},['📘 Modo Entrenamiento']),
        el('div',{class:'note'},['• práctica por tema\n• repaso global inteligente\n• feedback y respuesta modelo\n• pensado para aprender por primera vez']),
        el('div',{class:'row',style:'margin-top:12px'},[el('button',{class:'btn primary',onclick:themeMenu},['Empezar entrenamiento'])])
      ]),
      el('div',{class:'card',style:'margin:0'},[
        el('h3',{},['🏁 Modo Simulacro PAU']),
        el('div',{class:'note'},['• 90 minutos\n• 28 preguntas seleccionadas de forma inteligente\n• preguntas abiertas obligatorias\n• pausa disponible']),
        el('div',{class:'row',style:'margin-top:12px'},[el('button',{class:'btn primary',onclick:startSim},['Empezar simulacro'])])
      ])
    ]),
    el('div',{class:'card'},[
      el('h3',{},['Cómo funciona']),
      el('div',{class:'note'},['1) Lee la pregunta con atención.\n2) En abiertas debes escribir un párrafo antes de continuar.\n3) Algunas respuestas incluyen palabras clave recomendadas.\n4) Si vuelves al inicio se pierde el puntaje acumulado de la sesión actual.']),
      el('div',{class:'row',style:'margin-top:12px'},[
        sess ? el('button',{class:'btn',onclick:resume},['Continuar donde lo dejaste']) : el('span',{},[]),
        el('button',{class:'btn',onclick:stats},['Ver estadísticas']),
        el('button',{class:'btn',onclick:exportStats},['Exportar JSON']),
        el('button',{class:'btn bad',onclick:resetAll},['Reset'])
      ])
    ])
  ]));
}
function themeMenu(){
  show(el('div',{},[
    el('div',{class:'card'},[
      el('h2',{},['Modo Entrenamiento']),
      el('div',{class:'note'},['Elige cómo quieres estudiar:\n• por tema, para centrarte en un bloque concreto\n• global inteligente, para mezclar preguntas y priorizar fallos']),
      el('div',{class:'row',style:'margin-top:12px'},[
        el('button',{class:'btn primary',onclick:startTrainGlobal},['Entrenamiento global']),
        el('button',{class:'btn',onclick:intro},['← Volver'])
      ])
    ]),
    el('div',{class:'themegrid'},M.blocks.map(b=>el('div',{class:'card',style:'margin:0;background:rgba(0,0,0,.10)'},[
      el('div',{class:'pill'},[`#${b.order}`]),
      el('div',{style:'margin-top:6px'},[el('strong',{},[b.title])]),
      el('div',{class:'small',style:'margin-top:6px'},[`Preguntas disponibles: ${B.filter(q=>q.bloque===b.id).length}`]),
      el('div',{class:'row',style:'margin-top:10px'},[el('button',{class:'btn primary',onclick:()=>startTrainTheme(b.id)},['Entrenar este tema'])])
    ])))
  ]));
}
function startTrainTheme(block){const ids=B.filter(x=>x.bloque===block).map(x=>x.id);setSess({mode:'train-theme',block,idx:0,score:0,items:pick(ids,ids.length).map(id=>({id,ok:null,answer:null,meta:{}}))});stopTimer();render(true)}
function startTrainGlobal(){const ids=B.map(x=>x.id);setSess({mode:'train-global',block:null,idx:0,score:0,items:pick(ids,Math.min(30,ids.length)).map(id=>({id,ok:null,answer:null,meta:{}}))});stopTimer();render(true)}
function startSim(){const ids=B.map(x=>x.id);let base=[];for(const b of M.blocks){base.push(...pick(B.filter(x=>x.bloque===b.id).map(x=>x.id),2))}const rest=ids.filter(id=>!base.includes(id));const order=sh(base.concat(pick(rest,Math.max(0,M.simulacro_size-base.length)))).slice(0,M.simulacro_size);setSess({mode:'simulacro',block:null,idx:0,score:0,items:order.map(id=>({id,ok:null,answer:null,meta:{}}))});startTimer(M.default_simulacro_minutes);render(true)}
function resume(){const s=getSess();if(!s){alert('No hay sesión guardada.');return;}render(false)}

function top(s){const done=s.items.filter(i=>i.ok!==null).length;return el('div',{class:'card'},[
  el('div',{class:'row'},[
    el('span',{class:'pill'},[s.mode==='simulacro'?'🏁 Simulacro':(s.mode==='train-global'?'📘 Entrenamiento global':'📘 Entrenamiento por tema')]),
    s.block?el('span',{class:'pill'},[`Bloque: ${s.block}`]):el('span',{},[]),
    el('span',{class:'pill'},[`Progreso: ${done}/${s.items.length}`]),
    el('span',{class:'pill'},[`Puntos: ${s.score}`]),
    s.mode==='simulacro'?el('span',{class:'pill',id:'timerText'},['⏱️ --:-- / 90:00']):el('span',{},[]),
    el('span',{style:'flex:1'},['']),
    s.mode==='simulacro'?el('button',{class:'btn',onclick:pause},['⏯ Pausa']):el('span',{},[])
  ]),
  s.mode==='simulacro'?el('div',{class:'progressbar',style:'margin-top:10px'},[el('div',{id:'timerBar',style:'width:0%'},[])]):el('div',{},[]),
  el('div',{class:'small',style:'margin-top:8px'},[s.mode==='simulacro'?'Puedes volver atrás. Si regresas al inicio, se pierde el puntaje del simulacro actual. La pausa detiene el contador.':'Puedes volver atrás. Si regresas al inicio, se cierra la sesión actual.'])
])}

function render(force){
  const s=getSess(); if(!s){intro();return;}
  const it=s.items[s.idx], x=q(it.id); if(!x){intro();return;}
  const wrap=el('div',{},[]); wrap.appendChild(top(s));
  if(force && s.mode==='train-theme'){
    const cards=M.study_cards[s.block]||[];
    if(cards.length) wrap.appendChild(el('div',{class:'card'},[
      el('div',{class:'pill'},['🧩 Microresumen + mnemotecnia']),
      ...cards.map(c=>el('div',{style:'margin-top:10px'},[el('div',{class:'pill'},[c[0]]),el('div',{class:'note',style:'margin-top:6px'},[c[1]])]))
    ]));
  }
  const body=el('div',{class:'card'},[
    el('div',{class:'row'},[
      el('span',{class:'pill'},[`Bloque: ${x.bloque}`]),
      el('span',{class:'pill'},[`Tema: ${x.tema}`]),
      el('span',{class:'pill'},[x.tipo==='mc'?'Test':x.tipo==='cloze'?'Huecos':x.tipo==='match'?'Emparejar':'Abierta (PAU)'])
    ]),
    el('p',{class:'q'},[x.pregunta||x.texto||''])
  ]);
  if(x.tipo==='mc') mcView(x,s,body); else if(x.tipo==='cloze') clozeView(x,s,body); else if(x.tipo==='match') matchView(x,s,body); else openView(x,s,body);
  wrap.appendChild(body);
  wrap.appendChild(el('div',{class:'card'},[el('div',{class:'row'},[
    el('button',{class:'btn warn',onclick:goHome},['Inicio']),
    el('button',{class:'btn',onclick:prev,disabled:s.idx===0?'true':null},['← Anterior']),
    el('button',{class:'btn',onclick:next,disabled:s.idx===s.items.length-1?'true':null},['Siguiente →']),
    el('button',{class:'btn primary',onclick:()=>finish(false)},['Finalizar'])
  ])]));
  show(wrap);
  if(s.mode==='simulacro') tick();
}
function goHome(){const s=getSess();if(!s)return intro();const msg=s.mode==='simulacro'?'Si vuelves al inicio, perderás el puntaje acumulado del simulacro actual. ¿Volver?':'¿Volver al inicio?';if(confirm(msg)){clearSession();intro()}}
function prev(){const s=getSess();s.idx=Math.max(0,s.idx-1);setSess(s);render(false)}
function next(){const s=getSess();s.idx=Math.min(s.items.length-1,s.idx+1);setSess(s);render(false)}

function mcView(x,s,body){
  const it=s.items[s.idx]; if(!it.meta.order){it.meta.order=sh([...Array(x.opciones.length)].map((_,i)=>i));setSess(s)}
  body.appendChild(el('div',{class:'note',style:'margin-top:10px'},['Cómo se responde: toca una opción y luego pulsa “Comprobar”.']));
  const form=el('div',{},[]),fb=el('div',{style:'margin-top:10px'},[]),btn=el('button',{class:'btn primary'},['Comprobar']);
  it.meta.order.forEach((orig,disp)=>{const row=el('div',{class:'opt'},[el('input',{type:'radio',name:'opt',value:String(disp)}),el('div',{},[x.opciones[orig]])]);row.onclick=()=>row.querySelector('input').checked=true;form.appendChild(row)});
  btn.onclick=()=>{const ch=form.querySelector('input[name="opt"]:checked');if(!ch){snd('warn');alert('Elige una opción.');return;}const ok=it.meta.order[Number(ch.value)]===x.correcta;snd(ok?'ok':'bad');it.ok=ok;setSess(s);upd(x.id,ok);if(ok)s.score++;setSess(s);fb.innerHTML='';fb.appendChild(el('div',{class:'pill'},[ok?'✅ Correcto':`❌ Incorrecto · Correcta: ${x.opciones[x.correcta]}`]));fb.appendChild(el('div',{class:'note',style:'margin-top:8px'},['📚 Explicación: '+x.exp]));btn.disabled=true};
  body.appendChild(form);body.appendChild(el('div',{class:'row',style:'margin-top:10px'},[btn]));body.appendChild(fb);
}
function clozeView(x,s,body){
  const it=s.items[s.idx]; if(!it.meta.fill){it.meta.fill=Array(x.blanks.length).fill(null);it.meta.used={};it.meta.sel=null;setSess(s)}
  body.appendChild(el('div',{class:'note',style:'margin-top:10px'},['Cómo se responde: toca una palabra del banco y luego el hueco.']));
  const parts=x.texto.split('________'); const line=el('div',{class:'note',style:'font-size:14px;color:rgba(232,242,255,.92);margin-top:10px;line-height:1.6'},[]);
  for(let i=0;i<parts.length;i++){line.appendChild(document.createTextNode(parts[i]));if(i<x.blanks.length){const b=el('span',{class:'blank'},[it.meta.fill[i]||'________']);b.onclick=()=>{if(it.meta.sel&&!it.meta.fill[i]){it.meta.fill[i]=it.meta.sel;it.meta.used[it.meta.sel]=true;it.meta.sel=null;setSess(s);render(false)}};line.appendChild(b)}}
  const bank=el('div',{class:'bank'},(x.bank||[]).map(w=>{const chip=el('span',{class:'word'+(it.meta.used[w]?' used':'')},[w]);chip.onclick=()=>{if(it.meta.used[w])return;it.meta.sel=w;setSess(s)};return chip}));
  const fb=el('div',{style:'margin-top:10px'},[]),btn=el('button',{class:'btn primary'},['Comprobar']);
  btn.onclick=()=>{if(it.meta.fill.some(v=>!v)){snd('warn');alert('Completa todos los huecos.');return;}let ok=true;for(let i=0;i<x.blanks.length;i++){if(it.meta.fill[i]!==x.blanks[i].a)ok=false}snd(ok?'ok':'bad');it.ok=ok;setSess(s);upd(x.id,ok);if(ok)s.score++;setSess(s);fb.innerHTML='';fb.appendChild(el('div',{class:'pill'},[ok?'✅ Todo correcto':'❌ Hay errores en los huecos']));fb.appendChild(el('div',{class:'note',style:'margin-top:8px'},['📚 Explicación: '+x.exp]));btn.disabled=true};
  body.appendChild(line);body.appendChild(bank);body.appendChild(el('div',{class:'row',style:'margin-top:10px'},[btn]));body.appendChild(fb);
}
function matchView(x,s,body){
  const it=s.items[s.idx]; if(!it.meta.left){it.meta.left=sh(x.pairs.map(p=>p[0]));it.meta.right=sh(x.pairs.map(p=>p[1]));it.meta.map={};it.meta.done={};it.meta.selL=null;setSess(s)}
  body.appendChild(el('div',{class:'note',style:'margin-top:10px'},['Cómo se responde: toca un elemento de la izquierda y luego su pareja de la derecha.']));
  const fb=el('div',{style:'margin-top:10px'},[]);
  const left=el('div',{class:'matchcol'},it.meta.left.map(t=>{const d=!!it.meta.done['L:'+t];const n=el('div',{class:'matchitem'+(d?' done':'')},[t]);n.onclick=()=>{if(!d){it.meta.selL=t;setSess(s)}};return n}));
  const right=el('div',{class:'matchcol'},it.meta.right.map(t=>{const d=!!it.meta.done['R:'+t];const n=el('div',{class:'matchitem'+(d?' done':'')},[t]);n.onclick=()=>{if(d||!it.meta.selL)return;const ok=x.pairs.some(p=>p[0]===it.meta.selL&&p[1]===t);if(ok){snd('ok');it.meta.done['L:'+it.meta.selL]=true;it.meta.done['R:'+t]=true;it.meta.map[it.meta.selL]=t;it.meta.selL=null;setSess(s);render(false)}else snd('bad')};return n}));
  const btn=el('button',{class:'btn primary'},['Finalizar y comprobar']);
  btn.onclick=()=>{const ok=Object.keys(it.meta.map).length===x.pairs.length;snd(ok?'ok':'bad');it.ok=ok;setSess(s);upd(x.id,ok);if(ok)s.score++;setSess(s);fb.innerHTML='';fb.appendChild(el('div',{class:'pill'},[ok?'✅ Todo emparejado':'❌ Faltan parejas por resolver']));fb.appendChild(el('div',{class:'note',style:'margin-top:8px'},['📚 Explicación: '+x.exp]));btn.disabled=true};
  body.appendChild(el('div',{class:'matchgrid'},[left,right]));body.appendChild(el('div',{class:'row',style:'margin-top:10px'},[btn]));body.appendChild(fb);
}
function openView(x,s,body){
  const it=s.items[s.idx],min=x.min_chars||220;
  body.appendChild(el('div',{class:'note',style:'margin-top:10px'},['Cómo se responde:\n1) Escribe un párrafo.\n2) Pulsa “Corregir por checklist”.\n3) Lee el modelo y mejora tu texto.\n4) Marca “Me salió” o “No todavía”.']));
  body.appendChild(el('div',{class:'note',style:'margin-top:10px'},['🧩 Pistas: '+(x.must_include||[]).join(', ')]));
  const ta=el('textarea',{placeholder:`Escribe aquí (mínimo ${min} caracteres).`},[]), counter=el('div',{class:'small',style:'margin-top:6px'},[`0 / ${min}`]);
  ta.oninput=()=>counter.textContent=`${ta.value.length} / ${min}`;
  const fb=el('div',{style:'margin-top:10px'},[]), btn=el('button',{class:'btn primary'},['Corregir por checklist']);
  btn.onclick=()=>{const t=ta.value||'';if(t.trim().length<min){snd('warn');alert(`Escribe al menos ${min} caracteres.`);return;}const n=norm(t),must=(x.must_include||[]).map(norm),hits=[],miss=[];for(const k of must){n.includes(k)?hits.push(k):miss.push(k)}const ok=hits.length>=Math.ceil(must.length*.60);snd(ok?'ok':'bad');it.answer=t;setSess(s);fb.innerHTML='';fb.appendChild(el('div',{class:'pill'},[ok?`✅ Checklist OK (${hits.length}/${must.length})`:`❌ Checklist flojo (${hits.length}/${must.length})`]));fb.appendChild(el('div',{class:'note',style:'margin-top:8px'},['✅ Incluiste: '+(hits.length?hits.join(', '):'—')+'\n❌ Faltó: '+(miss.length?miss.join(', '):'—')+'\n📚 Explicación: '+x.exp]));fb.appendChild(el('div',{class:'note',style:'margin-top:10px'},['🧾 Respuesta modelo:\n'+x.respuesta_modelo]))};
  function mark(ok){const t=ta.value||'';if(t.trim().length<min){snd('warn');alert(`Antes de marcar, escribe al menos ${min} caracteres.`);return;}snd(ok?'ok':'bad');it.ok=ok;it.answer=t;setSess(s);upd(x.id,ok);if(ok)s.score++;setSess(s);alert('Guardado ✅')}
  body.appendChild(ta);body.appendChild(counter);body.appendChild(el('div',{class:'row',style:'margin-top:10px'},[btn,el('button',{class:'btn good',onclick:()=>mark(true)},['✅ Me salió']),el('button',{class:'btn bad',onclick:()=>mark(false)},['❌ No todavía'])]));body.appendChild(fb);
}
function finish(auto){
  const s=getSess();if(!s){intro();return;}stopTimer();
  const total=s.items.length, done=s.items.filter(i=>i.ok!==null).length, ok=s.items.filter(i=>i.ok===true).length;
  const by={};for(const it of s.items){const x=q(it.id);by[x.bloque]=by[x.bloque]||{t:0,ok:0,d:0};by[x.bloque].t++;if(it.ok===true)by[x.bloque].ok++;if(it.ok!==null)by[x.bloque].d++}
  show(el('div',{class:'card'},[
    el('div',{class:'pill'},['🏁 Fin']),
    el('h2',{},[s.mode==='simulacro'?'Resumen del simulacro':'Resumen del entrenamiento']),
    el('div',{class:'note'},[auto?'⏱️ Se acabó el tiempo: simulacro finalizado automáticamente.':'Sesión finalizada.']),
    el('div',{class:'row',style:'margin-top:8px'},[el('span',{class:'pill'},[`Hechas: ${done}/${total}`]),el('span',{class:'pill'},[`Aciertos: ${ok}/${total}`]),el('span',{class:'pill'},[`Puntos: ${s.score}`])]),
    el('table',{style:'margin-top:10px'},[el('thead',{},[el('tr',{},[el('th',{},['Bloque']),el('th',{},['Aciertos']),el('th',{},['Hechas'])])]),el('tbody',{},Object.entries(by).map(([b,r])=>el('tr',{},[el('td',{},[b]),el('td',{},[`${r.ok}/${r.t}`]),el('td',{},[`${r.d}/${r.t}`])])))]),
    el('div',{class:'row',style:'margin-top:12px'},[
      s.mode==='simulacro'?el('button',{class:'btn primary',onclick:()=>{clearSession();startSim()}},['Repetir simulacro']):el('button',{class:'btn primary',onclick:()=>{clearSession();intro()}},['Volver al menú']),
      el('button',{class:'btn',onclick:stats},['Ver estadísticas']),
      el('button',{class:'btn',onclick:()=>{clearSession();intro()}},['Inicio'])
    ])
  ]))
}
function stats(){
  const s=load(SK,{}),by={},ty={};
  Object.values(s).forEach(st=>{if(!st||!st.bloque)return;by[st.bloque]=by[st.bloque]||{seen:0,ok:0,fail:0};by[st.bloque].seen+=st.seen;by[st.bloque].ok+=st.ok;by[st.bloque].fail+=st.fail;ty[st.tipo]=ty[st.tipo]||{seen:0,ok:0,fail:0};ty[st.tipo].seen+=st.seen;ty[st.tipo].ok+=st.ok;ty[st.tipo].fail+=st.fail});
  show(el('div',{},[
    el('div',{class:'card'},[el('div',{class:'pill'},['📊 Estadísticas']),el('div',{class:'row',style:'margin-top:10px'},[el('button',{class:'btn',onclick:intro},['← Volver']),el('button',{class:'btn',onclick:exportStats},['Exportar JSON'])])]),
    el('div',{class:'card'},[el('h3',{},['Por bloque']),tableFrom(by,true)]),
    el('div',{class:'card'},[el('h3',{},['Por tipo']),tableFrom(ty,false)])
  ]))
}
function tableFrom(obj,isBlock){return el('table',{},[el('thead',{},[el('tr',{},[el('th',{},[isBlock?'Bloque':'Tipo']),el('th',{},['Vistas']),el('th',{},['OK']),el('th',{},['Fallo']),el('th',{},['Acierto'])])]),el('tbody',{},Object.entries(obj).map(([k,r])=>el('tr',{},[el('td',{},[isBlock?k:(k==='mc'?'Test':k==='cloze'?'Huecos':k==='match'?'Emparejar':'Abierta')]),el('td',{},[String(r.seen)]),el('td',{},[String(r.ok)]),el('td',{},[String(r.fail)]),el('td',{},[r.seen?(Math.round(r.ok/r.seen*100)+'%'):'—'])])))])}
function exportStats(){const d=localStorage.getItem(SK)||'{}';navigator.clipboard.writeText(d).then(()=>alert('Stats JSON copiado ✅')).catch(()=>prompt('Copia el JSON:',d))}
function resetAll(){if(!confirm('¿Seguro? Se borran estadísticas y sesión guardada.'))return;localStorage.removeItem(SK);localStorage.removeItem(XK);stopTimer();intro()}
window.addEventListener('load', intro);
