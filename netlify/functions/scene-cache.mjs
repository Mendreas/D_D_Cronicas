// Netlify: cache persistente de ilustrações solo no Supabase.
// Nunca devolve chaves privadas ao browser. Bucket scene-images é público
// (incluindo imagens das ações): não usar para conteúdo confidencial.
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const normalize=s=>String(s||'').trim().toLowerCase().replace(/_/g,'-');
const idPattern=/^[a-z0-9-]{2,80}$/;
const campaignIds=new Set(['veu','farol','estrelas']);
const BUCKET='scene-images';
const encoder=new TextEncoder();
async function sha(input){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(input)));
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export default async function(request){
 if(request.method!=='POST')return reply({error:'Método inválido'},405);
 const pass=process.env.GAME_ACCESS_CODE;
 if(!pass||request.headers.get('x-game-code')!==pass)return reply({error:'Código de acesso inválido'},401);
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
  const location=normalize(data.location_id);
  if(!campaignIds.has(campaign)||!idPattern.test(location))return reply({error:'Campanha ou local inválido'},400);
  const saveId=String(data.save_id||'');
  if(kind==='action_detail'&&!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(saveId))
   return reply({error:'É necessária uma aventura guardada'},400);
  const gmText=String(data.scene_text||'').slice(0,5000);
  const action=String(data.action_text||'').slice(0,1200);
  if(kind==='action_detail'&&!gmText.trim())return reply({error:'Ainda não existe uma cena para ilustrar'},400);
  const actionHash=kind==='action_detail'?await sha(saveId+'|'+location+'|'+gmText+'|'+action):null;
  const cacheKey=kind==='location_base'?['base',campaign,location].join(':'):
   ['detail',campaign,saveId,location,actionHash].join(':');
  const filePath=kind==='location_base'?['base',campaign,location+'.jpg'].join('/'):
    ['detail',campaign,saveId,location,actionHash+'.jpg'].join('/');
  const params=new URLSearchParams({select:'storage_path',scope:'eq.'+kind,campaign_id:'eq.'+campaign,location_id:'eq.'+location,limit:'1'});
  if(kind==='action_detail'){
    params.set('save_id','eq.'+saveId);params.set('action_hash','eq.'+actionHash);
  }
  const publicUrl=path=>url+'/storage/v1/object/public/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
  async function find(){
    const rows=await api('/rest/v1/game_scene_images?'+params.toString());
    return rows?.[0]?.storage_path||'';
  }
  const existing=await find();
  if(existing)return reply({status:'ready',url:publicUrl(existing),cached:true,kind,location});
  if(data.mode==='lookup'){
    const locks=await api('/rest/v1/game_scene_generation_locks?cache_key=eq.'+
      encodeURIComponent(cacheKey)+'&status=eq.generating&select=updated_at&limit=1');
    return reply({status:locks?.length?'pending':'missing',kind,location});
  }
  if(data.mode!=='generate')return reply({error:'Operação inválida'},400);
  if(!process.env.OPENAI_API_KEY)return reply({error:'Falta OPENAI_API_KEY no Netlify'},503);
  const claimed=await api('/rest/v1/rpc/claim_scene_generation',{
    method:'POST',data:{p_cache_key:cacheKey},headers:{'Content-Type':'application/json'}});
  if(claimed!==true)return reply({status:'pending',kind,location});
  claimedKey=cacheKey;
  // Corrige corrida no intervalo consulta/reserva.
  const afterLock=await find();
  if(afterLock)return reply({status:'ready',url:publicUrl(afterLock),cached:true,kind,location});
  const char=JSON.stringify(data.character||{}).slice(0,1600);
  const prompt=kind==='location_base'?
    'Imagem BASE permanente de local para aventura de fantasia heróica. O LOCAL: '+location+
    '. Campanha: '+campaign+'. Ambiente e arquitetura consistentes para regressos futuros. '+
    'Evita retratar personagens ou ações temporárias, apenas o cenário. Cena de referência: '+
    gmText.slice(0,2300)+'. Fotorealista cinematográfico, texturas detalhadas, 16:9 visual, sem letras, sem UI.':
    'Imagem DETALHADA de uma ação numa aventura de fantasia heróica. Local: '+location+
    '. Última narrativa: '+gmText.slice(0,3200)+'. Ação: '+action+
    '. Personagens: '+char+'. Fotorealista cinematográfico, composição expressiva, sem letras, sem UI.';
  const ai=await fetch('https://api.openai.com/v1/images/generations',{
   method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.IMAGE_MODEL||'gpt-image-2',prompt,size:'1536x1024',quality:'low',output_format:'jpeg',output_compression:65}),
   signal:AbortSignal.timeout(45000)});
  const result=await ai.json();
  if(!ai.ok)throw Error(result.error?.message||'Falha na geração da imagem');
  const b64=result.data?.[0]?.b64_json;
  if(!b64)throw Error('A API não devolveu imagem');
  const bytes=Buffer.from(b64,'base64');
  if(bytes.byteLength>12*1024*1024)throw Error('Imagem excede limite de segurança');
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
      storage_path:filePath,prompt},
    headers:{'Content-Type':'application/json','Prefer':'return=minimal'}});
  return reply({status:'ready',url:publicUrl(filePath),cached:false,kind,location});
 }catch(e){
  return reply({error:String(e.message||e)},400);
 }finally{
  if(claimedKey){
   try{await api('/rest/v1/rpc/release_scene_generation',{method:'POST',data:{p_cache_key:claimedKey},headers:{'Content-Type':'application/json'}})}catch{}
  }
 }
};
