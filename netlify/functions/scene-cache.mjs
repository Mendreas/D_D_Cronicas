import {requireGameUser,gameAuthError} from './_game-auth.mjs';
// Netlify: cache persistente de ilustrações solo no Supabase.
// Nunca devolve chaves privadas ao browser. Bucket scene-images é público
// (incluindo imagens das ações): não usar para conteúdo confidencial.
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const normalize=s=>String(s||'').trim().toLowerCase().replace(/_/g,'-');
const idPattern=/^[a-z0-9-]{2,80}$/;
const campaignIds=new Set(['veu','farol','estrelas']);
const aliasMap={"veu|aldeia-blackwood":"aldeia-blackwood","veu|vila-blackwood":"aldeia-blackwood","veu|blackwood-aldeia":"aldeia-blackwood","veu|aldeia-proxima":"aldeia-blackwood","veu|mercado-blackwood":"aldeia-blackwood","veu|trilha-sombria":"trilha-sombria","veu|floresta-blackwood":"trilha-sombria","veu|trilha-sombreada-floresta":"trilha-sombria","veu|caminho-blackwood":"trilha-sombria","veu|trilho-floresta":"trilha-sombria","veu|circulo-pedras":"circulo-pedras","veu|circulo-ritual-floresta":"circulo-pedras","veu|clareira-dos-menires":"circulo-pedras","veu|clareira-sagrada":"circulo-pedras","veu|blackwood-ruinas":"blackwood-ruinas","veu|ruinas-torre-blackwood":"blackwood-ruinas","veu|blackwood-ruinas-torre-exterior":"blackwood-ruinas","veu|ruinas-blackwood":"blackwood-ruinas","veu|torre-blackwood":"blackwood-ruinas","veu|torre-abandonada":"blackwood-ruinas","veu|sala-ruinas":"sala-ruinas","veu|interior-torre":"sala-ruinas","veu|sala-da-torre":"sala-ruinas","veu|ruinas-sala":"sala-ruinas","veu|corredor-estreito-ruinas":"sala-ruinas","veu|escadaria-torre":"escadaria-torre","veu|escadas-torre":"escadaria-torre","veu|escadaria-espiral":"escadaria-torre","veu|escadaria-antiga":"escadaria-torre","veu|cripta-subterranea":"cripta-subterranea","veu|cripta-blackwood":"cripta-subterranea","veu|cripta-antiga":"cripta-subterranea","veu|camara-funeraria":"cripta-subterranea","veu|camara-ritual":"camara-ritual","veu|camara-do-artefacto":"camara-ritual","veu|sala-do-artefacto":"camara-ritual","veu|sala-ritual":"camara-ritual","veu|camara-magica":"camara-ritual","farol|porto-cinzabruma":"porto-cinzabruma","farol|porto-nebuloso":"porto-cinzabruma","farol|porto-tempestade":"porto-cinzabruma","farol|cais-cinzabruma":"porto-cinzabruma","farol|porto":"porto-cinzabruma","farol|vila-cinzabruma":"vila-cinzabruma","farol|aldeia-cinzabruma":"vila-cinzabruma","farol|vila-costeira":"vila-cinzabruma","farol|mercado-cinzabruma":"vila-cinzabruma","farol|falesia-tempestuosa":"falesia-tempestuosa","farol|falesias-abaixo-do-farol":"falesia-tempestuosa","farol|falesias-do-norte":"falesia-tempestuosa","farol|falesia":"falesia-tempestuosa","farol|falesias":"falesia-tempestuosa","farol|exterior-farol":"exterior-farol","farol|farol-exterior-tempestade":"exterior-farol","farol|farol-exterior":"exterior-farol","farol|farol-cinzabruma":"exterior-farol","farol|base-do-farol":"exterior-farol","farol|interior-farol":"interior-farol","farol|farol-interior":"interior-farol","farol|escadaria-farol":"interior-farol","farol|salas-farol":"interior-farol","farol|tunel-contrabandistas":"tunel-contrabandistas","farol|tunel-contrabando":"tunel-contrabandistas","farol|passagem-secreta-farol":"tunel-contrabandistas","farol|tunel-subterraneo":"tunel-contrabandistas","farol|sala-da-lanterna":"sala-da-lanterna","farol|topo-do-farol":"sala-da-lanterna","farol|lanterna-farol":"sala-da-lanterna","farol|sala-luz":"sala-da-lanterna","farol|cume-farol":"sala-da-lanterna","farol|gruta-oculta":"gruta-oculta","farol|gruta-marinha":"gruta-oculta","farol|gruta-da-tempestade":"gruta-oculta","farol|caverna-tempestade":"gruta-oculta","farol|gruta-secreta":"gruta-oculta","estrelas|observatorio-exterior":"observatorio-exterior","estrelas|observatorio-serath":"observatorio-exterior","estrelas|observatorio-exterior-noturno":"observatorio-exterior","estrelas|exterior-observatorio":"observatorio-exterior","estrelas|observatorio":"observatorio-exterior","estrelas|observatorio-cupula":"observatorio-cupula","estrelas|cupula-principal":"observatorio-cupula","estrelas|observatorio-cupula-principal":"observatorio-cupula","estrelas|cupula-cristal":"observatorio-cupula","estrelas|sala-dos-mapas":"sala-dos-mapas","estrelas|sala-celeste-principal":"sala-dos-mapas","estrelas|cartografia-astral":"sala-dos-mapas","estrelas|sala-mapas":"sala-dos-mapas","estrelas|corredor-celeste":"corredor-celeste","estrelas|passagem-das-ruinas":"corredor-celeste","estrelas|corredor-astral":"corredor-celeste","estrelas|corredor-observatorio":"corredor-celeste","estrelas|camara-astral":"camara-astral","estrelas|cripta-estelar":"camara-astral","estrelas|camara-das-estrelas":"camara-astral","estrelas|santuario-astral":"camara-astral","estrelas|biblioteca-estelar":"biblioteca-estelar","estrelas|biblioteca-astral":"biblioteca-estelar","estrelas|arquivo-astral":"biblioteca-estelar","estrelas|biblioteca-observatorio":"biblioteca-estelar","estrelas|jardim-constelacao":"jardim-constelacao","estrelas|jardim-estelar":"jardim-constelacao","estrelas|terraco-das-constelacoes":"jardim-constelacao","estrelas|jardim-observatorio":"jardim-constelacao","estrelas|portal-estelar":"portal-estelar","estrelas|portal-das-estrelas":"portal-estelar","estrelas|santuario-das-chaves":"portal-estelar","estrelas|portal-astral":"portal-estelar","estrelas|camara-portal":"portal-estelar"};
const BUCKET='scene-images';
const encoder=new TextEncoder();
async function sha(input){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(input)));
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export default async function(request){
 if(request.method!=='POST')return reply({error:'Método inválido'},405);
 try{await requireGameUser(request)}catch(e){return gameAuthError(e)}
 const url=(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
 const secret=(process.env.SUPABASE_SECRET_KEY||'').trim();
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!secret)
   return reply({error:'Falta configurar o Supabase no Netlify'},503);
 const auth={apikey:secret,Authorization:'Bearer '+secret};
 async function api(path,{method='GET',data,headers={}}={}){
  const response=await fetch(url+path,{method,headers:{...auth,...headers},body:data===undefined?undefined:
   (data instanceof Uint8Array?data:JSON.stringify(data)),signal:AbortSignal.timeout(12000)});
  if(!response.ok){
   const txt=await response.text();throw Error('Supabase '+response.status+': '+txt.slice(0,400));
  }
  const txt=await response.text();if(!txt)return null;
  try{return JSON.parse(txt)}catch{return txt}
 }
 let claimedKey='';
 try{
  const data=await request.json(),kind=data.kind;
  if(!['location_base','action_detail'].includes(kind))return reply({error:'Tipo de imagem inválido'},400);
  const campaign=normalize(data.campaign_id);
  const rawLocation=normalize(data.location_id);
  const location=aliasMap[campaign+'|'+rawLocation]||rawLocation;
  const variant=kind==='location_base'?(data.variant==='b'?'b':'a'):'a';
  if(!campaignIds.has(campaign)||!idPattern.test(location))return reply({error:'Campanha ou local inválido'},400);
  const saveId=String(data.save_id||'');
  if(kind==='action_detail'&&!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(saveId))
   return reply({error:'É necessária uma aventura guardada'},400);
  const gmText=String(data.scene_text||'').slice(0,5000);
  const action=String(data.action_text||'').slice(0,1200);
  if(kind==='action_detail'&&!gmText.trim())return reply({error:'Ainda não existe uma cena para ilustrar'},400);
  const actionHash=kind==='action_detail'?await sha(saveId+'|'+location+'|'+gmText+'|'+action):null;
  const cacheKey=kind==='location_base'?['base',campaign,location,variant].join(':'):
   ['detail',campaign,saveId,location,actionHash].join(':');
  const filePath=kind==='location_base'?['base',campaign,location,variant+'.jpg'].join('/'):
    ['detail',campaign,saveId,location,actionHash+'.jpg'].join('/');
  const params=new URLSearchParams({select:'storage_path,updated_at',scope:'eq.'+kind,campaign_id:'eq.'+campaign,location_id:'eq.'+location,limit:'1'});
  if(kind==='action_detail'){
    params.set('save_id','eq.'+saveId);params.set('action_hash','eq.'+actionHash);
  }else params.set('variant','eq.'+variant);
  const publicUrl=path=>url+'/storage/v1/object/public/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
  async function find(){
    const rows=await api('/rest/v1/game_scene_images?'+params.toString());
    return rows?.[0]||null;
  }
  const existing=await find();
  const versionedUrl=row=>publicUrl(row.storage_path)+(row.updated_at?'?v='+encodeURIComponent(row.updated_at):'');
  if(existing&&data.mode!=='replace')return reply({status:'ready',url:versionedUrl(existing),cached:true,kind,location,variant});
  if(data.mode==='replace'){
    if(kind!=='location_base')return reply({error:'Só é possível substituir imagens base'},400);
    if(!existing)return reply({error:'Imagem base ainda não existe; usa a importação normal'},404);
    const encoded=String(data.image_data||'');
    const match=/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(encoded);
    if(!match||match[1].length>8_000_000)return reply({error:'JPEG inválido ou excessivamente grande'},400);
    const bytes=Buffer.from(match[1],'base64');
    if(bytes.length<100||bytes.length>6_000_000||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)
      return reply({error:'Ficheiro JPG inválido'},400);
    // Nunca modificar as referências do catálogo: manter o mesmo storage_path da imagem anterior.
    const uploaded=await fetch(url+'/storage/v1/object/'+BUCKET+'/'+existing.storage_path,{
      method:'PUT',headers:{...auth,'Content-Type':'image/jpeg','x-upsert':'true'},
      body:bytes,signal:AbortSignal.timeout(15000)
    });
    if(!uploaded.ok)return reply({error:'Storage: '+(await uploaded.text()).slice(0,350)},502);
    const updated=await api('/rest/v1/game_scene_images?scope=eq.location_base&campaign_id=eq.'+encodeURIComponent(campaign)+'&location_id=eq.'+encodeURIComponent(location)+'&variant=eq.'+variant,{
      method:'PATCH',
      data:{updated_at:new Date().toISOString(),prompt:'imagem-premium-substituida-manualmente'},
      headers:{'Content-Type':'application/json','Prefer':'return=representation'}
    });
    const row=updated?.[0];
    if(!row)return reply({error:'Imagem substituída no Storage, mas falhou a atualização de metadados'},502);
    return reply({status:'ready',url:publicUrl(existing.storage_path)+'?v='+encodeURIComponent(row.updated_at),
      cached:false,replaced:true,kind,location,variant});
  }
  if(data.mode==='lookup'){
    const locks=await api('/rest/v1/game_scene_generation_locks?cache_key=eq.'+
      encodeURIComponent(cacheKey)+'&status=eq.generating&select=updated_at&limit=1');
    return reply({status:locks?.length?'pending':'missing',kind,location});
  }
  if(!['generate','import'].includes(data.mode))return reply({error:'Operação inválida'},400);
  if(data.mode==='import'&&kind!=='location_base')return reply({error:'Só é possível importar imagens base antigas'},400);
  if(data.mode==='generate'&&!process.env.OPENAI_API_KEY)return reply({error:'Falta OPENAI_API_KEY no Netlify'},503);
  const claimed=await api('/rest/v1/rpc/claim_scene_generation',{
    method:'POST',data:{p_cache_key:cacheKey},headers:{'Content-Type':'application/json'}});
  if(claimed!==true)return reply({status:'pending',kind,location});
  claimedKey=cacheKey;
  // Corrige corrida no intervalo consulta/reserva.
  const afterLock=await find();
  if(afterLock)return reply({status:'ready',url:versionedUrl(afterLock),cached:true,kind,location,variant});
  const char=JSON.stringify(data.character||{}).slice(0,1600);
  const prompt=kind==='location_base'?
    'Imagem BASE permanente de local para aventura de fantasia heróica. O LOCAL: '+location+
    '. Campanha: '+campaign+'. Ambiente e arquitetura consistentes para regressos futuros. '+
    'Evita retratar personagens ou ações temporárias, apenas o cenário. Cena de referência: '+
    gmText.slice(0,2300)+'. Fotorealista cinematográfico, texturas detalhadas, 16:9 visual, sem letras, sem UI.':
    'Imagem DETALHADA de uma ação numa aventura de fantasia heróica. Local: '+location+
    '. Última narrativa: '+gmText.slice(0,3200)+'. Ação: '+action+
    '. Personagens: '+char+'. Fotorealista cinematográfico, composição expressiva, sem letras, sem UI.';
  let bytes;
  if(data.mode==='import'){
    const encoded=String(data.image_data||'');
    const match=/^data:image\/(?:jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(encoded);
    if(!match||match[1].length>5_600_000)throw Error('Imagem antiga inválida ou demasiado grande para importar.');
    bytes=Buffer.from(match[1],'base64');
    if(bytes.length<100||bytes.length>4_200_000||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)
      throw Error('A imagem antiga não é um JPEG válido.');
  }else{
    const ai=await fetch('https://api.openai.com/v1/images/generations',{
     method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
     body:JSON.stringify({model:process.env.IMAGE_MODEL||'gpt-image-2',prompt,size:'1536x1024',quality:'low',output_format:'jpeg',output_compression:65}),
     signal:AbortSignal.timeout(45000)});
    const result=await ai.json();
    if(!ai.ok)throw Error(result.error?.message||'Falha na geração da imagem');
    const b64=result.data?.[0]?.b64_json;
    if(!b64)throw Error('A API não devolveu imagem');
    bytes=Buffer.from(b64,'base64');
    if(bytes.byteLength>12*1024*1024)throw Error('Imagem excede limite de segurança');
  }
  // Armazena o ficheiro antes de gravar o registo. Se o insert falhar,
  // a próxima tentativa pode reaproveitar o objeto.
  const upload=await fetch(url+'/storage/v1/object/'+BUCKET+'/'+filePath,{
    method:'POST',headers:{...auth,'Content-Type':'image/jpeg','x-upsert':'true'},
    body:bytes,signal:AbortSignal.timeout(15000)});
  if(!upload.ok)throw Error('Erro ao guardar imagem no Storage: '+(await upload.text()).slice(0,300));
  await api('/rest/v1/game_scene_images',{
    method:'POST',
    data:{scope:kind,campaign_id:campaign,location_id:location,
      save_id:kind==='action_detail'?saveId:null,action_hash:actionHash,
      variant,storage_path:filePath,prompt:data.mode==='import'?'importado-manualmente':prompt},
    headers:{'Content-Type':'application/json','Prefer':'return=minimal'}});
  return reply({status:'ready',url:publicUrl(filePath),cached:false,kind,location,variant});
 }catch(e){
  return reply({error:String(e.message||e)},400);
 }finally{
  if(claimedKey){
   try{await api('/rest/v1/rpc/release_scene_generation',{method:'POST',data:{p_cache_key:claimedKey},headers:{'Content-Type':'application/json'}})}catch{}
  }
 }
};
