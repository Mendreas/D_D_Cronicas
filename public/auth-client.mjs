import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.8';
let sbPromise;
export async function gameClient(){
 if(!sbPromise)sbPromise=(async()=>{
  const r=await fetch('/.netlify/functions/game-config');
  const cfg=await r.json();
  if(!r.ok)throw Error(cfg.error||'Erro na configuração Supabase');
  return createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
 })();
 return sbPromise;
}
export async function gameToken(){
 const sb=await gameClient();
 const {data,error}=await sb.auth.getSession();
 if(error)throw error;
 if(!data.session?.access_token)return '';
 return data.session.access_token;
}
export async function requireLogin(next=location.pathname+location.search){
 const token=await gameToken();
 if(token)return token;
 location.replace('/login.html?next='+encodeURIComponent(next));
 return '';
}
