
const CFG=window.FIT4US_CONFIG||{};
const configured=CFG.supabaseUrl && !CFG.supabaseUrl.startsWith('DEINE_') && CFG.supabaseKey && !CFG.supabaseKey.startsWith('DEIN_');
let sb=null, session=null, me=null, profiles=[], entries=[], reactions=[], rewardChoices=[], challengePool=[], proposals=[], proposalVotes=[], ratings=[], groupAssignments=[], dailyAssignments=[], dailyUserAssignments=[], dailyCompletions=[], achievements=[], challengeCompletions=[], adminAudit=[], rewardPool=[], rewardProposals=[], rewardProposalVotes=[], rewardPoolVotes=[], feedComments=[], witnessConfirmations=[], userPreferences=[], currentView='home', pendingProof=null, pendingAvatar=null, signedCache={};
let realtimeRefreshTimer=null,realtimeRefreshRunning=false,realtimeRefreshPending=false;
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
function poolAvailable(c,date=new Date()){if(!c||c.disabled||c.permanently_disabled)return false;if(c.disabled_until&&new Date(c.disabled_until)>date)return false;return c.approved!==false}
function normalizedGroup(c){return c?{id:c.slug||c.id,dbId:c.id,icon:c.emoji,title:c.name,desc:c.description,target:+c.target_value,unit:c.target_unit,kind:c.metric,points:+c.points||5}:null}
function groupChallengeForPeriod(wk){let asg=groupAssignments.find(a=>a.week_key===wk);if(asg){let c=challengePool.find(x=>x.id===asg.challenge_pool_id);if(c)return normalizedGroup(c)}let active=challengePool.filter(c=>c.challenge_type==='group'&&poolAvailable(c));if(!active.length)return GROUP_CHALLENGES[0];let seed=[...wk].reduce((s,c)=>((s*31)+c.charCodeAt(0))>>>0,17);return normalizedGroup(active[seed%active.length])}
function groupChallengeValue(wk){
 let ch=groupChallengeForPeriod(wk),es=entriesForWeek(wk);
 if(ch.kind==='steps')return es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0);
 if(ch.kind==='minutes')return es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0);
 if(ch.kind==='outdoor')return es.filter(e=>e.kind==='activity'&&['walk','hike'].includes(e.activity)).length;
 if(ch.kind==='distance')return es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.distance||0),0);
 if(ch.kind==='healthy')return es.filter(e=>e.kind==='food'&&(e.food_items||[]).length>=5).length;
 if(ch.kind==='activities')return es.filter(e=>e.kind==='activity').length;
 return 0
}
function groupChallengeComplete(wk){let ch=groupChallengeForPeriod(wk);return groupChallengeValue(wk)>=ch.target}
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
 bonus+=dailyCompletions.filter(x=>x.user_id===userId&&x.challenge_date>=from&&x.challenge_date<=to).reduce((s,x)=>s+(+x.points||1),0);
 return bonus
}
function pointsOf(userId,list){return basePointsOf(userId,list)+bonusPointsOf(userId,list)}
function profileById(id){return profiles.find(p=>p.id===id)}

async function signed(bucket,path,expires=3600){
 if(!path)return null;
 let key=`${bucket}:${path}`,now=Date.now(),cached=signedCache[key];
 // Refresh five minutes before Supabase's signed URL actually expires.
 if(cached?.url&&cached.expiresAt>now+60_000)return cached.url;
 let {data,error}=await sb.storage.from(bucket).createSignedUrl(path,expires);
 if(error){console.warn('Signed URL:',error);delete signedCache[key];return null}
 let ttl=Math.max(60,expires-300)*1000;
 signedCache[key]={url:data.signedUrl,expiresAt:now+ttl};
 return data.signedUrl;
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
 setTimeout(()=>{flushOutbox(false);maybeShowOnboarding()},250);
}
function showPendingApproval(){
 $('#boot').innerHTML=`<div class="auth"><div class="authCard" style="text-align:center">
   <img class="authLogo" src="assets/fit4us-logo.png">
   <div style="font-size:48px">🔒</div>
   <h2>Freischaltung ausstehend</h2>
   <p>Hallo <b>${escapeHtml(me.first_name)}</b>! Dein Fit4Us-Konto wurde erstellt, muss aber zuerst von einem Admin freigeschaltet werden.</p>
   <div class="notice small" style="text-align:left"><b>Private Gruppe:</b> Ohne Freigabe hast du keinen Zugriff auf Feed, Rankings, Fotos oder andere Nutzerdaten.</div><div class="pendingIntro"><div>⭐ Punkte sammeln</div><div>🔥 Jeden Punktetag als Streak sichern</div><div>🎯 Individuelle Tages- & Wochenchallenges</div><div>🎁 Belohnungen freischalten</div></div>
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
 let [p,e,r,w,reward,cp,pr,pv,cr,ga,da,dua,dc,ach,cc,audit,rpool,rprop,rvotes,rpoolvotes,fc,wc,prefs]=await Promise.all([
  sb.from('profiles').select('*').order('created_at'),
  sb.from('entries').select('*').order('entry_date',{ascending:false}).order('created_at',{ascending:false}),
  sb.from('reactions').select('*'),sb.from('weekly_challenges').select('*'),sb.from('reward_choices').select('*'),
  sb.from('challenge_pool').select('*').order('challenge_type').order('name'),sb.from('challenge_proposals').select('*').order('created_at',{ascending:false}),sb.from('challenge_proposal_votes').select('*'),sb.from('challenge_ratings').select('*'),
  sb.from('group_challenge_assignments').select('*'),sb.from('daily_challenge_assignments').select('*'),sb.from('daily_user_challenge_assignments').select('*'),sb.from('daily_challenge_completions').select('*').order('created_at',{ascending:false}),
  sb.from('achievements').select('*').order('achieved_on',{ascending:false}),sb.from('challenge_completions').select('*').order('created_at',{ascending:false}),sb.from('admin_audit_log').select('*').order('created_at',{ascending:false}).limit(200),
  sb.from('reward_pool').select('*').order('points_required'),sb.from('reward_proposals').select('*').order('created_at',{ascending:false}),sb.from('reward_proposal_votes').select('*'),sb.from('reward_pool_votes').select('*'),
  sb.from('feed_comments').select('*').order('created_at'),sb.from('witness_confirmations').select('*'),sb.from('user_preferences').select('*')
 ]);
 if(p.error)throw p.error;
 profiles=(p.data||[]).filter(x=>x.approved || x.id===session.user.id || me?.is_admin);me=profiles.find(x=>x.id===session.user.id)||me;
 entries=e.data||[];reactions=r.data||[];window.weekSelections=w.data||[];rewardChoices=reward.data||[];challengePool=cp.data||[];proposals=pr.data||[];proposalVotes=pv.data||[];ratings=cr.data||[];groupAssignments=ga.data||[];dailyAssignments=da.data||[];dailyUserAssignments=dua.data||[];dailyCompletions=dc.data||[];achievements=ach.data||[];challengeCompletions=cc.data||[];adminAudit=audit.data||[];rewardPool=rpool.data||[];rewardProposals=rprop.data||[];rewardProposalVotes=rvotes.data||[];rewardPoolVotes=rpoolvotes.data||[];feedComments=fc.data||[];witnessConfirmations=wc.data||[];userPreferences=prefs.data||[];
 await ensureAssignments();await syncAchievements();applyTheme();
}
function scheduleRealtimeRefresh(){
 clearTimeout(realtimeRefreshTimer);
 realtimeRefreshTimer=setTimeout(async()=>{
  if(realtimeRefreshRunning){realtimeRefreshPending=true;return}
  realtimeRefreshRunning=true;
  try{await loadData();await render()}
  catch(err){console.warn('Realtime refresh:',err)}
  finally{
   realtimeRefreshRunning=false;
   if(realtimeRefreshPending){realtimeRefreshPending=false;scheduleRealtimeRefresh()}
  }
 },300);
}

const DEFAULT_PREFS={
 theme:'system',onboarded:false,
 feed_activity:true,feed_food:true,feed_steps:false,feed_daily:true,feed_achievements:true,
 notify_reactions:true,notify_witness:true,notify_challenges:true,notify_streak:true,celebration_sound:false
};
function prefFor(userId=me?.id){return {...DEFAULT_PREFS,...(userPreferences.find(x=>x.user_id===userId)||{})}}
function applyTheme(){
 let t=prefFor()?.theme||localStorage.getItem('fit4us-theme')||'system';
 localStorage.setItem('fit4us-theme',t);
 let dark=t==='dark'||(t==='system'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
 document.documentElement.dataset.theme=dark?'dark':'light';
}
async function savePreferencePatch(patch){
 let payload={user_id:me.id,...prefFor(),...patch,updated_at:new Date().toISOString()};
 delete payload.created_at;
 let {data,error}=await sb.from('user_preferences').upsert(payload,{onConflict:'user_id'}).select().single();
 if(error)return toast('Einstellung konnte nicht gespeichert werden: '+error.message);
 let i=userPreferences.findIndex(x=>x.user_id===me.id);if(i>=0)userPreferences[i]=data;else userPreferences.push(data);
 applyTheme();return data
}
async function changeTheme(v){await savePreferencePatch({theme:v});toast('Darstellung gespeichert ✓')}
async function togglePref(key,val){await savePreferencePatch({[key]:!!val});await render()}
function feedAllowed(userId,type){let p=prefFor(userId);return type==='activity'?p.feed_activity:type==='food'?p.feed_food:type==='steps'?p.feed_steps:type==='daily'?p.feed_daily:type==='achievement'?p.feed_achievements:true}

function getOutbox(){try{return JSON.parse(localStorage.getItem('fit4us-outbox')||'[]')}catch{return []}}
function setOutbox(q){localStorage.setItem('fit4us-outbox',JSON.stringify(q))}
function queueEntry(payload,mode='insert',id=null){let q=getOutbox();q.push({id:crypto.randomUUID?.()||String(Date.now()+Math.random()),kind:'entry',mode,entryId:id,payload,queuedAt:new Date().toISOString()});setOutbox(q)}
function outboxHTML(){let n=getOutbox().length;return n?`<div class="notice section outboxNotice"><b>📡 ${n} Eintrag${n===1?'':'e'} wartet${n===1?'':'n'} auf Synchronisierung.</b><button class="react" onclick="flushOutbox(true)">Jetzt versuchen</button></div>`:''}
function likelyOffline(err){return !navigator.onLine||/fetch|network|offline|failed to fetch/i.test(String(err?.message||err||''))}
async function flushOutbox(manual=false){
 if(!navigator.onLine){if(manual)toast('Noch keine Internetverbindung.');return}
 let q=getOutbox();if(!q.length)return;let remain=[];
 for(let item of q){try{
   let p=item.payload,res;
   if(item.entryId)res=await sb.from('entries').update(p).eq('id',item.entryId).eq('user_id',me.id);
   else if(p.kind==='steps'||p.kind==='food'){
     let old=(await sb.from('entries').select('id').eq('user_id',me.id).eq('entry_date',p.entry_date).eq('kind',p.kind).maybeSingle()).data;
     res=old?await sb.from('entries').update(p).eq('id',old.id):await sb.from('entries').insert(p);
   }else res=await sb.from('entries').insert(p);
   if(res.error)throw res.error;if(p.witness_user_id){let entryId=item.entryId||res.data?.id;if(!entryId){let q=await sb.from('entries').select('id').eq('user_id',me.id).eq('entry_date',p.entry_date).eq('kind','activity').order('created_at',{ascending:false}).limit(1).maybeSingle();entryId=q.data?.id}if(entryId)await sb.from('witness_confirmations').upsert({entry_id:entryId,entry_owner_id:me.id,witness_user_id:p.witness_user_id,status:'pending',responded_at:null},{onConflict:'entry_id'})}
 }catch(e){remain.push(item)}}
 setOutbox(remain);if(remain.length<q.length){await loadData();await render();toast(`${q.length-remain.length} Offline-Eintrag${q.length-remain.length===1?'':'e'} synchronisiert ✓`)}else if(manual)toast('Synchronisierung noch nicht möglich.')
}
window.addEventListener('online',()=>flushOutbox(false));

function celebrationSnapshot(){
 let pts=monthPoints(),st=streak(),mine=entries.filter(e=>e.user_id===me.id),maxSteps=Math.max(0,...mine.filter(e=>e.kind==='steps').map(e=>+e.steps||0));
 let sel=currentSelection(),wc=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null,wcDone=wc?challengeProgressForWeek(wc,me.id,weekKey())[0]>=challengeProgressForWeek(wc,me.id,weekKey())[1]:false;
 let gc=groupChallengeForPeriod(monthKey()),gv=groupChallengeValueMonth(monthKey());
 return {pts,st,maxSteps,wcDone,gcDone:!!gc&&gv>=gc.target}
}
function playCelebrationSound(){if(!prefFor().celebration_sound)return;try{let A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(523,c.currentTime);o.frequency.exponentialRampToValueAtTime(784,c.currentTime+.18);g.gain.setValueAtTime(.08,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.35);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.36)}catch{}}
function celebrate(title,text,emoji='🎉'){
 playCelebrationSound();
 $('#modalRoot').innerHTML=`<div class="modal celebrationModal"><div class="modalCard celebrationCard"><div class="confetti">${Array.from({length:18},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><div class="celebrateEmoji">${emoji}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p><button class="cta" onclick="closeModal()">Weiter</button></div></div>`
}
function maybeCelebrate(before){
 let after=celebrationSnapshot(),cross=MILESTONES.find(m=>before.pts<m&&after.pts>=m);
 if(cross)return celebrate(`${cross} Punkte erreicht!`,'Du hast eine neue Belohnung freigeschaltet.','🎁');
 let sm=STREAK_MARKS.find(x=>before.st<x[0]&&after.st>=x[0]);if(sm)return celebrate(`${sm[0]}-Tage-Streak!`,`+${sm[1]} Bonuspunkte für deine Serie.`,'🔥');
 if(after.maxSteps>before.maxSteps&&after.maxSteps>=10000)return celebrate('Neuer Schritt-Rekord!',`${after.maxSteps.toLocaleString('de-DE')} Schritte – dein neuer persönlicher Bestwert.`,'👟');
 if(!before.wcDone&&after.wcDone)return celebrate('Wochenchallenge geschafft!','Stark – die Wochenchallenge ist im Ziel.','🎯');
 if(!before.gcDone&&after.gcDone){notifyGroup('Monatsmission geschafft 🎉',`${firstName(me)} hat die Crew-Mission ins Ziel gebracht.`);return celebrate('Crew-Mission geschafft!','Ihr habt die Monatsmission gemeinsam erreicht.','👥')}
}
function maxStreakEver(userId=me.id){let dates=[...new Set([...entries.filter(e=>e.user_id===userId&&(+e.points||0)>0).map(e=>e.entry_date),...dailyCompletions.filter(d=>d.user_id===userId).map(d=>d.challenge_date)])].sort();let best=0,run=0,last=null;for(let ds of dates){let d=new Date(ds+'T12:00');if(last){let diff=Math.round((d-last)/86400000);run=diff===1?run+1:1}else run=1;best=Math.max(best,run);last=d}return best}
function personalRecords(userId=me.id){let es=entries.filter(e=>e.user_id===userId),acts=es.filter(e=>e.kind==='activity');return {maxSteps:Math.max(0,...es.filter(e=>e.kind==='steps').map(e=>+e.steps||0)),maxMinutes:Math.max(0,...acts.map(e=>+e.minutes||0)),maxDistance:Math.max(0,...acts.map(e=>+e.distance||0)),streak:maxStreakEver(userId),totalActivities:acts.length}}
function streakHeatmapHTML(userId=me.id,weeks=8){let end=new Date();let start=startOfWeek(end);start.setDate(start.getDate()-(weeks-1)*7);let cells=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){let ds=fmtDate(d),active=activeDay(ds,userId);cells.push(`<span class="heatCell ${active?'on':''}" title="${new Date(ds+'T12:00').toLocaleDateString('de-DE')} ${active?'· aktiv':''}"></span>`)}return `<div class="heatmap" style="--weeks:${weeks}">${cells.join('')}</div><div class="tiny muted heatLegend"><span>letzte ${weeks} Wochen</span><span>□ kein Punkt · ■ Streak-Tag</span></div>`}
function personalRecordsHTML(){let r=personalRecords();return `<div class="grid grid2 recordsGrid"><div class="recordMini">👟<span>Schritt-Rekord</span><b>${r.maxSteps.toLocaleString('de-DE')}</b></div><div class="recordMini">🔥<span>Längster Streak</span><b>${r.streak} Tage</b></div><div class="recordMini">⏱️<span>Längste Aktivität</span><b>${r.maxMinutes} Min.</b></div><div class="recordMini">🗺️<span>Längste Distanz</span><b>${r.maxDistance.toFixed(1)} km</b></div></div>`}

function quickTemplates(){let cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);let from=fmtDate(cutoff),map=new Map();entries.filter(e=>e.user_id===me.id&&e.kind==='activity'&&e.entry_date>=from).forEach(e=>{let min=Math.max(5,Math.round((+e.minutes||0)/5)*5),dist=e.distance?Math.round(+e.distance*10)/10:null,key=`${e.activity}|${min}|${dist||''}`,x=map.get(key)||{activity:e.activity,minutes:min,distance:dist,count:0};x.count++;map.set(key,x)});return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,3)}
function quickTemplatesHTML(){let q=quickTemplates();if(!q.length)return '';return `<div class="sectionTitle"><h2>⚡ Schnell eintragen</h2><span class="pill">aus deinen letzten 30 Tagen</span></div><div class="quickTemplates">${q.map(x=>`<button class="quickTemplate" onclick="openQuickTemplate('${x.activity}',${x.minutes},${x.distance??'null'})"><span>${ACTIVITIES[x.activity]?.icon||'⚡'}</span><b>${escapeHtml(ACTIVITIES[x.activity]?.name||'Aktivität')}</b><small>${x.minutes} Min.${x.distance?` · ${x.distance} km`:''}</small></button>`).join('')}</div>`}
function openQuickTemplate(activity,minutes,distance){let a=ACTIVITIES[activity];$('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>${a?.icon||'⚡'} Schnell eintragen</h2><button class="x" onclick="closeModal()">×</button></div><p><b>${escapeHtml(a?.name||'Aktivität')}</b> · ${minutes} Min.${distance?` · ${distance} km`:''}</p><div class="notice small">Zeuge: <b>Ehrenkodex</b> – dafür ist keine Bestätigung nötig.</div><button class="cta section" onclick="saveQuickActivity('${activity}',${minutes},${distance??'null'})">Jetzt eintragen</button></div></div>`}
async function saveQuickActivity(activity,minutes,distance){let before=celebrationSnapshot(),payload={user_id:me.id,entry_date:fmtDate(),kind:'activity',activity,minutes,distance,witness:'Ehrenkodex',witness_user_id:null,points:calcCappedActivityPoints(me.id,fmtDate(),activity,minutes,distance,null)};let {error}=await sb.from('entries').insert(payload);if(error){if(likelyOffline(error)){queueEntry(payload);closeModal();toast('Offline gespeichert – wird später synchronisiert.');return}return toast(error.message)}closeModal();await loadData();await detectChallengeCompletions();await render();maybeCelebrate(before)}

function almostThereHTML(){let items=[],sel=currentSelection(),c=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null;if(c){let [a,b]=challengeProgressForWeek(c,me.id,weekKey()),left=Math.max(0,b-a);if(left>0&&left<=Math.max(1,b*.34))items.push(`🎯 Noch <b>${left}</b> bis „${escapeHtml(c.title)}“`)}let gc=groupChallengeForPeriod(monthKey()),gv=groupChallengeValueMonth(monthKey()),gl=Math.max(0,gc.target-gv),pct=gv/gc.target;if(gl>0&&pct>=.7)items.push(`👥 Crew fast am Ziel: noch <b>${Number(gl.toFixed?.(1)??gl).toLocaleString('de-DE')} ${escapeHtml(gc.unit||'')}</b>`);let pts=monthPoints(),next=MILESTONES.find(m=>m>pts);if(next&&next-pts<=10)items.push(`🎁 Noch <b>${next-pts} P</b> bis zur nächsten Belohnung`);return items.length?`<div class="card pad almostThere"><b>✨ Fast geschafft</b>${items.map(x=>`<div>${x}</div>`).join('')}</div>`:''}
function todayEnoughHTML(){let p=pointsCollectedOnDate(fmtDate()),dc=dailyCompletedBy(me.id);if(p>=8||((todayEntry('steps')?.steps||0)>=10000&&todayActivityMinutes()>=30))return `<div class="todayEnough"><b>🌿 Starker Tag.</b><span>Dein Streak ist gesichert und du hast heute ${p} Punkt${p===1?'':'e'} gesammelt. Alles Weitere ist Bonus.</span></div>`;return ''}
function previousWeekSummary(userId=me.id){let d=startOfWeek();d.setDate(d.getDate()-7),wk=weekKey(d),es=entriesForWeek(wk).filter(e=>e.user_id===userId);return {wk,pts:pointsOf(userId,es),steps:es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0),minutes:es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),days:[...new Set(es.filter(e=>(+e.points||0)>0).map(e=>e.entry_date))].length}}
function weeklyReviewHTML(){let w=previousWeekSummary();return `<div class="card pad"><div class="challengeTop"><h3>📅 Deine letzte Woche</h3><span class="pill">KW ${isoWeek(new Date(w.wk+'T12:00'))}</span></div><div class="grid kpis section"><div class="kpi"><b>${w.pts}</b><div class="tiny muted">Punkte</div></div><div class="kpi"><b>${w.steps.toLocaleString('de-DE')}</b><div class="tiny muted">Schritte</div></div><div class="kpi"><b>${w.minutes}</b><div class="tiny muted">Aktivmin.</div></div></div></div>`}
function crewMomentHTML(){let es=currentWeekEntries(),steps=es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0),mins=es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),activeUsers=profiles.filter(p=>p.approved&&es.some(e=>e.user_id===p.id&&(+e.points||0)>0)).length;let text=steps>=100000?`Ihr habt diese Woche schon ${steps.toLocaleString('de-DE')} Schritte gesammelt.`:mins>=300?`Die Crew kommt diese Woche auf ${mins} aktive Minuten.`:`${activeUsers} von ${profiles.filter(p=>p.approved).length} sind diese Woche bereits im Streak aktiv.`;return `<div class="card crewMoment"><span>❤️</span><div><small>CREW-MOMENT DER WOCHE</small><b>${text}</b></div></div>`}

