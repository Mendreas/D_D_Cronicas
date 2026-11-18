import {requireGameUser,gameAuthError} from './_game-auth.mjs';
// Netlify function — imagens persistentes de local para salas privadas.
// Authentication: Supabase JWT, membership, and game code. Secret key server-side only.
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default async function(request){
 if(request.method!=='POST')return response({error:'Método inválido'},405);
 const url=(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
 const pub=process.env.SUPABASE_PUBLISHABLE_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY;
 const openai=process.env.OPENAI_API_KEY;
 if(!url||!pub||!secret||!openai)return response({error:'Configuração de imagens incompleta'},503);
 try{await requireGameUser(request)}catch(e){return gameAuthError(e)}
 const jwt=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!jwt)return response({error:'É necessário iniciar sessão'},401);
 const headers={apikey:secret};
 async function api(path,{method='GET',body,extraHeaders={}}={}){
  const r=await fetch(url+path,{method,headers:{...headers,...extraHeaders},body,
    signal:AbortSignal.timeout(10000)});
  const t=await r.text();let data;try{data=t?JSON.parse(t):null}catch{data=t}
  if(!r.ok)throw Error(data?.message||data?.error||('Supabase '+r.status));
  return data;
 }
 let roomId=null,locationKey=null,claimed=false;
 try{
  const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:pub,Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return response({error:'Sessão inválida'},401);
  const user=await auth.json();
  const data=await request.json();roomId=data.room_id;
  if(typeof roomId!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(roomId))
    return response({error:'Sala inválida'},400);
  const members=await api('/rest/v1/game_players?room_id=eq.'+encodeURIComponent(roomId)+'&user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id');
  if(!members.length)return response({error:'Não tens acesso a esta aventura'},403);
  const gm=await api('/rest/v1/game_messages?room_id=eq.'+encodeURIComponent(roomId)+'&role=eq.gm&select=content,created_at&order=created_at.desc&limit=1');
  if(!gm.length)return response({status:'empty'});
  const scene=gm[0].content||'';
  const tag=scene.match(/\[LOCAL:([a-z0-9-]{2,80})\]/i);
  locationKey=tag?tag[1].toLowerCase():'sala-inicial';
  const existing=await api('/rest/v1/game_images?room_id=eq.'+encodeURIComponent(roomId)+'&location_key=eq.'+encodeURIComponent(locationKey)+'&select=image_path&limit=1');
  async function signed(path){
    const result=await api('/storage/v1/object/sign/game-scenes/'+path,{method:'POST',body:JSON.stringify({expiresIn:3600}),extraHeaders:{'Content-Type':'application/json'}});
    if(!result.signedURL)throw Error('Não foi possível obter a imagem guardada.');
    return new URL(result.signedURL,url).href;
  }
  if(existing.length)return response({status:'ready',location:locationKey,url:await signed(existing[0].image_path)});
  const lock=await api('/rest/v1/rpc/claim_game_scene',{method:'POST',body:JSON.stringify({p_room_id:roomId,p_location_key:locationKey}),extraHeaders:{'Content-Type':'application/json'}});
  if(!lock)return response({status:'pending',location:locationKey});
  claimed=true;
  const chars=await api('/rest/v1/game_characters?room_id=eq.'+encodeURIComponent(roomId)+'&select=name,sheet');
  const companions=await api('/rest/v1/game_companions?room_id=eq.'+encodeURIComponent(roomId)+'&select=name,archetype');
  const artPrompt='Ilustração cinematográfica de fantasia heroica para um jogo de exploração. Uma única imagem horizontal 16:9 que representa fisicamente este LOCAL, e não uma lista de opções: '+locationKey+'. Descrição da última cena: '+scene.replace(/\[LOCAL:[^\]]+\]/ig,'').slice(0,3200)+'. Personagens presentes se realmente visíveis: '+JSON.stringify([...chars,...companions]).slice(0,1300)+'. Ambiente persistente, composição e arquitetura reconhecíveis para regressar ao local mais tarde. Sem legendas, sem palavras, sem interface, sem cartas, sem símbolos de texto.';
  const ai=await fetch('https://api.openai.com/v1/images/generations',{
   method:'POST',headers:{Authorization:'Bearer '+openai,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.IMAGE_MODEL||'gpt-image-2',prompt:artPrompt,size:'1536x1024',quality:'low',output_format:'jpeg',output_compression:65}),
   signal:AbortSignal.timeout(43000)
  });
  const result=await ai.json();if(!ai.ok)throw Error(result.error?.message||'Erro de geração de imagem');
  const encoded=result.data?.[0]?.b64_json;if(!encoded)throw Error('A API não devolveu imagem.');
  const buffer=Buffer.from(encoded,'base64');
  const imagePath=roomId+'/'+locationKey+'.jpg';
  await api('/storage/v1/object/game-scenes/'+imagePath,{
    method:'POST',body:buffer,extraHeaders:{'Content-Type':'image/jpeg','x-upsert':'true'}
  });
  await api('/rest/v1/game_images?on_conflict=room_id,location_key',{
    method:'POST',body:JSON.stringify({room_id:roomId,location_key:locationKey,image_path:imagePath}),
    extraHeaders:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}
  });
  await api('/rest/v1/game_scene_jobs?room_id=eq.'+encodeURIComponent(roomId)+'&location_key=eq.'+encodeURIComponent(locationKey),{
    method:'PATCH',body:JSON.stringify({state:'ready'}),
    extraHeaders:{'Content-Type':'application/json'}
  });
  return response({status:'ready',location:locationKey,url:await signed(imagePath)});
 }catch(e){
  if(claimed&&roomId&&locationKey){
   try{await api('/rest/v1/game_scene_jobs?room_id=eq.'+encodeURIComponent(roomId)+'&location_key=eq.'+encodeURIComponent(locationKey),{
    method:'PATCH',body:JSON.stringify({state:'failed'}),extraHeaders:{'Content-Type':'application/json'}
   })}catch{}
  }
  return response({error:String(e.message||e)},400);
 }
}
