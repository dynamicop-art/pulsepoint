// Small shared visual-polish helpers: floating background blobs, confetti burst,
// tiny synth sound effects (Web Audio, no audio files) and toast notifications.
// Pure client-side decoration — no data, no network calls, safe to include anywhere.

export function mountBlobs(){
  if(document.querySelector(".blob-bg"))return;
  const d=document.createElement("div");
  d.className="blob-bg";
  d.innerHTML=`<div class="blob blob1"></div><div class="blob blob2"></div><div class="blob blob3"></div><div class="blob blob4"></div><div class="blob blob5"></div>`;
  document.body.prepend(d);
}

/* Adds a shimmering light-sweep + a few twinkling stars to every .hero card
   for a more "magical", premium feel. Pure CSS-driven decoration. */
export function mountHeroSparkle(){
  document.querySelectorAll(".hero").forEach(hero=>{
    if(hero.querySelector(".sparkle-sweep"))return;
    const sweep=document.createElement("div");
    sweep.className="sparkle-sweep";
    hero.appendChild(sweep);
    const starGlyphs=["✦","✧","⋆","✨"];
    const positions=[["10%","18%"],["82%","14%"],["92%","62%"],["6%","70%"],["46%","10%"]];
    positions.forEach(([left,top],i)=>{
      const s=document.createElement("span");
      s.className="star";
      s.textContent=starGlyphs[i%starGlyphs.length];
      s.style.left=left;s.style.top=top;
      s.style.animationDelay=(i*0.45)+"s";
      hero.appendChild(s);
    });
    const symbols=[["π","14%","72%"],["∑","74%","18%"],["⚛","88%","70%"],["F=ma","58%","76%"],["√x","32%","14%"]];
    symbols.forEach(([text,left,top],i)=>{const s=document.createElement("span");s.className=`learn-symbol symbol-${i}`;s.textContent=text;s.style.left=left;s.style.top=top;s.style.animationDelay=`${i*-.8}s`;hero.appendChild(s);});
  });
}

export function confettiBurst(count=90){
  const colors=["#1d4ed8","#4f46e5","#c8960c","#7c3aed","#16a34a","#f3d477"];
  const layer=document.createElement("div");
  layer.className="confetti-layer";
  document.body.appendChild(layer);
  for(let i=0;i<count;i++){
    const p=document.createElement("div");
    p.className="confetti-piece";
    const size=6+Math.random()*7;
    p.style.left=Math.random()*100+"vw";
    p.style.width=size+"px";
    p.style.height=size*0.4+"px";
    p.style.background=colors[Math.floor(Math.random()*colors.length)];
    const duration=2.2+Math.random()*1.6;
    const delay=Math.random()*0.5;
    p.style.animationDuration=duration+"s";
    p.style.animationDelay=delay+"s";
    layer.appendChild(p);
  }
  setTimeout(()=>layer.remove(),4200);
}

/* ---------- SOUND (tiny synth chimes, no external audio files) ---------- */
function soundOn(){try{return localStorage.getItem("sound")==="on";}catch(e){return false;}}
export function isSoundOn(){return soundOn();}
export function setSoundOn(on){try{localStorage.setItem("sound",on?"on":"off");}catch(e){}}

let _actx=null;
function ctx(){
  if(!soundOn())return null;
  try{_actx=_actx||new (window.AudioContext||window.webkitAudioContext)();if(_actx.state==="suspended")_actx.resume();return _actx;}
  catch(e){return null;}
}
function tone(freq,start,dur,type="sine",gainPeak=0.16){
  const c=ctx();if(!c)return;
  const osc=c.createOscillator(),gain=c.createGain();
  osc.type=type;osc.frequency.value=freq;
  osc.connect(gain);gain.connect(c.destination);
  const t0=c.currentTime+start;
  gain.gain.setValueAtTime(0,t0);
  gain.gain.linearRampToValueAtTime(gainPeak,t0+0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  osc.start(t0);osc.stop(t0+dur+0.02);
}
// kind: "success" | "perfect" | "click" | "notify" | "timer"
export function playChime(kind="success"){
  if(!soundOn())return;
  if(kind==="perfect"){tone(523.25,0,.16,"triangle");tone(659.25,.13,.16,"triangle");tone(783.99,.26,.28,"triangle");}
  else if(kind==="success"){tone(587.33,0,.14,"sine");tone(880,.11,.22,"sine");}
  else if(kind==="click"){tone(660,0,.06,"square",.08);}
  else if(kind==="notify"){tone(740,0,.1,"sine",.12);tone(988,.09,.14,"sine",.1);}
  else if(kind==="timer"){tone(440,0,.18,"triangle");tone(440,.22,.18,"triangle");tone(440,.44,.3,"triangle");}
}

/* ---------- TOASTS ---------- */
// Escapes the message before inserting into innerHTML. Every current call
// site passes a static/trusted string, but this keeps the helper itself safe
// by default if a future call ever passes through user-typed text.
function escapeToastMsg(s){return String(s==null?"":s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
export function toast(message,icon="✅"){
  let layer=document.querySelector(".toast-layer");
  if(!layer){layer=document.createElement("div");layer.className="toast-layer";document.body.appendChild(layer);}
  const t=document.createElement("div");
  t.className="toast";
  t.innerHTML=`<span>${icon}</span><span>${escapeToastMsg(message)}</span>`;
  layer.appendChild(t);
  setTimeout(()=>t.remove(),2800);
}

/* Lightweight 3D polish. It is disabled for touch devices, active tests and
   people who request reduced motion. */
export function mountCardTilt(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches||!matchMedia("(hover: hover) and (pointer: fine)").matches)return;
  const selector=".smart-tile,.subject-card,.exam-board";
  let active=null,frame=0;
  const reset=el=>{if(!el)return;el.style.setProperty("--rx","0deg");el.style.setProperty("--ry","0deg");};
  document.addEventListener("pointermove",e=>{
    const el=e.target.closest?.(selector);
    if(active&&active!==el)reset(active);
    active=el||null;if(!active)return;
    if(!active.classList.contains("fx-3d"))active.classList.add("fx-3d");
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const r=active?.getBoundingClientRect();if(!r||!r.width||!r.height)return;const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;active.style.setProperty("--rx",`${(-y*2.1).toFixed(2)}deg`);active.style.setProperty("--ry",`${(x*2.1).toFixed(2)}deg`);active.style.setProperty("--mx",`${(x+.5)*100}%`);active.style.setProperty("--my",`${(y+.5)*100}%`);});
  },{passive:true});
  document.addEventListener("pointerout",e=>{const el=e.target.closest?.(selector);if(el&&!el.contains(e.relatedTarget)){reset(el);if(active===el)active=null;}},{passive:true});
}

export function mountButtonRipples(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  document.addEventListener("pointerdown",e=>{const b=e.target.closest("button,.btn");if(!b||b.disabled)return;const r=b.getBoundingClientRect(),s=document.createElement("span"),size=Math.max(r.width,r.height)*1.5;s.className="fx-ripple";s.style.width=s.style.height=size+"px";s.style.left=e.clientX-r.left-size/2+"px";s.style.top=e.clientY-r.top-size/2+"px";b.appendChild(s);setTimeout(()=>s.remove(),650);});
}