function witnessStatusFor(entryId){return witnessConfirmations.find(x=>x.entry_id===entryId)}
function witnessBadge(e){if(!e.witness_user_id)return `<span class="witnessBadge honor">🤝 Ehrenkodex</span>`;let w=witnessStatusFor(e.id),name=escapeHtml(e.witness||firstName(profileById(e.witness_user_id)));if(!w||w.status==='pending')return `<span class="witnessBadge pending">👀 ${name}: offen</span>`;if(w.status==='confirmed')return `<span class="witnessBadge confirmed">✓ von ${name} bestätigt</span>`;return `<span class="witnessBadge declined">? ${name} nicht bestätigt</span>`}
function pendingWitnessHTML(){let req=witnessConfirmations.filter(x=>x.witness_user_id===me.id&&x.status==='pending');if(!req.length)return '';return `<div class="sectionTitle"><h2>👀 Zeugenanfragen</h2><span class="pill">${req.length} offen</span></div><div class="grid">${req.map(w=>{let e=entries.find(x=>x.id===w.entry_id),p=e?profileById(e.user_id):null;if(!e)return '';return `<div class="card pad witnessRequest"><div><b>${escapeHtml(firstName(p))} hat dich als Zeuge angegeben</b><div class="small muted">${escapeHtml(entryLabel(e))}</div></div><div><button class="react" onclick="answerWitness('${w.id}','confirmed')">✓ Bestätigen</button><button class="react" onclick="answerWitness('${w.id}','declined')">🤷 Kann ich nicht bestätigen</button></div></div>`}).join('')}</div>`}
async function answerWitness(id,status){let w=witnessConfirmations.find(x=>x.id===id);if(!w)return;let {data,error}=await sb.from('witness_confirmations').update({status,responded_at:new Date().toISOString()}).eq('id',id).eq('witness_user_id',me.id).select().single();if(error)return toast(error.message);let e=entries.find(x=>x.id===w.entry_id);if(e)prefFor(e.user_id).notify_witness&&notifyUser(e.user_id,status==='confirmed'?'Zeuge bestätigt ✓':`${firstName(me)} konnte den Eintrag nicht bestätigen`,`${firstName(me)} hat auf deine Zeugenanfrage reagiert.`,'witness');await loadData();await render();toast(status==='confirmed'?'Bestätigt ✓':'Antwort gespeichert')}

function commentsFor(type,id){return feedComments.filter(c=>c.item_type===type&&c.item_id===id).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))}
function commentsHTML(type,id,ownerId){let cs=commentsFor(type,id);return `<div class="comments">${cs.map(c=>{let p=profileById(c.user_id);return `<div class="comment"><b>${escapeHtml(firstName(p))}</b><span>${escapeHtml(c.comment)}</span>${c.user_id===me.id?`<button onclick="deleteComment('${c.id}')">×</button>`:''}</div>`}).join('')}<form onsubmit="addComment(event,'${type}','${id}','${ownerId||''}')"><input maxlength="240" placeholder="Kommentieren…" required><button>➤</button></form></div>`}
async function addComment(ev,type,id,ownerId){ev.preventDefault();let input=ev.target.querySelector('input'),comment=input.value.trim();if(!comment)return;let {error}=await sb.from('feed_comments').insert({user_id:me.id,item_type:type,item_id:id,comment});if(error)return toast(error.message);if(ownerId&&ownerId!==me.id)prefFor(ownerId).notify_reactions&&notifyUser(ownerId,`${firstName(me)} hat kommentiert 💬`,comment,'reactions');await loadData();await render()}
async function deleteComment(id){let {error}=await sb.from('feed_comments').delete().eq('id',id).eq('user_id',me.id);if(error)return toast(error.message);await loadData();await render()}

function base64ToUint8Array(base64){let pad='='.repeat((4-base64.length%4)%4),s=(base64+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(s);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function enablePushNotifications(){
 if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))return toast('Push wird von diesem Browser nicht unterstützt.');
 if(!CFG.pushVapidPublicKey)return toast('Push ist noch nicht konfiguriert. Siehe UPDATE-Anleitung.');
 let perm=await Notification.requestPermission();if(perm!=='granted')return toast('Benachrichtigungen wurden nicht erlaubt.');
 let reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToUint8Array(CFG.pushVapidPublicKey)}),j=sub.toJSON();
 let {error}=await sb.from('push_subscriptions').upsert({user_id:me.id,endpoint:j.endpoint,p256dh:j.keys?.p256dh,auth:j.keys?.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});if(error)return toast(error.message);toast('Push-Benachrichtigungen aktiviert ✓')
}
async function notifyUser(targetUserId,title,body,category='challenges'){if(!targetUserId||targetUserId===me?.id)return;try{await sb.functions.invoke('push-notification',{body:{target_user_id:targetUserId,title,body,category,url:'https://banditosjar.github.io/Fit4Us/'}})}catch(e){console.warn('push',e)}}
async function notifyGroup(title,body){for(let p of profiles.filter(p=>p.approved&&p.id!==me.id))await notifyUser(p.id,title,body)}

