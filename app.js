
const CFG=window.FIT4US_CONFIG||{};
const configured=CFG.supabaseUrl && !CFG.supabaseUrl.startsWith('DEINE_') && CFG.supabaseKey && !CFG.supabaseKey.startsWith('DEIN_');
let sb=null, session=null, me=null, profiles=[], entries=[], reactions=[], rewardChoices=[], currentView='home', pendingProof=null, pendingAvatar=null, signedCache={};
let realtimeChannels=[];

const ACTIVITIES={
 walk:{name:'Spaziergang',icon:'🚶',mode:'time',step:15,points:1,distance:true},
 hike:{name:'Wandern',icon:'🥾',mode:'time',step:30,points:2,distance:true},
 gym:{name:'Gym',icon:'🏋️',mode:'time',step:30,points:3,distance:false},
 bike:{name:'Fahrrad',icon:'🚴',mode:'distance',step:5,points:1,distance:true},
 swim:{name:'Schwimmen',icon:'🏊',mode:'time',step:30,points:3,distance:true},
 climb:{name:'Klettern / Bouldern',icon:'🧗',mode:'time',step:30,points:3,distance:false},
 garden:{name:'Gartenarbeit',icon:'🌿',mode:'time',step:30,points:1,distance:false},
 house:{name:'Hausworking',icon:'🧹',mode:'time',step:30,points:1,distance:false},
 other:{name:'Sonstige Sportart',icon:'⚡',mode:'time',step:30,points:2,distance:false}
};
const FOOD=[
 {id:'veg',icon:'🥦',title:'5 Portionen Obst & Gemüse',desc:'Mind. 5 Portionen, davon idealerweise mindestens 3 Gemüse.'},
 {id:'water',icon:'💧',title:'2 Liter trinken',desc:'Mind. 2 Liter Wasser oder ungesüßter Tee.'},
 {id:'fresh',icon:'🍳',title:'Frisch & bewusst',desc:'Mind. eine vollwertige, selbst zubereitete Hauptmahlzeit.'},
 {id:'sweets',icon:'🍬',title:'Süßigkeitenfrei',desc:'Keine Süßigkeiten oder klassischen Knabbereien.'},
 {id:'soft',icon:'🥤',title:'Softdrinkfrei',desc:'Keine zuckerhaltigen Softdrinks.'},
 {id:'fast',icon:'🍔',title:'Fast-Food-frei',desc:'Kein klassisches Fast Food / Take-away.'},
 {id:'protein',icon:'💪',title:'Protein bewusst',desc:'Bei mindestens zwei Hauptmahlzeiten eine sinnvolle Proteinquelle.'}
];
const WEEKLY=[
 {id:'move3',icon:'🏃',title:'Beweg dich!',desc:'3 Tage mit mindestens 30 Minuten gezielter Aktivität',points:10},
 {id:'steps4',icon:'👟',title:'Schrittmacher',desc:'4 Tage mit mindestens 10.000 Schritten',points:10},
 {id:'healthy5',icon:'🥗',title:'Healthy Week',desc:'5 Ernährungstage mit mindestens 5 erfüllten Zielen',points:10},
 {id:'sport180',icon:'⏱️',title:'180 Minuten',desc:'Mindestens 180 aktive Minuten in dieser Woche',points:10},
 {id:'walk5',icon:'🚶',title:'Draußenzeit',desc:'5 Spaziergänge oder Wanderungen in dieser Woche',points:10},
 {id:'mix3',icon:'⚡',title:'Abwechslung',desc:'3 unterschiedliche Aktivitätsarten in dieser Woche',points:10}
];

const GROUP_CHALLENGES=[
 {id:'steps250',icon:'👟',title:'Gemeinsam unterwegs',desc:'Sammelt gemeinsam 250.000 Schritte.',target:250000,unit:'Schritte',kind:'steps'},
 {id:'minutes600',icon:'⏱️',title:'Aktive Crew',desc:'Sammelt gemeinsam 600 aktive Minuten.',target:600,unit:'Minuten',kind:'minutes'},
 {id:'outdoor12',icon:'🌤️',title:'Raus mit euch!',desc:'Schafft gemeinsam 12 Spaziergänge oder Wanderungen.',target:12,unit:'Draußen-Sessions',kind:'outdoor'},
 {id:'distance60',icon:'🗺️',title:'Kilometerjäger',desc:'Sammelt gemeinsam 60 Kilometer bei Aktivitäten mit Distanz.',target:60,unit:'km',kind:'distance'},
 {id:'healthy16',icon:'🥗',title:'Gemeinsam bewusst',desc:'Sammelt 16 Ernährungstage mit mindestens 5 erfüllten Zielen.',target:16,unit:'Ernährungstage',kind:'healthy'},
 {id:'sports14',icon:'💪',title:'Team in Bewegung',desc:'Sammelt gemeinsam 14 echte Sport-/Aktivitätseinheiten.',target:14,unit:'Aktivitäten',kind:'activities'}
];
const STREAK_MARKS=[[3,2],[5,3],[7,5],[14,10],[21,15],[30,25]];

