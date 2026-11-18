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
    const system=`És Mestre de Jogo de uma aventura de fantasia heroica inspirada em D&D, escrita em português europeu. Narrativa imersiva, escolhas significativas, personagens consistentes, perigos e consequências. Não decides ações do jogador. Se a ficha incluir companheiros IA, interpretas as suas decisões e diálogos de forma autónoma, sem exceder o número indicado, e respeitas os seus recursos. Nunca mudes arbitrariamente os atributos da ficha. Usa a ficha fornecida e mantém coerência com o histórico. Usa regras simplificadas e explica os testes ou resultados quando necessário. Responde em 2-5 parágrafos, termina com exatamente três opções concisas numa lista em três linhas separadas, começadas por 1., 2. e 3. sem subitens nem quebras dentro das opções. As escolhas serão apresentadas como botões, e o jogador poderá também escrever qualquer ação. Quando apropriado, apresenta uma sugestão de lançamento de d20 e CD; não inventes que um dado foi lançado. Evita conteúdo gráfico extremo. Segue o SRD 5.2.1, sem inventar resultados de lançamentos. Atribui experiência ao grupo APENAS quando um objetivo relevante foi realmente concluído (descoberta importante, obstáculo resolvido ou vitória), nunca por mera deslocação, conversa, tentativas repetidas ou apenas começar a campanha. Acrescenta antes do marcador LOCAL a linha [XP:0] por defeito, ou [XP:25], [XP:50], [XP:75] ou [XP:100] quando se justificar uma recompensa por conquista efetiva. Não repitas recompensas por feitos já obtidos. No FIM da resposta acrescenta uma linha [LOCAL:identificador-do-local], por exemplo [LOCAL:floresta-blackwood]. Mantém o identificador se continuarem no mesmo local e muda quando realmente se deslocarem. Se a cena ocorrer num dos seguintes locais conhecidos, utiliza OBRIGATORIAMENTE o seu identificador canónico, mesmo quando a descrição tenha sinónimos: ${knownLocations.join(', ')}. Não juntes exterior, interior, escadaria e cripta como se fossem um único local. Só inventes novo identificador para um local realmente novo, não para outra perspetiva do mesmo espaço. Local anterior: ${lastLocation}. ${initialLocationInstruction} Campanha: ${campaign}. Premissa: ${intro}. FICHA: ${JSON.stringify(char)}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions:system,input:messages,max_output_tokens:850}),signal:AbortSignal.timeout(54000)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error?.message||`Erro OpenAI ${r.status}`);
    const txt=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!txt) throw Error('A IA não devolveu texto.');
    const xpMatch=txt.match(/\[XP:(0|25|50|75|100)\]/i);
    const experienceAward=isOpeningScene?0:Number(xpMatch?.[1]||0);
    const match=txt.match(/\[LOCAL:([a-z0-9-]{2,80})\]\s*$/i);
    // A localização da abertura é uma regra da campanha, não uma escolha livre do modelo.
    const location=isOpeningScene&&campaignStart?campaignStart:
      (match?match[1].toLowerCase():(lastLocation||'local-inicial'));
    const clean=(match?txt.slice(0,match.index).trim():txt).replace(/\[XP:\d+\]/gi,'').trim();
    // O identificador do modelo pode ficar atrasado face à sua própria narrativa.
    // Corrigir apenas um regresso explícito à torre, não meras referências às ruínas.
    const returnedToTower=campaign==='O Limiar do Véu'&&lastLocation==='aldeia-blackwood'
      &&location==='aldeia-blackwood'
      &&/(?:regressas?|voltas?|aproximas-te|chegas?|diriges-te|encontras-te|est[aá]s)\s+(?:de novo\s+)?(?:[àa]\s+|para\s+|junto\s+[àa]\s+|perto\s+d[aeo]\s+)?(?:entrada\s+d[aeo]\s+)?(?:torre|ru[ií]nas)|(?:[àa]\s+)?entrada\s+d[aeo]\s+torre/i.test(clean);
    // A narrativa tem precedência sobre um marcador LOCAL desatualizado quando
    // descreve uma deslocação física inequívoca. Funciona nas três campanhas.
    const destinations={
      'O Limiar do Véu':[
        ['cripta-subterranea', /(?:entras?|penetras?|desces?|chegas?|avan[cç]as?|encontras?-te|regressas?)\b[^.!?]{0,100}\b(?:cripta|c[aâ]mara funer[aá]ria)/i],
        ['camara-ritual', /(?:entras?|penetras?|chegas?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:c[aâ]mara do artefacto|c[aâ]mara ritual|sala do artefacto)/i],
        ['escadaria-torre', /(?:entras?|penetras?|desces?|sobes?|chegas?|avan[cç]as?|encontras?-te|segues?)\b[^.!?]{0,95}\b(?:escadaria|escadas|degraus)\b/i],
        ['sala-ruinas', /(?:entras?|penetras?|chegas?|avan[cç]as?|encontras?-te|atravessas?)\b[^.!?]{0,95}\b(?:interior da torre|sal[aã]o das ru[ií]nas|sala da torre)/i],
        ['blackwood-ruinas', /(?:regressas?|voltas?|aproximas-te|chegas?|diriges-te|encontras-te|est[aá]s)\b[^.!?]{0,85}\b(?:ru[ií]nas|torre|entrada da torre)/i],
        ['aldeia-blackwood', /(?:regressas?|voltas?|chegas?|entras?|atravessas?|diriges-te)\b[^.!?]{0,80}\b(?:aldeia|vila|mercado)\b/i],
        ['circulo-pedras', /(?:chegas?|entras?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:c[ií]rculo de pedras|menires|clareira sagrada)/i],
        ['trilha-sombria', /(?:entras?|avan[cç]as?|chegas?|caminhas?|segues?|regressas?)\b[^.!?]{0,90}\b(?:floresta|trilho|trilha|bosque)/i]
      ],
      'O Farol de Cinzabruma':[
        ['sala-da-lanterna', /(?:entras?|chegas?|sobes?|atinges?|encontras?-te)\b[^.!?]{0,90}\b(?:sala da lanterna|topo do farol|lanterna do farol)/i],
        ['tunel-contrabandistas', /(?:entras?|avan[cç]as?|desces?|chegas?|encontras?-te|atravessas?)\b[^.!?]{0,90}\b(?:t[uú]nel|passagem secreta)/i],
        ['gruta-oculta', /(?:entras?|chegas?|descobres?|encontras?-te|avan[cç]as?)\b[^.!?]{0,90}\b(?:gruta|caverna)/i],
        ['interior-farol', /(?:entras?|penetr[aá]s?|sobes?|encontras?-te|avan[cç]as?)\b[^.!?]{0,80}\b(?:interior do farol|escadaria do farol|dentro do farol)/i],
        ['exterior-farol', /(?:chegas?|regressas?|aproximas-te|diriges-te|encontras?-te)\b[^.!?]{0,80}\b(?:base do farol|exterior do farol|entrada do farol)/i],
        ['falesia-tempestuosa', /(?:chegas?|atravessas?|avan[cç]as?|segues?|encontras?-te)\b[^.!?]{0,80}\b(?:fal[eé]sia|fal[eé]sias)/i],
        ['vila-cinzabruma', /(?:chegas?|regressas?|entras?|avan[cç]as?|atravessas?)\b[^.!?]{0,80}\b(?:vila|aldeia|mercado)/i],
        ['porto-cinzabruma', /(?:chegas?|regressas?|entras?|avan[cç]as?|atravessas?|encontras?-te)\b[^.!?]{0,80}\b(?:porto|cais|docas)/i]
      ],
      'As Chaves das Estrelas':[
        ['portal-estelar', /(?:entras?|atravessas?|chegas?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:portal|santu[aá]rio das chaves)/i],
        ['jardim-constelacao', /(?:chegas?|entras?|atravessas?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:jardim|terra[cç]o das constela[cç][oõ]es)/i],
        ['biblioteca-estelar', /(?:chegas?|entras?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:biblioteca|arquivo astral)/i],
        ['camara-astral', /(?:chegas?|entras?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:c[aâ]mara astral|c[aâ]mara das estrelas|santu[aá]rio astral)/i],
        ['corredor-celeste', /(?:chegas?|entras?|avan[cç]as?|atravessas?|encontras?-te|segues?)\b[^.!?]{0,90}\b(?:corredor|passagem das ru[ií]nas)/i],
        ['sala-dos-mapas', /(?:chegas?|entras?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:sala dos mapas|cartografia astral)/i],
        ['observatorio-cupula', /(?:chegas?|entras?|sobes?|avan[cç]as?|encontras?-te)\b[^.!?]{0,90}\b(?:c[uú]pula|telesc[oó]pio principal)/i],
        ['observatorio-exterior', /(?:chegas?|regressas?|aproximas-te|encontras?-te)\b[^.!?]{0,90}\b(?:exterior do observat[oó]rio|entrada do observat[oó]rio|planalto)/i]
      ]
    };
    const sentences=clean.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
    const lastPhysicalMove=sentences.reduce((found,sentence)=>{
      for(const [id,pattern] of (destinations[campaign]||[]))if(pattern.test(sentence))return id;
      return found;
    },'');
    // Se o Mestre reportou um local canónico que contradiz a deslocação explícita,
    // resolver a divergência antes de pedir a imagem ao Supabase.
    const resolvedLocation=lastPhysicalMove|| (returnedToTower?'blackwood-ruinas':location);
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
    return Response.json({text:narrative||clean,location:resolvedLocation,choices:continuation,experience_award:experienceAward});
  }catch(e){return Response.json({error:String(e.message||e)},{status:400});}
};