function settingsHTML(){let p=prefFor();return `<div class="card pad settingsCard"><h3>⚙️ Komfort & Datenschutz</h3><div class="field section"><label>Darstellung</label><select onchange="changeTheme(this.value)"><option value="system" ${p.theme==='system'?'selected':''}>System</option><option value="light" ${p.theme==='light'?'selected':''}>Hell</option><option value="dark" ${p.theme==='dark'?'selected':''}>Dunkel</option></select></div><h4>Im Feed teilen</h4>${[['feed_activity','Aktivitäten'],['feed_food','Ernährung'],['feed_steps','Schritte'],['feed_daily','Tageschallenges'],['feed_achievements','Achievements']].map(([k,l])=>`<label class="settingToggle"><input type="checkbox" ${p[k]?'checked':''} onchange="togglePref('${k}',this.checked)"><span>${l}</span></label>`).join('')}<h4>Benachrichtigungen</h4>${[['notify_reactions','Reaktionen & Kommentare'],['notify_witness','Zeugenanfragen'],['notify_challenges','Challenges & Missionen'],['notify_streak','Streak-Erinnerung']].map(([k,l])=>`<label class="settingToggle"><input type="checkbox" ${p[k]?'checked':''} onchange="togglePref('${k}',this.checked)"><span>${l}</span></label>`).join('')}<label class="settingToggle"><input type="checkbox" ${p.celebration_sound?'checked':''} onchange="togglePref('celebration_sound',this.checked)"><span>🔊 Sound bei großen Erfolgen</span></label><button class="secondary section" onclick="enablePushNotifications()">🔔 Push auf diesem Gerät aktivieren</button></div>`}
async function maybeShowOnboarding(){if(prefFor().onboarded)return;$('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard onboarding"><div class="celebrateEmoji">👋</div><h2>Willkommen bei Fit4Us</h2><div class="onboardingGrid"><div><span>⭐</span><b>Punkte sammeln</b><p>Bewegung, Ernährung und Challenges bringen Punkte – ohne Negativpunkte.</p></div><div><span>🔥</span><b>Streak aufbauen</b><p>Schon ein einziger Punkt am Tag hält deine Serie am Leben.</p></div><div><span>🎁</span><b>Belohnungen freischalten</b><p>Deine Punkte werden nicht ausgegeben. Erreichte Belohnungen bleiben dir.</p></div></div><button class="cta" onclick="finishOnboarding()">Fit4Us starten</button></div></div>`}
async function finishOnboarding(){await savePreferencePatch({onboarded:true});closeModal()}

function startRealtime(){
 stopRealtime();
 ['entries','reactions','profiles','weekly_challenges','reward_choices','challenge_pool','challenge_proposals','challenge_proposal_votes','challenge_ratings','group_challenge_assignments','daily_challenge_assignments','daily_user_challenge_assignments','daily_challenge_completions','achievements','challenge_completions','admin_audit_log','reward_pool','reward_proposals','reward_proposal_votes','reward_pool_votes','feed_comments','witness_confirmations','user_preferences'].forEach(table=>{
  let ch=sb.channel('fit4us-'+table).on('postgres_changes',{event:'*',schema:'public',table},scheduleRealtimeRefresh).subscribe();
  realtimeChannels.push(ch)
 })
}
function stopRealtime(){
 clearTimeout(realtimeRefreshTimer);realtimeRefreshTimer=null;realtimeRefreshPending=false;
 realtimeChannels.forEach(c=>sb?.removeChannel(c));realtimeChannels=[]
}
function renderShell(){
 $('#boot').innerHTML=`<div class="shell">
 <aside class="side"><img src="assets/fit4us-logo.png"><div class="sideNav" id="sideNav"></div><div class="sideBottom" id="sideUser"></div></aside>
 <main class="main"><header class="top"><img class="brandMini" src="assets/fit4us-icon.png"><div class="topUser" id="topUser"></div></header><div id="content"></div></main>
 <nav class="bottom" id="bottomNav"></nav><div id="mobileMenuRoot"></div></div><div id="modalRoot"></div>`;
 navs()
}
async function navs(){
 let nav=[['home','🏠','Home'],['group','👥','Gruppe'],['add','＋',''],['challenges','🎯','Challenges'],['more','☰','Mehr']];
 $('#bottomNav').innerHTML=nav.map(([id,ic,t])=>id==='add'?`<button class="plus" aria-label="Eintrag hinzufügen" onclick="openEntry()">＋</button>`:id==='more'?`<button class="navBtn ${['me','rules','history','admin'].includes(currentView)?'active':''}" onclick="openMobileMenu()"><span>${ic}</span>${t}</button>`:`<button class="navBtn ${currentView===id?'active':''}" onclick="go('${id}')"><span>${ic}</span>${t}</button>`).join('');
 $('#sideNav').innerHTML=[['home','🏠 Home'],['group','👥 Gruppe'],['challenges','🎯 Challenges'],['me','📊 Mein Profil'],['rules','📖 Punkte & Regeln'],['history','🗓️ Historie'],...(me?.is_admin?[['admin','🛡️ Admin']]:[])].map(([id,t])=>`<button class="${currentView===id?'active':''}" onclick="go('${id}')">${t}</button>`).join('');
 let av=await avatarHTML(me,42);$('#topUser').innerHTML=`${av}<div><b>${escapeHtml(firstName(me))}</b><div class="tiny muted">@${escapeHtml(me.username)}</div></div>`;
 $('#sideUser').innerHTML=`<button class="secondary" style="width:100%" onclick="logout()">Abmelden</button>`
}
function openMobileMenu(){
 let root=$('#mobileMenuRoot');if(!root)return;
 root.innerHTML=`<div class="mobileMenuBackdrop" onclick="closeMobileMenu(event)"><div class="mobileMenuSheet" onclick="event.stopPropagation()"><div class="mobileMenuHandle"></div><div class="mobileMenuHead"><div><b>Fit4Us Menü</b><div class="tiny muted">Alle Funktionen</div></div><button class="x" onclick="closeMobileMenu()">×</button></div><div class="mobileMenuGrid">
 <button onclick="mobileGo('me')"><span>👤</span><b>Mein Profil</b></button>
 <button onclick="mobileGo('rules')"><span>📖</span><b>Punkte & Regeln</b></button>
 <button onclick="mobileGo('history')"><span>🗓️</span><b>Historie</b></button>
 ${me?.is_admin?`<button class="adminMobile" onclick="mobileGo('admin')"><span>🛡️</span><b>Admin</b></button>`:''}
 </div><button class="secondary mobileLogout" onclick="logout()">Abmelden</button></div></div>`
}
function closeMobileMenu(e){if(e&&e.target!==e.currentTarget)return;let r=$('#mobileMenuRoot');if(r)r.innerHTML=''}
async function mobileGo(v){closeMobileMenu();await go(v)}

async function go(v){if(v==='admin'&&!me?.is_admin){toast('Kein Admin-Zugriff.');v='home'}currentView=v;navs();await render()}
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
function pointsCollectedOnDate(date,userId=me.id){
 let base=entries.filter(e=>e.user_id===userId&&e.entry_date===date).reduce((s,e)=>s+(+e.points||0),0);
 let daily=dailyCompletions.filter(e=>e.user_id===userId&&e.challenge_date===date).reduce((s,e)=>s+(+e.points||1),0);
 return base+daily;
}
function activeDay(date,userId=me.id){
 return pointsCollectedOnDate(date,userId)>0;
}
function streak(userId=me.id){
 let n=0,d=new Date(); if(!activeDay(fmtDate(d),userId)){d.setDate(d.getDate()-1)}
 while(activeDay(fmtDate(d),userId)){n++;d.setDate(d.getDate()-1)}
 return n
}
function streakNext(s){return STREAK_MARKS.find(x=>x[0]>s)||[30,25]}


function dailyTemplateText(text,targetUser=null){
 let person=targetUser?firstName(targetUser):'eine andere Person aus der Gruppe';
 return String(text||'').replace(/\{person\}/g,person);
}
function dailyPoolByMode(mode){
 return challengePool
  .filter(c=>c.challenge_type==='daily'&&poolAvailable(c)&&(c.daily_target_mode||'general')===mode)
  .sort((a,b)=>String(a.slug||a.id).localeCompare(String(b.slug||b.id)));
}
function dailyAssignmentCandidate(date,userId){
 let members=profiles.filter(p=>p.approved).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 let idx=Math.max(0,members.findIndex(p=>p.id===userId));
 let seed=[...date].reduce((s,c)=>((s*43)+c.charCodeAt(0))>>>0,29);

 // Exakt ca. 1/5 der persönlichen Tagesaufgaben hat Gruppenbezug.
 // Bei vier Nutzern erhält an vier von fünf Tagen jeweils einer eine Gruppenaufgabe.
 let mode=((seed+idx)%5===0)?'group_other':'general';
 let pool=dailyPoolByMode(mode);
 if(!pool.length){mode='general';pool=dailyPoolByMode('general')}
 if(!pool.length)return null;

 // 73 sorgt bei einem großen Pool dafür, dass die vier Gruppenmitglieder
 // am selben Tag unterschiedliche Aufgaben erhalten.
 let chosen=pool[(seed+idx*73)%pool.length];
 let targetUserId=null;
 if(mode==='group_other'){
  let others=members.filter(p=>p.id!==userId);
  if(others.length)targetUserId=others[(seed+idx*11)%others.length].id;
 }
 return {challenge_date:date,user_id:userId,challenge_pool_id:chosen.id,target_user_id:targetUserId};
}
async function ensureAssignments(){
 if(!me?.approved)return;
 let mk=monthKey();
 if(!groupAssignments.some(a=>a.week_key===mk)){
  let available=challengePool.filter(c=>c.challenge_type==='group'&&poolAvailable(c));
  if(available.length){
   let seed=[...mk].reduce((s,c)=>((s*37)+c.charCodeAt(0))>>>0,19),chosen=available[seed%available.length];
   let {error}=await sb.from('group_challenge_assignments').insert({week_key:mk,challenge_pool_id:chosen.id});
   if(!error)groupAssignments.push({week_key:mk,challenge_pool_id:chosen.id})
  }
 }

 let ds=fmtDate();
 if(!dailyUserAssignments.some(a=>a.challenge_date===ds&&a.user_id===me.id)){
  // Wer die Tageschallenge vor dem Update heute bereits erledigt hat,
  // behält exakt diese Challenge.
  let existingCompletion=dailyCompletions.find(x=>x.challenge_date===ds&&x.user_id===me.id);
  let payload=existingCompletion
   ?{challenge_date:ds,user_id:me.id,challenge_pool_id:existingCompletion.challenge_pool_id,target_user_id:existingCompletion.target_user_id||null}
   :dailyAssignmentCandidate(ds,me.id);

  if(payload){
   let {data,error}=await sb.from('daily_user_challenge_assignments')
    .upsert(payload,{onConflict:'challenge_date,user_id',ignoreDuplicates:true})
    .select('*');
   if(!error&&data?.length)dailyUserAssignments.push(data[0]);
   else if(error){
    let q=await sb.from('daily_user_challenge_assignments').select('*').eq('challenge_date',ds).eq('user_id',me.id).maybeSingle();
    if(q.data)dailyUserAssignments.push(q.data);
   }
  }
 }
}
function dailyChallengeFor(date=fmtDate(),userId=me?.id){
 let a=dailyUserAssignments.find(x=>x.challenge_date===date&&x.user_id===userId);

 // Legacy-Fallback für alte Backups / solange die neue Migration noch nicht lief.
 if(!a&&userId===me?.id){
  let legacy=dailyAssignments.find(x=>x.challenge_date===date);
  if(legacy)a={challenge_date:date,user_id:userId,challenge_pool_id:legacy.challenge_pool_id,target_user_id:null};
 }
 let c=a?challengePool.find(x=>x.id===a.challenge_pool_id):null;
 if(!c)return null;

 let targetUser=a?.target_user_id?profileById(a.target_user_id):null;
 return {
  ...c,
  target_user_id:a?.target_user_id||null,
  targetUser,
  emoji:c.emoji||'☀️',
  name:dailyTemplateText(c.name||'Tageschallenge',targetUser),
  description:dailyTemplateText(c.description||'Keine Beschreibung hinterlegt.',targetUser)
 };
}
function dailyCompletedBy(userId,date=fmtDate()){return dailyCompletions.find(x=>x.user_id===userId&&x.challenge_date===date)}
function calcCappedActivityPoints(userId,date,activity,minutes,distance,excludeId=null){let raw=activityPoints(activity,minutes,distance);if(!['garden','house'].includes(activity))return raw;let existing=entries.filter(e=>e.user_id===userId&&e.entry_date===date&&e.kind==='activity'&&['garden','house'].includes(e.activity)&&e.id!==excludeId).reduce((s,e)=>s+(+e.points||0),0);return Math.max(0,Math.min(raw,4-existing))}
function allApprovedUsers(){return profiles.filter(p=>p.approved)}
function proposalVoteCounts(id){let vs=proposalVotes.filter(v=>v.proposal_id===id);return {yes:vs.filter(v=>v.vote).length,no:vs.filter(v=>!v.vote).length,total:vs.length}}
function achievementDefinitions(userId){
 let es=entries.filter(e=>e.user_id===userId),defs=[],stepMax=Math.max(0,...es.filter(e=>e.kind==='steps').map(e=>+e.steps||0));
 [[10000,'steps10','👟','Erste 10.000 Schritte'],[15000,'steps15','👟','Erste 15.000 Schritte'],[20000,'steps20','👟','Erste 20.000 Schritte']].forEach(([n,k,em,t])=>{if(stepMax>=n)defs.push([k,em,t,es.filter(e=>e.kind==='steps'&&e.steps>=n).sort((a,b)=>a.entry_date.localeCompare(b.entry_date))[0]?.entry_date])});
 let totalDist=es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.distance||0),0);if(totalDist>=100)defs.push(['distance100','🗺️','100 km Gesamtstrecke',fmtDate()]);
 let maxStreak=streak(userId);[[3,'streak3','🔥','3-Tage-Streak'],[7,'streak7','🔥','7-Tage-Streak'],[14,'streak14','🔥','14-Tage-Streak'],[30,'streak30','🔥','30-Tage-Streak']].forEach(([n,k,em,t])=>{if(maxStreak>=n)defs.push([k,em,t,fmtDate()])});
 if(es.some(e=>e.kind==='food'&&(e.food_items||[]).length===7))defs.push(['food7','🥗','Alle 7 Ernährungsziele',es.filter(e=>e.kind==='food'&&(e.food_items||[]).length===7).sort((a,b)=>a.entry_date.localeCompare(b.entry_date))[0]?.entry_date]);
 if(es.filter(e=>e.kind==='food').length>=10)defs.push(['food10','🥦','10 Ernährungstage',fmtDate()]);
 let dc=dailyCompletions.filter(x=>x.user_id===userId);if(dc.length>=1)defs.push(['daily1','❤️','Erste Tageschallenge',dc.sort((a,b)=>a.challenge_date.localeCompare(b.challenge_date))[0]?.challenge_date]);if(dc.length>=10)defs.push(['daily10','💬','10 Tageschallenges',fmtDate()]);
 let given=reactions.filter(r=>r.user_id===userId).length,received=reactions.filter(r=>entries.some(e=>e.id===r.entry_id&&e.user_id===userId)).length;if(given>=25)defs.push(['react25','👏','25 Reaktionen vergeben',fmtDate()]);if(received>=50)defs.push(['react50','🔥','50 Reaktionen erhalten',fmtDate()]);
 return defs.filter(x=>x[3])
}
async function syncAchievements(){if(!me?.id)return;let existing=new Set(achievements.filter(a=>a.user_id===me.id).map(a=>a.achievement_key));for(let [key,emoji,title,date] of achievementDefinitions(me.id)){if(existing.has(key))continue;let {data,error}=await sb.from('achievements').insert({user_id:me.id,achievement_key:key,title,emoji,achieved_on:date}).select().single();if(!error&&data){achievements.push(data);existing.add(key)}}}
function monthlyReviewData(userId,mk){let list=entries.filter(e=>e.user_id===userId&&e.entry_date.startsWith(mk));return {pts:pointsOf(userId,list),steps:list.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0),minutes:list.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),distance:list.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.distance||0),0),maxSteps:Math.max(0,...list.filter(e=>e.kind==='steps').map(e=>+e.steps||0)),foodDays:list.filter(e=>e.kind==='food').length}}
function hallOfFame(mk){
 let rows=allApprovedUsers().map(p=>({p,d:monthlyReviewData(p.id,mk),streak:streak(p.id),outdoor:entries.filter(e=>e.user_id===p.id&&e.entry_date.startsWith(mk)&&e.kind==='activity'&&['walk','hike'].includes(e.activity)).length,daily:dailyCompletions.filter(x=>x.user_id===p.id&&x.challenge_date.startsWith(mk)).length}));
 if(!rows.length||rows.every(x=>x.d.pts===0&&x.d.steps===0&&x.streak===0&&x.d.foodDays===0&&x.outdoor===0&&x.daily===0))return{};
 let maxPositive=fn=>{let eligible=rows.filter(x=>fn(x)>0);return eligible.length?eligible.sort((a,b)=>fn(b)-fn(a))[0]:null};
 return {champ:maxPositive(x=>x.d.pts),steps:maxPositive(x=>x.d.steps),streak:maxPositive(x=>x.streak),healthy:maxPositive(x=>x.d.foodDays),outdoor:maxPositive(x=>x.outdoor),social:maxPositive(x=>x.daily)}
}
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
 let ch=groupChallengeForPeriod(monthKey()),v=groupChallengeValueMonth(monthKey()),pct=Math.min(100,v/ch.target*100);
 let value=ch.kind==='steps'?Math.round(v).toLocaleString('de-DE'):Number(v.toFixed?.(1)??v).toLocaleString('de-DE');
 return `<div class="card challengeHome group"><div class="challengeTop"><span class="pill">👥 Gruppen-Monatschallenge</span><span class="points">+5 P alle</span></div><div class="challengeIcon">${ch.icon}</div><div class="challengeTitle">${ch.title}</div><div class="muted small">${ch.desc}</div><div class="progress" style="margin-top:12px"><i style="width:${pct}%"></i></div><div class="challengeFooter"><b>${value} / ${ch.target.toLocaleString('de-DE')} ${ch.unit}</b><span>${v>=ch.target?'Gemeinsam geschafft! 🎉':`${Math.round(pct)} %`}</span></div></div>`
}

let historyMode='month',historyMonth=null;
function monthLabel(m){return new Date(m+'-01T12:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'})}
function entriesForMonth(m){return entries.filter(e=>e.entry_date?.startsWith(m))}
function completedMonths(){let cur=monthKey();return [...new Set(entries.map(e=>e.entry_date?.slice(0,7)).filter(m=>m&&m<cur))].sort().reverse()}
function monthRank(m){let es=entriesForMonth(m);return profiles.filter(p=>p.approved).map(p=>({p,pts:pointsOf(p.id,es)})).sort((a,b)=>b.pts-a.pts)}
function mStats(id,m){let es=entriesForMonth(m).filter(e=>e.user_id===id);return {steps:es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0),minutes:es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),km:es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.distance||0),0),acts:es.filter(e=>e.kind==='activity').length,food:es.filter(e=>e.kind==='food').length}}
function isoWeek(d){let x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));x.setUTCDate(x.getUTCDate()+4-(x.getUTCDay()||7));let y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y)/86400000)+1)/7)}
function weekChamp(wk){let es=entriesForWeek(wk),r=profiles.filter(p=>p.approved).map(p=>({p,pts:pointsOf(p.id,es)})).sort((a,b)=>b.pts-a.pts);return r[0]?.pts>0?r[0]:null}
function monthWeeks(m){let d=startOfWeek(new Date(m+'-01T12:00')),end=new Date(m+'-01T12:00');end.setMonth(end.getMonth()+1);end.setDate(0);let a=[];while(d<=end){let wk=weekKey(d);if(fmtDate(endOfWeek(d))>=m+'-01')a.push(wk);d.setDate(d.getDate()+7)}return [...new Set(a)]}
function setHistoryMode(x){historyMode=x;render()} function setHistoryMonth(x){historyMonth=x;render()}
function shiftHistory(n){let ms=completedMonths(),i=ms.indexOf(historyMonth);let ni=i+n;if(ni>=0&&ni<ms.length){historyMonth=ms[ni];render()}}
function todaySummary(){let es=entries.filter(e=>e.user_id===me.id&&e.entry_date===fmtDate()),st=es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0),mi=es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),f=es.find(e=>e.kind==='food');return `<div class="todayDash"><div><span>👟</span><b>${st.toLocaleString('de-DE')}</b><small>Schritte</small></div><div><span>⏱️</span><b>${mi}</b><small>aktive Min.</small></div><div><span>🥗</span><b>${(f?.food_items||[]).length}/${FOOD.length}</b><small>Ernährung</small></div></div>`}
function taskSummary(){
 let sel=currentSelection(),ch=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null,
 w=ch?challengeProgressForWeek(ch,me.id,weekKey()):[0,1],
 gc=groupChallengeForPeriod(monthKey()),gv=groupChallengeValueMonth(monthKey()),
 dc=dailyChallengeFor(),done=dailyCompletions.some(x=>x.user_id===me.id&&x.challenge_date===fmtDate());

 return `<div class="tasks">
 ${ch?`<button class="homeTask" onclick="openActiveChallenge('weekly')"><span>🎯</span><p><b>${escapeHtml(ch.title)}</b><small>Wochenchallenge · ${Math.round(w[0]/w[1]*100)} %</small></p><strong>${w[0]}/${w[1]}</strong></button>`:''}
 <button class="homeTask" onclick="openActiveChallenge('group')"><span>👥</span><p><b>${escapeHtml(gc.title)}</b><small>Monatsmission · ${Math.round(gv/gc.target*100)} %</small></p><strong>${Math.round(gv/gc.target*100)}%</strong></button>
 ${dc?`<button class="homeTask" onclick="openActiveChallenge('daily')"><span>${escapeHtml(dc.emoji)}</span><p><b>${escapeHtml(dc.name)}</b><small>${dc.targetUser?`Für ${escapeHtml(firstName(dc.targetUser))} · `:''}Tageschallenge</small></p><strong>${done?'✓':'offen'}</strong></button>`:''}
 </div>`
}
function openActiveChallenge(kind){
 let title='',emoji='🎯',desc='',meta='',action='';

 if(kind==='weekly'){
  let sel=currentSelection(),c=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null;
  if(!c)return;
  let [a,b]=challengeProgressForWeek(c,me.id,weekKey()),pct=Math.min(100,a/b*100);
  title=c.title;emoji=c.icon;desc=c.desc;
  meta=`<div class="notice"><b>Fortschritt:</b> ${a} / ${b} · ${Math.round(pct)} %<br><b>Belohnung:</b> +${c.points} Punkte</div><div class="progress section"><i style="width:${pct}%"></i></div>`;
 }
 if(kind==='group'){
  let c=groupChallengeForPeriod(monthKey()),v=groupChallengeValueMonth(monthKey()),pct=Math.min(100,v/c.target*100);
  title=c.title;emoji=c.icon;desc=c.desc;
  meta=`<div class="notice"><b>Crew-Fortschritt:</b> ${Number(v.toFixed?.(1)??v).toLocaleString('de-DE')} / ${c.target.toLocaleString('de-DE')} ${escapeHtml(c.unit||'')}<br><b>Fortschritt:</b> ${Math.round(pct)} %</div><div class="progress section"><i style="width:${pct}%"></i></div>`;
 }
 if(kind==='daily'){
  let c=dailyChallengeFor();if(!c)return;
  let done=dailyCompletedBy(me.id);
  title=c.name;emoji=c.emoji;desc=c.description;
  meta=`<div class="notice">${c.targetUser?`<b>Heute für dich ausgelost:</b> Diese Aufgabe bezieht sich auf <b>${escapeHtml(firstName(c.targetUser))}</b>.<br>`:''}<b>Punkte:</b> +1 · ${done?'✓ bereits erledigt':'noch offen'}</div>`;
  if(!done)action=`<button class="cta section" onclick="closeModal();openDailyComplete()">Als erledigt markieren</button>`;
 }
 $('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>${escapeHtml(emoji)} ${escapeHtml(title)}</h2><button class="x" onclick="closeModal()">×</button></div><p>${escapeHtml(desc)}</p>${meta}${action}</div></div>`;
}



/* V1.13.1 restored core helpers */
function canEditEntryAnywhere(e){return !!e && e.user_id===me.id && e.entry_date.startsWith(monthKey())}

async function completeDaily(e){
 e.preventDefault();
 let before=celebrationSnapshot(),c=dailyChallengeFor(),text=$('#dailyText')?.value?.trim()||'',file=$('#dailyPhoto')?.files?.[0]||null,photo=null;
 if(!c)return toast('Keine Tageschallenge gefunden.');
 if(text.length<3)return toast('Bitte kurz beschreiben, was du gemacht hast.');
 try{
  if(file)photo=await uploadProof(file);
  let payload={
   challenge_date:fmtDate(),
   challenge_pool_id:c.id,
   user_id:me.id,
   target_user_id:c.target_user_id||null,
   completion_text:text,
   points:1
  };
  if(photo)payload.photo_path=photo;
  let {data,error}=await sb.from('daily_challenge_completions').insert(payload).select().single();
  if(error)throw error;
  closeModal();
  await loadData();
  await recordChallengeCompletion('daily',c.id,c.name,c.emoji,1,fmtDate());
  await render();
  maybeCelebrate(before);
  toast(photo?'Tageschallenge geschafft +1 P · Foto gespeichert 📸':'Tageschallenge geschafft +1 P 🎉');
 }catch(err){
  if(photo){try{await sb.storage.from('proofs').remove([photo])}catch{}}
  toast('Tageschallenge konnte nicht gespeichert werden: '+(err?.message||err));
 }
}

function dailyPinnedHTML(){let c=dailyChallengeFor(),done=dailyCompletedBy(me.id),count=dailyCompletions.filter(x=>x.challenge_date===fmtDate()).length;if(!c)return '';return `<div class="card pad section" style="background:linear-gradient(135deg,#fff8ec,#fff)"><div class="challengeTop"><span class="pill">☀️ Tageschallenge</span><span class="points">+1 P</span></div><h3>${escapeHtml(c.emoji)} ${escapeHtml(c.name)}</h3><div class="small muted">${escapeHtml(c.description)}</div>${done?`<div class="notice small" style="margin-top:10px">✓ Heute erledigt: „${escapeHtml(done.completion_text)}“</div>`:`<button class="cta" style="margin-top:10px" onclick="openDailyComplete()">Als erledigt markieren</button>`}</div>`}

async function detectChallengeCompletions(){
 if(!me?.id)return;
 let sel=currentSelection(),ch=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null;
 if(ch){let [a,b]=challengeProgressForWeek(ch,me.id,weekKey());if(a>=b)await recordChallengeCompletion('weekly',ch.id,ch.title,ch.icon,ch.points,weekKey())}
 let gc=groupChallengeForPeriod(monthKey()),gv=groupChallengeValueMonth(monthKey());
 if(gc&&gv>=gc.target)await recordChallengeCompletion('group',gc.dbId||gc.id,gc.title,gc.icon,gc.points,monthKey());
}

async function adminSuspendChallenge(id){let opt=prompt('Sperrdauer in Tagen eingeben. Leer lassen = unbegrenzt bis zur Entsperrung.');if(opt===null)return;let permanent=opt.trim()==='',until=permanent?null:new Date(Date.now()+(Math.max(1,+opt)||1)*86400000).toISOString(),{error}=await sb.rpc('admin_set_challenge_disabled',{target_challenge:id,disabled_state:true,until_time:until,permanent_state:permanent});if(error)return toast(error.message);await logAdmin('challenge_suspended',{challenge_id:id,permanent,until});closeModal();await loadData();await render();toast(permanent?'Challenge unbegrenzt gesperrt':'Challenge temporär gesperrt')}

async function adminUnsuspendChallenge(id){let {error}=await sb.rpc('admin_set_challenge_disabled',{target_challenge:id,disabled_state:false,until_time:null,permanent_state:false});if(error)return toast(error.message);await logAdmin('challenge_unsuspended',{challenge_id:id});closeModal();await loadData();await render();toast('Challenge entsperrt')}

async function adminDeleteChallenge(id){if(!confirm('Challenge wirklich entfernen? Historisch verwendete Challenges können nur gesperrt werden.'))return;let {error}=await sb.rpc('admin_delete_challenge',{target_challenge:id});if(error)return toast(error.message);await logAdmin('challenge_deleted',{challenge_id:id});closeModal();await loadData();await render();toast('Challenge entfernt')}

async function chooseChallenge(id){let champ=prevChampion();if(!me.is_admin&&champ?.id!==me.id)return toast('Nur der Vorwochen-Champion darf wählen.');let {error}=await sb.from('weekly_challenges').insert({week_key:weekKey(),challenge_id:id,selected_by:me.id});if(error)return toast(error.message);await loadData();await render();toast('Challenge gewählt ✓')}

function statsFor(userId,from,to){
 let es=entries.filter(e=>e.user_id===userId&&e.entry_date>=from&&e.entry_date<=to);
 return {points:pointsOf(userId,es),steps:es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0),minutes:es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0),foodDays:es.filter(e=>e.kind==='food').length}
}

