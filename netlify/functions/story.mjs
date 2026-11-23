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
    const campaign=String(data.campaign||'Aventura original').slice(0,200);
    const intro=String(data.intro||'').slice(0,1500);
    const lastLocation=String(data.lastLocation||'').slice(0,120);
    const messages=(data.messages||[]).filter(m=>['user','assistant'].includes(m.role)).slice(-24).map(m=>({role:m.role,content:String(m.content||'').slice(0,5000)}));
    if(!messages.length || messages.at(-1).role!=='user') throw Error('Falta a ação do jogador.');
    // A ação pode conter um resultado de teste já calculado pelo motor de dados.
    // Este resultado deve ser respeitado; nunca voltar a lançá-lo na narração.
    const system=`És Mestre de Jogo de uma aventura de fantasia heroica inspirada em D&D, escrita em português europeu. Narrativa imersiva, escolhas significativas, personagens consistentes, perigos e consequências. Não decides ações do jogador. Se a ficha incluir companheiros IA, interpretas as suas decisões e diálogos de forma autónoma, sem exceder o número indicado, e respeitas os seus recursos. Nunca mudes arbitrariamente os atributos da ficha. Usa a ficha fornecida e mantém coerência com o histórico. Usa regras simplificadas e explica os testes ou resultados quando necessário. Responde em 2-5 parágrafos, termina com 3 opções numeradas e acrescenta sempre que o jogador pode escrever qualquer ação. Quando uma ação depender de um teste d20, PARA a narração antes das consequências e pede exatamente um teste. Acrescenta, ANTES da linha [LOCAL:...], uma linha isolada [TESTE:nome|atributo|CD] (por exemplo [TESTE:Perceção|wis|13], [TESTE:Arcanismo|int|15]). Os atributos possíveis são str,dex,con,int,wis,cha, e a CD é um número inteiro entre 5 e 30. Faz perguntas concretas, não narrativas que resolvam o resultado antes da rolagem. Se a última ação recebida incluir "RESULTADO DE TESTE", a rolagem já ocorreu e foi calculada pelo motor: usa obrigatoriamente o valor, o bónus, a CD e o sucesso/falha fornecidos para narrar consequências; não peças de novo o mesmo teste nem alteres o resultado. Podes pedir outro teste apenas quando houver uma situação nova. Se não for necessário teste, não acrescentes a linha [TESTE]. Evita conteúdo gráfico extremo. Segue o SRD 5.2.1, sem inventar resultados de lançamentos. No FIM da resposta acrescenta uma linha [LOCAL:identificador-do-local], por exemplo [LOCAL:floresta-blackwood]. Mantém o identificador se continuarem no mesmo local e muda quando realmente se deslocarem. Local anterior: ${lastLocation}. Campanha: ${campaign}. Premissa: ${intro}. FICHA: ${JSON.stringify(char)}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions:system,input:messages,max_output_tokens:850}),signal:AbortSignal.timeout(54000)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error?.message||`Erro OpenAI ${r.status}`);
    const txt=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!txt) throw Error('A IA não devolveu texto.');
    const locationMatch=txt.match(/\[LOCAL:([a-z0-9-]{2,80})\]/i);
    const location=locationMatch?locationMatch[1].toLowerCase():(lastLocation||'local-inicial');
    const checkMatch=txt.match(/\[TESTE:([^|\]\n]{2,60})\|(str|dex|con|int|wis|cha)\|(\d{1,2})\]/i);
    let check=null;
    if(checkMatch){
      const dc=Number(checkMatch[3]);
      if(dc>=5&&dc<=30)check={name:checkMatch[1].trim(),ability:checkMatch[2].toLowerCase(),dc};
    }
    const clean=txt.replace(/\[LOCAL:[a-z0-9-]{2,80}\]/gi,'').replace(/\[TESTE:[^\]\n]+\]/gi,'').trim();
    return Response.json({text:clean,location,check});
  }catch(e){return Response.json({error:String(e.message||e)},{status:400});}
};