const REWARDS=[
 {key:'game',name:'🎮 Game Master',desc:'Du bestimmst das nächste Online-Spiel.'},
 {key:'snack',name:'🍿 Snack-Joker',desc:'Dein Partner organisiert deinen Lieblingssnack.'},
 {key:'board',name:'🎲 Spieleabend-Joker',desc:'Du bestimmst das nächste Brett-/Kartenspiel.'},
 {key:'lazy',name:'🛋️ Lazy Joker',desc:'Eine kleine lästige Aufgabe wird dir abgenommen.'},
 {key:'movie',name:'🎬 Film-Joker',desc:'Du bestimmst den Film.'},
 {key:'food',name:'🍕 Essens-Joker',desc:'Du bestimmst das Essen für einen gemeinsamen Abend.'},
 {key:'date',name:'❤️ Wunschzeit',desc:'Du bestimmst eine gemeinsame Aktivität.'},
 {key:'music',name:'🎧 Musikhoheit',desc:'Du bestimmst Musik/Playlist beim nächsten gemeinsamen Anlass.'},
 {key:'surprise',name:'🎁 Überraschung',desc:'Du bekommst eine kleine Überraschung.'}
];
const MILESTONES=[50,100,150,200,250,300,400];

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmtDate=d=>{let x=d?new Date(d):new Date(); return x.toISOString().slice(0,10)};
const monthKey=d=>fmtDate(d).slice(0,7);
function startOfWeek(d=new Date()){let x=new Date(d);x.setHours(12,0,0,0);let day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x}
function weekKey(d=new Date()){return fmtDate(startOfWeek(d))}
function endOfWeek(d=new Date()){let x=startOfWeek(d);x.setDate(x.getDate()+6);return x}
function syntheticEmail(username){return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@fit4us.local`}
function stepPoints(s){s=Math.floor((+s||0)/100)*100;if(s<5000)return 0;if(s<7500)return 1;if(s<10000)return 2;if(s<12500)return 3;if(s<15000)return 4;return 5+Math.floor((s-15000)/5000)}
function activityPoints(a,minutes,distance){let x=ACTIVITIES[a]; if(!x)return 0;let v=x.mode==='distance'?+distance:+minutes;return Math.max(0,Math.floor(v/x.step)*x.points)}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast(msg){let t=document.createElement('div');t.textContent=msg;t.style='position:fixed;z-index:999;left:50%;bottom:95px;transform:translateX(-50%);background:#10283d;color:#fff;padding:10px 14px;border-radius:12px;box-shadow:0 8px 25px #0003';document.body.append(t);setTimeout(()=>t.remove(),2500)}
function showError(el,msg){el.innerHTML=`<div class="error">${escapeHtml(msg)}</div>`}
function firstName(p){return p?.first_name||'User'}
function own(e){return e.user_id===me?.id}
function currentMonthEntries(){let mk=monthKey();return entries.filter(e=>e.entry_date.startsWith(mk))}
function currentWeekEntries(){let a=fmtDate(startOfWeek()),b=fmtDate(endOfWeek());return entries.filter(e=>e.entry_date>=a&&e.entry_date<=b)}
function basePointsOf(userId,list){return list.filter(e=>e.user_id===userId).reduce((s,e)=>s+(+e.points||0),0)}
function rangeOf(list){
 if(!list?.length)return null;
 let ds=list.map(e=>e.entry_date).sort();
 return [ds[0],ds.at(-1)]
}
function entriesForWeek(wk){let s=new Date(wk+'T12:00'),e=new Date(s);e.setDate(e.getDate()+6);let a=fmtDate(s),b=fmtDate(e);return entries.filter(x=>x.entry_date>=a&&x.entry_date<=b)}
function groupChallengeForWeek(wk){
 let seed=[...wk].reduce((s,c)=>((s*31)+c.charCodeAt(0))>>>0,17);
 return GROUP_CHALLENGES[seed%GROUP_CHALLENGES.length]
}
function groupChallengeValue(wk){
 let ch=groupChallengeForWeek(wk),es=entriesForWeek(wk);
 if(ch.kind==='steps')return es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0);
 if(ch.kind==='minutes')return es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0);
 if(ch.kind==='outdoor')return es.filter(e=>e.kind==='activity'&&['walk','hike'].includes(e.activity)).length;
 if(ch.kind==='distance')return es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.distance||0),0);
 if(ch.kind==='healthy')return es.filter(e=>e.kind==='food'&&(e.food_items||[]).length>=5).length;
 if(ch.kind==='activities')return es.filter(e=>e.kind==='activity').length;
 return 0
}
function groupChallengeComplete(wk){let ch=groupChallengeForWeek(wk);return groupChallengeValue(wk)>=ch.target}
function selectionForWeek(wk){return (window.weekSelections||[]).find(x=>x.week_key===wk)}
function challengeProgressForWeek(ch,userId,wk){
 let es=entriesForWeek(wk).filter(e=>e.user_id===userId);
 if(!ch)return [0,1];
 if(ch.id==='move3'){let ds=[...new Set(es.filter(e=>e.kind==='activity'&&e.minutes>=30).map(e=>e.entry_date))];return [ds.length,3]}
 if(ch.id==='steps4')return [es.filter(e=>e.kind==='steps'&&e.steps>=10000).length,4];
 if(ch.id==='healthy5')return [es.filter(e=>e.kind==='food'&&(e.food_items||[]).length>=5).length,5];
 if(ch.id==='sport180')return [es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),180];
 if(ch.id==='walk5')return [es.filter(e=>e.kind==='activity'&&['walk','hike'].includes(e.activity)).length,5];
 if(ch.id==='mix3')return [new Set(es.filter(e=>e.kind==='activity').map(e=>e.activity)).size,3];
 return [0,1]
}
function streakBonusEvents(userId){
 let dates=[...new Set(entries.filter(e=>e.user_id===userId).map(e=>e.entry_date))].sort();
 if(!dates.length)return [];
 let min=new Date(dates[0]+'T12:00'),max=new Date(dates.at(-1)+'T12:00'),events=[],run=0;
 for(let d=new Date(min);d<=max;d.setDate(d.getDate()+1)){
   let ds=fmtDate(d);
   if(activeDay(ds,userId)){
     run++;
     let mark=STREAK_MARKS.find(x=>x[0]===run);
     if(mark)events.push({date:ds,points:mark[1],days:mark[0]});
   }else run=0;
 }
 return events
}
function bonusPointsOf(userId,list){
 let range=rangeOf(list);if(!range)return 0;
 let [from,to]=range,bonus=0;
 for(let sel of (window.weekSelections||[])){
   let wk=sel.week_key,end=new Date(wk+'T12:00');end.setDate(end.getDate()+6);
   if(fmtDate(end)<from||wk>to)continue;
   let ch=WEEKLY.find(x=>x.id===sel.challenge_id),[a,b]=challengeProgressForWeek(ch,userId,wk);
   if(a>=b)bonus+=(ch?.points||0);
   if(groupChallengeComplete(wk))bonus+=5;
 }
 bonus+=streakBonusEvents(userId).filter(x=>x.date>=from&&x.date<=to).reduce((s,x)=>s+x.points,0);
 return bonus
}
function pointsOf(userId,list){return basePointsOf(userId,list)+bonusPointsOf(userId,list)}
function profileById(id){return profiles.find(p=>p.id===id)}

async function signed(bucket,path,expires=3600){
 if(!path)return null;
 let key=`${bucket}:${path}`; if(signedCache[key])return signedCache[key];
 let {data,error}=await sb.storage.from(bucket).createSignedUrl(path,expires);
 if(error)return null; signedCache[key]=data.signedUrl; return data.signedUrl;
}
async function avatarHTML(p,size=42){
 let url=await signed('avatars',p?.avatar_path);
 return url?`<div class="avatar" style="width:${size}px;height:${size}px"><img src="${url}"></div>`:`<div class="avatar" style="width:${size}px;height:${size}px">${escapeHtml((p?.first_name||'?')[0])}</div>`;
}

async function init(){
 if(!configured){$('#boot').innerHTML=`<div class="auth"><div class="authCard"><img class="authLogo" src="assets/fit4us-logo.png"><div class="error"><b>Supabase noch nicht verbunden.</b><br><br>Öffne <code>config.js</code> und trage Project URL + publishable/anon Key ein. Danach <code>supabase-setup.sql</code> einmal im Supabase SQL Editor ausführen.</div></div></div>`;return}
 sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
 const {data}=await sb.auth.getSession(); session=data.session;
 sb.auth.onAuthStateChange(async(evt,s)=>{session=s;if(!s){stopRealtime();showAuth()}else{await bootApp()}});
 if(session)await bootApp(); else showAuth();
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
function showAuth(){
 $('#boot').innerHTML=`<div class="auth"><div class="authCard"><img class="authLogo" src="assets/fit4us-logo.png">
 <div class="tabs"><button id="tabLogin" class="active" onclick="authTab('login')">Anmelden</button><button id="tabReg" onclick="authTab('reg')">Konto erstellen</button></div>
 <div id="authBody"></div></div></div>`; authTab('login')
}
function authTab(tab){
 $('#tabLogin').classList.toggle('active',tab==='login');$('#tabReg').classList.toggle('active',tab==='reg');
 $('#authBody').innerHTML=tab==='login'?`<form class="form" onsubmit="login(event)">
  <div class="field"><label>Benutzername</label><input id="loginUser" autocomplete="username" required></div>
  <div class="field"><label>Passwort</label><input id="loginPass" type="password" autocomplete="current-password" required></div>
  <div id="authErr"></div><button class="cta">Anmelden</button>
  <div class="tiny muted">Der Benutzername wird nur für den Login verwendet. In Fit4Us sehen andere deinen Vornamen.</div>
 </form>`:`<form class="form two" onsubmit="register(event)">
  <div class="field full"><label>Benutzername</label><input id="regUser" pattern="[A-Za-z0-9._-]{3,30}" autocomplete="username" required><div class="tiny muted">3–30 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich.</div></div>
  <div class="field"><label>Vorname</label><input id="regFirst" autocomplete="given-name" required></div>
  <div class="field"><label>Nachname</label><input id="regLast" autocomplete="family-name" required></div>
  <div class="field"><label>Passwort</label><input id="regPass" type="password" minlength="8" autocomplete="new-password" required></div>
  <div class="field"><label>Passwort wiederholen</label><input id="regPass2" type="password" minlength="8" autocomplete="new-password" required></div>
  <div id="authErr" class="full"></div><button class="cta full">Konto erstellen</button>
  <div class="tiny muted full">Öffentlich wird nur dein Vorname angezeigt. Der Nachname ist für Profil/Administration hinterlegt.</div>
 </form>`
}
async function login(e){
 e.preventDefault();let user=$('#loginUser').value.trim().toLowerCase(),pass=$('#loginPass').value;
 let {error}=await sb.auth.signInWithPassword({email:syntheticEmail(user),password:pass});
 if(error)showError($('#authErr'),'Benutzername oder Passwort ist nicht korrekt.')
}
async function register(e){
 e.preventDefault();let username=$('#regUser').value.trim().toLowerCase(),first=$('#regFirst').value.trim(),last=$('#regLast').value.trim(),p=$('#regPass').value,p2=$('#regPass2').value;
 if(p!==p2)return showError($('#authErr'),'Die Passwörter stimmen nicht überein.');
 let {data,error}=await sb.auth.signUp({email:syntheticEmail(username),password:p,options:{data:{username,first_name:first,last_name:last}}});
 if(error)return showError($('#authErr'),error.message);
 if(!data.session)return showError($('#authErr'),'Konto angelegt, aber Supabase verlangt noch eine E-Mail-Bestätigung. Deaktiviere in Supabase Authentication → Providers → Email die E-Mail-Bestätigung, da Fit4Us technische Login-Adressen verwendet.');
 toast('Konto erstellt – wartet auf Admin-Freigabe ✓')
}
async function bootApp(){
 // Erst eigenes Profil laden: Pending-Nutzer dürfen per RLS nur dieses lesen.
 const {data:ownProfile,error}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
 if(error||!ownProfile){await sb.auth.signOut();return}
 me=ownProfile;

 if(!me.approved){
   stopRealtime();
   showPendingApproval();
   return;
 }
 await loadData();
 renderShell();
 await render();
 startRealtime();
}
function showPendingApproval(){
 $('#boot').innerHTML=`<div class="auth"><div class="authCard" style="text-align:center">
   <img class="authLogo" src="assets/fit4us-logo.png">
   <div style="font-size:48px">🔒</div>
   <h2>Freischaltung ausstehend</h2>
   <p>Hallo <b>${escapeHtml(me.first_name)}</b>! Dein Fit4Us-Konto wurde erstellt, muss aber zuerst von einem Admin freigeschaltet werden.</p>
   <div class="notice small" style="text-align:left"><b>Private Gruppe:</b> Ohne Freigabe hast du keinen Zugriff auf Feed, Rankings, Fotos oder andere Nutzerdaten.</div>
   <div class="grid" style="margin-top:18px">
     <button class="cta" onclick="checkApproval()">Status prüfen</button>
     <button class="secondary" onclick="logout()">Abmelden</button>
   </div>
 </div></div>`;
}
async function checkApproval(){
 const {data,error}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
 if(error)return toast('Status konnte nicht geprüft werden.');
 if(data?.approved){me=data;toast('Freigeschaltet ✓');await bootApp()}
 else toast('Noch nicht freigeschaltet.');
}
async function loadData(){
 let [p,e,r,w,reward]=await Promise.all([
  sb.from('profiles').select('*').order('created_at'),
  sb.from('entries').select('*').order('entry_date',{ascending:false}).order('created_at',{ascending:false}),
  sb.from('reactions').select('*'),
  sb.from('weekly_challenges').select('*'),
  sb.from('reward_choices').select('*')
 ]);
 if(p.error)throw p.error;
 profiles=(p.data||[]).filter(x=>x.approved || x.id===session.user.id || me?.is_admin);
 me=profiles.find(x=>x.id===session.user.id)||me;
 entries=e.data||[];reactions=r.data||[];window.weekSelections=w.data||[];rewardChoices=reward.data||[]
}
function startRealtime(){
 stopRealtime();
 ['entries','reactions','profiles','weekly_challenges','reward_choices'].forEach(table=>{
  let ch=sb.channel('fit4us-'+table).on('postgres_changes',{event:'*',schema:'public',table},async()=>{await loadData();await render()}).subscribe();
  realtimeChannels.push(ch)
 })
}
function stopRealtime(){realtimeChannels.forEach(c=>sb?.removeChannel(c));realtimeChannels=[]}
function renderShell(){
 $('#boot').innerHTML=`<div class="shell">
 <aside class="side"><img src="assets/fit4us-logo.png"><div class="sideNav" id="sideNav"></div><div class="sideBottom" id="sideUser"></div></aside>
 <main class="main"><header class="top"><img class="brandMini" src="assets/fit4us-icon.png"><div class="topUser" id="topUser"></div></header><div id="content"></div></main>
 <nav class="bottom" id="bottomNav"></nav></div><div id="modalRoot"></div>`;
 navs()
}
async function navs(){
 let nav=[['home','🏠','Heute'],['group','👥','Gruppe'],['add','＋',''],['challenges','🎯','Challenges'],['me','👤','Ich']];
 $('#bottomNav').innerHTML=nav.map(([id,ic,t])=>id==='add'?`<button class="plus" onclick="openEntry()">＋</button>`:`<button class="navBtn ${currentView===id?'active':''}" onclick="go('${id}')"><span>${ic}</span>${t}</button>`).join('');
 $('#sideNav').innerHTML=[['home','🏠 Heute'],['group','👥 Gruppe'],['challenges','🎯 Challenges'],['me','📊 Ich'],['rules','📖 Punkte & Regeln'],['history','🗓️ Historie'],...(me?.is_admin?[['admin','🛡️ Admin']]:[])].map(([id,t])=>`<button class="${currentView===id?'active':''}" onclick="go('${id}')">${t}</button>`).join('');
 let av=await avatarHTML(me,42);$('#topUser').innerHTML=`${av}<div><b>${escapeHtml(firstName(me))}</b><div class="tiny muted">@${escapeHtml(me.username)}</div></div>`;
 $('#sideUser').innerHTML=`<button class="secondary" style="width:100%" onclick="logout()">Abmelden</button>`
}
async function go(v){currentView=v;navs();await render()}
async function logout(){await sb.auth.signOut()}
async function render(){
 let c=$('#content'); if(!c)return;
 if(currentView==='home')c.innerHTML=await homeHTML();
 if(currentView==='group')c.innerHTML=await groupHTML();
 if(currentView==='challenges')c.innerHTML=await challengesHTML();
 if(currentView==='me')c.innerHTML=await meHTML();
 if(currentView==='rules')c.innerHTML=rulesHTML();
 if(currentView==='history')c.innerHTML=historyHTML();
 if(currentView==='admin')c.innerHTML=await adminHTML();
}
function ranking(list){
 return profiles.map(p=>({p,pts:pointsOf(p.id,list)})).sort((a,b)=>b.pts-a.pts||firstName(a.p).localeCompare(firstName(b.p)))
}
async function rankingHTML(list){
 let r=ranking(list),out='';
 for(let i=0;i<r.length;i++){let av=await avatarHTML(r[i].p,34);out+=`<div class="rankRow ${r[i].p.id===me.id?'rankMe':''}"><b>${i+1}.</b><div style="display:flex;align-items:center;gap:9px">${av}<b>${escapeHtml(firstName(r[i].p))}</b></div><b>${r[i].pts} P</b></div>`}
 return out||'<div class="muted">Noch keine Teilnehmer.</div>'
}
function todayEntry(kind){return entries.find(e=>e.user_id===me.id&&e.entry_date===fmtDate()&&e.kind===kind)}
function todayActivityMinutes(){return entries.filter(e=>e.user_id===me.id&&e.entry_date===fmtDate()&&e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0)}
function monthPoints(){return pointsOf(me.id,currentMonthEntries())}
function nextMilestone(p){return MILESTONES.find(x=>x>p)||MILESTONES.at(-1)}
function activeDay(date,userId=me.id){
 let d=entries.filter(e=>e.user_id===userId&&e.entry_date===date);
 let steps=d.find(e=>e.kind==='steps')?.steps||0,min=d.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0);
 return steps>=10000||min>=30
}
function streak(userId=me.id){
 let n=0,d=new Date(); if(!activeDay(fmtDate(d),userId)){d.setDate(d.getDate()-1)}
 while(activeDay(fmtDate(d),userId)){n++;d.setDate(d.getDate()-1)}
 return n
}
function streakNext(s){return STREAK_MARKS.find(x=>x[0]>s)||[30,25]}

function currentChallenge(){
 let sel=currentSelection();
 return sel?WEEKLY.find(x=>x.id===sel.challenge_id):null
}
function todaySuggestions(){
 let st=todayEntry('steps')?.steps||0,min=todayActivityMinutes(),food=todayEntry('food'),items=[];
 let thresholds=[5000,7500,10000,12500,15000];
 let next=thresholds.find(x=>x>st);
 if(next)items.push({icon:'👟',title:`Noch ${(next-st).toLocaleString('de-DE')} Schritte`,desc:`Dann erreichst du die nächste Schritt-Punktestufe (${next.toLocaleString('de-DE')}).`});
 else {let nextX=20000+Math.max(0,Math.floor((st-15000)/5000))*5000;if(nextX>st)items.push({icon:'👟',title:`Noch ${(nextX-st).toLocaleString('de-DE')} Schritte`,desc:'Damit gibt es einen weiteren Schrittpunkt.'})}
 if(min<30)items.push({icon:'🔥',title:`Noch ${30-min} aktive Minuten`,desc:'Damit zählt heute als aktiver Tag für deinen Streak.'});
 if(!food)items.push({icon:'🥗',title:'Ernährung noch nicht eingetragen',desc:'Tages-Check-in öffnen und bis zu 7 positive Ziele abhaken.'});
 let ch=currentChallenge();
 if(ch){let [a,b]=challengeProgressForWeek(ch,me.id,weekKey());if(a<b)items.push({icon:ch.icon,title:`Wochenchallenge: ${a}/${b}`,desc:ch.desc})}
 return items.slice(0,3)
}
function bonusSummary(userId,list){
 let base=basePointsOf(userId,list),bonus=bonusPointsOf(userId,list);
 return `<div class="bonusBreakdown"><span class="bonusPill">Aktivitäten & Alltag: ${base} P</span>${bonus?`<span class="bonusPill">Bonuspunkte: +${bonus} P</span>`:''}</div>`
}
function compactChallengeHTML(){
 let ch=currentChallenge();
 if(!ch)return `<div class="card challengeHome personal"><div class="challengeTop"><span class="pill">🎯 Wochenchallenge</span></div><div class="challengeTitle">Noch keine Challenge gewählt</div><div class="muted small">Der Vorwochen-Champion entscheidet.</div></div>`;
 let [a,b]=challengeProgressForWeek(ch,me.id,weekKey()),pct=Math.min(100,a/b*100);
 return `<div class="card challengeHome personal"><div class="challengeTop"><span class="pill">🎯 Wochenchallenge</span><span class="points">+${ch.points} P</span></div><div class="challengeIcon">${ch.icon}</div><div class="challengeTitle">${ch.title}</div><div class="muted small">${ch.desc}</div><div class="progress" style="margin-top:12px"><i style="width:${pct}%"></i></div><div class="challengeFooter"><b>${a} / ${b}</b><span>${a>=b?'Geschafft! 🎉':`Noch ${Math.max(0,b-a)} bis zum Ziel`}</span></div></div>`
}
function compactGroupChallengeHTML(){
 let ch=groupChallengeForWeek(weekKey()),v=groupChallengeValue(weekKey()),pct=Math.min(100,v/ch.target*100);
 let value=ch.kind==='steps'?Math.round(v).toLocaleString('de-DE'):Number(v.toFixed?.(1)??v).toLocaleString('de-DE');
 return `<div class="card challengeHome group"><div class="challengeTop"><span class="pill">👥 Gruppen-Challenge</span><span class="points">+5 P alle</span></div><div class="challengeIcon">${ch.icon}</div><div class="challengeTitle">${ch.title}</div><div class="muted small">${ch.desc}</div><div class="progress" style="margin-top:12px"><i style="width:${pct}%"></i></div><div class="challengeFooter"><b>${value} / ${ch.target.toLocaleString('de-DE')} ${ch.unit}</b><span>${v>=ch.target?'Gemeinsam geschafft! 🎉':`${Math.round(pct)} %`}</span></div></div>`
}
async function homeHTML(){
 let st=todayEntry('steps')?.steps||0,food=(todayEntry('food')?.food_items||[]).length,min=todayActivityMinutes(),pts=monthPoints(),next=nextMilestone(pts),sk=streak(),sn=streakNext(sk),suggestions=todaySuggestions();
 return `<h1>Hallo ${escapeHtml(firstName(me))}! 👋</h1>
 <div class="grid desktopGrid">
  <div>
   <div class="card hero"><div class="heroRow"><div><div class="muted small">Deine Punkte im ${new Date().toLocaleDateString('de-DE',{month:'long'})}</div><div class="big">${pts} P</div></div><span class="chip">🔥 ${sk} Tage</span></div><div class="progress" style="margin-top:14px"><i style="width:${Math.min(100,pts/next*100)}%"></i></div><div class="tiny muted" style="margin-top:6px">${pts} / ${next} P bis zur nächsten Belohnung</div>${bonusSummary(me.id,currentMonthEntries())}</div>
   <div class="grid kpis section"><div class="card kpi"><div>👟</div><b>${st.toLocaleString('de-DE')}</b><div class="tiny muted">Schritte heute</div></div><div class="card kpi"><div>⏱️</div><b>${min}</b><div class="tiny muted">aktive Min.</div></div><div class="card kpi"><div>🥗</div><b>${food}/7</b><div class="tiny muted">Ernährungsziele</div></div></div>
   <div class="sectionTitle"><h2>Deine Challenges</h2><button class="react" onclick="go('challenges')">Details</button></div>
   <div class="grid challengeGrid">${compactChallengeHTML()}${compactGroupChallengeHTML()}</div>
   <div class="card pad suggestionCard section"><b>💡 Was kannst du heute noch machen?</b>${suggestions.length?suggestions.map(x=>`<div class="suggestion"><div class="suggestionIcon">${x.icon}</div><div><b>${x.title}</b><div class="small muted">${x.desc}</div></div></div>`).join(''):'<div class="notice" style="margin-top:10px">Für heute sieht es richtig gut aus – dranbleiben! 🎉</div>'}</div>
   <div class="card pad section"><b>🔥 Streak-Motivation</b><div style="margin-top:8px">${sk} aktive Tage in Folge</div><div class="muted small">Nächstes Ziel: ${sn[0]} Tage → <b>+${sn[1]} Bonuspunkte</b></div></div>
   <button class="cta section" style="width:100%" onclick="openEntry()">＋ Aktivität / Tageswert eintragen</button>
  </div>
  <div>
   <div class="card pad"><div style="display:flex;justify-content:space-between"><b>🏆 Diese Woche</b><button class="react" onclick="go('group')">Alle</button></div>${await rankingHTML(currentWeekEntries())}</div>
   <div class="sectionTitle"><h2>Aktuelles von euch</h2><button class="react" onclick="go('group')">Feed öffnen</button></div>${await feedHTML(3)}
  </div>
 </div>`
}
async function groupHTML(){return `<h1>Gruppe</h1><div class="grid grid2"><div><h2>Wochenranking</h2><div class="card pad">${await rankingHTML(currentWeekEntries())}</div></div><div><h2>Monatsranking</h2><div class="card pad">${await rankingHTML(currentMonthEntries())}</div></div></div><h2 class="section">Feed</h2><div class="grid">${await feedHTML(100)}</div>`}
async function feedHTML(limit=99){
 let list=entries.filter(e=>e.kind==='activity'||(e.kind==='food'&&e.photo_path)).slice(0,limit),out='';
 if(!list.length)return `<div class="card pad muted">Noch keine Feed-Einträge. Sobald jemand eine Aktivität oder einen Ernährungs-Check-in mit Foto speichert, erscheint er hier.</div>`;
 for(let e of list){
  let p=profileById(e.user_id),av=await avatarHTML(p),photo=e.photo_path?await signed('proofs',e.photo_path):null;
  let react={};reactions.filter(r=>r.entry_id===e.id).forEach(r=>{react[r.emoji]=(react[r.emoji]||[]).concat(r.user_id)});
  let content=e.kind==='food'?`🥗 <b>Ernährungs-Check-in</b> · ${(e.food_items||[]).length}/7 Ziele`:`${ACTIVITIES[e.activity]?.icon||'⚡'} <b>${ACTIVITIES[e.activity]?.name||'Aktivität'}</b> · ${e.minutes||0} Min.${e.distance?` · ${e.distance} km`:''}`;
  out+=`<article class="card feedItem"><div class="feedHead">${av}<div><b>${escapeHtml(firstName(p))}</b><div class="tiny muted">${new Date(e.entry_date+'T12:00').toLocaleDateString('de-DE')} · ${escapeHtml(e.witness||'Ehrenkodex')}</div></div><span class="points" style="margin-left:auto">+${e.points} P</span></div><div class="feedText">${content}</div>${photo?`<img class="feedPhoto" src="${photo}">`:''}<div class="reactions">${['👏','🔥','💪'].map(x=>`<button class="react ${react[x]?.includes(me.id)?'active':''}" onclick="toggleReaction('${e.id}','${x}')">${x} ${react[x]?.length||0}</button>`).join('')}</div></article>`
 }
 return out
}
async function toggleReaction(entryId,emoji){
 let mine=reactions.find(r=>r.entry_id===entryId&&r.user_id===me.id&&r.emoji===emoji);
 if(mine)await sb.from('reactions').delete().eq('id',mine.id);else await sb.from('reactions').insert({entry_id:entryId,user_id:me.id,emoji});
 await loadData();await render()
}

function lastWeek(){let s=startOfWeek();s.setDate(s.getDate()-7);let e=new Date(s);e.setDate(e.getDate()+6);return entries.filter(x=>x.entry_date>=fmtDate(s)&&x.entry_date<=fmtDate(e))}
function weeklyOptions(key=weekKey()){let seed=[...key].reduce((s,c)=>s+c.charCodeAt(0),0);return [0,1,2].map(i=>WEEKLY[(seed+i*2)%WEEKLY.length])}
function currentSelection(){return selectionForWeek(weekKey())}
function prevChampion(){let r=ranking(lastWeek());if(!r.length||r[0].pts===0)return null;return r[0].p}
function challengeProgress(ch,userId=me.id){return challengeProgressForWeek(ch,userId,weekKey())}
async function challengesHTML(){
 let sel=currentSelection(),ch=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null,champ=prevChampion(),choose=(!sel && champ?.id===me.id)||(!sel&&me.is_admin);
 let main=ch?(()=>{let [a,b]=challengeProgressForWeek(ch,me.id,weekKey());return `<div class="card challenge challengeHome personal"><div class="challengeTop"><span class="pill">🎯 Persönliche Wochenchallenge</span><span class="points">+${ch.points} P</span></div><h2>${ch.icon} ${ch.title}</h2><p class="muted">${ch.desc}</p><div class="progress"><i style="width:${Math.min(100,a/b*100)}%"></i></div><div class="challengeFooter"><b>${a} / ${b}</b><span>${a>=b?'Geschafft! 🎉':'Weiter dranbleiben'}</span></div></div>`})():`<div class="card pad muted">Für diese Woche wurde noch keine Challenge gewählt.</div>`;
 let pick='';
 if(choose){pick=`<div class="sectionTitle"><h2>Du darfst die nächste Challenge wählen 🎉</h2></div><div class="grid choiceGrid">${weeklyOptions().map(c=>`<button class="choice" onclick="chooseChallenge('${c.id}')"><b>${c.icon} ${c.title}</b><div class="tiny muted">${c.desc}</div></button>`).join('')}</div>`}
 else if(!sel&&champ)pick=`<div class="notice section"><b>${escapeHtml(firstName(champ))}</b> ist Wochenchampion der Vorwoche und darf aus drei Challenges wählen.</div>`;
 let gc=groupChallengeForWeek(weekKey()),gv=groupChallengeValue(weekKey()),gp=Math.min(100,gv/gc.target*100),gval=gc.kind==='steps'?Math.round(gv).toLocaleString('de-DE'):Number(gv.toFixed?.(1)??gv).toLocaleString('de-DE');
 return `<h1>Challenges</h1>${main}${pick}<div class="sectionTitle"><h2>Gemeinsame Wochenmission</h2><span class="pill">🎲 wöchentlich zufällig</span></div><div class="card challenge challengeHome group"><div class="challengeTop"><span class="pill">👥 Gruppen-Challenge</span><span class="points">+5 P für alle</span></div><h2>${gc.icon} ${gc.title}</h2><p class="muted">${gc.desc}</p><div class="progress"><i style="width:${gp}%"></i></div><div class="challengeFooter"><b>${gval} / ${gc.target.toLocaleString('de-DE')} ${gc.unit}</b><span>${gv>=gc.target?'Gemeinsam geschafft! 🎉':`${Math.round(gp)} % erreicht`}</span></div></div>`
}
function groupChallengeHTML(){let ch=groupChallengeForWeek(weekKey()),v=groupChallengeValue(weekKey());return `<div class="progress"><i style="width:${Math.min(100,v/ch.target*100)}%"></i></div>`}
async function chooseChallenge(id){let champ=prevChampion();if(!me.is_admin&&champ?.id!==me.id)return toast('Nur der Vorwochen-Champion darf wählen.');let {error}=await sb.from('weekly_challenges').insert({week_key:weekKey(),challenge_id:id,selected_by:me.id});if(error)return toast(error.message);await loadData();await render();toast('Challenge gewählt ✓')}

function statsFor(userId,from,to){
 let es=entries.filter(e=>e.user_id===userId&&e.entry_date>=from&&e.entry_date<=to);
 return {points:pointsOf(userId,es),steps:es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0),minutes:es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),foodDays:es.filter(e=>e.kind==='food').length}
}
async function meHTML(){
 let ws=startOfWeek(),we=endOfWeek(),prevS=new Date(ws);prevS.setDate(prevS.getDate()-7);let prevE=new Date(we);prevE.setDate(prevE.getDate()-7);
 let a=statsFor(me.id,fmtDate(ws),fmtDate(we)),b=statsFor(me.id,fmtDate(prevS),fmtDate(prevE)),av=await avatarHTML(me,88),pts=monthPoints();
 let rewards=MILESTONES.filter(m=>pts>=m);
 return `<h1>Ich</h1><div class="grid grid2"><div><div class="card statBig">${av}<h2>${escapeHtml(me.first_name)} ${escapeHtml(me.last_name)}</h2><div class="muted">@${escapeHtml(me.username)}</div><strong>${pts} P</strong><div class="muted">diesen Monat</div>${bonusSummary(me.id,currentMonthEntries())}<button class="secondary section" onclick="openProfile()">Profil bearbeiten</button></div>
 <div class="card pad section"><h3>Diese Woche vs. Vorwoche</h3>${compareRow('👟 Schritte',a.steps,b.steps)}${compareRow('⏱️ Aktivminuten',a.minutes,b.minutes)}${compareRow('🥗 Ernährungstage',a.foodDays,b.foodDays)}${compareRow('⭐ Punkte',a.points,b.points)}</div></div>
 <div><div class="card pad"><h3>🔥 Dein Streak</h3><div class="big">${streak()} Tage</div><div class="muted">${(()=>{let n=streakNext(streak());return `Noch ${Math.max(0,n[0]-streak())} aktive Tage bis +${n[1]} Bonuspunkte`;})()}</div></div>
 <div class="card pad section"><h3>🎁 Freigeschaltete Belohnungen</h3>${rewards.length?rewards.map(m=>rewardMilestoneHTML(m)).join(''):'<div class="muted">Erste Belohnung bei 50 Punkten.</div>'}</div></div></div>
 <h2 class="section">Meine Einträge – aktueller Monat</h2><div class="grid">${await ownEntriesHTML()}</div>`
}
function compareRow(label,a,b){let diff=a-b,sign=diff>0?'↑':diff<0?'↓':'→';return `<div class="barRow"><span>${label}</span><div class="progress"><i style="width:${Math.min(100,(a/(Math.max(a,b,1)))*100)}%"></i></div><b>${sign} ${Math.abs(diff).toLocaleString('de-DE')}</b></div>`}
function rewardMilestoneHTML(m){let got=rewardChoices.find(r=>r.user_id===me.id&&r.month_key===monthKey()&&r.milestone===m);return `<div class="reward" style="border-top:1px solid #edf1f4"><b>${m} P</b> ${got?`· ${escapeHtml(REWARDS.find(x=>x.key===got.reward_key)?.name||got.reward_key)} ${got.redeemed_at?'✓ eingelöst':`<button class="react" onclick="redeemReward('${got.id}')">Einlösen</button>`}`:`<button class="react" onclick="openReward(${m})">Belohnung wählen</button>`}</div>`}
async function redeemReward(id){await sb.from('reward_choices').update({redeemed_at:new Date().toISOString()}).eq('id',id);await loadData();await render()}
async function ownEntriesHTML(){
 let list=currentMonthEntries().filter(own);if(!list.length)return '<div class="card pad muted">Noch keine Einträge in diesem Monat.</div>';return list.map(e=>`<div class="card pad"><div style="display:flex;justify-content:space-between;gap:12px"><div><b>${entryLabel(e)}</b><div class="tiny muted">${new Date(e.entry_date+'T12:00').toLocaleDateString('de-DE')} · +${e.points} P</div></div><div><button class="react" onclick="editEntry('${e.id}')">Bearbeiten</button> <button class="react danger" onclick="deleteEntry('${e.id}')">Löschen</button></div></div></div>`).join('')
}
function entryLabel(e){if(e.kind==='steps')return `👟 ${(+e.steps).toLocaleString('de-DE')} Schritte`;if(e.kind==='food')return `🥗 Ernährung ${(e.food_items||[]).length}/7`;if(e.kind==='activity')return `${ACTIVITIES[e.activity]?.icon||'⚡'} ${ACTIVITIES[e.activity]?.name||'Aktivität'} · ${e.minutes||0} Min.${e.distance?` · ${e.distance} km`:''}`;return 'Bonus'}
function canEdit(e){return own(e)&&e.entry_date.startsWith(monthKey())}
async function deleteEntry(id){let e=entries.find(x=>x.id===id);if(!e||!canEdit(e))return toast('Dieser Eintrag kann nicht mehr geändert werden.');if(!confirm('Eintrag wirklich löschen?'))return;await sb.from('entries').delete().eq('id',id);await loadData();await render()}
function editEntry(id){let e=entries.find(x=>x.id===id);if(!e||!canEdit(e))return toast('Dieser Eintrag kann nicht mehr geändert werden.');openEntry(e.kind,e)}

function rulesHTML(){
 return `<h1>Punkte & Regeln</h1><div class="card pad rulesIntro"><b>Transparentes Punktesystem</b><div class="small muted">Rankings enthalten deine normalen Aktivitäts-/Ernährungspunkte sowie automatisch erreichte Challenge- und Streak-Boni. Punkte werden nie ausgegeben.</div></div><div class="grid grid2 section"><div class="card pad"><h3>👟 Schritte</h3><p>5.000 = 1 P · 7.500 = 2 P · 10.000 = 3 P · 12.500 = 4 P · 15.000 = 5 P · danach je weitere 5.000 = +1 P.</p><p class="muted small">Eingaben werden auf volle 100 Schritte abgerundet.</p></div><div class="card pad"><h3>🥗 Ernährung</h3>${FOOD.map(f=>`<p><b>${f.icon} ${f.title}</b><br><span class="muted small">${f.desc}</span> · +1 P</p>`).join('')}</div></div><h2 class="section">Aktivitäten</h2><div class="grid grid2">${Object.entries(ACTIVITIES).map(([k,a])=>`<div class="card pad"><b>${a.icon} ${a.name}</b><div class="muted small">${a.mode==='distance'?`${a.step} km = ${a.points} P`:`${a.step} Minuten = ${a.points} P`}${a.distance?' · Distanz kann erfasst werden':''}</div></div>`).join('')}</div><h2 class="section">🔥 Streak-Boni</h2><div class="card pad">3 Tage +2 P · 5 Tage +3 P · 7 Tage +5 P · 14 Tage +10 P · 21 Tage +15 P · 30 Tage +25 P</div>`
}
function historyHTML(){
 let months=[...new Set(entries.map(e=>e.entry_date.slice(0,7)))].sort().reverse();return `<h1>Historie</h1>${months.length?months.map(m=>`<div class="card pad section"><h3>${new Date(m+'-01T12:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</h3>${profiles.map(p=>{let pts=pointsOf(p.id,entries.filter(e=>e.entry_date.startsWith(m)));return `<div class="rankRow"><span></span><b>${escapeHtml(firstName(p))}</b><b>${pts} P</b></div>`}).join('')}</div>`).join(''):'<div class="card pad muted">Noch keine abgeschlossenen Monate.</div>'}`
}
async function adminHTML(){
 if(!me.is_admin)return '<div class="error">Kein Admin-Zugriff.</div>';
 let pending=profiles.filter(p=>!p.approved),active=profiles.filter(p=>p.approved);
 let pendingHtml=pending.length?pending.map(p=>`<div class="card pad" style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:14px;align-items:center"><div><b>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</b><div class="tiny muted">@${escapeHtml(p.username)} · registriert ${new Date(p.created_at).toLocaleDateString('de-DE')}</div></div><button class="cta" onclick="setApproval('${p.id}',true)">✓ Freischalten</button></div></div>`).join(''):'<div class="muted">Keine offenen Registrierungen.</div>';
 let activeHtml=active.map(p=>`<div class="rankRow"><span>${p.is_admin?'🛡️':'👤'}</span><div><b>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</b><div class="tiny muted">@${escapeHtml(p.username)}</div></div><div>${p.is_admin?'<b>Admin</b>':`<button class="react danger" onclick="setApproval('${p.id}',false)">Zugriff sperren</button>`}</div></div>`).join('');
 return `<h1>Admin</h1>
 <div class="notice"><b>🔐 Private Fit4Us-Gruppe</b><br>Neue Konten erhalten erst nach deiner Freigabe Zugriff auf die Gruppe.</div>
 <div class="section"><h2>Offene Registrierungen ${pending.length?`(${pending.length})`:''}</h2>${pendingHtml}</div>
 <div class="card pad adminOnly section"><h3>Freigegebene Benutzer</h3>${activeHtml}</div>
 <div class="card pad section"><h3>Datenbank</h3><div>Freigegebene Profile: ${active.length}</div><div>Einträge: ${entries.length}</div><div>Reaktionen: ${reactions.length}</div></div>`
}
async function setApproval(userId,allow){
 if(!me.is_admin)return;
 let p=profiles.find(x=>x.id===userId);
 if(!confirm(allow?`${p?.first_name||'Benutzer'} wirklich freischalten?`:`Zugriff für ${p?.first_name||'Benutzer'} wirklich sperren?`))return;
 let {error}=await sb.rpc('admin_set_user_approval',{target_user:userId,allow_access:allow});
 if(error)return toast(error.message);
 await loadData();await render();toast(allow?'Benutzer freigeschaltet ✓':'Zugriff gesperrt');
}

