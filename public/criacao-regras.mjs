// SRD 5.2.1 — criação de personagem, subconjunto básico verificado.
// Cada classe escolhe N perícias da sua lista; antecedente fixa duas;
// Elfo ganha uma perícia de Sentidos Aguçados; Humano ganha uma perícia adicional.
export const SKILL_NAMES=[
 'Acrobacia','Adestrar Animais','Arcanismo','Atletismo','Atuação','Enganação',
 'Furtividade','História','Intimidação','Intuição','Investigação','Medicina',
 'Natureza','Perceção','Persuasão','Prestidigitação','Religião','Sobrevivência'
];
export const CLASS_SKILLS={
 Barbarian:{count:2,skills:['Adestrar Animais','Atletismo','Intimidação','Natureza','Perceção','Sobrevivência']},
 Bard:{count:3,skills:SKILL_NAMES},
 Cleric:{count:2,skills:['História','Intuição','Medicina','Persuasão','Religião']},
 Druid:{count:2,skills:['Arcanismo','Adestrar Animais','Intuição','Medicina','Natureza','Perceção','Religião','Sobrevivência']},
 Fighter:{count:2,skills:['Acrobacia','Adestrar Animais','Atletismo','História','Intuição','Intimidação','Persuasão','Perceção','Sobrevivência']},
 Monk:{count:2,skills:['Acrobacia','Atletismo','História','Intuição','Religião','Furtividade']},
 Paladin:{count:2,skills:['Atletismo','Intuição','Intimidação','Medicina','Persuasão','Religião']},
 Ranger:{count:3,skills:['Adestrar Animais','Atletismo','Intuição','Investigação','Natureza','Perceção','Furtividade','Sobrevivência']},
 Rogue:{count:4,skills:['Acrobacia','Atletismo','Enganação','Intuição','Intimidação','Investigação','Perceção','Persuasão','Prestidigitação','Furtividade']},
 Sorcerer:{count:2,skills:['Arcanismo','Enganação','Intuição','Intimidação','Persuasão','Religião']},
 Warlock:{count:2,skills:['Arcanismo','Enganação','História','Intimidação','Investigação','Natureza','Religião']},
 Wizard:{count:2,skills:['Arcanismo','História','Intuição','Investigação','Medicina','Natureza','Religião']}
};
export const BACKGROUNDS={
 'Acólito':{skills:['Intuição','Religião'],abilities:['int','wis','cha'],feat:'Iniciado em Magia (Clérigo)',tool:'Material de caligrafia'},
 'Criminoso':{skills:['Prestidigitação','Furtividade'],abilities:['dex','con','int'],feat:'Alerta',tool:'Ferramentas de ladrão'},
 'Sábio':{skills:['Arcanismo','História'],abilities:['con','int','wis'],feat:'Iniciado em Magia (Mago)',tool:'Material de caligrafia'},
 'Soldado':{skills:['Atletismo','Intimidação'],abilities:['str','dex','con'],feat:'Atacante Selvagem',tool:'Conjunto de jogo'}
};
export const ABILITY_LABELS={str:'Força',dex:'Destreza',con:'Constituição',int:'Inteligência',wis:'Sabedoria',cha:'Carisma'};
export const ABILITY_CODES=Object.keys(ABILITY_LABELS);
export const STANDARD_ARRAY=[8,10,12,13,14,15];
export const POINT_COSTS=Object.freeze({8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9});
export const POINT_BUDGET=27;
// Regra caseira pedida pelo utilizador: soma dos seis atributos base até 66.
export const FREE_BUDGET=66;
export const FREE_MIN=3;
export const FREE_MAX=18;
// Tabela "Standard Array by Class" das regras de 2024; ordem STR, DEX, CON, INT, WIS, CHA.
export const CLASS_STANDARD_ARRAY={
 Barbarian:[15,13,14,10,12,8],Bard:[8,14,12,13,10,15],
 Cleric:[14,8,13,10,15,12],Druid:[8,12,14,13,15,10],
 Fighter:[15,14,13,8,10,12],Monk:[12,15,13,10,14,8],
 Paladin:[15,10,13,8,12,14],Ranger:[12,15,13,8,14,10],
 Rogue:[12,15,13,14,10,8],Sorcerer:[10,13,14,8,12,15],
 Warlock:[8,14,13,12,10,15],Wizard:[8,12,13,15,14,10]
};
export const ABILITY_METHODS=['free','point','standard','rolled'];
export function baseValues(base){
 return ABILITY_CODES.map(k=>Number(base?.[k]));
}
export function freeAbilityTotal(base){
 const scores=baseValues(base);
 if(scores.some(v=>!Number.isInteger(v)||v<FREE_MIN||v>FREE_MAX))
  throw Error('Distribuição livre: cada atributo deve estar entre '+FREE_MIN+' e '+FREE_MAX+'.');
 return scores.reduce((sum,value)=>sum+value,0);
}
export function pointCostTotal(base){
 const scores=baseValues(base);
 if(scores.some(v=>!Number.isInteger(v)||!(v in POINT_COSTS)))
  throw Error('Na compra de pontos, cada atributo deve estar entre 8 e 15.');
 return scores.reduce((sum,score)=>sum+POINT_COSTS[score],0);
}
export function validateAbilityScores(base,method='standard',rolledPool=[]){
 const values=baseValues(base);
 if(values.length!==6||values.some(v=>!Number.isInteger(v)))throw Error('Cada atributo precisa de um valor inteiro.');
 if(method==='free'){
  const total=freeAbilityTotal(base);
  if(total>FREE_BUDGET)throw Error('Distribuição livre: ultrapassaste os 66 pontos em '+(total-FREE_BUDGET)+'. Reduz outros atributos para compensar.');
 }else if(method==='standard'){
  if([...values].sort((a,b)=>a-b).join(',')!==STANDARD_ARRAY.join(','))
   throw Error('Array padrão: distribui 15, 14, 13, 12, 10 e 8, cada um uma vez.');
 }else if(method==='point'){
  const cost=pointCostTotal(base);
  if(cost>POINT_BUDGET)throw Error('Compra de pontos: usaste '+cost+' dos 27 pontos disponíveis. Reduz outros atributos.');
 }else if(method==='rolled'){
  if(!Array.isArray(rolledPool)||rolledPool.length!==6||rolledPool.some(v=>!Number.isInteger(v)||v<3||v>18))
   throw Error('Gera primeiro os seis atributos com 4d6, descartando o menor.');
  if([...values].sort((a,b)=>a-b).join(',')!==[...rolledPool].sort((a,b)=>a-b).join(','))
   throw Error('Os seis atributos devem corresponder aos resultados dos dados, sem criar valores novos.');
 }else throw Error('Método de criação dos atributos inválido.');
 return true;
}
export function recommendedAbilities(className,method='standard',rolledPool=[]){
 const template=CLASS_STANDARD_ARRAY[className]||CLASS_STANDARD_ARRAY.Wizard;
 let values;
 if(method==='rolled'){
  if(!Array.isArray(rolledPool)||rolledPool.length!==6||rolledPool.some(v=>!Number.isInteger(v)||v<3||v>18))
   throw Error('Lança primeiro os dados para obter seis valores.');
  const ranked=[...rolledPool].sort((a,b)=>b-a);
  const positions=template.map((score,i)=>({score,i})).sort((a,b)=>b.score-a.score);
  values=new Array(6);
  positions.forEach((item,rank)=>{values[item.i]=ranked[rank]});
 }else if(method==='free'){
  const freeRanks=[17,14,12,9,8,6]; // Total 66; prioridades ordenadas pela classe.
  const positions=template.map((score,i)=>({score,i})).sort((a,b)=>b.score-a.score);
  values=new Array(6);
  positions.forEach((item,rank)=>{values[item.i]=freeRanks[rank]});
 }else values=[...template]; // Também corresponde a uma compra legal de 27 pontos.
 return Object.fromEntries(ABILITY_CODES.map((code,i)=>[code,values[i]]));
}
export function rollAbilityPool(d6){
 if(typeof d6!=='function')throw Error('É necessário um lançador de d6.');
 const rolls=Array.from({length:6},()=>{
  const dice=Array.from({length:4},()=>Number(d6()));
  if(dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Resultado inválido num d6.');
  const sorted=[...dice].sort((a,b)=>b-a);
  return {dice,value:sorted[0]+sorted[1]+sorted[2]};
 });
 return {values:rolls.map(x=>x.value),rolls};
}
export function abilityIncrease(base,bg,mode,first,second,method='standard',rolledPool=[]){
 const background=BACKGROUNDS[bg];
 if(!background)throw Error('Seleciona um antecedente disponível no SRD.');
 validateAbilityScores(base,method,rolledPool);
 const raw=Object.fromEntries(ABILITY_CODES.map(k=>[k,Number(base[k])]));
 const bonuses=Object.fromEntries(ABILITY_CODES.map(k=>[k,0]));
 if(mode==='triple'){for(const k of background.abilities)bonuses[k]=1}
 else if(mode==='dual'){
  if(!background.abilities.includes(first)||!background.abilities.includes(second)||first===second)
   throw Error('Seleciona duas características diferentes permitidas pelo antecedente.');
  bonuses[first]=2;bonuses[second]=1;
 }else throw Error('Distribuição dos aumentos do antecedente inválida.');
 return Object.fromEntries(ABILITY_CODES.map(k=>[k,Math.min(20,raw[k]+bonuses[k])]));
}
export function validateCreation({classe,antecedente,raca,periciasClasse,periciaEspecie,atributosBase,modoBonus,bonusPrincipal,bonusSecundario,metodoAtributos='standard',valoresRolados=[]}){
 const config=CLASS_SKILLS[classe],background=BACKGROUNDS[antecedente];
 if(!config)throw Error('Classe inválida.');
 if(!background)throw Error('Seleciona um dos antecedentes SRD disponíveis.');
 if(!Array.isArray(periciasClasse)||periciasClasse.length!==config.count||new Set(periciasClasse).size!==config.count)
  throw Error('Escolhe exatamente '+config.count+' perícias da classe '+classe+'.');
 const reserved=new Set(background.skills);
 if(periciasClasse.some(s=>!config.skills.includes(s)||reserved.has(s)))throw Error('A classe não pode escolher uma perícia repetida do antecedente.');
 const speciesCount=raca==='Elfo'||raca==='Humano'?1:0;
 if(speciesCount){
  const available=raca==='Elfo'?['Intuição','Perceção','Sobrevivência']:SKILL_NAMES;
  if(!available.includes(periciaEspecie)||reserved.has(periciaEspecie)||periciasClasse.includes(periciaEspecie))
   throw Error('A perícia extra da espécie tem de ser válida e diferente das restantes.');
 }else if(periciaEspecie)throw Error('Esta espécie não recebe uma perícia extra genérica.');
 const atributos=abilityIncrease(atributosBase,antecedente,modoBonus,bonusPrincipal,bonusSecundario,metodoAtributos,valoresRolados);
 return {atributos,periciasProficientes:[...new Set([...background.skills,...periciasClasse,...(speciesCount?[periciaEspecie]:[])])],talentoOrigem:background.feat,profFerramenta:background.tool};
}
