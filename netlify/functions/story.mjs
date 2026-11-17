export default async (request) => {
  if (request.method !== 'POST') return Response.json({error:'Método inválido'},{status:405});
  const pass = process.env.GAME_ACCESS_CODE;
  const auth = request.headers.get('x-game-code') || '';
  if (!pass || auth !== pass) return Response.json({error:'Código de acesso inválido ou não configurado no Netlify.'},{status:401});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return Response.json({error:'Falta OPENAI_API_KEY no Netlify.'},{status:500});
  try {
    const data=await request.json();
    const char=data.character||{};
    const messages=(data.messages||[]).filter(m=>['user','assistant'].includes(m.role)).slice(-24).map(m=>({role:m.role,content:String(m.content||'').slice(0,5000)}));
    if(!messages.length || messages.at(-1).role!=='user') throw Error('Falta a ação do jogador.');
    const system=`És Mestre de Jogo de uma aventura de fantasia heroica inspirada em D&D, escrita em português europeu. Narrativa imersiva, escolhas significativas, personagens consistentes, perigos e consequências. Não decides ações do jogador. Nunca mudes arbitrariamente os atributos da ficha. Usa a ficha fornecida e mantém coerência com o histórico. Usa regras simplificadas e explica os testes ou resultados quando necessário. Responde em 2-5 parágrafos, termina com 3 opções numeradas e acrescenta sempre que o jogador pode escrever qualquer ação. Quando apropriado, apresenta uma sugestão de lançamento de d20 e CD; não inventes que um dado foi lançado. Evita conteúdo gráfico extremo. FICHA: ${JSON.stringify(char)}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions:system,input:messages,max_output_tokens:850}),signal:AbortSignal.timeout(54000)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error?.message||`Erro OpenAI ${r.status}`);
    const txt=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!txt) throw Error('A IA não devolveu texto.');
    return Response.json({text:txt});
  }catch(e){return Response.json({error:String(e.message||e)},{status:400});}
};
