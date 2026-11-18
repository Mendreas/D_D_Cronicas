// Verifica a sessão Supabase em TODAS as operações pagas.
// A chave SERVICE_ROLE/SECRET_KEY permanece exclusivamente no Netlify.
export async function requireGameUser(request){
 const url=(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
 const pub=(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();
 const secret=(process.env.SUPABASE_SECRET_KEY||'').trim();
 if(!url||!pub||!secret)throw Object.assign(Error('Configuração Supabase incompleta no Netlify.'),{status:503});
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)throw Object.assign(Error('Inicia sessão na tua conta Supabase para jogar.'),{status:401});
 const opts={signal:AbortSignal.timeout(12000)};
 const response=await fetch(url+'/auth/v1/user',{...opts,headers:{apikey:pub,Authorization:'Bearer '+token}});
 if(!response.ok)throw Object.assign(Error('Sessão inválida ou expirada. Entra novamente.'),{status:401});
 const user=await response.json();
 if(!user.id)throw Object.assign(Error('Não foi possível identificar o utilizador.'),{status:401});
 const lookup=await fetch(url+'/rest/v1/game_authorized_users?user_id=eq.'+
   encodeURIComponent(user.id)+'&enabled=eq.true&select=user_id&limit=1',{
    ...opts,headers:{apikey:secret,Authorization:'Bearer '+secret}
   });
 if(!lookup.ok)throw Object.assign(Error('Ainda falta configurar a lista de utilizadores autorizados.'),{status:503});
 const found=await lookup.json();
 if(!Array.isArray(found)||!found.length)throw Object.assign(Error('Esta conta não está autorizada a gerar texto ou imagens. Pede ao administrador para autorizar o teu email.'),{status:403});
 return user;
}
export function gameAuthError(e){
 const status=[401,403,503].includes(e?.status)?e.status:503;
 return Response.json({error:e?.status?e.message:'Não foi possível validar a sessão: '+String(e?.message||e)},{status,headers:{'Cache-Control':'no-store'}});
}
