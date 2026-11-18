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
export function abilityIncrease(base,bg,mode,first,second){
 const background=BACKGROUNDS[bg];
 if(!background)throw Error('Seleciona um antecedente disponível no SRD.');
 const raw=Object.fromEntries(ABILITY_CODES.map(k=>[k,Number(base[k])]));
 if(STANDARD_ARRAY.some(n=>!Object.values(raw).includes(n))||new Set(Object.values(raw)).size!==6)throw Error('Atribui uma vez cada valor do array padrão: 15, 14, 13, 12, 10, 8.');
 const bonuses=Object.fromEntries(ABILITY_CODES.map(k=>[k,0]));
 if(mode==='triple'){for(const k of background.abilities)bonuses[k]=1}
 else{
  if(!background.abilities.includes(first)||!background.abilities.includes(second)||first===second)throw Error('Seleciona duas características diferentes permitidas pelo antecedente.');
  bonuses[first]=2;bonuses[second]=1;
 }
 return Object.fromEntries(ABILITY_CODES.map(k=>[k,Math.min(20,raw[k]+bonuses[k])]));
}
export function validateCreation({classe,antecedente,raca,periciasClasse,periciaEspecie,atributosBase,modoBonus,bonusPrincipal,bonusSecundario}){
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
 const atributos=abilityIncrease(atributosBase,antecedente,modoBonus,bonusPrincipal,bonusSecundario);
 return {atributos,periciasProficientes:[...new Set([...background.skills,...periciasClasse,...(speciesCount?[periciaEspecie]:[])])],talentoOrigem:background.feat,profFerramenta:background.tool};
}
