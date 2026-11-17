const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default async function(request){
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY,ai=process.env.OPENAI_API_KEY,gameCode=process.env.GAME_ACCESS_CODE;
 if(!url||!key||!secret||!ai||!gameCode)return json({error:'Falta configurar SUPABASE_SECRET_KEY ou outra variável no Netlify.'},503);
 if(request.headers.get('x-game-code')!==gameCode)return json({error:'Código de acesso incorreto. Abre primeiro o jogo individual, confirma o código e regressa à página multijogador.'},401);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!token)return json({error:'Inicia sessão primeiro.'},401);
 try{
   const authRes=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
   if(!authRes.ok)return json({error:'Sessão inválida. Entra novamente.'},401);
   const user=await authRes.json();
   const {room_id}=await request.json();
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(room_id||''))return json({error:'Sala inválida.'},400);
   const serviceHeaders={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
   async function get(table,query){
     const r=await fetch(url+'/rest/v1/'+table+'?'+query,{headers:serviceHeaders,signal:AbortSignal.timeout(12000)});
     const data=await r.json();if(!r.ok)throw Error(data.message||'Erro Supabase');return data;
   }
   const rooms=await get('game_rooms','id=eq.'+encodeURIComponent(room_id)+'&select=id,title,owner_id');
   if(!rooms.length)return json({error:'Sala não encontrada.'},404);
   if(rooms[0].owner_id!==user.id)return json({error:'Só o anfitrião pode pedir a continuação da IA.'},403);
   const members=await get('game_players','room_id=eq.'+encodeURIComponent(room_id)+'&select=user_id,display_name');
   if(!members.some(m=>m.user_id===user.id))return json({error:'Não pertences à sala.'},403);
   const msgs=await get('game_messages','room_id=eq.'+encodeURIComponent(room_id)+'&select=id,role,content,author_id,created_at&order=created_at.desc&limit=25');
   msgs.reverse();
   if(!msgs.length||msgs.at(-1).role!=='player')return json({error:'É preciso haver uma nova ação de jogador antes do Mestre continuar.'},400);
   const chars=await get('game_characters','room_id=eq.'+encodeURIComponent(room_id)+'&select=user_id,name,sheet');
   const history=msgs.map(m=>({role:m.role==='gm'?'assistant':'user',content:m.role==='gm'?m.content:(members.find(x=>x.user_id===m.author_id)?.display_name||'Jogador')+': '+m.content}));
   const instruction='És o Mestre de Jogo de uma aventura de fantasia heroica cooperativa em português europeu. Existem vários jogadores humanos, com personagens diferentes. Todos partilham a mesma aventura. Considera as últimas ações de todos os jogadores e resolve a cena sem contradizer as ações anteriores. Não assumes ações pelos jogadores. Não inventes lançamentos de dados. Escreve 2 a 4 parágrafos e termina com escolhas para a equipa. Sala: '+rooms[0].title+'. Personagens: '+JSON.stringify(chars.map(c=>({jogador:members.find(p=>p.user_id===c.user_id)?.display_name,nome:c.name,ficha:c.sheet}))).slice(0,6000);
   const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+ai,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions:instruction,input:history.slice(-22),max_output_tokens:900}),signal:AbortSignal.timeout(52000)});
   const j=await r.json();if(!r.ok)throw Error(j.error?.message||'Erro OpenAI');
   const story=(j.output||[]).flatMap(x=>x.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim();
   if(!story)throw Error('O Mestre não devolveu texto.');
   // Confirm that actions have not changed during generation, before saving the response.
   const latest=await get('game_messages','room_id=eq.'+encodeURIComponent(room_id)+'&select=id&order=created_at.desc&limit=1');
   if(latest[0]?.id!==msgs.at(-1).id)return json({error:'Chegou uma nova ação durante a narração. Clica novamente para o Mestre considerar todas as ações.'},409);
   const saved=await fetch(url+'/rest/v1/game_messages',{method:'POST',headers:{...serviceHeaders,Prefer:'return=minimal'},body:JSON.stringify({room_id,author_id:null,role:'gm',content:story}),signal:AbortSignal.timeout(15000)});
   if(!saved.ok){const e=await saved.json();throw Error(e.message||'Falha ao gravar a história.')}
   return json({ok:true,text:story});
 }catch(e){return json({error:String(e.message||e)},400)}
}
