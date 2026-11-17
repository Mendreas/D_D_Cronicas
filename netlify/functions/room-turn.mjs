// Resolve exatamente um turno após todos os participantes confirmarem a sua ação.
const respond=(obj,status=200)=>Response.json(obj,{status,headers:{'Cache-Control':'no-store'}});
export default async function(request){
 if(request.method!=='POST')return respond({error:'Método não permitido.'},405);
 const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
 const key=process.env.SUPABASE_PUBLISHABLE_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY;
 const ai=process.env.OPENAI_API_KEY;
 if(!url||!key||!secret||!ai)return respond({error:'Faltam variáveis no Netlify.'},503);
 if(request.headers.get('x-game-code')!==process.env.GAME_ACCESS_CODE || !process.env.GAME_ACCESS_CODE)
   return respond({error:'Código de acesso do jogo inválido.'},401);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!token)return respond({error:'Inicia sessão primeiro.'},401);
 let roomId=null,turnNo=null,claimed=false;
 const adminHeaders={apikey:secret,'Content-Type':'application/json'};
 async function admin(path,options={}){
   const r=await fetch(url+'/rest/v1/'+path,{...options,headers:{...adminHeaders,...(options.headers||{})},signal:AbortSignal.timeout(12000)});
   const body=await r.text();let data;try{data=body?JSON.parse(body):null}catch{data=body}
   if(!r.ok)throw Error(data?.message||data?.error||'Erro Supabase '+r.status);
   return data;
 }
 async function rpc(name,values){return admin('rpc/'+name,{method:'POST',body:JSON.stringify(values)})}
 try{
   const authRes=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
   if(!authRes.ok)return respond({error:'Sessão inválida. Entra novamente.'},401);
   const user=await authRes.json();
   const data=await request.json();roomId=data.room_id;
   if(typeof roomId!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(roomId))
     return respond({error:'Sala inválida.'},400);
   const rooms=await admin('game_rooms?id=eq.'+encodeURIComponent(roomId)+'&select=id,title,owner_id,campaign_id,campaign_intro');
   if(!rooms.length)return respond({error:'Sala não encontrada.'},404);
   const members=await admin('game_players?room_id=eq.'+encodeURIComponent(roomId)+'&select=user_id,display_name');
   if(!members.some(p=>p.user_id===user.id))return respond({error:'Não pertences a esta sala.'},403);
   // A função Postgres verifica atomicamente o estado e impede duas gerações simultâneas.
   turnNo=await rpc('claim_game_turn',{p_room_id:roomId});claimed=true;
   const participants=await admin('game_turn_members?room_id=eq.'+encodeURIComponent(roomId)+'&turn_number=eq.'+turnNo+'&select=user_id,ready');
   const actions=await admin('game_turn_actions?room_id=eq.'+encodeURIComponent(roomId)+'&turn_number=eq.'+turnNo+'&select=user_id,content');
   if(actions.length!==participants.length)throw Error('As ações ainda não estão completas.');
   const charSheets=await admin('game_characters?room_id=eq.'+encodeURIComponent(roomId)+'&select=user_id,name,sheet');
   const companions=await admin('game_companions?room_id=eq.'+encodeURIComponent(roomId)+'&select=name,archetype,sheet');
   const prior=(await admin('game_messages?room_id=eq.'+encodeURIComponent(roomId)+'&role=eq.gm&select=content,created_at&order=created_at.desc&limit=12')).reverse();
   const input=[
     ...prior.map(m=>({role:'assistant',content:m.content})),
     {role:'user',content:'AÇÕES DO TURNO '+turnNo+' (considera TODAS):\n'+actions.map(a=>{
       const p=members.find(m=>m.user_id===a.user_id);
       return (p?.display_name||'Jogador')+': '+a.content;
     }).join('\n')}
   ];
   const instructions='És Mestre de Jogo de uma aventura cooperativa de fantasia heroica, em português europeu. Os jogadores estão em locais diferentes e tomam decisões por turnos assíncronos. Considera simultaneamente TODAS as ações do turno, sem ignorar ninguém. Não inventes ações dos jogadores nem dados lançados. Narra o resultado num máximo de quatro parágrafos, explica as consequências e termina com uma nova situação que exija decisões de cada jogador. Não avances para outro turno. Título: '+rooms[0].title+'. Contexto da campanha: '+(rooms[0].campaign_intro||'')+'. Controlas até dois companheiros IA, cujas ações são tuas para resolver e nunca substituem as decisões dos dois humanos. Companheiros: '+JSON.stringify(companions).slice(0,3000)+'. Personagens humanas: '+JSON.stringify(charSheets.map(c=>({jogador:members.find(p=>p.user_id===c.user_id)?.display_name,nome:c.name,ficha:c.sheet}))).slice(0,6500);
   const aiRes=await fetch('https://api.openai.com/v1/responses',{
     method:'POST',
     headers:{Authorization:'Bearer '+ai,'Content-Type':'application/json'},
     body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions,input,max_output_tokens:1000}),
     signal:AbortSignal.timeout(50000)
   });
   const result=await aiRes.json();
   if(!aiRes.ok)throw Error(result.error?.message||'Erro OpenAI '+aiRes.status);
   const story=(result.output||[]).flatMap(x=>x.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim();
   if(!story)throw Error('O Mestre de Jogo não devolveu uma narração.');
   await rpc('finish_game_turn',{p_room_id:roomId,p_turn_number:turnNo,p_story:story});
   claimed=false;
   return respond({ok:true,turn_number:turnNo,text:story});
 }catch(e){
   if(claimed&&roomId&&turnNo!==null){try{await rpc('abort_game_turn',{p_room_id:roomId,p_turn_number:turnNo})}catch{}}
   return respond({error:String(e.message||e)},400);
 }
};
