import {normalizeEcowitt,createEcowittUrl} from './normalize.mjs';
import {waterApi,pruneWaterHistory} from './water.mjs';
const COLUMNS=['ts','temp_c','humidity_pct','wind_kmh','gust_kmh','wind_dir_deg','rain_daily_mm','rain_rate_mmh','pressure_hpa','solar_wm2','uv_index','indoor_c','indoor_humidity_pct','source_ts'];
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:HEADERS});
const now=()=>Date.now();
const STALE_MS=15*60000;

// Claim a polling slot atomically. Prevents multiple tabs/cron invocations
// from hammering the cloud API during the same minute.
export async function collect(env,{clock=now,requestFetch=fetch}={}) {
  if(!env.DB) throw new Error('Base de datos no configurada');
  const at=clock();
  const claim=await env.DB.prepare(`UPDATE station_state SET last_poll_ts=?
    WHERE id=1 AND (last_poll_ts IS NULL OR last_poll_ts < ?)
    RETURNING id`).bind(at,at-90000).first();
  if(!claim) return {skipped:true,reason:'Consulta reciente; esperá al siguiente intervalo'};
  try {
    const url=createEcowittUrl({applicationKey:env.ECOWITT_APPLICATION_KEY,apiKey:env.ECOWITT_API_KEY,mac:env.ECOWITT_MAC});
    const response=await requestFetch(url.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!response.ok) throw new Error(`Ecowitt respondió HTTP ${response.status}`);
    const reading=normalizeEcowitt(await response.json(),at);
    // Never treat a stale cloud replay as a new current reading.
    if(reading.source_ts !== null && at-reading.source_ts > STALE_MS) {
      throw new Error('El gateway no envía datos recientes a Ecowitt (más de 15 min)');
    }
    // Skip duplicate readings if their validated sensor timestamp has not advanced.
    const prev=await env.DB.prepare('SELECT source_ts FROM observations ORDER BY ts DESC LIMIT 1').first();
    const duplicate=reading.source_ts !== null && prev?.source_ts===reading.source_ts;
    if(!duplicate) {
      await env.DB.prepare(`INSERT INTO observations (${COLUMNS.join(',')}) VALUES (${COLUMNS.map(()=>'?').join(',')})`)
        .bind(...COLUMNS.map(k=>reading[k])).run();
    }
    await env.DB.prepare('UPDATE station_state SET last_success_ts=?,last_error=NULL WHERE id=1').bind(at).run();
    // Do retention housekeeping at most once per day to reduce D1 writes.
    const utc=new Date(at);const day=utc.getUTCHours()===0 && utc.getUTCMinutes()<5;
    if(day) await env.DB.prepare('DELETE FROM observations WHERE ts < ?').bind(at-180*86400000).run();
    return {ok:true,duplicate,received_at:at,source_ts:reading.source_ts};
  } catch(e) {
    // Do not send outbound request URL, response body, MAC, secrets or exception stack.
    const message=e?.name==='TimeoutError'?'Tiempo de espera agotado con Ecowitt':
      e instanceof SyntaxError?'Ecowitt devolvió datos JSON ilegibles':
      /^Ecowitt respondió HTTP \d{3}$|^El gateway no envía datos recientes|^Ecowitt no devolvió mediciones principales$|^Respuesta Ecowitt inválida o rechazada$|^Faltan credenciales de Ecowitt/.test(e?.message||'')
        ?e.message:'No se pudo consultar Ecowitt';
    await env.DB.prepare('UPDATE station_state SET last_error=? WHERE id=1').bind(message).run();
    return {ok:false,error:message};
  }
}

function authorized(request,env){
  const secret=env.ADMIN_TOKEN;
  return typeof secret==='string' && secret.length>=24 &&
    request.headers.get('authorization')===`Bearer ${secret}`;
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin=request.headers.get('origin');
    const cors=origin==='https://miqueas80.github.io'?{'access-control-allow-origin':origin,'vary':'Origin'}:{};
    const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{...HEADERS,...cors}});
    if(request.method==='OPTIONS'){
      if(!cors['access-control-allow-origin'])return reply({error:'Origen no permitido'},403);
      return new Response(null,{status:204,headers:{...cors,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Authorization,Content-Type','access-control-max-age':'600'}});
    }
    if(url.pathname.startsWith('/api/water/')){
      const res=await waterApi(request,env);
      const headers=new Headers(res.headers);
      for(const [k,v] of Object.entries(cors))headers.set(k,v);
      return new Response(res.body,{status:res.status,headers});
    }
    if(!env.DB) return reply({error:'Base de datos D1 sin configurar'},503);
    if(typeof env.ADMIN_TOKEN!=='string' || env.ADMIN_TOKEN.length<24)
      return reply({error:'Configurar ADMIN_TOKEN de al menos 24 caracteres aleatorios'},503);
    if(!authorized(request,env)) return reply({error:'Clave de acceso incorrecta'},401);
    try {
      if(request.method==='GET' && url.pathname==='/api/health') {
        const state=await env.DB.prepare('SELECT * FROM station_state WHERE id=1').first();
        const latest=await env.DB.prepare('SELECT ts,source_ts FROM observations ORDER BY ts DESC LIMIT 1').first();
        // Reception time is NOT evidence that the physical sensor is fresh.
        const verifiedTimestamp=latest?.source_ts ?? null;
        return reply({configured:!!(env.ECOWITT_API_KEY&&env.ECOWITT_APPLICATION_KEY&&env.ECOWITT_MAC),
          last_poll_ts:state?.last_poll_ts??null,last_success_ts:state?.last_success_ts??null,
          last_error:state?.last_error??null,last_reading_ts:latest?.ts??null,
          last_source_ts:latest?.source_ts??null,source_age_verifiable:latest?.source_ts!=null,
          sensor_time_unverified:verifiedTimestamp===null,
          stale:verifiedTimestamp===null||now()-verifiedTimestamp>STALE_MS,now:now()});
      }
      if(request.method==='GET' && url.pathname==='/api/latest')
        return reply({reading:await env.DB.prepare('SELECT * FROM observations ORDER BY ts DESC LIMIT 1').first()});
      if(request.method==='GET' && url.pathname==='/api/history') {
        const v=Number(url.searchParams.get('hours'));
        const hours=Number.isFinite(v)&&v>0?Math.min(168,Math.max(1,Math.floor(v))):24;
        const results=await env.DB.prepare('SELECT * FROM observations WHERE ts >= ? ORDER BY ts DESC LIMIT 2100')
          .bind(now()-hours*3600000).all();
        return reply({hours,readings:(results.results||[]).reverse()});
      }
      if(request.method==='POST' && url.pathname==='/api/refresh') {
        const result=await collect(env);
        return reply(result,result.ok || result.skipped ? 200 : 502);
      }
      return reply({error:'Ruta o método no disponible'},404);
    }catch(e){return reply({error:'Error interno del servicio'},500);}
  },
  async scheduled(controller,env,ctx){
    // The water retention task is deliberately independent from Ecowitt polling.
    const at=new Date(controller?.scheduledTime??Date.now());
    if(at.getUTCHours()===0 && at.getUTCMinutes()<5){
      ctx.waitUntil(pruneWaterHistory(env,{clock:()=>at.getTime()})
        .catch(()=>console.error('Error de mantenimiento de historial de agua')));
    }
    ctx.waitUntil(collect(env).catch(()=>console.error('Error interno durante recolección Ecowitt')));
  }
};