function monthView(m){let rank=monthRank(m),team=profiles.filter(p=>p.approved).map(p=>({p,s:mStats(p.id,m)})),tot={steps:team.reduce((s,x)=>s+x.s.steps,0),min:team.reduce((s,x)=>s+x.s.minutes,0),km:team.reduce((s,x)=>s+x.s.km,0),acts:team.reduce((s,x)=>s+x.s.acts,0)};return `<div class="historyHero"><div><small>🏆 CHAMPION ${monthLabel(m).toUpperCase()}</small><h2>${rank[0]?.pts?escapeHtml(firstName(rank[0].p)):'–'}</h2><b>${rank[0]?.pts||0} Punkte</b></div><span>👑</span></div><div class="card pad section"><h3>Endstand</h3>${rank.map((x,i)=>`<div class="rankRow"><span>${['🥇','🥈','🥉'][i]||i+1+'.'}</span><b>${escapeHtml(firstName(x.p))}</b><b>${x.pts} P</b></div>`).join('')}</div><div class="grid kpis section"><div class="kpi"><b>${tot.steps.toLocaleString('de-DE')}</b><small>Crew-Schritte</small></div><div class="kpi"><b>${tot.min}</b><small>Aktivminuten</small></div><div class="kpi"><b>${tot.km.toFixed(1)}</b><small>km</small></div><div class="kpi"><b>${tot.acts}</b><small>Aktivitäten</small></div></div><div class="grid grid2 section"><div class="card pad"><h3>👑 Wochenchampions</h3>${monthWeeks(m).map(w=>{let c=weekChamp(w),sel=selectionForWeek(w),ch=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null;return `<div class="histWeek"><div><b>KW ${isoWeek(new Date(w+'T12:00'))}</b><small>${ch?ch.icon+' '+ch.title:'–'}</small></div><div>${c?'👑 '+escapeHtml(firstName(c.p))+' · '+c.pts+' P':'–'}</div></div>`}).join('')}</div><div class="card pad"><h3>🏅 Monatsrekorde</h3>${[['👟','Schritte','steps'],['⏱️','Aktivminuten','minutes'],['🥗','Ernährungstage','food']].map(([ic,l,k])=>{let x=[...team].sort((a,b)=>b.s[k]-a.s[k])[0];return `<div class="histWeek"><div>${ic} <b>${l}</b></div><div>${x?escapeHtml(firstName(x.p))+' · '+(k==='steps'?x.s[k].toLocaleString('de-DE'):x.s[k]):'–'}</div></div>`}).join('')}</div></div><h2 class="section">Persönliche Monatswerte</h2><div class="grid grid2">${team.map(x=>`<div class="card pad"><h3>${escapeHtml(firstName(x.p))}</h3><div class="personalMonth"><span>👟 ${x.s.steps.toLocaleString('de-DE')}</span><span>⏱️ ${x.s.minutes} Min.</span><span>🗺️ ${x.s.km.toFixed(1)} km</span><span>🏃 ${x.s.acts} Aktivitäten</span><span>🥗 ${x.s.food} Ernährungstage</span></div></div>`).join('')}</div>`}

function allTimeView(){let u=profiles.filter(p=>p.approved).map(p=>{let es=entries.filter(e=>e.user_id===p.id);return {p,pts:pointsOf(p.id,es),s:mStats(p.id,'')}}).sort((a,b)=>b.pts-a.pts);return `<div class="historyHero"><div><small>∞ FIT4US ALL-TIME</small><h2>${u[0]?escapeHtml(firstName(u[0].p)):'–'}</h2><b>${u[0]?.pts||0} Gesamtpunkte</b></div><span>🏛️</span></div><div class="grid grid2 section">${u.map((x,i)=>`<div class="card pad"><div class="challengeTop"><h3>${['🥇','🥈','🥉'][i]||i+1+'.'} ${escapeHtml(firstName(x.p))}</h3><b>${x.pts} P</b></div><div class="personalMonth"><span>👟 ${x.s.steps.toLocaleString('de-DE')}</span><span>⏱️ ${x.s.minutes} Min.</span><span>🗺️ ${x.s.km.toFixed(1)} km</span><span>🏃 ${x.s.acts} Aktivitäten</span></div></div>`).join('')}</div>`}

function entryEditControls(e){
 if(!canEditEntryAnywhere(e))return '';
 return `<div class="entryActions"><button class="react" onclick="event.stopPropagation();editEntry('${e.id}')">✏️ Bearbeiten</button><button class="react danger" onclick="event.stopPropagation();deleteEntry('${e.id}')">🗑 Löschen</button></div>`
}

