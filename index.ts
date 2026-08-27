import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
}

function json(body:unknown,status=200){
 return new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}})
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return json({error:'Method not allowed'},405)
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublic=Deno.env.get('VAPID_PUBLIC_KEY'),vapidPrivate=Deno.env.get('VAPID_PRIVATE_KEY')
  if(!vapidPublic||!vapidPrivate)return json({error:'VAPID secrets missing'},500)

  const auth=req.headers.get('Authorization')||''
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser()
  if(userError||!user)return json({error:'Unauthorized'},401)

  const {data:caller}=await userClient.from('profiles').select('id,approved').eq('id',user.id).maybeSingle()
  if(!caller?.approved)return json({error:'Approved user required'},403)

  const {target_user_id,title,body,category='challenges',url:targetUrl,tag}=await req.json()
  if(!target_user_id||!title)return json({error:'Bad request'},400)

  const admin=createClient(url,service,{auth:{persistSession:false}})
  const {data:target}=await admin.from('profiles').select('id,approved').eq('id',target_user_id).maybeSingle()
  if(!target?.approved)return json({error:'Target user not found'},404)

  const {data:pref}=await admin.from('user_preferences').select('*').eq('user_id',target_user_id).maybeSingle()
  const prefMap:Record<string,string>={
   reactions:'notify_reactions',witness:'notify_witness',streak:'notify_streak',
   votes:'notify_votes',rewards:'notify_rewards',challenges:'notify_challenges'
  }
  const prefKey=prefMap[category]||'notify_challenges'
  if(pref&&pref[prefKey]===false)return json({sent:0,disabled:true})

  const {data:subs}=await admin.from('push_subscriptions').select('*').eq('user_id',target_user_id)
  if(!subs?.length)return json({sent:0,no_subscriptions:true})

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:fit4us@example.invalid',vapidPublic,vapidPrivate)
  let sent=0,removed=0,failed=0
  for(const s of subs){
   try{
    await webpush.sendNotification(
     {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
     JSON.stringify({title,body,url:targetUrl||'https://banditosjar.github.io/Fit4Us/',tag:tag||category})
    )
    sent++
   }catch(e){
    const status=(e as any)?.statusCode
    if(status===404||status===410){await admin.from('push_subscriptions').delete().eq('id',s.id);removed++}
    else{console.error('push failed',status,(e as any)?.message);failed++}
   }
  }
  return json({sent,removed,failed})
 }catch(e){console.error(e);return json({error:String((e as any)?.message||e)},500)}
})
