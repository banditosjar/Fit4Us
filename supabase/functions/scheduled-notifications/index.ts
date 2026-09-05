import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const tz='Europe/Berlin'
function localParts(now=new Date()){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false}).formatToParts(now)
 const get=(t:string)=>p.find(x=>x.type===t)?.value||''
 return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour'))}
}

Deno.serve(async req=>{
 try{
  if(req.headers.get('x-cron-secret')!==Deno.env.get('CRON_SECRET'))return new Response('Unauthorized',{status:401})
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:movo@example.invalid',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!)
  const {date,hour}=localParts()

  const {data:profiles}=await admin.from('profiles').select('id,first_name').eq('approved',true)
  const {data:prefs}=await admin.from('user_preferences').select('*')
  const {data:subs}=await admin.from('push_subscriptions').select('*')
  let sentCount=0,removedCount=0

  async function send(uid:string,title:string,body:string,tag:string){
   for(const s of (subs||[]).filter(x=>x.user_id===uid)){
    try{
     await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url:'https://banditosjar.github.io/Movo/',tag}))
     sentCount++
    }catch(e){
     const status=(e as any)?.statusCode
     if(status===404||status===410){await admin.from('push_subscriptions').delete().eq('id',s.id);removedCount++}
     else console.error('push failed',status,(e as any)?.message)
    }
   }
  }

  const cutoff=new Date(Date.now()-70*60*1000).toISOString()
  const {data:autoRows}=await admin.from('weekly_choice_windows')
   .select('week_key,auto_selected_at')
   .eq('auto_selected',true).gte('auto_selected_at',cutoff)
  for(const row of autoRows||[]){
   const {data:wc}=await admin.from('weekly_challenges').select('challenge_id').eq('week_key',row.week_key).maybeSingle()
   let title='Wochenchallenge'
   if(wc?.challenge_id){
    const {data:pool}=await admin.from('challenge_pool').select('name').eq('slug',wc.challenge_id).maybeSingle()
    if(pool?.name)title=pool.name
   }
   for(const p of profiles||[]){
    const pr=(prefs||[]).find(x=>x.user_id===p.id)
    if(pr?.notify_challenges!==false)await send(p.id,'🎲 Wochenchallenge automatisch gewählt',`Movo hat „${title}“ aus den drei Optionen ausgewählt.`,'weekly-auto-'+row.week_key)
   }
  }

  if(hour===8){
   const {data:done}=await admin.from('daily_challenge_completions').select('user_id').eq('challenge_date',date)
   const completed=new Set((done||[]).map(x=>x.user_id))
   for(const p of profiles||[]){
    const pr=(prefs||[]).find(x=>x.user_id===p.id)
    if(pr?.notify_challenges!==false&&!completed.has(p.id))await send(p.id,'☀️ Deine Movo-Challenge wartet',`Guten Morgen ${p.first_name} – deine persönliche Tageschallenge ist noch offen.`,'daily-'+date)
   }
  }

  if(hour===19){
   const {data:todayEntries}=await admin.from('entries').select('user_id,kind,points,steps,food_items').eq('entry_date',date)
   const {data:daily}=await admin.from('daily_challenge_completions').select('user_id').eq('challenge_date',date)
   const dailyUsers=new Set((daily||[]).map(x=>x.user_id))
   const qualified=new Set<string>()
   for(const p of profiles||[]){
    const es=(todayEntries||[]).filter(x=>x.user_id===p.id)
    const stepOk=es.some(x=>x.kind==='steps'&&Number(x.steps||0)>=7500)
    const foodOk=es.some(x=>x.kind==='food'&&Array.isArray(x.food_items)&&x.food_items.length>=3)
    const activityOk=es.some(x=>x.kind==='activity'&&Number(x.points||0)>=2)
    const otherHealth=es.some(x=>Number(x.points||0)>0)
    const dailyPlus=dailyUsers.has(p.id)&&otherHealth
    if(stepOk||foodOk||activityOk||dailyPlus)qualified.add(p.id)
   }
   for(const p of profiles||[]){
    const pr=(prefs||[]).find(x=>x.user_id===p.id)
    if(pr?.notify_streak!==false&&!qualified.has(p.id))await send(p.id,'🔥 Dein Streak ist heute noch offen',`${p.first_name}, dir fehlt heute noch ein qualifizierter aktiver Tag. 7.500 Schritte, 3 Ernährungsziele, eine Aktivität ab 2 P oder Daily + ein weiterer Gesundheitspunkt reichen.`,'streak-'+date)
   }
  }

  return Response.json({ok:true,hour,date,sent:sentCount,removed:removedCount,auto_weekly:(autoRows||[]).length})
 }catch(e){console.error(e);return new Response(String((e as any)?.message||e),{status:500})}
})
