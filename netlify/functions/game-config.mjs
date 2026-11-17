export default async () => {
  const url=process.env.SUPABASE_URL||'';
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || !key.startsWith('sb_publishable_')) {
    return Response.json({error:'Configuração Supabase incompleta no Netlify.'},{status:503});
  }
  return Response.json({url, key},{headers:{'Cache-Control':'no-store'}});
};
