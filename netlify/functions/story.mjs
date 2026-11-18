import {requireGameUser,gameAuthError} from './_game-auth.mjs';
export default async (request) => {
  if (request.method !== 'POST') return Response.json({error:'Método inválido'},{status:405});
  try{await requireGameUser(request)}catch(e){return gameAuthError(e)}
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
    const system=`És Mestre de Jogo de uma aventura de fantasia heroica inspirada em D&D, escrita em português europeu. Narrativa imersiva, escolhas significativas, personagens consistentes, perigos e consequências. Não decides ações do jogador. Se a ficha incluir companheiros IA, interpretas as suas decisões e diálogos de forma autónoma, sem exceder o número indicado, e respeitas os seus recursos. Nunca mudes arbitrariamente os atributos da ficha. Usa a ficha fornecida e mantém coerência com o histórico. Usa regras simplificadas e explica os testes ou resultados quando necessário. Responde em 2-5 parágrafos, termina com exatamente três opções concisas numa lista em três linhas separadas, começadas por 1., 2. e 3. sem subitens nem quebras dentro das opções. As escolhas serão apresentadas como botões, e o jogador poderá também escrever qualquer ação. Quando apropriado, apresenta uma sugestão de lançamento de d20 e CD; não inventes que um dado foi lançado. Evita conteúdo gráfico extremo. Segue o SRD 5.2.1, sem inventar resultados de lançamentos. No FIM da resposta acrescenta uma linha [LOCAL:identificador-do-local], por exemplo [LOCAL:floresta-blackwood]. Mantém o identificador se continuarem no mesmo local e muda quando realmente se deslocarem. Local anterior: ${lastLocation}. Campanha: ${campaign}. Premissa: ${intro}. FICHA: ${JSON.stringify(char)}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions:system,input:messages,max_output_tokens:850}),signal:AbortSignal.timeout(54000)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error?.message||`Erro OpenAI ${r.status}`);
    const txt=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!txt) throw Error('A IA não devolveu texto.');
    const match=txt.match(/\[LOCAL:([a-z0-9-]{2,80})\]\s*$/i);
    const location=match?match[1].toLowerCase():(lastLocation||'local-inicial');
    const clean=match?txt.slice(0,match.index).trim():txt;
    // Extract player choices into explicit UI actions instead of repeating them in the narrative.
    // Supports 1. / 1) and optional Markdown formatting.
    const lines=clean.split(/\r?\n/);
    const choices=[];
    let first=-1,last=-1;
    for(let i=0;i<lines.length;i++){
      const m=lines[i].match(/^\s*(?:\*\*)?([1-3])[.)](?:\*\*)?\s+(.+?)\s*$/);
      if(m){
        const number=Number(m[1]);
        const value=m[2].replace(/\*\*/g,'').trim();
        if(number===choices.length+1&&value.length>3&&value.length<320){
          if(first<0)first=i;
          choices.push(value);last=i;
        }
      }
    }
    let narrative=clean;
    if(choices.length===3&&first>=0){
      const before=lines.slice(0,first);
      const after=lines.slice(last+1).filter(line=>!/^\s*(?:podes|também podes|em alternativa|ou podes)\b/i.test(line));
      narrative=[...before,...after].join('\n').trim();
    }
    return Response.json({text:narrative||clean,location,choices:choices.length===3?choices:[]});
  }catch(e){return Response.json({error:String(e.message||e)},{status:400});}
};
