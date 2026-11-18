import {requireGameUser,gameAuthError} from './_game-auth.mjs';
const reply=(obj,status=200)=>Response.json(obj,{status,headers:{'Cache-Control':'no-store'}});
const types=['cv-character-','cv-party-','cv-save-'];
const indexes=new Set(['cv-character-index','cv-save-index','cv-active-character']);
const allowed=k=>indexes.has(k)||types.some(p=>k.startsWith(p)&&/^[a-zA-Z0-9-]{8,110}$/.test(k.slice(p.length)));
const limitedText=v=>typeof v==='string'&&v.length<=280000;
const maxKeys=180;
const merge=(oldData,incoming)=>{
 const base={...(oldData&&typeof oldData==='object'?oldData:{})};
 for(const [key,value] of Object.entries(incoming)){
  if(!allowed(key)||!limitedText(value))continue;
  if(key==='cv-active-character'){base[key]=value;continue}
  if(key==='cv-character-index'||key==='cv-save-index'){
   let a=[],b=[];try{a=JSON.parse(base[key]||'[]')}catch{}try{b=JSON.parse(value)}catch{}
   const union=[...new Set([...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])])].filter(x=>typeof x==='string').slice(0,150);
   base[key]=JSON.stringify(union);continue;
  }
  if(!base[key]){base[key]=value;continue}
  try{
   const local=JSON.parse(value),stored=JSON.parse(base[key]);
   // A história mais recente e a ficha de maior evolução não podem ser apagadas
   // por abrir uma versão antiga noutro dispositivo.
   if(key.startsWith('cv-save-')){
    if(Number(local.updated||0)>Number(stored.updated||0))base[key]=value;
   }else if(key.startsWith('cv-character-')){
    const newXP=Number(local.experiencia||0),oldXP=Number(stored.experiencia||0);
    const useNew=newXP>oldXP||(newXP===oldXP&&Number(local.updated||0)>=Number(stored.updated||0));
    const primary=useNew?local:stored;
    primary.experiencia=Math.max(oldXP,newXP);
    primary.nivel=Math.max(Number(local.nivel||1),Number(stored.nivel||1));
    primary.conquistas=[...new Set([...(stored.conquistas||[]),...(local.conquistas||[])])];
    base[key]=JSON.stringify(primary);
   }else if(key.startsWith('cv-party-')){
    const a=Array.isArray(stored)?stored:[],b=Array.isArray(local)?local:[];
    const map=new Map(a.map(x=>[x.id||x.nome,x]));
    for(const ally of b){const id=ally.id||ally.nome,prior=map.get(id);
     if(!prior||Number(ally.experiencia||0)>Number(prior.experiencia||0))map.set(id,ally);
    }
    base[key]=JSON.stringify([...map.values()]);
   }
  }catch{base[key]=value}
 }
 return Object.fromEntries(Object.entries(base).filter(([k,v])=>allowed(k)&&limitedText(v)).slice(0,maxKeys));
};
export default async request=>{
 if(!['GET','POST'].includes(request.method))return reply({error:'Método inválido'},405);
 let user;try{user=await requireGameUser(request)}catch(e){return gameAuthError(e)}
 const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
 const key=process.env.SUPABASE_SECRET_KEY||'';
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 const endpoint=url+'/rest/v1/game_player_state';
 try{
  const fetchState=await fetch(endpoint+'?user_id=eq.'+encodeURIComponent(user.id)+'&select=payload',{headers,signal:AbortSignal.timeout(16000)});
  if(!fetchState.ok){
   const msg=await fetchState.text();
   return reply({error:'Sincronização por configurar. Executa supabase/sincronizacao_jogador.sql no SQL Editor. '+msg.slice(0,180)},503);
  }
  const records=await fetchState.json();const existing=records?.[0]?.payload||{};
  if(request.method==='GET')return reply({state:existing});
  const input=await request.json();
  if(!input||typeof input.state!=='object'||Array.isArray(input.state))return reply({error:'Estado inválido'},400);
  if(JSON.stringify(input.state).length>1_500_000)return reply({error:'Dados demasiado grandes'},413);
  const state=merge(existing,input.state);
  const write=await fetch(endpoint+'?on_conflict=user_id',{method:'POST',
    headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({user_id:user.id,payload:state,updated_at:new Date().toISOString()}),
    signal:AbortSignal.timeout(16000)});
  if(!write.ok)throw Error((await write.text()).slice(0,250));
  return reply({state});
 }catch(e){return reply({error:'Falhou a sincronização: '+String(e.message||e)},503)}
};
