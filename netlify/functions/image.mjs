export default async (request) => {
  if(request.method!=='POST') return Response.json({error:'Método inválido'},{status:405});
  const pass=process.env.GAME_ACCESS_CODE;
  if(!pass || request.headers.get('x-game-code')!==pass) return Response.json({error:'Código de acesso inválido ou não configurado no Netlify.'},{status:401});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return Response.json({error:'Falta OPENAI_API_KEY no Netlify.'},{status:500});
  try{
    const data=await request.json();
    const char=data.character||{};const msgs=(data.messages||[]).slice(-6);
    if(!msgs.length) throw Error('Inicia a aventura antes de gerar uma imagem.');
    const last=msgs.filter(m=>m.role==='assistant').at(-1)?.content||'';
    const prompt=`Cria uma ilustração digital cinematográfica de fantasia heroica para um jogo narrativo, sem qualquer texto, logótipos, molduras ou UI. Rica em detalhes, atmosfera e luz dramática. Deve representar a cena atual com coerência com a personagem. Personagem: ${JSON.stringify(char).slice(0,2000)}. Cena narrada pelo Mestre de Jogo: ${String(last).slice(0,3800)}. Contexto: ${msgs.map(m=>`${m.role}: ${String(m.content||'').slice(0,600)}`).join('\n')}`;
    const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.IMAGE_MODEL||'gpt-image-2',prompt,size:'1024x1536',quality:'low',output_format:'jpeg',output_compression:65}),signal:AbortSignal.timeout(54000)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error?.message||`Erro OpenAI ${r.status}`);
    const b64=result.data?.[0]?.b64_json;
    if(!b64) throw Error('A API não devolveu a imagem.');
    return Response.json({image_data:`data:image/jpeg;base64,${b64}`});
  }catch(e){return Response.json({error:String(e.message||e)},{status:400});}
};
