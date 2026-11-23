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
    const previousAdventures=Array.isArray(data.previousAdventures)?data.previousAdventures.slice(0,2):[];
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
    const system=`És Mestre de Jogo de uma aventura de fantasia heroica inspirada em D&D, escrita em português europeu. Narrativa imersiva, escolhas significativas, personagens consistentes, perigos e consequências. Não decides ações do jogador. Se a ficha incluir companheiros IA, interpretas as suas decisões e diálogos de forma autónoma, sem exceder o número indicado, e respeitas os seus recursos. Nunca mudes arbitrariamente os atributos da ficha. Usa a ficha fornecida e mantém coerência com o histórico. Usa regras simplificadas e explica os testes ou resultados quando necessário. Responde em 2-5 parágrafos de narrativa e, quando NÃO há teste pendente, cria exatamente três ações concretas adequadas à situação, com verbos e objetos específicos presentes na cena. As três opções devem ser linhas isoladas no fim, no formato [OPCAO:ação completa] (três linhas). Não acrescentes uma lista 1., 2., 3. nem sugiras outras três opções em texto corrido: a interface mostra estas ações como botões. Não reutilizes opções genéricas de exploração, conversa e avanço que não correspondam ao local. O jogador pode sempre escrever outra ação. Quando uma ação exigir um teste de habilidade ou salvaguarda, NÃO narres o resultado da ação antes de o jogador lançar o dado. Em vez disso, apresenta o pedido do teste (nome e CD) e inclui a linha exata [TESTE:nome|atributo|CD|tipo] antes do marcador LOCAL, por exemplo [TESTE:Perceção|wis|13|pericia], [TESTE:Salvaguarda de Constituição|con|14|salvaguarda], [TESTE:Força|str|12|atributo]. Atributo deve ser str,dex,con,int,wis,cha; CD de 5 a 30; tipo pericia, salvaguarda ou atributo. Não peças mais de um teste de cada vez. Quando pedires um teste, não mostres as três opções de ação; a próxima interação tem de ser o lançamento do dado para resolver a ação atual. Se a última mensagem tiver "RESULTADO DE TESTE", a rolagem já aconteceu: respeita obrigatoriamente o total, a CD e o sucesso/falha e continua a narrativa com as consequências, SEM repetir o teste, sem gerar um resultado diferente e sem conceder XP só por um lançamento. Apenas pede novo teste para uma situação realmente diferente. Evita conteúdo gráfico extremo. Segue o SRD 5.2.1, sem inventar resultados de lançamentos. Atribui experiência ao grupo APENAS quando um objetivo relevante foi realmente concluído (descoberta importante, obstáculo resolvido ou vitória), nunca por mera deslocação, conversa, tentativas repetidas ou apenas começar a campanha. Acrescenta antes do marcador LOCAL a linha [XP:0] por defeito, ou [XP:25], [XP:50], [XP:75] ou [XP:100] quando se justificar uma recompensa por conquista efetiva. Não repitas recompensas por feitos já obtidos. Para qualquer XP maior que zero inclui também a linha [FEITO:campanha-objetivo-concluido] com identificador estável em letras minúsculas e hífen (exemplo [FEITO:veu-primeira-cripta]); se não houver feito concluído usa apenas [XP:0]. Ajusta a dificuldade, adversários, encontros, provas e recompensas ao nível atual da personagem e dos companheiros, mantendo a identidade do enredo. Um grupo veterano não recomeça no nível 1 ao entrar noutra aventura. Respeita as relações, descobertas e consequências de campanhas anteriores quando fornecidas. No FIM da resposta acrescenta uma linha [LOCAL:identificador-do-local], por exemplo [LOCAL:floresta-blackwood]. Mantém o identificador se continuarem no mesmo local e muda quando realmente se deslocarem. Se a cena ocorrer num dos seguintes locais conhecidos, utiliza OBRIGATORIAMENTE o seu identificador canónico, mesmo quando a descrição tenha sinónimos: ${knownLocations.join(', ')}. Não juntes exterior, interior, escadaria e cripta como se fossem um único local. Só inventes novo identificador para um local realmente novo, não para outra perspetiva do mesmo espaço. Local anterior: ${lastLocation}. ${initialLocationInstruction} Campanha: ${campaign}. Premissa: ${intro}. Histórico de outras aventuras desta personagem (sem misturar os locais): ${JSON.stringify(previousAdventures).slice(0,1600)}. FICHA: ${JSON.stringify(char)}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.STORY_MODEL||'gpt-4.1-mini',instructions:system,input:messages,max_output_tokens:1150}),signal:AbortSignal.timeout(54000)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error?.message||`Erro OpenAI ${r.status}`);
    const txt=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!txt) throw Error('A IA não devolveu texto.');
    const achievementMatch=txt.match(/\[FEITO:([a-z0-9-]{5,72})\]/i);
    const xpMatch=txt.match(/\[XP:(0|25|50|75|100)\]/i);
    const experienceAward=isOpeningScene?0:Number(xpMatch?.[1]||0);
    const match=txt.match(/\[LOCAL:([a-z0-9-]{2,80})\]\s*$/i);
    // A localização da abertura é uma regra da campanha, não uma escolha livre do modelo.
    const location=isOpeningScene&&campaignStart?campaignStart:
      (match?match[1].toLowerCase():(lastLocation||'local-inicial'));
    const checkMatch=txt.match(/\[TESTE:([^|\]\n]{2,60})\|(str|dex|con|int|wis|cha)\|(\d{1,2})\|(pericia|salvaguarda|atributo)\]/i);
    const requestedCheck=checkMatch&&Number(checkMatch[3])>=5&&Number(checkMatch[3])<=30
      ?{name:checkMatch[1].trim(),ability:checkMatch[2].toLowerCase(),dc:Number(checkMatch[3]),type:checkMatch[4].toLowerCase()}:null;
    const clean=(match?txt.slice(0,match.index).trim():txt)
      .replace(/\[(?:XP:\d+|FEITO:[a-z0-9-]+)\]/gi,'')
      .replace(/\[TESTE:[^\]\n]+\]/gi,'').trim();
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
    // Não tratar sugestões de ações futuras como deslocações que já aconteceram.
    const locationNarrative=clean.split(/\r?\n/).filter(line=>!/^\s*(?:\*\*)?[1-3][.)]/.test(line)).join('\n');
    const sentences=locationNarrative.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
    const lastPhysicalMove=sentences.reduce((found,sentence)=>{
      for(const [id,pattern] of (destinations[campaign]||[]))if(pattern.test(sentence))return id;
      return found;
    },'');
    // Se o Mestre reportou um local canónico que contradiz a deslocação explícita,
    // resolver a divergência antes de pedir a imagem ao Supabase.
    const resolvedLocation=lastPhysicalMove|| (returnedToTower?'blackwood-ruinas':location);
    // Nunca criar opções genéricas desconectadas da narrativa.
    // Prioridade: três marcadores estruturados, lista numerada real, ou frase final com três ações explícitas.
    const markerChoices=[...clean.matchAll(/\[OPCAO:([^\]\n]{4,320})\]/gi)].map(m=>m[1].trim());
    let narrative=clean.replace(/\[OPCAO:[^\]\n]+\]/gi,'').trim();
    const numbered=[];
    const numberedLines=narrative.split(/\r?\n/);
    for(const line of numberedLines){
      const match=line.match(/^\s*(?:\*\*)?([1-3])[.)](?:\*\*)?\s+(.+?)\s*$/);
      if(match&&Number(match[1])===numbered.length+1&&match[2].trim().length>=4){
        numbered.push(match[2].replace(/\*\*/g,'').trim());
      }
    }
    let continuation=markerChoices.length===3?markerChoices:numbered.length===3?numbered:[];
    if(continuation.length===3&&numbered.length===3){
      narrative=numberedLines.filter(line=>!/^\s*(?:\*\*)?[1-3][.)](?:\*\*)?\s+/.test(line)).join('\n').trim();
    }
    // Compatibilidade com respostas que exprimem três opções no mesmo parágrafo.
    if(continuation.length!==3){
      const paragraphs=narrative.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
      const candidate=paragraphs.at(-1)||'';
      const match=candidate.match(/^(?:Podes|Podem|Poderás)\s+(?:tentar\s+)?(.+?)[.!?]?$/is);
      if(match){
        const options=match[1].replace(/[.!?]+$/,'').split(/,\s+|\s+ou\s+(?=(?:acionar|usar|lançar|investigar|procurar|seguir|abrir|examinar|puxar|falar|esperar|tentar|explorar)\b)/i).map(s=>s.trim());
        if(options.length===3&&options.every(s=>s.length>=8&&s.length<=180)){
          continuation=options.map(s=>s[0].toUpperCase()+s.slice(1)+'.');
        }
      }
    }
    if(continuation.length!==3)continuation=[]; // Sem botões falsos: texto livre continua disponível.
    return Response.json({text:narrative||clean,location:resolvedLocation,
      choices:requestedCheck?[]:continuation,check:requestedCheck,
      experience_award:requestedCheck?0:(achievementMatch?experienceAward:0),
      achievement_id:requestedCheck?null:(achievementMatch?.[1]||null)});
  }catch(e){return Response.json({error:String(e.message||e)},{status:400});}
};
