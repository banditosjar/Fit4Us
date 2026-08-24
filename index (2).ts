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
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:fit4us@example.invalid',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!)
  const {date,hour}=localParts()
  if(hour!==8&&hour!==19)return Response.json({skipped:true,hour,date})

  const {data:profiles}=await admin.from('profiles').select('id,first_name').eq('approved',true)
  const {data:prefs}=await admin.from('user_preferences').select('*')
  const {data:subs}=await admin.from('push_subscriptions').select('*')

  async function send(uid:string,title:string,body:string,tag:string){
   for(const s of (subs||[]).filter(x=>x.user_id===uid)){
    try{
     await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url:'https://banditosjar.github.io/Fit4Us/',tag}))
    }catch(e){
     const status=(e as any)?.statusCode
     if(status===404||status===410)await admin.from('push_subscriptions').delete().eq('id',s.id)
    }
   }
  }

  if(hour===8){
   for(const p of profiles||[]){
    let pr=(prefs||[]).find(x=>x.user_id===p.id)
    if(pr?.notify_challenges!==false)await send(p.id,'☀️ Deine Fit4Us-Challenge wartet',`Guten Morgen ${p.first_name} – deine persönliche Tageschallenge ist bereit.`,'daily')
   }
  }
  if(hour===19){
   const {data:entries}=await admin.from('entries').select('user_id,points').eq('entry_date',date).gt('points',0)
   const {data:daily}=await admin.from('daily_challenge_completions').select('user_id,points').eq('challenge_date',date)
   const active=new Set([...(entries||[]).map(x=>x.user_id),...(daily||[]).filter(x=>(x.points||1)>0).map(x=>x.user_id)])
   for(const p of profiles||[]){
    let pr=(prefs||[]).find(x=>x.user_id===p.id)
    if(pr?.notify_streak!==false&&!active.has(p.id))await send(p.id,'🔥 Dein Streak ist heute noch offen',`Ein einziger Punkt reicht heute, ${p.first_name}.`,'streak')
   }
  }
  return Response.json({ok:true,hour,date})
 }catch(e){console.error(e);return new Response(String((e as any)?.message||e),{status:500})}
})
