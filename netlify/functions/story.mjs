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
    const isOpeningScene=!lastLocation && !(data.messages||[]).some(m=>m.role==='assistant');
    const campaignStart={
      'O Limiar do Véu':'blackwood-ruinas',
      'O Farol de Cinzabruma':'porto-cinzabruma',
      'As Chaves das Estrelas':'observatorio-exterior'
    }[campaign];
    const messages=(data.messages||[]).filter(m=>['user','assistant'].includes(m.role)).slice(-24).map(m=>({role:m.role,content:String(m.content||'').slice(0,5000)}));
    if(!messages.length || messages.at(-1).role!=='user') throw Error('Falta a ação do jogador.');
    const catalog={
      'O Limiar do Véu':['aldeia-blackwood','trilha-sombria','circulo-pedras','blackwood-ruinas','sala-ruinas','escadaria-torre','cripta-subterranea','camara-ritual'],
      'O Farol de Cinzabruma':['porto-cinzabruma','vila-cinzabruma','falesia-tempestuosa','exterior-farol','interior-farol','tunel-contrabandistas','sala-da-lanterna','gruta-oculta'],
      'As Chaves das Estrelas':['observatorio-exterior','observatorio-cupula','sala-dos-mapas','corredor-celeste','camara-astral','biblioteca-estelar','jardim-constelacao','portal-estelar']
    };
    const knownLocations=catalog[campaign]||[];
    const initialLocationInstruction=isOpeningScene&&campaignStart?`Esta é a CENA DE ABERTURA, que decorre OBRIGATORIAMENTE em ${campaignStart}. Descreve o grupo fisicamente nesse local, e não num local próximo; a aldeia pode ser mencionada à distância, mas não é onde estão. Termina com [LOCAL:${campaignStart}].`:'';
    const system=`És Mestre de Jogo de uma aventura de fantasia heroica inspirada em D&D, escrita em português europeu. Narrativa imersiva, escolhas significativas, personagens consistentes, perigos e consequências. Não decides ações do jogador. Se a ficha incluir companheiros IA, interpretas as suas decisões e diálogos de forma autónoma, sem exceder o número indicado, e respeitas os seus recursos. Nunca mudes arbitrariamente os atributos da ficha. Usa a ficha fornecida e mantém coerência com o histórico. Usa regras simplificadas e explica os testes ou resultados quando necessário. Responde em 2-5 parágrafos, termina com exatamente três opções concisas numa lista em três linhas separadas, começadas por 1., 2. e 3. sem subitens nem quebras dentro das opções. As escolhas serão apresentadas como botões, e o jogador poderá também escrever qualquer ação. Quando apropriado, apresenta uma sugestão de lançamento de d20 e CD; não inventes que um dado foi lançado. Evita conteúdo gráfico extremo. Segue o SRD 5.2.1, sem inventar resultados de lançamentos. No FIM da resposta acrescenta uma linha [LOCAL:identificador-do-local], por exemplo [LOCAL:floresta-blackwood]. Mantém o identificador se continuarem no mesmo local e muda quando realmente se deslocarem. Se a cena ocorrer num dos seguintes locais conhecidos, utiliza OBRIGATORIAMENTE o seu identificador canónico, mesmo quando a descrição tenha sinónimos: ${knownLocations.join(', ')}. Não juntes exterior, interior, escadaria e cripta como se fossem um único local. Só inventes novo identificador para um local realmente novo, não para outra perspetiva do mesmo espaço. Local anterior: ${lastLocation}. ${initialLocationInstruction} Campanha: ${campaign}. Premissa: ${intro}. FICHA: ${JSON.stringify(char)}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions:system,input:messages,max_output_tokens:850}),signal:AbortSignal.timeout(54000)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error?.message||`Erro OpenAI ${r.status}`);
    const txt=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!txt) throw Error('A IA não devolveu texto.');
    const match=txt.match(/\[LOCAL:([a-z0-9-]{2,80})\]\s*$/i);
    // A localização da abertura é uma regra da campanha, não uma escolha livre do modelo.
    const location=isOpeningScene&&campaignStart?campaignStart:
      (match?match[1].toLowerCase():(lastLocation||'local-inicial'));
    const clean=match?txt.slice(0,match.index).trim():txt;
    // O identificador do modelo pode ficar atrasado face à sua própria narrativa.
    // Corrigir apenas um regresso explícito à torre, não meras referências às ruínas.
    const returnedToTower=campaign==='O Limiar do Véu'&&lastLocation==='aldeia-blackwood'
      &&location==='aldeia-blackwood'
      &&/(?:regressas?|voltas?|aproximas-te|chegas?|diriges-te|encontras-te|est[aá]s)\s+(?:de novo\s+)?(?:[àa]\s+|para\s+|junto\s+[àa]\s+|perto\s+d[aeo]\s+)?(?:entrada\s+d[aeo]\s+)?(?:torre|ru[ií]nas)|(?:[àa]\s+)?entrada\s+d[aeo]\s+torre/i.test(clean);
    const resolvedLocation=returnedToTower?'blackwood-ruinas':location;
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
    // Garantir sempre três ações mesmo quando a IA omite a lista ou fica sem tokens.
    const continuation=choices.length===3?choices:
      /escadaria|escadas/i.test(narrative)&&/inscri[cç][oõ]es|s[ií]mbolos|runa/i.test(narrative)
      ?['Descer a escadaria com o grupo, atento a armadilhas e perigos.','Examinar as ruínas à procura de outra passagem mais segura.','Investigar os símbolos mágicos antes de avançar (teste de Investigação).']
      :/inscri[cç][oõ]es|s[ií]mbolos|runa/i.test(narrative)
      ?['Examinar os símbolos e procurar compreender o seu significado.','Pedir aos companheiros que procurem pistas e passagens ocultas.','Avançar com cautela e observar qualquer reação mágica.']
      :['Investigar os arredores à procura de pistas e perigos.','Conversar com os companheiros e decidir em conjunto o próximo passo.','Avançar cautelosamente para explorar o que existe à frente.'];
    return Response.json({text:narrative||clean,location:resolvedLocation,choices:continuation});
  }catch(e){return Response.json({error:String(e.message||e)},{status:400});}
};
