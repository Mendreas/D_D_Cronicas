export default async () => {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const urlValid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
  const keyValid = key.startsWith('sb_publishable_') && key.length > 20;
  if (!urlValid || !keyValid) {
    return Response.json({
      error: 'Configuração Supabase incompleta no Netlify.',
      diagnostics: {
        supabase_url_present: Boolean(url),
        supabase_url_valid: urlValid,
        publishable_key_present: Boolean(key),
        publishable_key_format_valid: keyValid
      }
    }, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
  return Response.json({url,key}, {headers: {'Cache-Control': 'no-store'}});
};