function previewDailyPhoto(input){
 let file=input?.files?.[0],img=$('#dailyPhotoPreview');
 if(!img)return;
 if(!file){img.src='';img.classList.add('hidden');return}
 img.src=URL.createObjectURL(file);img.classList.remove('hidden');
}
function openDailyComplete(){
 let c=dailyChallengeFor();if(!c)return;
 $('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>${escapeHtml(c.emoji)} Tageschallenge erledigt</h2><button class="x" onclick="closeModal()">×</button></div>
 <p>${escapeHtml(c.description)}</p>
 <form class="form" onsubmit="completeDaily(event)">
  <div class="field"><label>Was hast du gemacht?</label><textarea id="dailyText" rows="5" required minlength="3"></textarea></div>
  <div class="field"><label>Foto <span class="muted">(optional)</span></label><input id="dailyPhoto" type="file" accept="image/*" capture="environment" onchange="previewDailyPhoto(this)"><div class="tiny muted">Wenn du möchtest, kannst du wie bei Aktivitäten oder Ernährung ein Foto anhängen.</div><img id="dailyPhotoPreview" class="photoPreview hidden" alt="Vorschau"></div>
  <button class="cta">Erledigt · +1 P</button>
 </form></div></div>`
}

async function pinnedProposalsHTML(){let active=proposals.filter(p=>p.status==='voting');if(!active.length)return '';return `<div class="sectionTitle"><h2>📌 Offene Abstimmungen</h2></div>`+active.map(p=>{let who=profileById(p.proposer_id),v=proposalVoteCounts(p.id),mine=proposalVotes.find(x=>x.proposal_id===p.id&&x.user_id===me.id);return `<div class="card pad section" style="border-color:#dfd4f7;background:#fbf9ff"><div class="challengeTop"><span class="pill">📌 Challenge-Vorschlag</span><span class="tiny muted">${v.total}/${allApprovedUsers().length} Stimmen</span></div><h3>${escapeHtml(p.emoji)} ${escapeHtml(p.name)}</h3><div class="small muted">${escapeHtml(p.description)}</div><div class="tiny muted" style="margin-top:6px">von ${escapeHtml(firstName(who))} · ${escapeHtml(p.challenge_type)}${p.challenge_type==='daily'&&p.daily_target_mode==='group_other'?' · 👥 Gruppenbezug':''} · +${p.points} P</div><div class="reactions"><button class="react ${mine?.vote===true?'active':''}" onclick="voteProposal('${p.id}',true)">👍 ${v.yes}</button><button class="react ${mine?.vote===false?'active':''}" onclick="voteProposal('${p.id}',false)">👎 ${v.no}</button></div>${v.total>=allApprovedUsers().length?'<div class="notice small" style="margin-top:8px">Alle haben abgestimmt – wartet auf Admin-Entscheidung.</div>':''}</div>`}).join('')}

async function recordChallengeCompletion(kind,challengeId,title,emoji,points,periodKey){
 if(challengeCompletions.some(x=>x.user_id===me.id&&x.challenge_kind===kind&&x.period_key===periodKey&&x.challenge_ref===String(challengeId)))return;
 let {data,error}=await sb.from('challenge_completions').insert({user_id:me.id,challenge_kind:kind,challenge_ref:String(challengeId),title,emoji,points:+points||0,period_key:periodKey}).select().single();
 if(!error&&data){challengeCompletions.push(data);openPostChallengeRating(challengeId,title)}
}

async function todayOwnEntriesHTML(){
 let list=entries.filter(e=>e.user_id===me.id&&e.entry_date===fmtDate());
 let daily=dailyCompletions.filter(d=>d.user_id===me.id&&d.challenge_date===fmtDate());
 if(!list.length&&!daily.length)return `<div class="card pad muted">Heute noch keine Einträge.</div>`;
 let out='';
 for(let e of list){
  let label=e.kind==='steps'
   ?`👟 ${(+e.steps||0).toLocaleString('de-DE')} Schritte`
   :e.kind==='food'
    ?`🥗 Ernährung · ${(e.food_items||[]).length}/7 Ziele`
    :`${ACTIVITIES[e.activity]?.icon||'⚡'} ${ACTIVITIES[e.activity]?.name||'Aktivität'} · ${e.minutes||0} Min.${e.distance?` · ${e.distance} km`:''}`;
  out+=`<div class="card pad"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b>${label}</b><div class="tiny muted">+${e.points} P</div></div>${entryEditControls(e)}</div></div>`
 }
 for(let d of daily){
  let c=challengePool.find(x=>x.id===d.challenge_pool_id);
  out+=`<div class="card pad"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b>${escapeHtml(c?.emoji||'☀️')} ${escapeHtml(c?.name||'Tageschallenge')}</b><div class="tiny muted">+1 P${d.photo_path?' · 📸 Foto':''} · „${escapeHtml(d.completion_text)}“</div></div><button class="react danger" onclick="undoDailyCompletion('${d.id}')">↩ Zurücknehmen</button></div></div>`
 }
 return out
}

async function undoDailyCompletion(id){
 let d=dailyCompletions.find(x=>x.id===id);
 if(!d||d.user_id!==me.id)return toast('Dieser Eintrag gehört nicht dir.');
 if(!d.challenge_date.startsWith(monthKey()))return toast('Vergangene Monate können nicht geändert werden.');
 if(!confirm('Tageschallenge wirklich zurücknehmen? Der +1 Punkt, Feed-Eintrag und ggf. das Foto werden entfernt.'))return;
 let cc=challengeCompletions.filter(x=>x.user_id===me.id&&x.challenge_kind==='daily'&&x.period_key===d.challenge_date);
 if(cc.length){
  let {data,error}=await sb.from('challenge_completions').delete().in('id',cc.map(x=>x.id)).select('id');
  if(error)return toast('Challenge-Abschluss konnte nicht entfernt werden: '+error.message);
  if((data||[]).length!==cc.length)return toast('Challenge-Abschluss wurde nicht vollständig gelöscht.');
 }
 let {data,error}=await sb.from('daily_challenge_completions').delete().eq('id',id).eq('user_id',me.id).select('id');
 if(error)return toast('Tageschallenge konnte nicht zurückgenommen werden: '+error.message);
 if(!data?.length)return toast('Tageschallenge wurde von der Datenbank nicht gelöscht.');
 if(d.photo_path){let rm=await sb.storage.from('proofs').remove([d.photo_path]);if(rm.error)console.warn('Tageschallenge-Foto konnte nicht entfernt werden:',rm.error)}
 await loadData();await render();toast('Tageschallenge zurückgenommen ✓');
}

async function voteProposal(id,vote){let old=proposalVotes.find(x=>x.proposal_id===id&&x.user_id===me.id),q=old?sb.from('challenge_proposal_votes').update({vote}).eq('proposal_id',id).eq('user_id',me.id):sb.from('challenge_proposal_votes').insert({proposal_id:id,user_id:me.id,vote});let {error}=await q;if(error)return toast(error.message);await loadData();await render()}

function groupChallengeValueMonth(mk){
 let ch=groupChallengeForPeriod(mk),from=mk+'-01',to=mk+'-31',es=entries.filter(e=>e.entry_date>=from&&e.entry_date<=to);
 if(ch.kind==='steps')return es.filter(e=>e.kind==='steps').reduce((s,e)=>s+(+e.steps||0),0);
 if(ch.kind==='minutes')return es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.minutes||0),0);
 if(ch.kind==='outdoor')return es.filter(e=>e.kind==='activity'&&['walk','hike'].includes(e.activity)).length;
 if(ch.kind==='distance')return es.filter(e=>e.kind==='activity').reduce((s,e)=>s+(+e.distance||0),0);
 if(ch.kind==='healthy')return es.filter(e=>e.kind==='food'&&(e.food_items||[]).length>=5).length;
 if(ch.kind==='activities')return es.filter(e=>e.kind==='activity').length;
 return 0
}

function groupChallengeHTML(){let ch=groupChallengeForPeriod(monthKey()),v=groupChallengeValueMonth(monthKey());return `<div class="progress"><i style="width:${Math.min(100,v/ch.target*100)}%"></i></div>`}

async function homeHTML(){let pts=monthPoints(),st=streak();return `<div class="homeHead"><div><small>FIT4US · ${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})}</small><h1>Hallo ${escapeHtml(firstName(me))} 👋</h1></div><div><b>${pts} P</b><span>🔥 ${st} Tage</span></div></div>${todaySummary()}${todayEnoughHTML()}${outboxHTML()}${pendingWitnessHTML()}<div class="sectionTitle"><h2>Deine Aufgaben</h2><button class="react" onclick="go('challenges')">Alle Challenges</button></div><div class="card pad">${taskSummary()}</div>${almostThereHTML()}${quickTemplatesHTML()}<div class="sectionTitle"><h2>Deine Punkte</h2></div>${rewardsOverviewHTML()}<details class="card pad section"><summary><b>📝 Meine heutigen Einträge bearbeiten</b></summary><div class="section">${await todayOwnEntriesHTML()}</div></details><div class="quickAdd"><button class="cta" onclick="openEntry()">＋ Eintrag hinzufügen</button></div>${await pinnedProposalsHTML()}${rewardProposalFeedHTML()}<div class="sectionTitle"><h2>Diese Woche</h2><button class="react" onclick="go('group')">Zur Gruppe</button></div><div class="card pad">${await rankingHTML(currentWeekEntries())}</div><div class="sectionTitle"><h2>Feed</h2><span class="pill">Crew</span></div><div class="grid">${await feedHTML(35)}</div>`}
async function groupHTML(){let d=startOfWeek();d.setDate(d.getDate()-7);let wk=weekKey(d),c=weekChamp(wk);return `<h1>Gruppe</h1>${crewMomentHTML()}${c?`<div class="weekRecap section"><div><small>🏆 LETZTER WOCHENABSCHLUSS</small><h2>${escapeHtml(firstName(c.p))} gewinnt mit ${c.pts} P</h2><p>KW ${isoWeek(d)}</p></div><span>👑</span></div>`:''}${await pinnedProposalsHTML()}${rewardProposalFeedHTML()}<div class="grid grid2 section"><div><h2>Wochenranking</h2><div class="card pad">${await rankingHTML(currentWeekEntries())}</div></div><div><h2>Monatsranking</h2><div class="card pad">${await rankingHTML(currentMonthEntries())}</div></div></div><h2 class="section">Feed</h2><div class="grid">${await feedHTML(100)}</div>`}
function feedDateTime(item){
 let date=item?.created_at?new Date(item.created_at):null;
 if(date&&!Number.isNaN(date.getTime())){
  return date.toLocaleDateString('de-DE')+' · '+date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
 }
 return item?.entry_date?new Date(item.entry_date+'T12:00:00').toLocaleDateString('de-DE'):'';
}
async function feedHTML(limit=99){
 let items=[
  ...entries.filter(e=>(e.kind==='activity'&&feedAllowed(e.user_id,'activity'))||(e.kind==='food'&&feedAllowed(e.user_id,'food'))||(e.kind==='steps'&&feedAllowed(e.user_id,'steps'))).map(e=>({type:'entry',date:e.created_at||e.entry_date,obj:e})),
  ...dailyCompletions.filter(d=>feedAllowed(d.user_id,'daily')).map(d=>({type:'daily',date:d.created_at,obj:d})),
  ...challengeCompletions.filter(x=>x.challenge_kind!=='daily').map(c=>({type:'challenge',date:c.created_at,obj:c})),
  ...achievements.filter(a=>feedAllowed(a.user_id,'achievement')).map(a=>({type:'achievement',date:a.created_at||a.achieved_on,obj:a}))
 ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,limit);
 if(!items.length)return `<div class="card pad muted">Noch keine Feed-Einträge.</div>`;
 let out='';
 for(let item of items){
  if(item.type==='achievement'){let a=item.obj,p=profileById(a.user_id),av=await avatarHTML(p);out+=`<article class="card feedItem specialFeed achievementFeed"><div class="feedHead">${av}<div><b>${escapeHtml(firstName(p))}</b><div class="tiny muted">Achievement · ${new Date(a.achieved_on+'T12:00').toLocaleDateString('de-DE')}</div></div></div><div class="feedText"><b>${escapeHtml(a.emoji)} ${escapeHtml(a.title)}</b></div>${commentsHTML('achievement',a.id,a.user_id)}</article>`;continue}
  if(item.type==='challenge'){let c=item.obj,p=profileById(c.user_id),av=await avatarHTML(p);out+=`<article class="card feedItem specialFeed challengeFeed"><div class="feedHead">${av}<div><b>${escapeHtml(firstName(p))}</b><div class="tiny muted">Challenge geschafft · ${new Date(c.created_at).toLocaleDateString('de-DE')}</div></div><span class="points" style="margin-left:auto">+${c.points} P</span></div><div class="feedText"><b>${escapeHtml(c.emoji||'🎯')} ${escapeHtml(c.title)}</b><div class="small muted">${c.challenge_kind==='group'?'Gemeinsame Monatschallenge erfüllt 🎉':'Persönliche Wochenchallenge erfüllt 🎉'}</div></div>${commentsHTML('challenge',c.id,c.user_id)}</article>`;continue}
  if(item.type==='daily'){
   let d=item.obj,p=profileById(d.user_id),av=await avatarHTML(p),c=challengePool.find(x=>x.id===d.challenge_pool_id),
       target=d.target_user_id?profileById(d.target_user_id):null,desc=dailyTemplateText(c?.description||'',target),
       photo=d.photo_path?await signed('proofs',d.photo_path):null;
   out+=`<article class="card feedItem dailyFeed"><div class="feedHead">${av}<div><b>${escapeHtml(firstName(p))}</b><div class="tiny muted">${new Date(d.challenge_date+'T12:00').toLocaleDateString('de-DE')} · Tageschallenge</div></div><span class="points" style="margin-left:auto">+1 P</span></div><div class="feedText"><b>${escapeHtml(c?.emoji||'☀️')} ${escapeHtml(dailyTemplateText(c?.name||'Tageschallenge',target))}</b><div class="muted small">${escapeHtml(desc)}</div>${target?`<div class="tiny muted">👥 Bezug: ${escapeHtml(firstName(target))}</div>`:''}<blockquote>„${escapeHtml(d.completion_text)}“</blockquote></div>${photo?`<img class="feedPhoto" src="${photo}" alt="Foto zur Tageschallenge">`:''}${d.user_id===me.id&&d.challenge_date.startsWith(monthKey())?`<div class="entryActions"><button class="react danger" onclick="undoDailyCompletion('${d.id}')">↩ Zurücknehmen</button></div>`:''}${commentsHTML('daily',d.id,d.user_id)}</article>`;
   continue
  }
  let e=item.obj,p=profileById(e.user_id),av=await avatarHTML(p),photo=e.photo_path?await signed('proofs',e.photo_path):null,react={};reactions.filter(r=>r.entry_id===e.id).forEach(r=>{react[r.emoji]=(react[r.emoji]||[]).concat(r.user_id)});let content='';
  if(e.kind==='food'){let selected=(e.food_items||[]).map(id=>FOOD.find(f=>f.id===id)).filter(Boolean);content=`🥗 <b>Ernährungs-Check-in</b> · ${selected.length}/${FOOD.length} Ziele${selected.length?`<div class="foodFeedGoals">${selected.map(f=>`<span class="foodGoalChip">${f.icon} ${escapeHtml(f.title)}</span>`).join('')}</div>`:''}`}
  else if(e.kind==='steps')content=`👟 <b>${(+e.steps||0).toLocaleString('de-DE')} Schritte</b>`;
  else content=`${ACTIVITIES[e.activity]?.icon||'⚡'} <b>${escapeHtml(ACTIVITIES[e.activity]?.name||'Aktivität')}</b> · ${e.minutes||0} Min.${e.distance?` · ${e.distance} km`:''}`;
  out+=`<article class="card feedItem"><div class="feedHead">${av}<div><b>${escapeHtml(firstName(p))}</b><div class="tiny muted">${feedDateTime(e)}</div></div><span class="points" style="margin-left:auto">+${e.points} P</span></div><div class="feedText">${content}${e.kind==='activity'?`<div class="sectionTiny">${witnessBadge(e)}</div>`:''}</div>${photo?`<img class="feedPhoto" src="${photo}">`:''}${entryEditControls(e)}<div class="reactions">${['👏','🔥','💪','❤️'].map(x=>`<button class="react ${react[x]?.includes(me.id)?'active':''}" onclick="toggleReaction('${e.id}','${x}')">${x} ${react[x]?.length||0}</button>`).join('')}</div>${commentsHTML('entry',e.id,e.user_id)}</article>`
 }
 return out
}
async function toggleReaction(entryId,emoji){
 let mine=reactions.find(r=>r.entry_id===entryId&&r.user_id===me.id&&r.emoji===emoji),res;
 if(mine)res=await sb.from('reactions').delete().eq('id',mine.id).eq('user_id',me.id).select('id');else res=await sb.from('reactions').insert({entry_id:entryId,user_id:me.id,emoji}).select('id');
 if(res.error)return toast('Reaktion konnte nicht gespeichert werden: '+res.error.message);if(!res.data?.length)return toast('Reaktion wurde von der Datenbank nicht geändert.');
 let e=entries.find(x=>x.id===entryId);if(!mine&&e&&e.user_id!==me.id&&prefFor(e.user_id).notify_reactions)notifyUser(e.user_id,`${firstName(me)} reagiert ${emoji}`,'Auf deinen Fit4Us-Eintrag.','reactions');await loadData();await render()
}

function lastWeek(){let s=startOfWeek();s.setDate(s.getDate()-7);let e=new Date(s);e.setDate(e.getDate()+6);return entries.filter(x=>x.entry_date>=fmtDate(s)&&x.entry_date<=fmtDate(e))}
function weeklyOptions(key=weekKey()){let seed=[...key].reduce((s,c)=>s+c.charCodeAt(0),0);return [0,1,2].map(i=>WEEKLY[(seed+i*2)%WEEKLY.length])}
function currentSelection(){return selectionForWeek(weekKey())}
function prevChampion(){let r=ranking(lastWeek());if(!r.length||r[0].pts===0)return null;return r[0].p}
function challengeProgress(ch,userId=me.id){return challengeProgressForWeek(ch,userId,weekKey())}
async function challengesHTML(){let sel=currentSelection(),ch=sel?WEEKLY.find(x=>x.id===sel.challenge_id):null,champ=prevChampion(),choose=(!sel&&champ?.id===me.id)||(!sel&&me.is_admin),gc=groupChallengeForPeriod(monthKey()),gv=groupChallengeValueMonth(monthKey()),gp=Math.min(100,gv/gc.target*100),dc=dailyChallengeFor(),done=dc&&dailyCompletions.some(x=>x.user_id===me.id&&x.challenge_date===fmtDate());let w=ch?challengeProgressForWeek(ch,me.id,weekKey()):[0,1],wp=Math.min(100,w[0]/w[1]*100),pick='';if(choose)pick=`<div class="sectionTitle"><h2>👑 Du darfst die nächste Challenge wählen</h2></div><div class="grid choiceGrid">${weeklyOptions().map(c=>`<button class="choice" onclick="chooseChallenge('${c.id}')"><b>${c.icon} ${c.title}</b><div class="tiny muted">${c.desc}</div></button>`).join('')}</div>`;return `<h1>Challenges</h1><div class="challengeCurrent">${dc?`<div class="nowCard daily"><small>☀️ HEUTE${dc.targetUser?` · FÜR ${escapeHtml(firstName(dc.targetUser)).toUpperCase()}`:''}</small><h2>${escapeHtml(dc.emoji)} ${escapeHtml(dc.name)}</h2><p>${escapeHtml(dc.description)}</p>${done?'<span class="chip">✓ Erledigt</span>':`<button class="cta" onclick="openDailyComplete()">Erledigt</button>`}</div>`:''}<div class="nowCard weekly"><small>🎯 DIESE WOCHE</small><h2>${ch?ch.icon+' '+ch.title:'Noch keine Challenge gewählt'}</h2>${ch?`<p>${ch.desc}</p><div class="progress"><i style="width:${wp}%"></i></div><b>${w[0]} / ${w[1]}</b>`:''}</div><div class="nowCard monthly"><small>👥 DIESEN MONAT</small><h2>${gc.icon} ${gc.title}</h2><p>${gc.desc}</p><div class="progress"><i style="width:${gp}%"></i></div><b>${Math.round(gp)} %</b></div></div>${pick}<div class="sectionTitle"><h2>Challenge-Pool</h2><button class="cta" onclick="openProposal()">＋ Neue Challenge</button></div><details class="card pad"><summary><b>📚 Alle verfügbaren Challenges (${challengePool.filter(poolAvailable).length})</b></summary><div class="section">${challengePoolHTML()}</div></details>`}
function challengePoolHTML(){return ['weekly','group','daily'].map(type=>{let title=type==='weekly'?'🎯 Wochenchallenges':type==='group'?'👥 Gruppen-Monatschallenges':'☀️ Tageschallenges',list=challengePool.filter(c=>c.challenge_type===type);return `<h3>${title}</h3><div class="grid grid2">${list.map(c=>{let r=ratings.filter(x=>x.challenge_pool_id===c.id),creator=profileById(c.created_by);return `<button class="choice ${!poolAvailable(c)?'disabled':''}" onclick="openChallengeDetail('${c.id}')"><div><b>${escapeHtml(c.emoji)} ${escapeHtml(c.name)}</b>${!poolAvailable(c)?' 🔒':''}${c.challenge_type==='daily'&&c.daily_target_mode==='group_other'?' 👥':''}</div><div class="tiny muted">${escapeHtml(dailyTemplateText(c.description,null))}</div><div class="tiny muted" style="margin-top:5px">+${c.points} P · 👍 ${r.filter(x=>x.rating==='again').length} · 😐 ${r.filter(x=>x.rating==='okay').length} · 👎 ${r.filter(x=>x.rating==='never').length}${creator?` · von ${escapeHtml(firstName(creator))}`:''}</div></button>`}).join('')}</div>`}).join('')}
function openChallengeDetail(id){let c=challengePool.find(x=>x.id===id),r=ratings.filter(x=>x.challenge_pool_id===id),creator=profileById(c.created_by),poolDesc=dailyTemplateText(c.description,null);$('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>${escapeHtml(c.emoji)} ${escapeHtml(c.name)}</h2><button class="x" onclick="closeModal()">×</button></div><p>${escapeHtml(poolDesc)}</p><div class="notice"><b>Typ:</b> ${escapeHtml(c.challenge_type)}<br><b>Punkte:</b> +${c.points}${c.challenge_type==='daily'&&c.daily_target_mode==='group_other'?'<br><b>Gruppenbezug:</b> Fit4Us lost täglich eine andere Person aus.':''}${c.target_value?`<br><b>Ziel:</b> ${c.target_value} ${escapeHtml(c.target_unit||'')}`:''}${creator?`<br><b>Vorgeschlagen von:</b> ${escapeHtml(firstName(creator))}`:''}</div><div class="section"><b>Bewertungen nach Durchführung</b><div class="reactions"><span class="react">👍 ${r.filter(x=>x.rating==='again').length}</span><span class="react">😐 ${r.filter(x=>x.rating==='okay').length}</span><span class="react">👎 ${r.filter(x=>x.rating==='never').length}</span></div></div><div class="section"><b>Wie fandest du diese Challenge?</b><div class="reactions"><button class="react" onclick="rateChallenge('${c.id}','again')">👍 Gerne wieder</button><button class="react" onclick="rateChallenge('${c.id}','okay')">😐 War okay</button><button class="react" onclick="rateChallenge('${c.id}','never')">👎 Nicht nochmal</button></div></div>${me.is_admin?`<div class="section"><b>Admin</b><div class="uploadBtns"><button class="secondary" onclick="adminSuspendChallenge('${c.id}')">⏸ Sperren</button>${!poolAvailable(c)?`<button class="secondary" onclick="adminUnsuspendChallenge('${c.id}')">▶ Entsperren</button>`:''}<button class="secondary danger" onclick="adminDeleteChallenge('${c.id}')">🗑 Entfernen</button></div></div>`:''}</div></div>`}
async function rateChallenge(id,rating){let old=ratings.find(x=>x.challenge_pool_id===id&&x.user_id===me.id&&x.week_key===weekKey()),payload={challenge_pool_id:id,user_id:me.id,week_key:weekKey(),rating},q=old?sb.from('challenge_ratings').update({rating}).eq('id',old.id):sb.from('challenge_ratings').insert(payload),{error}=await q;if(error)return toast(error.message);closeModal();await loadData();await render();toast('Bewertung gespeichert')}
function openProposal(){
 $('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>Neue Challenge vorschlagen</h2><button class="x" onclick="closeModal()">×</button></div><form class="form section" onsubmit="submitProposal(event)">
 <div class="field"><label>Typ</label><select id="prType" onchange="proposalTypeChanged()"><option value="weekly">Wochenchallenge</option><option value="group">Gruppen-Challenge</option><option value="daily">Tageschallenge</option></select></div>
 <div class="field hidden" id="prDailyModeWrap"><label>Art der Tageschallenge</label><select id="prDailyMode"><option value="general">Allgemein</option><option value="group_other">Bezieht sich auf eine andere Person der Gruppe</option></select><div class="tiny muted">Bei Gruppenbezug lost Fit4Us täglich automatisch eine andere Person aus. Die Aufgabe sollte deshalb auch per Nachricht, Anruf oder aus der Ferne machbar sein. Nutze in der Beschreibung <b>{person}</b> als Platzhalter.</div></div>
 <div class="field"><label>Name</label><input id="prName" required maxlength="60"></div>
 <div class="field"><label>Emoji</label><input id="prEmoji" required maxlength="8" value="🎯"></div>
 <div class="field"><label>Beschreibung</label><textarea id="prDesc" rows="4" required maxlength="400" style="width:100%;border:1px solid #dbe4eb;border-radius:13px;padding:12px"></textarea></div>
 <div class="field"><label>Punkte</label><input id="prPoints" type="number" min="1" max="50" value="10" required></div>
 <button class="cta">Vorschlag zur Abstimmung stellen</button></form></div></div>`;
 proposalTypeChanged();
}
function proposalTypeChanged(){
 let wrap=$('#prDailyModeWrap');if(!wrap)return;
 wrap.classList.toggle('hidden',$('#prType')?.value!=='daily');
}
async function submitProposal(e){
 e.preventDefault();
 let type=$('#prType').value;
 let payload={
  proposer_id:me.id,
  challenge_type:type,
  name:$('#prName').value.trim(),
  emoji:$('#prEmoji').value.trim(),
  description:$('#prDesc').value.trim(),
  points:+$('#prPoints').value,
  daily_target_mode:type==='daily'?($('#prDailyMode')?.value||'general'):'general'
 };
 let {data,error}=await sb.from('challenge_proposals').insert(payload).select().single();
 if(error)return toast(error.message);
 let vote=await sb.from('challenge_proposal_votes').insert({proposal_id:data.id,user_id:me.id,vote:true});
 if(vote.error)return toast('Vorschlag gespeichert, aber Stimme fehlgeschlagen: '+vote.error.message);
 closeModal();await loadData();await render();toast('Vorschlag ist jetzt im Feed angepinnt 📌')
}
function trend4(id){let ws=[];for(let i=3;i>=0;i--){let d=startOfWeek();d.setDate(d.getDate()-i*7);let es=entriesForWeek(weekKey(d)).filter(e=>e.user_id===id);ws.push({d,pts:pointsOf(id,es)})}let mx=Math.max(1,...ws.map(x=>x.pts));return `<div class="card pad section"><h3>📈 Deine letzten 4 Wochen</h3><div class="trend">${ws.map(x=>`<div><i style="height:${Math.max(5,x.pts/mx*64)}px"></i><b>${x.pts}</b><small>KW${isoWeek(x.d)}</small></div>`).join('')}</div></div>`}async function meHTML(){
 let ws=startOfWeek(),we=endOfWeek(),prevS=new Date(ws);prevS.setDate(prevS.getDate()-7);let prevE=new Date(we);prevE.setDate(prevE.getDate()-7);
 let a=statsFor(me.id,fmtDate(ws),fmtDate(we)),b=statsFor(me.id,fmtDate(prevS),fmtDate(prevE)),av=await avatarHTML(me,88),pts=monthPoints(),rewards=MILESTONES.filter(m=>pts>=m);
 return `<h1>Mein Profil</h1><div class="grid grid2"><div><div class="card statBig">${av}<h2>${escapeHtml(me.first_name)} ${escapeHtml(me.last_name)}</h2><div class="muted">@${escapeHtml(me.username)}</div><strong>${pts} P</strong><div class="muted">diesen Monat</div>${bonusSummary(me.id,currentMonthEntries())}<button class="secondary section" onclick="openProfile()">Profil bearbeiten</button></div><div class="card pad section"><h3>Diese Woche vs. Vorwoche</h3>${compareRow('👟 Schritte',a.steps,b.steps)}${compareRow('⏱️ Aktivminuten',a.minutes,b.minutes)}${compareRow('🥗 Ernährungstage',a.foodDays,b.foodDays)}${compareRow('⭐ Punkte',a.points,b.points)}</div>${trend4(me.id)}${weeklyReviewHTML()}</div><div><div class="card pad"><div class="challengeTop"><h3>🔥 Dein Streak</h3><span class="pill">Rekord ${maxStreakEver()} Tage</span></div><div class="big">${streak()} Tage</div><div class="muted">${(()=>{let n=streakNext(streak());return `Noch ${Math.max(0,n[0]-streak())} aktive Tage bis +${n[1]} Bonuspunkte`;})()}</div><div class="section">${streakHeatmapHTML()}</div></div><div class="card pad section"><h3>🏅 Persönliche Rekorde</h3>${personalRecordsHTML()}</div><div class="card pad section"><h3>🎁 Meine offenen Belohnungen</h3>${rewards.length?rewards.map(m=>rewardMilestoneHTML(m)).join(''):'<div class="muted">Deine erste Belohnung wartet bei 50 Punkten.</div>'}${openRewardsInventoryHTML()}</div>${settingsHTML()}</div></div><h2 class="section">Achievements</h2><div class="card pad">${achievementHTML()}</div><h2 class="section">Monatsrückblick</h2>${monthlyReviewHTML()}<h2 class="section">Hall of Fame</h2>${hallOfFameHTML()}<h2 class="section">Meine Einträge – aktueller Monat</h2><div class="grid">${await ownEntriesHTML()}</div>`
}

function achievementHTML(){let list=achievements.filter(a=>a.user_id===me.id);if(!list.length)return '<div class="muted">Noch keine Achievements.</div>';return `<div class="grid grid2">${list.map(a=>`<div class="choice"><b>${escapeHtml(a.emoji)} ${escapeHtml(a.title)}</b><div class="tiny muted">Erreicht am ${new Date(a.achieved_on+'T12:00').toLocaleDateString('de-DE')}</div></div>`).join('')}</div>`}
function monthlyReviewHTML(){let mk=monthKey(),d=monthlyReviewData(me.id,mk),prevD=new Date(mk+'-01T12:00');prevD.setMonth(prevD.getMonth()-1);let p=monthlyReviewData(me.id,monthKey(prevD)),diff=p.pts?Math.round((d.pts-p.pts)/p.pts*100):null;return `<div class="card monthHero"><div class="heroRow"><div><div class="muted small">${new Date(mk+'-01T12:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</div><div class="big">${d.pts} P</div></div>${diff!==null?`<span class="chip">${diff>=0?'↑':'↓'} ${Math.abs(diff)} % zum Vormonat</span>`:''}</div><div class="grid kpis section"><div class="kpi"><b>${d.steps.toLocaleString('de-DE')}</b><div class="tiny muted">Schritte</div></div><div class="kpi"><b>${d.minutes}</b><div class="tiny muted">Aktivminuten</div></div><div class="kpi"><b>${d.distance.toFixed(1)}</b><div class="tiny muted">km</div></div></div><div class="small muted">Schritt-Rekord: <b>${d.maxSteps.toLocaleString('de-DE')}</b> · Ernährungstage: <b>${d.foodDays}</b></div></div>`}
function hallOfFameHTML(){
 let h=hallOfFame(monthKey());
 if(!h.champ&&!h.steps&&!h.streak&&!h.healthy&&!h.outdoor&&!h.social)return '<div class="card pad muted">Die Hall of Fame erscheint, sobald in diesem Monat echte Leistungen vorhanden sind.</div>';
 let row=(em,title,x)=>x?`<div class="rankRow"><span>${em}</span><b>${title}</b><b>${escapeHtml(firstName(x.p))}</b></div>`:'';
 return `<div class="card pad">${row('👑','Monatschampion',h.champ)}${row('👟','Schrittmonster',h.steps)}${row('🔥','Streak-Master',h.streak)}${row('🥗','Healthy Hero',h.healthy)}${row('🌤️','Outdoor-König',h.outdoor)}${row('❤️','Social Hero',h.social)}</div>`
}
function compareRow(label,a,b){let diff=a-b,sign=diff>0?'↑':diff<0?'↓':'→';return `<div class="barRow"><span>${label}</span><div class="progress"><i style="width:${Math.min(100,(a/(Math.max(a,b,1)))*100)}%"></i></div><b>${sign} ${Math.abs(diff).toLocaleString('de-DE')}</b></div>`}
function openRewardChoices(){
 return rewardChoices.filter(r=>r.user_id===me.id&&!r.redeemed_at).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')))
}
function rewardName(key){return rewardPool.find(x=>x.id===key||x.reward_key===key)?.name||REWARDS.find(x=>x.key===key)?.name||key}
function rewardsOverviewHTML(){
 let pts=monthPoints(),next=MILESTONES.find(m=>m>pts),open=openRewardChoices();
 if(!next){
  return `<div class="rewardOverview"><div class="rewardNextHead"><div><div class="tiny muted">🎁 Belohnungen</div><b>Alle Punkteziele dieses Monats erreicht!</b></div><span class="rewardBig">🎉</span></div>${open.length?`<div class="notice small" style="margin-top:10px"><b>${open.length} offene Belohnung${open.length===1?'':'en'}</b> – bleiben erhalten, bis du sie einlöst.</div>`:''}<button class="react" style="margin-top:10px" onclick="go('rules')">Alle Belohnungen ansehen</button></div>`
 }
 let opts=rewardOptions(next),remaining=Math.max(0,next-pts);
 return `<div class="rewardOverview">
   <div class="rewardNextHead"><div><div class="tiny muted">🎁 Nächste Belohnung bei ${next} Punkten</div><b>Noch ${remaining} Punkt${remaining===1?'':'e'}</b></div><span class="rewardBig">🎁</span></div>
   <div class="rewardChoicePreview">${opts.map(r=>`<div class="rewardPreviewItem"><b>${escapeHtml(r.name)}</b><div class="tiny muted">${escapeHtml(r.desc)}</div></div>`).join('')}</div>
   <div class="tiny muted" style="margin-top:8px">Beim Erreichen von ${next} P wählst du eine dieser drei Belohnungen.</div>
   ${open.length?`<div class="notice small" style="margin-top:10px"><b>${open.length} offene Belohnung${open.length===1?'':'en'}</b> – bleiben monatsübergreifend erhalten.</div>`:''}
   <button class="react" style="margin-top:10px" onclick="go('rules')">Alle Belohnungen ansehen</button>
 </div>`
}
function allRewardMilestonesHTML(){
 return `<div class="grid">${MILESTONES.map(m=>{
   let opts=rewardOptions(m),unlocked=monthPoints()>=m;
   return `<div class="card pad rewardMilestoneCard ${unlocked?'rewardUnlocked':''}">
     <div class="challengeTop"><div><span class="pill">${unlocked?'✓ Freigeschaltet':'🎁 Punkte-Ziel'}</span><h3 style="margin:8px 0 0">${m} Punkte</h3></div><b class="points">${unlocked?'erreicht':''}</b></div>
     <div class="rewardChoicePreview section">${opts.map(r=>`<div class="rewardPreviewItem"><b>${escapeHtml(r.name)}</b><div class="tiny muted">${escapeHtml(r.desc)}</div></div>`).join('')}</div>
   </div>`
 }).join('')}</div>`
}

function openRewardsInventoryHTML(){
 let open=openRewardChoices();
 if(!open.length)return '';
 return `<div class="section"><b>Offene Belohnungen – monatsübergreifend</b>${open.map(r=>`<div class="reward"><span>${escapeHtml(rewardName(r.reward_key))}</span><div class="tiny muted">${r.month_key||''} · ${r.milestone} P</div><button class="react" onclick="redeemReward('${r.id}')">Einlösen</button></div>`).join('')}</div>`
}
function rewardMilestoneHTML(m){let got=rewardChoices.find(r=>r.user_id===me.id&&r.month_key===monthKey()&&r.milestone===m);return `<div class="reward" style="border-top:1px solid #edf1f4"><b>${m} P</b> ${got?`· ${escapeHtml(REWARDS.find(x=>x.key===got.reward_key)?.name||got.reward_key)} ${got.redeemed_at?'✓ eingelöst':`<button class="react" onclick="redeemReward('${got.id}')">Einlösen</button>`}`:`<button class="react" onclick="openReward(${m})">Belohnung wählen</button>`}</div>`}
async function redeemReward(id){
 let {data,error}=await sb.from('reward_choices').update({redeemed_at:new Date().toISOString()}).eq('id',id).eq('user_id',me.id).select('id');
 if(error)return toast('Belohnung konnte nicht eingelöst werden: '+error.message);
 if(!data?.length)return toast('Belohnung wurde von der Datenbank nicht geändert.');
 await loadData();await render();toast('Belohnung eingelöst ✓')
}
async function ownEntriesHTML(){
 let list=currentMonthEntries().filter(own);
 let daily=dailyCompletions.filter(d=>d.user_id===me.id&&d.challenge_date.startsWith(monthKey()));
 if(!list.length&&!daily.length)return '<div class="card pad muted">Noch keine Einträge in diesem Monat.</div>';
 let rows=list.map(e=>`<div class="card pad"><div style="display:flex;justify-content:space-between;gap:12px"><div><b>${entryLabel(e)}</b><div class="tiny muted">${feedDateTime(e)} · +${e.points} P</div></div>${entryEditControls(e)}</div></div>`);
 rows.push(...daily.map(d=>{let c=challengePool.find(x=>x.id===d.challenge_pool_id);return `<div class="card pad"><div style="display:flex;justify-content:space-between;gap:12px"><div><b>${escapeHtml(c?.emoji||'☀️')} ${escapeHtml(c?.name||'Tageschallenge')}</b><div class="tiny muted">${new Date(d.challenge_date+'T12:00').toLocaleDateString('de-DE')} · +1 P${d.photo_path?' · 📸 Foto':''} · „${escapeHtml(d.completion_text)}“</div></div><button class="react danger" onclick="undoDailyCompletion('${d.id}')">↩ Zurücknehmen</button></div></div>`}));
 return rows.join('')
}
function entryLabel(e){if(e.kind==='steps')return `👟 ${(+e.steps).toLocaleString('de-DE')} Schritte`;if(e.kind==='food')return `🥗 Ernährung ${(e.food_items||[]).length}/7`;if(e.kind==='activity')return `${ACTIVITIES[e.activity]?.icon||'⚡'} ${ACTIVITIES[e.activity]?.name||'Aktivität'} · ${e.minutes||0} Min.${e.distance?` · ${e.distance} km`:''}`;return 'Bonus'}
function canEdit(e){return own(e)&&e.entry_date.startsWith(monthKey())}
async function deleteEntry(id){
 let e=entries.find(x=>x.id===id);
 if(!e||!canEdit(e))return toast('Dieser Eintrag kann nicht mehr geändert werden.');
 if(!confirm('Eintrag wirklich löschen?'))return;
 let {data,error}=await sb.from('entries').delete().eq('id',id).eq('user_id',me.id).select('id');
 if(error)return toast('Eintrag konnte nicht gelöscht werden: '+error.message);
 if(!data?.length)return toast('Eintrag wurde von der Datenbank nicht gelöscht.');
 await loadData();await render();toast('Eintrag gelöscht ✓')
}
function editEntry(id){let e=entries.find(x=>x.id===id);if(!e||!canEdit(e))return toast('Dieser Eintrag kann nicht mehr geändert werden.');openEntry(e.kind,e)}


function rewardPoolVoteCounts(id){
 let v=rewardPoolVotes.filter(x=>x.reward_id===id);
 return {yes:v.filter(x=>x.vote===true).length,no:v.filter(x=>x.vote===false).length,total:v.length}
}
function myRewardPoolVote(id){return rewardPoolVotes.find(x=>x.reward_id===id&&x.user_id===me.id)}
async function voteRewardPool(id,vote){
 let old=myRewardPoolVote(id);
 let q=old
  ?sb.from('reward_pool_votes').update({vote,updated_at:new Date().toISOString()}).eq('reward_id',id).eq('user_id',me.id)
  :sb.from('reward_pool_votes').insert({reward_id:id,user_id:me.id,vote});
 let {error}=await q;if(error)return toast(error.message);
 await loadData();await render();toast(vote?'Belohnung positiv bewertet 👍':'Belohnung negativ bewertet 👎')
}
function rewardVoteCounts(id){
 let v=rewardProposalVotes.filter(x=>x.proposal_id===id);
 return {yes:v.filter(x=>x.vote===true).length,no:v.filter(x=>x.vote===false).length,total:v.length}
}
function rewardsRulesHTML(){
 let byPoints=[...new Set([...MILESTONES,...rewardPool.map(r=>+r.points_required)])].sort((a,b)=>a-b);
 let cards=byPoints.map(points=>{
  let list=rewardPool.filter(r=>+r.points_required===points);
  if(!list.length)list=REWARDS.slice(0,3).map((r,i)=>({...r,id:'legacy-'+points+'-'+i,active:true}));
  return `<div class="card pad"><div class="challengeTop"><h3>🎁 ${points} Punkte</h3><span class="pill">${list.filter(x=>x.active!==false).length} aktiv</span></div>
   <div class="grid">${list.map(r=>{
   let legacy=String(r.id).startsWith('legacy-'),v=legacy?{yes:0,no:0,total:0}:rewardPoolVoteCounts(r.id),mine=legacy?null:myRewardPoolVote(r.id);
   return `<div class="choice rewardPoolCard ${r.active===false?'disabled':''}"><button class="rewardCardMain" ${legacy?'':`onclick="openRewardDetail('${r.id}')"`}><b>${escapeHtml(r.name)}</b>${r.active===false?' 🔒':''}<div class="tiny muted">${escapeHtml(r.description||r.desc||'')}</div></button>${legacy?'':`<div class="rewardVotes"><button class="react ${mine?.vote===true?'active':''}" onclick="voteRewardPool('${r.id}',true)">👍 ${v.yes}</button><button class="react ${mine?.vote===false?'active':''}" onclick="voteRewardPool('${r.id}',false)">👎 ${v.no}</button><span class="tiny muted">${v.total}/${allApprovedUsers().length} bewertet</span></div>`}</div>`
  }).join('')}</div></div>`
 }).join('');
 return `<div class="sectionTitle"><h2>🎁 Alle Belohnungen</h2><button class="react" onclick="openRewardProposal()">＋ Belohnung vorschlagen</button></div>
 <div class="notice small">Jeder darf neue Belohnungen vorschlagen. Die Gruppe stimmt 👍/👎 ab; erst nach Admin-Freigabe landet eine Belohnung im Pool.</div>
 <div class="grid section">${cards}</div>`
}
function openRewardDetail(id){
 let r=rewardPool.find(x=>x.id===id);if(!r)return;
 $('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>🎁 ${escapeHtml(r.name)}</h2><button class="x" onclick="closeModal()">×</button></div><p>${escapeHtml(r.description||'')}</p>${(()=>{let v=rewardPoolVoteCounts(r.id),mine=myRewardPoolVote(r.id);return `<div class="notice"><b>Punkte:</b> ${r.points_required}<br><b>Status:</b> ${r.active?'Aktiv':'Deaktiviert'}<br><b>Gruppenmeinung:</b> 👍 ${v.yes} · 👎 ${v.no}</div><div class="reactions"><button class="react ${mine?.vote===true?'active':''}" onclick="voteRewardPool('${r.id}',true)">👍 Dafür</button><button class="react ${mine?.vote===false?'active':''}" onclick="voteRewardPool('${r.id}',false)">👎 Dagegen</button></div>`})()}${me.is_admin?`<div class="section"><b>Admin</b><div class="uploadBtns"><button class="secondary" onclick="toggleReward('${r.id}',${!r.active})">${r.active?'⏸ Deaktivieren':'▶ Aktivieren'}</button><button class="secondary danger" onclick="deleteReward('${r.id}')">🗑 Entfernen</button></div></div>`:''}</div></div>`
}
function openRewardProposal(){
 $('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>🎁 Neue Belohnung vorschlagen</h2><button class="x" onclick="closeModal()">×</button></div><form class="form section" onsubmit="submitRewardProposal(event)"><div class="field"><label>Name</label><input id="rpName" required maxlength="80"></div><div class="field"><label>Beschreibung</label><textarea id="rpDesc" rows="4" required maxlength="400"></textarea></div><div class="field"><label>Punkte-Ziel</label><select id="rpPoints">${MILESTONES.map(m=>`<option value="${m}">${m} Punkte</option>`).join('')}</select></div><button class="cta">Zur Abstimmung stellen</button></form></div></div>`
}
async function submitRewardProposal(e){
 e.preventDefault();
 let payload={proposer_id:me.id,name:$('#rpName').value.trim(),description:$('#rpDesc').value.trim(),points_required:+$('#rpPoints').value};
 let {data,error}=await sb.from('reward_proposals').insert(payload).select().single();if(error)return toast(error.message);
 let voteRes=await sb.from('reward_proposal_votes').insert({proposal_id:data.id,user_id:me.id,vote:true});if(voteRes.error)return toast('Vorschlag gespeichert, aber Start-Stimme fehlgeschlagen: '+voteRes.error.message);
 closeModal();await loadData();await render();toast('Belohnungsvorschlag zur Abstimmung gestellt 📌')
}
async function voteRewardProposal(id,vote){
 let old=rewardProposalVotes.find(x=>x.proposal_id===id&&x.user_id===me.id);
 let q=old?sb.from('reward_proposal_votes').update({vote}).eq('proposal_id',id).eq('user_id',me.id):sb.from('reward_proposal_votes').insert({proposal_id:id,user_id:me.id,vote});
 let {error}=await q;if(error)return toast(error.message);await loadData();await render()
}
async function decideRewardProposal(id,approve){
 let p=rewardProposals.find(x=>x.id===id);if(!p||!me.is_admin)return;
 if(approve){
  let {error}=await sb.from('reward_pool').insert({name:p.name,description:p.description,points_required:p.points_required,created_by:p.proposer_id,active:true});
  if(error)return toast(error.message)
 }
 let decision=await sb.from('reward_proposals').update({status:approve?'approved':'rejected',decided_by:me.id,decided_at:new Date().toISOString()}).eq('id',id).select('id');if(decision.error||!decision.data?.length)return toast('Entscheidung konnte nicht gespeichert werden: '+(decision.error?.message||'keine Zeile geändert'));
 await logAdmin(approve?'reward_proposal_approved':'reward_proposal_rejected',{proposal_id:id});
 await loadData();await render();toast(approve?'Belohnung genehmigt ✓':'Belohnung abgelehnt')
}
async function toggleReward(id,active){
 if(!me.is_admin)return;
 let {error}=await sb.from('reward_pool').update({active}).eq('id',id);if(error)return toast(error.message);
 await logAdmin(active?'reward_enabled':'reward_disabled',{reward_id:id});closeModal();await loadData();await render()
}
async function deleteReward(id){
 if(!me.is_admin||!confirm('Belohnung wirklich aus dem Pool entfernen? Bereits gewählte Belohnungen bleiben historisch erhalten.'))return;
 let {error}=await sb.from('reward_pool').delete().eq('id',id);if(error)return toast(error.message);
 await logAdmin('reward_deleted',{reward_id:id});closeModal();await loadData();await render()
}
function rewardProposalFeedHTML(){
 let list=rewardProposals.filter(p=>p.status==='voting');if(!list.length)return '';
 return `<div class="sectionTitle"><h2>📌 Belohnungsvorschläge</h2><span class="pill">Abstimmung</span></div>${list.map(p=>{let v=rewardVoteCounts(p.id),mine=rewardProposalVotes.find(x=>x.proposal_id===p.id&&x.user_id===me.id),who=profileById(p.proposer_id);return `<div class="card pad section"><h3>🎁 ${escapeHtml(p.name)}</h3><p class="small muted">${escapeHtml(p.description)}</p><div class="tiny muted">${p.points_required} P · vorgeschlagen von ${escapeHtml(firstName(who))} · 👍 ${v.yes} / 👎 ${v.no}</div><div class="reactions"><button class="react ${mine?.vote===true?'active':''}" onclick="voteRewardProposal('${p.id}',true)">👍 Dafür</button><button class="react ${mine?.vote===false?'active':''}" onclick="voteRewardProposal('${p.id}',false)">👎 Dagegen</button></div></div>`}).join('')}`
}
function rulesHTML(){return `<h1>Punkte & Regeln</h1><div class="card pad rulesIntro"><b>Transparentes Punktesystem</b><div class="small muted">Rankings enthalten Aktivitäts-, Schritt- und Ernährungspunkte sowie Challenge-, Gruppen-, Tageschallenge- und Streak-Boni. Punkte werden nie ausgegeben.</div></div><div class="grid grid2 section"><div class="card pad"><h3>👟 Schritte</h3><p>5.000 = 1 P · 7.500 = 2 P · 10.000 = 3 P · 12.500 = 4 P · 15.000 = 5 P · danach je weitere 5.000 = +1 P.</p></div><div class="card pad"><h3>🥗 Ernährung</h3>${FOOD.map(f=>`<p><b>${f.icon} ${f.title}</b><br><span class="muted small">${f.desc}</span> · +1 P</p>`).join('')}</div></div><h2 class="section">Aktivitäten</h2><div class="grid grid2">${Object.entries(ACTIVITIES).map(([k,a])=>`<div class="card pad"><b>${a.icon} ${a.name}</b><div class="muted small">${a.mode==='distance'?`${a.step} km = ${a.points} P`:`${a.step} Minuten = ${a.points} P`}${a.distance?' · Distanz kann erfasst werden':''}${['garden','house'].includes(k)?' · Haus-/Gartenarbeit zusammen max. 4 P pro Tag':''}</div></div>`).join('')}</div><h2 class="section">🔥 Streak-Boni</h2><div class="card pad">3 Tage +2 P · 5 Tage +3 P · 7 Tage +5 P · 14 Tage +10 P · 21 Tage +15 P · 30 Tage +25 P</div><h2 class="section">🎯 Challenge-Regeln</h2><div class="card pad"><p><b>Wochenchallenge:</b> Gewinner der Vorwoche wählt aus drei Vorschlägen. Aktive Challenges werden durch Updates nie verändert.</p><p><b>Gruppen-Challenge:</b> Eine gemeinsame Mission pro Monat, zufällig aus dem Pool gewählt und fest in der Datenbank gespeichert. Zielwerte basieren immer auf 28 Tagen. Erfolg standardmäßig +5 P für alle.</p><p><b>Tageschallenge:</b> Jeden Tag dieselbe zwischenmenschliche Challenge für alle. Freiwillig, +1 Sonderpunkt. Abschluss nur mit Freitext, der im Feed erscheint.</p><p><b>Eigene Vorschläge:</b> Jeder darf Challenges vorschlagen. Alle stimmen 👍/👎 ab, Admin entscheidet final.</p><p><b>Sperren:</b> Admin kann Challenges zeitweise oder unbegrenzt sperren/entsperren.</p><p><b>Bewertungen:</b> 👍 Gerne wieder, 😐 War okay oder 👎 Nicht nochmal. Ergebnis steht in der Pool-Übersicht.</p></div>${rewardsRulesHTML()}`}
function historyHTML(){let ms=completedMonths();if(!historyMonth||!ms.includes(historyMonth))historyMonth=ms[0]||null;return `<div class="historyTop"><div><small>FIT4US ARCHIV</small><h1>Historie</h1></div><div class="segmented"><button class="${historyMode==='month'?'active':''}" onclick="setHistoryMode('month')">Monat</button><button class="${historyMode==='all'?'active':''}" onclick="setHistoryMode('all')">Gesamt</button></div></div>${historyMode==='all'?allTimeView():ms.length?`<div class="monthNav"><button onclick="shiftHistory(-1)">‹</button><div><b>${monthLabel(historyMonth)}</b><select onchange="setHistoryMonth(this.value)">${ms.map(m=>`<option value="${m}" ${m===historyMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}</select></div><button onclick="shiftHistory(1)">›</button></div>${monthView(historyMonth)}`:'<div class="card pad muted">Nach dem ersten abgeschlossenen Monat erscheint hier automatisch der Monatsrückblick.</div>'}` }
async function adminHTML(){
 if(!me.is_admin)return '<div class="error">Kein Admin-Zugriff.</div>';
 let pending=profiles.filter(p=>!p.approved),active=profiles.filter(p=>p.approved);
 let pendingHtml=pending.length?pending.map(p=>`<div class="card pad" style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:14px;align-items:center"><div><b>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</b><div class="tiny muted">@${escapeHtml(p.username)}</div></div><button class="cta" onclick="setApproval('${p.id}',true)">✓ Freischalten</button></div></div>`).join(''):'<div class="muted">Keine offenen Registrierungen.</div>';
 let activeHtml=active.map(p=>`<div class="rankRow"><span>${p.is_admin?'🛡️':'👤'}</span><div><b>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</b><div class="tiny muted">@${escapeHtml(p.username)}</div></div><div>${p.is_admin?'<b>Admin</b>':`<button class="react danger" onclick="setApproval('${p.id}',false)">Zugriff sperren</button>`}</div></div>`).join('');
 let prop=proposals.filter(p=>p.status==='voting').map(p=>{let v=proposalVoteCounts(p.id),who=profileById(p.proposer_id);return `<div class="card pad section"><h3>${escapeHtml(p.emoji)} ${escapeHtml(p.name)}</h3><div class="small muted">${escapeHtml(p.description)}</div><div class="tiny muted">von ${escapeHtml(firstName(who))} · 👍 ${v.yes} / 👎 ${v.no} · ${v.total}/${active.length} abgestimmt</div><div class="uploadBtns" style="margin-top:10px"><button class="cta" onclick="decideProposal('${p.id}',true)">✓ Genehmigen</button><button class="secondary danger" onclick="decideProposal('${p.id}',false)">✕ Ablehnen</button></div></div>`}).join('')||'<div class="muted">Keine offenen Challenge-Vorschläge.</div>';
 let rewardProp=rewardProposals.filter(p=>p.status==='voting').map(p=>{let v=rewardVoteCounts(p.id),who=profileById(p.proposer_id);return `<div class="card pad section"><h3>🎁 ${escapeHtml(p.name)}</h3><div class="small muted">${escapeHtml(p.description)}</div><div class="tiny muted">${p.points_required} P · von ${escapeHtml(firstName(who))} · 👍 ${v.yes} / 👎 ${v.no} · ${v.total}/${active.length} abgestimmt</div><div class="uploadBtns" style="margin-top:10px"><button class="cta" onclick="decideRewardProposal('${p.id}',true)">✓ Genehmigen</button><button class="secondary danger" onclick="decideRewardProposal('${p.id}',false)">✕ Ablehnen</button></div></div>`}).join('')||'<div class="muted">Keine offenen Belohnungsvorschläge.</div>';
 let auditHtml=adminAudit.length?adminAudit.slice(0,50).map(a=>{let p=profileById(a.admin_user_id);return `<div class="rankRow"><span>🧾</span><div><b>${escapeHtml(a.action)}</b><div class="tiny muted">${new Date(a.created_at).toLocaleString('de-DE')} · ${escapeHtml(firstName(p))}</div></div><button class="react" onclick='alert(${JSON.stringify(JSON.stringify(a.details||{},null,2))})'>Details</button></div>`}).join(''):'<div class="muted">Noch keine Admin-Aktionen protokolliert.</div>';
 return `<h1>Admin</h1>
 <div class="notice"><b>🔐 Private Fit4Us-Gruppe</b></div>
 <div class="section"><h2>Offene Registrierungen ${pending.length?`(${pending.length})`:''}</h2>${pendingHtml}</div>
 <div class="section"><h2>Challenge-Vorschläge</h2>${prop}</div><div class="section"><h2>Belohnungsvorschläge</h2>${rewardProp}</div>
 <div class="card pad adminOnly section"><h3>Freigegebene Benutzer</h3>${activeHtml}</div>
 <div class="card pad section"><h3>💾 Backup & Restore</h3><div class="uploadBtns"><button class="cta" onclick="exportBackup()">Komplett-Backup herunterladen</button><button class="secondary" onclick="openRestoreDialog()">Backup wiederherstellen</button></div><div class="tiny muted" style="margin-top:8px">Backup enthält alle zentralen Fit4Us-Datenbanktabellen. Bilder in Supabase Storage werden derzeit nicht in die JSON-Datei eingebettet.</div></div>
 <div class="card pad section" style="border-color:#ffd4d4;background:#fffafa"><h3>⚠️ Daten zurücksetzen</h3><p class="small muted">Jeder Reset erstellt zuerst automatisch ein Komplett-Backup und verlangt eine eindeutige Bestätigung.</p><div class="grid"><button class="secondary" onclick="openResetDialog('test')">🧪 Testdaten zurücksetzen</button><button class="secondary" onclick="openResetDialog('season')">🏁 Saison-/Wettbewerbsdaten zurücksetzen</button><button class="secondary danger" onclick="openResetDialog('full')">☢ Kompletter Datenreset</button></div></div>
 <div class="card pad section"><h3>Datenbank</h3><div>Profile: ${active.length}</div><div>Einträge: ${entries.length}</div><div>Challenges im Pool: ${challengePool.length}</div><div>Offene Vorschläge: ${proposals.filter(p=>p.status==='voting').length}</div></div>
 <div class="card pad section"><h3>🧾 Admin-Auditlog</h3>${auditHtml}</div>`
}
async function logAdmin(action,details={}){
 if(!me?.is_admin)return;
 try{
  const {data,error}=await sb.from('admin_audit_log')
   .insert({admin_user_id:me.id,action,details})
   .select()
   .single();
  if(error){
   console.warn('Fit4Us Auditlog:',error);
   return;
  }
  if(data)adminAudit.unshift(data);
 }catch(err){
  console.warn('Fit4Us Auditlog:',err);
 }
}
async function buildBackup(){
 let tables=['profiles','entries','reactions','weekly_challenges','reward_choices','challenge_pool','challenge_proposals','challenge_proposal_votes','challenge_ratings','group_challenge_assignments','daily_challenge_assignments','daily_user_challenge_assignments','daily_challenge_completions','achievements','challenge_completions','admin_audit_log','reward_pool','reward_proposals','reward_proposal_votes','reward_pool_votes','feed_comments','witness_confirmations','user_preferences'],backup={format:'Fit4Us Backup',version:FIT4US_VERSION,created_at:new Date().toISOString(),tables:{}};
 for(let t of tables){let {data,error}=await sb.from(t).select('*');if(error)throw new Error('Backup-Fehler bei '+t+': '+error.message);backup.tables[t]=data||[]}
 return backup
}
function downloadBackupObject(backup,label='manual'){
 let blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`Fit4Us_Backup_${label}_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
async function exportBackup(){
 try{let backup=await buildBackup();downloadBackupObject(backup,'manual');await logAdmin('backup_exported',{tables:Object.keys(backup.tables)});toast('Backup erstellt ✓')}catch(err){toast(err.message)}
}
function openRestoreDialog(){
 $('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>📥 Backup wiederherstellen</h2><button class="x" onclick="closeModal()">×</button></div><div class="error small"><b>Achtung:</b> Restore verändert Daten in der zentralen Datenbank. Vorher wird automatisch ein aktuelles Backup heruntergeladen.</div><div class="field section"><label>Fit4Us-Backup (.json)</label><input id="restoreFile" type="file" accept=".json,application/json"></div><button class="cta" onclick="restoreBackup()">Backup prüfen & wiederherstellen</button></div></div>`
}
async function restoreBackup(){
 let f=$('#restoreFile')?.files?.[0];if(!f)return toast('Bitte Backup-Datei auswählen.');
 let data;try{data=JSON.parse(await f.text())}catch{return toast('Ungültige JSON-Datei.')}
 if(!data?.tables||!data?.format?.startsWith('Fit4Us Backup'))return toast('Kein gültiges Fit4Us-Backup.');
 let confirmText=prompt('Zur Wiederherstellung RESTORE eingeben:');if(confirmText!=='RESTORE')return toast('Wiederherstellung abgebrochen.');
 try{
  let current=await buildBackup();downloadBackupObject(current,'pre-restore');
  await logAdmin('restore_started',{source_version:data.version||'unknown'});
  let order=['feed_comments','witness_confirmations','challenge_completions','daily_challenge_completions','challenge_proposal_votes','challenge_ratings','reactions','reward_choices','entries','daily_user_challenge_assignments','daily_challenge_assignments','group_challenge_assignments','weekly_challenges','achievements','challenge_proposals','challenge_pool','user_preferences'];
  for(let t of order){if(data.tables[t]){await clearTable(t); if(data.tables[t].length){let {error}=await sb.from(t).insert(data.tables[t]);if(error)throw new Error(t+': '+error.message)}}}
  await logAdmin('restore_completed',{source_version:data.version||'unknown'});
  closeModal();await loadData();await render();toast('Restore abgeschlossen ✓')
 }catch(err){toast('Restore-Fehler: '+err.message)}
}
function openResetDialog(mode){
 const defs={
  test:{title:'Testdaten zurücksetzen',desc:'Löscht Aktivitäten, Schritte, Ernährung, Reaktionen, Challenge-Abschlüsse, Achievements, Belohnungen und Bewertungen. Accounts, Freischaltungen und Challenge-Pool bleiben erhalten.',word:'TESTRESET'},
  season:{title:'Saison-/Wettbewerbsdaten zurücksetzen',desc:'Löscht Nutzungs- und Wettbewerbsdaten inklusive laufender Challenge-Zuweisungen, behält Benutzerkonten und Challenge-Pool.',word:'SAISONRESET'},
  full:{title:'Kompletter Fit4Us-Datenreset',desc:'Löscht nahezu alle Fit4Us-Inhalte außer Benutzerkonten, Admin-/Freischaltungsstatus und der technischen Grundstruktur. Challenge-Pool wird auf Systemdaten reduziert.',word:'FULLRESET'}
 };
 let d=defs[mode];
 $('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>⚠️ ${d.title}</h2><button class="x" onclick="closeModal()">×</button></div><div class="error">${d.desc}<br><br><b>Vor dem Reset wird automatisch ein Komplett-Backup heruntergeladen.</b></div><div class="field section"><label>Zur Bestätigung exakt <b>${d.word}</b> eingeben</label><input id="resetConfirm"></div><button class="cta danger" onclick="executeReset('${mode}','${d.word}')">Backup erstellen & Reset ausführen</button></div></div>`
}
const TABLE_CLEAR_KEYS={
 profiles:['id','00000000-0000-0000-0000-000000000000'],
 entries:['id','00000000-0000-0000-0000-000000000000'],
 reactions:['id','00000000-0000-0000-0000-000000000000'],
 weekly_challenges:['week_key','__never__'],
 reward_choices:['id','00000000-0000-0000-0000-000000000000'],
 challenge_pool:['id','00000000-0000-0000-0000-000000000000'],
 challenge_proposals:['id','00000000-0000-0000-0000-000000000000'],
 challenge_proposal_votes:['proposal_id','00000000-0000-0000-0000-000000000000'],
 challenge_ratings:['id','00000000-0000-0000-0000-000000000000'],
 group_challenge_assignments:['week_key','__never__'],
 daily_challenge_assignments:['challenge_date','0001-01-01'],
 daily_user_challenge_assignments:['challenge_date','0001-01-01'],
 daily_challenge_completions:['id','00000000-0000-0000-0000-000000000000'],
 achievements:['id','00000000-0000-0000-0000-000000000000'],
 challenge_completions:['id','00000000-0000-0000-0000-000000000000'],
 admin_audit_log:['id','00000000-0000-0000-0000-000000000000']
};
async function clearTable(table){
 let cfg=TABLE_CLEAR_KEYS[table];
 if(!cfg)throw new Error('Keine Löschdefinition für '+table);
 let {error}=await sb.from(table).delete().neq(cfg[0],cfg[1]);
 if(error)throw new Error(table+': '+error.message);
}
async function deleteAll(table){return clearTable(table)}

async function executeReset(mode,word){
 if($('#resetConfirm').value!==word)return toast('Bestätigung stimmt nicht.');
 try{
  let backup=await buildBackup();downloadBackupObject(backup,'pre-reset-'+mode);
  await logAdmin('reset_started',{mode});
  if(mode==='test'){
   for(let t of ['challenge_completions','daily_challenge_completions','challenge_proposal_votes','challenge_ratings','feed_comments','witness_confirmations','reactions','reward_choices','entries','achievements'])await deleteAll(t);
  }
  if(mode==='season'){
   for(let t of ['challenge_completions','daily_challenge_completions','challenge_proposal_votes','challenge_ratings','feed_comments','witness_confirmations','reactions','reward_choices','entries','achievements','daily_user_challenge_assignments','daily_challenge_assignments','group_challenge_assignments','weekly_challenges'])await clearTable(t);
  }
  if(mode==='full'){
   for(let t of ['challenge_completions','daily_challenge_completions','challenge_proposal_votes','challenge_ratings','feed_comments','witness_confirmations','reactions','reward_choices','entries','achievements','daily_user_challenge_assignments','daily_challenge_assignments','group_challenge_assignments','weekly_challenges','challenge_proposals'])await clearTable(t);
   let {error}=await sb.from('challenge_pool').delete().eq('is_system',false);if(error)throw new Error('challenge_pool: '+error.message);
  }
  await logAdmin('reset_completed',{mode});
  closeModal();await loadData();await render();toast('Reset abgeschlossen ✓')
 }catch(err){toast('Reset-Fehler: '+err.message)}
}

async function decideProposal(id,approve){let note=prompt(approve?'Optionale Admin-Notiz zur Genehmigung:':'Optionale Begründung zur Ablehnung:')||null,{error}=await sb.rpc('admin_decide_proposal',{target_proposal:id,approve_it:approve,note_text:note});if(error)return toast(error.message);await logAdmin(approve?'challenge_proposal_approved':'challenge_proposal_rejected',{proposal_id:id});await loadData();await render();toast(approve?'Challenge genehmigt und dem Pool hinzugefügt':'Challenge abgelehnt')}
async function setApproval(userId,allow){
 if(!me.is_admin)return;
 let p=profiles.find(x=>x.id===userId);
 if(!confirm(allow?`${p?.first_name||'Benutzer'} wirklich freischalten?`:`Zugriff für ${p?.first_name||'Benutzer'} wirklich sperren?`))return;
 let {error}=await sb.rpc('admin_set_user_approval',{target_user:userId,allow_access:allow});
 if(error)return toast(error.message);
 await logAdmin(allow?'user_approved':'user_blocked',{target_user:userId});await loadData();await render();toast(allow?'Benutzer freigeschaltet ✓':'Zugriff gesperrt');
}

function openEntry(kind='activity',edit=null){
 $('#modalRoot').innerHTML=`<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modalCard"><div class="modalHead"><h2>${edit?'Eintrag bearbeiten':'Eintragen'}</h2><button class="x" onclick="closeModal()">×</button></div>${edit?entryForm(edit.kind,edit):`<div class="tabs"><button class="active" onclick="entryTab('activity',this)">Aktivität</button><button onclick="entryTab('steps',this)">Schritte</button></div><div style="display:grid;grid-template-columns:1fr"><button class="secondary" onclick="entryTab('food',this)">🥗 Ernährung des Tages eintragen</button></div><div id="entryForm" class="section">${entryForm('activity')}</div>`}</div></div>`;
 if(edit)setTimeout(()=>wireDynamic(edit),0)
}
function entryTab(kind,btn){$$('.modal .tabs button').forEach(x=>x.classList.remove('active'));if(btn?.closest('.tabs'))btn.classList.add('active');$('#entryForm').innerHTML=entryForm(kind);wireDynamic()}
function entryForm(kind,e=null){
 if(kind==='activity'){let a=e?.activity||'walk';return `<form class="form twoMobile" onsubmit="saveActivity(event,'${e?.id||''}')"><div class="field"><label>Aktivität</label><select id="aType" onchange="wireDynamic()">${Object.entries(ACTIVITIES).map(([k,x])=>`<option value="${k}" ${k===a?'selected':''}>${x.icon} ${x.name}</option>`).join('')}</select></div><div class="field"><label>Dauer (Min.)</label><input id="aMinutes" type="number" min="0" value="${e?.minutes||30}" oninput="livePts()"></div><div class="field" id="distWrap"><label>Distanz (km)</label><input id="aDistance" type="number" step=".1" min="0" value="${e?.distance||''}" oninput="livePts()"></div><div class="field"><label>Zeuge</label><select id="aWitness"><option value="honor" ${!e?.witness_user_id?'selected':''}>🤝 Ehrenkodex</option>${profiles.filter(p=>p.id!==me.id).map(p=>`<option value="${p.id}" ${e?.witness_user_id===p.id?'selected':''}>${escapeHtml(p.first_name)}</option>`).join('')}</select><div class="tiny muted">Ehrenkodex braucht keine Bestätigung. Bei einer Person erscheint eine freiwillige Zeugenanfrage.</div></div><div class="full"><label class="strong small">Optionaler Bildnachweis</label><div class="uploadBtns"><label class="uploadBtn">📷 Foto aufnehmen<input hidden type="file" accept="image/*" capture="environment" onchange="proofFile(this)"></label><label class="uploadBtn">🖼️ Galerie<input hidden type="file" accept="image/*" onchange="proofFile(this)"></label></div><img id="proofPreview" class="photoPreview hidden"></div><div id="livePts" class="notice full"></div><button class="cta full">${e?'Speichern':'Aktivität speichern'}</button></form>`}
 if(kind==='steps')return `<form class="form" onsubmit="saveSteps(event,'${e?.id||''}')"><div class="field"><label>Schritte</label><input id="sSteps" type="number" min="0" value="${e?.steps||''}" oninput="stepHint()" required></div><div id="stepHint" class="notice">Wird automatisch auf volle 100 abgerundet.</div><button class="cta">Schritte speichern</button></form>`;
 return `<form class="form" onsubmit="saveFood(event,'${e?.id||''}')"><div class="notice"><b>Ein Tages-Check-in.</b> Hake nur Ziele ab, die du vollständig erfüllt hast.</div><div class="toggleGrid">${FOOD.map(f=>`<label class="toggle"><input type="checkbox" name="food" value="${f.id}" ${(e?.food_items||[]).includes(f.id)?'checked':''}><span><b>${f.icon} ${f.title}</b><br><span class="tiny muted">${f.desc}</span></span></label>`).join('')}</div><div><label class="strong small">Optionales Foto für den Feed</label><div class="uploadBtns"><label class="uploadBtn">📷 Foto aufnehmen<input hidden type="file" accept="image/*" capture="environment" onchange="proofFile(this)"></label><label class="uploadBtn">🖼️ Galerie<input hidden type="file" accept="image/*" onchange="proofFile(this)"></label></div><img id="proofPreview" class="photoPreview hidden"></div><button class="cta">Ernährung speichern</button></form>`
}
function wireDynamic(edit){let a=$('#aType');if(!a)return;let x=ACTIVITIES[a.value];$('#distWrap')?.classList.toggle('hidden',!x.distance);livePts()}
function livePts(){let a=$('#aType')?.value,min=+($('#aMinutes')?.value||0),dist=+($('#aDistance')?.value||0),p=activityPoints(a,min,dist);if($('#livePts'))$('#livePts').innerHTML=`Diese Aktivität bringt aktuell <b>+${p} Punkte</b>.`}
function stepHint(){let raw=+($('#sSteps')?.value||0),rounded=Math.floor(raw/100)*100;if($('#stepHint'))$('#stepHint').innerHTML=`Für die Wertung: <b>${rounded.toLocaleString('de-DE')} Schritte = +${stepPoints(rounded)} P</b>`}
function proofFile(input){let f=input.files?.[0];pendingProof=f||null;if(f){let url=URL.createObjectURL(f),img=$('#proofPreview');if(img){img.src=url;img.classList.remove('hidden')}}}
async function uploadProof(file){if(!file)return null;let ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${me.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;let {error}=await sb.storage.from('proofs').upload(path,file,{upsert:false});if(error)throw error;return path}
async function saveActivity(ev,id=''){
 ev.preventDefault();let before=celebrationSnapshot(),a=$('#aType').value,min=+$('#aMinutes').value,dist=$('#aDistance')&&!$('#distWrap').classList.contains('hidden')?+$('#aDistance').value:null,rawW=$('#aWitness').value,witnessId=rawW==='honor'?null:rawW,witnessName=witnessId?firstName(profileById(witnessId)):'Ehrenkodex',photo=null,entryDate=id?entries.find(x=>x.id===id).entry_date:fmtDate();
 try{if(pendingProof)photo=await uploadProof(pendingProof);let payload={user_id:me.id,entry_date:entryDate,kind:'activity',activity:a,minutes:min,distance:dist,witness:witnessName,witness_user_id:witnessId,points:calcCappedActivityPoints(me.id,entryDate,a,min,dist,id||null)};if(photo)payload.photo_path=photo;
 let res=id?await sb.from('entries').update(payload).eq('id',id).eq('user_id',me.id).select().single():await sb.from('entries').insert(payload).select().single();if(res.error)throw res.error;let entry=res.data;
 if(witnessId){let wr=await sb.from('witness_confirmations').upsert({entry_id:entry.id,entry_owner_id:me.id,witness_user_id:witnessId,status:'pending',responded_at:null},{onConflict:'entry_id'});if(wr.error)console.warn(wr.error);if(prefFor(witnessId).notify_witness)notifyUser(witnessId,`${firstName(me)} nennt dich als Zeuge 👀`,`${ACTIVITIES[a]?.name||'Aktivität'} · ${min} Min.`,'witness')}else await sb.from('witness_confirmations').delete().eq('entry_id',entry.id).eq('entry_owner_id',me.id);
 pendingProof=null;closeModal();await loadData();await detectChallengeCompletions();await render();maybeCelebrate(before);toast('Gespeichert ✓')
 }catch(err){if(likelyOffline(err)&&!photo){let payload={user_id:me.id,entry_date:entryDate,kind:'activity',activity:a,minutes:min,distance:dist,witness:witnessName,witness_user_id:witnessId,points:calcCappedActivityPoints(me.id,entryDate,a,min,dist,id||null)};queueEntry(payload,id?'update':'insert',id||null);pendingProof=null;closeModal();await render();return toast('Offline gespeichert – wird später synchronisiert.')}toast(err.message)}
}
async function saveSteps(ev,id=''){ev.preventDefault();let before=celebrationSnapshot(),steps=Math.floor(+$('#sSteps').value/100)*100,payload={user_id:me.id,entry_date:id?entries.find(x=>x.id===id).entry_date:fmtDate(),kind:'steps',steps,points:stepPoints(steps)};try{let old=id?entries.find(x=>x.id===id):entries.find(e=>e.user_id===me.id&&e.entry_date===payload.entry_date&&e.kind==='steps'),res=old?await sb.from('entries').update(payload).eq('id',old.id).eq('user_id',me.id):await sb.from('entries').insert(payload);if(res.error)throw res.error;closeModal();await loadData();await render();maybeCelebrate(before);toast('Schritte gespeichert ✓')}catch(err){if(likelyOffline(err)){queueEntry(payload,id?'update':'insert',id||null);closeModal();await render();return toast('Offline gespeichert – wird später synchronisiert.')}toast(err.message)}}
async function saveFood(ev,id=''){ev.preventDefault();let before=celebrationSnapshot(),items=$$('input[name=food]:checked').map(x=>x.value),photo=null,entryDate=id?entries.find(x=>x.id===id).entry_date:fmtDate();try{if(pendingProof)photo=await uploadProof(pendingProof);let payload={user_id:me.id,entry_date:entryDate,kind:'food',food_items:items,points:items.length,witness:'Ehrenkodex',witness_user_id:null};if(photo)payload.photo_path=photo;let old=id?entries.find(x=>x.id===id):entries.find(e=>e.user_id===me.id&&e.entry_date===entryDate&&e.kind==='food'),res=old?await sb.from('entries').update(payload).eq('id',old.id).eq('user_id',me.id):await sb.from('entries').insert(payload);if(res.error)throw res.error;pendingProof=null;closeModal();await loadData();await render();maybeCelebrate(before);toast('Ernährung gespeichert ✓')}catch(err){if(likelyOffline(err)&&!photo){let payload={user_id:me.id,entry_date:entryDate,kind:'food',food_items:items,points:items.length,witness:'Ehrenkodex',witness_user_id:null};queueEntry(payload,id?'update':'insert',id||null);pendingProof=null;closeModal();await render();return toast('Offline gespeichert – wird später synchronisiert.')}toast(err.message)}}
function closeModal(){pendingProof=null;$('#modalRoot').innerHTML=''}

async function openProfile(){
 let av=await signed('avatars',me.avatar_path);$('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>Profil</h2><button class="x" onclick="closeModal()">×</button></div><form class="form two section" onsubmit="saveProfile(event)"><div class="field"><label>Vorname</label><input id="pfFirst" value="${escapeHtml(me.first_name)}" required></div><div class="field"><label>Nachname</label><input id="pfLast" value="${escapeHtml(me.last_name)}" required></div><div class="full"><label class="strong small">Profilbild</label><div class="uploadBtns"><label class="uploadBtn">📷 Foto aufnehmen<input hidden type="file" accept="image/*" capture="user" onchange="avatarFile(this)"></label><label class="uploadBtn">🖼️ Galerie<input hidden type="file" accept="image/*" onchange="avatarFile(this)"></label></div><img id="avatarPreview" class="photoPreview ${av?'':'hidden'}" src="${av||''}"></div><button class="cta full">Profil speichern</button></form></div></div>`
}
function avatarFile(i){pendingAvatar=i.files?.[0]||null;if(pendingAvatar){let img=$('#avatarPreview');img.src=URL.createObjectURL(pendingAvatar);img.classList.remove('hidden')}}
async function saveProfile(ev){ev.preventDefault();let path=me.avatar_path;try{if(pendingAvatar){let ext=(pendingAvatar.name.split('.').pop()||'jpg').toLowerCase();path=`${me.id}/avatar-${Date.now()}.${ext}`;let {error}=await sb.storage.from('avatars').upload(path,pendingAvatar);if(error)throw error}let {error}=await sb.from('profiles').update({first_name:$('#pfFirst').value.trim(),last_name:$('#pfLast').value.trim(),avatar_path:path}).eq('id',me.id);if(error)throw error;pendingAvatar=null;signedCache={};
closeModal();await loadData();renderShell();await render();toast('Profil gespeichert ✓')}catch(err){toast(err.message)}}
function activeRewardsForMilestone(m){
 let db=rewardPool.filter(r=>r.active&&+r.points_required===+m);
 return db.length?db:REWARDS.map((r,i)=>({...r,id:'legacy-'+r.key,points_required:MILESTONES[i%MILESTONES.length],active:true}))
}
function rewardOptions(m){
 let pool=activeRewardsForMilestone(m);
 if(!pool.length)return [];
 let seed=m+[...monthKey()].reduce((s,c)=>s+c.charCodeAt(0),0);
 return [0,1,2].map(i=>pool[(seed+i)%pool.length]).filter((x,i,a)=>x&&a.findIndex(y=>y.id===x.id)===i)
}
function openReward(m){let opts=rewardOptions(m);$('#modalRoot').innerHTML=`<div class="modal"><div class="modalCard"><div class="modalHead"><h2>🎉 ${m} Punkte!</h2><button class="x" onclick="closeModal()">×</button></div><p>Wähle eine Belohnung:</p><div class="grid">${opts.map(r=>`<button class="choice" onclick="chooseReward(${m},'${r.key}')"><b>${r.name}</b><div class="muted small">${r.desc}</div></button>`).join('')}</div></div></div>`}
async function chooseReward(m,key){let {error}=await sb.from('reward_choices').insert({user_id:me.id,month_key:monthKey(),milestone:m,reward_key:key});if(error)return toast(error.message);closeModal();await loadData();await render();toast('Belohnung gespeichert 🎁')}


const FIT4US_VERSION='1.13.1';
let fit4usReloading=false;

function cleanFit4UsUrl(){
  // Remove old ?v=... or other cache-busting parameters from previous builds
  // without reloading the page.
  const clean=location.pathname + (location.hash||'');
  if(location.search)history.replaceState(null,'',clean);
}

async function setupAppUpdates(){
  cleanFit4UsUrl();
  if(!('serviceWorker' in navigator))return;

  // Always register the same stable URL. updateViaCache:'none' forces the browser
  // to revalidate the service worker itself instead of trusting HTTP cache.
  const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});

  try{await reg.update()}catch(err){console.warn('Update check:',err)}

  if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});

  reg.addEventListener('updatefound',()=>{
    const worker=reg.installing;
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller){
        worker.postMessage({type:'SKIP_WAITING'});
      }
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(fit4usReloading)return;
    fit4usReloading=true;
    sessionStorage.setItem('fit4us-last-reload-version',FIT4US_VERSION);
    // Reload the SAME clean URL. No ?v=... is added.
    location.reload();
  });

  await checkPublishedVersion(reg);

  // If the app stays open for a long time, re-check periodically.
  setInterval(()=>{
    reg.update().catch(()=>{});
    checkPublishedVersion(reg).catch(()=>{});
  },15*60*1000);
}

async function checkPublishedVersion(reg){
  try{
    const res=await fetch('./version.json',{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    if(!res.ok)return;
    const info=await res.json();

    if(info.version&&info.version!==FIT4US_VERSION){
      // A newer index/app build exists on GitHub. Ask the browser to update the
      // stable service worker, then let controllerchange perform one clean reload.
      try{await reg.update()}catch{}

      if(reg.waiting){
        reg.waiting.postMessage({type:'SKIP_WAITING'});
        return;
      }

      // Fallback for iOS edge cases: reload the normal URL once, still without
      // exposing a version parameter to the user.
      const marker='fit4us-published-version-'+info.version;
      if(!sessionStorage.getItem(marker)){
        sessionStorage.setItem(marker,'1');
        location.reload();
      }
    }
  }catch(err){
    console.warn('Version check:',err);
  }
}

document.addEventListener('DOMContentLoaded',async()=>{await setupAppUpdates().catch(err=>console.warn('App update:',err));init()});