function openEntry(kind='activity',edit=null){
 $('#modalRoot').innerHTML=`<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modalCard"><div class="modalHead"><h2>${edit?'Eintrag bearbeiten':'Eintragen'}</h2><button class="x" onclick="closeModal()">×</button></div>${edit?entryForm(edit.kind,edit):`<div class="tabs"><button class="active" onclick="entryTab('activity',this)">Aktivität</button><button onclick="entryTab('steps',this)">Schritte</button></div><div style="display:grid;grid-template-columns:1fr"><button class="secondary" onclick="entryTab('food',this)">🥗 Ernährung des Tages eintragen</button></div><div id="entryForm" class="section">${entryForm('activity')}</div>`}</div></div>`;
 if(edit)setTimeout(()=>wireDynamic(edit),0)
}
function entryTab(kind,btn){$$('.modal .tabs button').forEach(x=>x.classList.remove('active'));if(btn?.closest('.tabs'))btn.classList.add('active');$('#entryForm').innerHTML=entryForm(kind);wireDynamic()}
function entryForm(kind,e=null){
 if(kind==='activity'){let a=e?.activity||'walk';return `<form class="form twoMobile" onsubmit="saveActivity(event,'${e?.id||''}')"><div class="field"><label>Aktivität</label><select id="aType" onchange="wireDynamic()">${Object.entries(ACTIVITIES).map(([k,x])=>`<option value="${k}" ${k===a?'selected':''}>${x.icon} ${x.name}</option>`).join('')}</select></div><div class="field"><label>Dauer (Min.)</label><input id="aMinutes" type="number" min="0" value="${e?.minutes||30}" oninput="livePts()"></div><div class="field" id="distWrap"><label>Distanz (km)</label><input id="aDistance" type="number" step=".1" min="0" value="${e?.distance||''}" oninput="livePts()"></div><div class="field"><label>Zeuge</label><select id="aWitness">${profiles.filter(p=>p.id!==me.id).map(p=>`<option ${e?.witness===p.first_name?'selected':''}>${escapeHtml(p.first_name)}</option>`).join('')}<option ${e?.witness==='Ehrenkodex'?'selected':''}>Ehrenkodex</option></select></div><div class="full"><label class="strong small">Optionaler Bildnachweis</label><div class="uploadBtns"><label class="uploadBtn">📷 Foto aufnehmen<input hidden type="file" accept="image/*" capture="environment" onchange="proofFile(this)"></label><label class="uploadBtn">🖼️ Galerie<input hidden type="file" accept="image/*" onchange="proofFile(this)"></label></div><img id="proofPreview" class="photoPreview hidden"></div><div id="livePts" class="notice full"></div><button class="cta full">${e?'Speichern':'Aktivität speichern'}</button></form>`}
 if(kind==='steps')return `<form class="form" onsubmit="saveSteps(event,'${e?.id||''}')"><div class="field"><label>Schritte</label><input id="sSteps" type="number" min="0" value="${e?.steps||''}" oninput="stepHint()" required></div><div id="stepHint" class="notice">Wird automatisch auf volle 100 abgerundet.</div><button class="cta">Schritte speichern</button></form>`;
 return `<form class="form" onsubmit="saveFood(event,'${e?.id||''}')"><div class="notice"><b>Ein Tages-Check-in.</b> Hake nur Ziele ab, die du vollständig erfüllt hast.</div><div class="toggleGrid">${FOOD.map(f=>`<label class="toggle"><input type="checkbox" name="food" value="${f.id}" ${(e?.food_items||[]).includes(f.id)?'checked':''}><span><b>${f.icon} ${f.title}</b><br><span class="tiny muted">${f.desc}</span></span></label>`).join('')}</div><div><label class="strong small">Optionales Foto für den Feed</label><div class="uploadBtns"><label class="uploadBtn">📷 Foto aufnehmen<input hidden type="file" accept="image/*" capture="environment" onchange="proofFile(this)"></label><label class="uploadBtn">🖼️ Galerie<input hidden type="file" accept="image/*" onchange="proofFile(this)"></label></div><img id="proofPreview" class="photoPreview hidden"></div><button class="cta">Ernährung speichern</button></form>`
}
function wireDynamic(edit){let a=$('#aType');if(!a)return;let x=ACTIVITIES[a.value];$('#distWrap')?.classList.toggle('hidden',!x.distance);livePts()}
function livePts(){let a=$('#aType')?.value,min=+($('#aMinutes')?.value||0),dist=+($('#aDistance')?.value||0),p=activityPoints(a,min,dist);if($('#livePts'))$('#livePts').innerHTML=`Diese Aktivität bringt aktuell <b>+${p} Punkte</b>.`}
function stepHint(){let raw=+($('#sSteps')?.value||0),rounded=Math.floor(raw/100)*100;if($('#stepHint'))$('#stepHint').innerHTML=`Für die Wertung: <b>${rounded.toLocaleString('de-DE')} Schritte = +${stepPoints(rounded)} P</b>`}
function proofFile(input){let f=input.files?.[0];pendingProof=f||null;if(f){let url=URL.createObjectURL(f),img=$('#proofPreview');if(img){img.src=url;img.classList.remove('hidden')}}}
async function uploadProof(file){if(!file)return null;let ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${me.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;let {error}=await sb.storage.from('proofs').upload(path,file,{upsert:false});if(error)throw error;return path}
async function saveActivity(ev,id=''){
 ev.preventDefault();let a=$('#aType').value,min=+$('#aMinutes').value,dist=$('#aDistance')&&!$('#distWrap').classList.contains('hidden')?+$('#aDistance').value:null,w=$('#aWitness').value,photo=null;
 try{if(pendingProof)photo=await uploadProof(pendingProof);let payload={user_id:me.id,entry_date:id?entries.find(x=>x.id===id).entry_date:fmtDate(),kind:'activity',activity:a,minutes:min,distance:dist,witness:w,points:activityPoints(a,min,dist)};if(photo)payload.photo_path=photo;
 let q=id?sb.from('entries').update(payload).eq('id',id):sb.from('entries').insert(payload);let {error}=await q;if(error)throw error;pendingProof=null;closeModal();await loadData();await render();toast('Gespeichert ✓')}catch(err){toast(err.message)}
}
async function saveSteps(ev,id=''){ev.preventDefault();let steps=Math.floor(+$('#sSteps').value/100)*100,payload={user_id:me.id,entry_date:id?entries.find(x=>x.id===id).entry_date:fmtDate(),kind:'steps',steps,points:stepPoints(steps)};let q=id?sb.from('entries').update(payload).eq('id',id):sb.from('entries').upsert(payload,{onConflict:'user_id,entry_date'});let {error}=await q;if(error){ // Partial unique index is not accepted by upsert; fallback
  let old=entries.find(e=>e.user_id===me.id&&e.entry_date===fmtDate()&&e.kind==='steps');
  let res=old?await sb.from('entries').update(payload).eq('id',old.id):await sb.from('entries').insert(payload);if(res.error)return toast(res.error.message)
 }closeModal();await loadData();await render();toast('Schritte gespeichert ✓')}
async function saveFood(ev,id=''){ev.preventDefault();let items=$$('input[name=food]:checked').map(x=>x.value),photo=null;try{if(pendingProof)photo=await uploadProof(pendingProof);let payload={user_id:me.id,entry_date:id?entries.find(x=>x.id===id).entry_date:fmtDate(),kind:'food',food_items:items,points:items.length,witness:'Ehrenkodex'};if(photo)payload.photo_path=photo;let old=id?entries.find(x=>x.id===id):entries.find(e=>e.user_id===me.id&&e.entry_date===fmtDate()&&e.kind==='food');let res=old?await sb.from('entries').update(payload).eq('id',old.id):await sb.from('entries').insert(payload);if(res.error)throw res.error;pendingProof=null;closeModal();await loadData();await render();toast('Ernährung gespeichert ✓')}catch(err){toast(err.message)}}
function closeModal(){pendingProof=null;$('#modalRoot').innerHTML=''}

async function openProfile(){
 let av=await signed('avatars',me.avatar_path);$('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>Profil</h2><button class="x" onclick="closeModal()">×</button></div><form class="form two section" onsubmit="saveProfile(event)"><div class="field"><label>Vorname</label><input id="pfFirst" value="${escapeHtml(me.first_name)}" required></div><div class="field"><label>Nachname</label><input id="pfLast" value="${escapeHtml(me.last_name)}" required></div><div class="full"><label class="strong small">Profilbild</label><div class="uploadBtns"><label class="uploadBtn">📷 Foto aufnehmen<input hidden type="file" accept="image/*" capture="user" onchange="avatarFile(this)"></label><label class="uploadBtn">🖼️ Galerie<input hidden type="file" accept="image/*" onchange="avatarFile(this)"></label></div><img id="avatarPreview" class="photoPreview ${av?'':'hidden'}" src="${av||''}"></div><button class="cta full">Profil speichern</button></form></div></div>`
}
function avatarFile(i){pendingAvatar=i.files?.[0]||null;if(pendingAvatar){let img=$('#avatarPreview');img.src=URL.createObjectURL(pendingAvatar);img.classList.remove('hidden')}}
async function saveProfile(ev){ev.preventDefault();let path=me.avatar_path;try{if(pendingAvatar){let ext=(pendingAvatar.name.split('.').pop()||'jpg').toLowerCase();path=`${me.id}/avatar-${Date.now()}.${ext}`;let {error}=await sb.storage.from('avatars').upload(path,pendingAvatar);if(error)throw error}let {error}=await sb.from('profiles').update({first_name:$('#pfFirst').value.trim(),last_name:$('#pfLast').value.trim(),avatar_path:path}).eq('id',me.id);if(error)throw error;pendingAvatar=null;signedCache={};closeModal();await loadData();renderShell();await render();toast('Profil gespeichert ✓')}catch(err){toast(err.message)}}
function rewardOptions(m){let seed=m+[...monthKey()].reduce((s,c)=>s+c.charCodeAt(0),0);return [0,1,2].map(i=>REWARDS[(seed+i*3)%REWARDS.length])}
function openReward(m){let opts=rewardOptions(m);$('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>🎉 ${m} Punkte!</h2><button class="x" onclick="closeModal()">×</button></div><p>Wähle eine Belohnung:</p><div class="grid">${opts.map(r=>`<button class="choice" onclick="chooseReward(${m},'${r.key}')"><b>${r.name}</b><div class="muted small">${r.desc}</div></button>`).join('')}</div></div></div>`}
async function chooseReward(m,key){let {error}=await sb.from('reward_choices').insert({user_id:me.id,month_key:monthKey(),milestone:m,reward_key:key});if(error)return toast(error.message);closeModal();await loadData();await render();toast('Belohnung gespeichert 🎁')}

document.addEventListener('DOMContentLoaded',init);
