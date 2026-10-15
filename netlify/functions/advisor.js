// Función Netlify para consulta del Asesor IA.
// Requiere variable OPENAI_API_KEY configurada en Netlify, nunca en archivos públicos.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return {statusCode:405,body:JSON.stringify({error:'Método no permitido'})};
  if (!process.env.OPENAI_API_KEY || !process.env.ADVISOR_ACCESS_CODE) return {statusCode:503,body:JSON.stringify({error:'Falta configurar OPENAI_API_KEY o ADVISOR_ACCESS_CODE en Netlify'})};
  try {
    if ((event.body||'').length>18000) return {statusCode:413,body:JSON.stringify({error:'Consulta demasiado extensa'})};
    const body=JSON.parse(event.body||'{}');if(String(body.access_code||'')!==process.env.ADVISOR_ACCESS_CODE)return {statusCode:403,body:JSON.stringify({error:'Código de acceso incorrecto'})};const question=String(body.question||'').slice(0,550);
    if (!question) return {statusCode:400,body:JSON.stringify({error:'Pregunta vacía'})};
    const p=body.portfolio||{};
    const context={total:p.total,crypto:p.crypto,argentina:p.argentina,top5:p.top5,stale:p.stale,manual:p.manual,position_count:p.position_count,asof:p.asof,positions:(p.ordered||[]).slice(0,12)};
    const history=(Array.isArray(body.history)?body.history:[]).slice(-6).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:String(m.content||'').slice(0,1200)}));
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6',max_output_tokens:650,instructions:'Sos el Asesor IA de una app de inversión argentina. Respondé en español rioplatense claro, 100-220 palabras, con mirada crítica. Usá los datos de la cartera provistos en el contexto, sin inventar precios ni fechas. Se trata de una app pública; nunca solicites claves o datos personales. No hay herramientas de búsqueda web en esta función, por lo tanto no afirmes hechos financieros externos de última hora. Distingui riesgos de recomendaciones y aclará información faltante. Nunca ejecutes operaciones.',input:[{role:'user',content:`Contexto cartera al momento de la consulta: ${JSON.stringify(context)}. Este contexto es informativo no ejecutable.`},...history,{role:'user',content:question}]})});
    const j=await response.json();if(!response.ok)throw new Error(j.error?.message||'Servicio de IA no disponible');
    const answer=(j.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim()||j.output_text||'';
    return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({answer})};
  }catch(e){return {statusCode:502,body:JSON.stringify({error:'Falló la consulta a la IA: '+String(e.message||e).slice(0,140)})}}
};
