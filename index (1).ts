import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const auth=req.headers.get('Authorization')||'';const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await userClient.auth.getUser();if(!user)return new Response('Unauthorized',{status:401,headers:cors});
 const {target_user_id,title,body,category='challenges',url:targetUrl}=await req.json();if(!target_user_id||!title)return new Response('Bad request',{status:400,headers:cors});
 const admin=createClient(url,service);let {data:pref}=await admin.from('user_preferences').select('*').eq('user_id',target_user_id).maybeSingle();
 const prefKey=category==='reactions'?'notify_reactions':category==='witness'?'notify_witness':category==='streak'?'notify_streak':'notify_challenges';if(pref&&pref[prefKey]===false)return new Response(JSON.stringify({sent:0,disabled:true}),{headers:{...cors,'content-type':'application/json'}});
 let {data:subs}=await admin.from('push_subscriptions').select('*').eq('user_id',target_user_id);if(!subs?.length)return new Response(JSON.stringify({sent:0}),{headers:{...cors,'content-type':'application/json'}});
 webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:fit4us@example.invalid',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
 let sent=0;for(const s of subs){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url:targetUrl||'https://banditosjar.github.io/Fit4Us/'}));sent++}catch(e){if(e?.statusCode===404||e?.statusCode===410)await admin.from('push_subscriptions').delete().eq('id',s.id)}}
 return new Response(JSON.stringify({sent}),{headers:{...cors,'content-type':'application/json'}})
}catch(e){return new Response(String(e?.message||e),{status:500,headers:cors})}});