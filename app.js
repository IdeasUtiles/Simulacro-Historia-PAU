
const bank=window.HISTORIA_BANK;
let idx=0;
let score=0;

function show(){
 const q=bank[idx];
 const app=document.getElementById("app");
 app.innerHTML="";
 const card=document.createElement("div");
 card.className="card";

 const title=document.createElement("h2");
 title.textContent=q.pregunta||"";
 card.appendChild(title);

 if(q.tipo==="mc"){
   q.opciones.forEach((o,i)=>{
     const b=document.createElement("button");
     b.textContent=o;
     b.onclick=()=>{
        if(i===q.correcta){alert("Correcto\n"+q.exp);score++}
        else alert("Incorrecto\n"+q.exp);
        next();
     }
     card.appendChild(b);
   });
 }

 if(q.tipo==="open"){
   const ta=document.createElement("textarea");
   card.appendChild(ta);
   const btn=document.createElement("button");
   btn.textContent="Comprobar";
   btn.onclick=()=>{
      if(ta.value.length<q.min_chars){alert("Escribe más para responder.");return;}
      let ok=q.must_include.filter(w=>ta.value.toLowerCase().includes(w.toLowerCase())).length>=2;
      alert((ok?"Aceptable":"Revisa tu respuesta")+"\n"+q.exp+"\n\nModelo:\n"+q.respuesta_modelo);
      if(ok)score++;
      next();
   };
   card.appendChild(btn);
 }

 app.appendChild(card);
}

function next(){
 idx++;
 if(idx>=bank.length){
   document.getElementById("app").innerHTML="<div class='card'><h2>Fin</h2>Puntos: "+score+"</div>";
   return;
 }
 show();
}

window.onload=show;
