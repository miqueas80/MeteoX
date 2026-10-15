// MeteoX Agua — recepción HTTPS de lecturas ESP32. Solo monitoreo.
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const valid=(n,lo,hi)=>typeof n==='number' && Number.isFinite(n) && n>=lo && n<=hi;
const digest=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))),c=>c.toString(16).padStart(2,'0')).join('');
const admin=(req,env)=>typeof env.ADMIN_TOKEN==='string' && env.ADMIN_TOKEN.length>=24 && req.headers.get('authorization')==='Bearer '+env.ADMIN_TOKEN;
const secureToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),c=>c.toString(16).padStart(2,'0')).join('');
async function readJson(req) {
 if(!req.headers.get('content-type')?.startsWith('application/json'))return null;
 const size=Number(req.headers.get('content-length')); if(size>2048)return null;
 const s=await req.text();if(s.length>2048)return null;
 try{const obj=JSON.parse(s);return obj && typeof obj==='object' && !Array.isArray(obj)?obj:null;}catch{return null;}
}
export function levelFromDistance({distance_cm,empty_cm,full_cm,capacity_l}) {
 if(![distance_cm,empty_cm,full_cm,capacity_l].every(Number.isFinite) || empty_cm<=full_cm || capacity_l<=0)return null;
 if(distance_cm<full_cm-10 || distance_cm>empty_cm+10)return null;
 const percent=Math.max(0,Math.min(100,100*(empty_cm-distance_cm)/(empty_cm-full_cm)));
 return {percent:Math.round(percent*10)/10,liters:Math.round(capacity_l*percent/10)/10};
}
export async function waterApi(request,env,{clock=Date.now}={}) {
 const path=new URL(request.url).pathname;if(!env.DB)return reply({error:'Base D1 sin configurar'},503);
 const match=/^\/api\/water\/ingest\/([\w-]{10,64})$/.exec(path);
 if(match) {
  if(request.method!=='POST')return reply({error:'Método no permitido'},405);
  const id=match[1],secret=request.headers.get('authorization')?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if(!secret)return reply({error:'Dispositivo no autorizado'},401);
  const tank=await env.DB.prepare('SELECT id,capacity_l,empty_cm,full_cm,token_hash FROM water_tanks WHERE id=?').bind(id).first();
  if(!tank || await digest(secret)!==tank.token_hash)return reply({error:'Dispositivo no autorizado'},401);
  const data=await readJson(request);
  if(!data || !valid(data.distance_cm,0,1000))return reply({error:'distance_cm numérico obligatorio (0-1000)'},422);
  if(data.battery_v!==undefined && !valid(data.battery_v,0,30))return reply({error:'battery_v fuera de rango'},422);
  const level=levelFromDistance({...tank,distance_cm:data.distance_cm});
  if(!level)return reply({error:'Medición fuera de calibración; revisar sensor'},422);
  const at=clock();
  const prev=await env.DB.prepare('SELECT ts FROM water_readings WHERE tank_id=? ORDER BY ts DESC LIMIT 1').bind(id).first();
  if(prev && at-prev.ts<30000)return reply({error:'Esperar 30 segundos entre lecturas'},429);
  await env.DB.prepare('INSERT INTO water_readings(tank_id,ts,distance_cm,percent,liters,battery_v) VALUES(?,?,?,?,?,?)')
   .bind(id,at,data.distance_cm,level.percent,level.liters,data.battery_v??null).run();
  return reply({ok:true,received_at:at,...level});
 }
 if(!admin(request,env))return reply({error:'Clave de acceso incorrecta'},401);
 if(path==='/api/water/tanks' && request.method==='GET') {
  const rows=await env.DB.prepare('SELECT t.id,t.name,t.capacity_l,t.empty_cm,t.full_cm,t.low_pct,w.ts,w.distance_cm,w.percent,w.liters,w.battery_v FROM water_tanks t LEFT JOIN water_readings w ON w.tank_id=t.id AND w.ts=(SELECT MAX(ts) FROM water_readings WHERE tank_id=t.id) ORDER BY t.created_at LIMIT 100').all();
  return reply({tanks:(rows.results||[]).map(t=>({...t,stale:!t.ts || clock()-t.ts>900000}))});
 }
 if(path==='/api/water/tanks' && request.method==='POST') {
  const data=await readJson(request);
  if(!data || typeof data.name!=='string' || data.name.trim().length<2 || data.name.length>60 || !valid(data.capacity_l,1,1000000) || !valid(data.empty_cm,1,1000) || !valid(data.full_cm,0,950) || data.empty_cm-data.full_cm<5 || (data.low_pct!==undefined && !valid(data.low_pct,1,95)))return reply({error:'Configuración del tanque inválida'},422);
  const id=crypto.randomUUID(),token=secureToken();
  await env.DB.prepare('INSERT INTO water_tanks(id,name,capacity_l,empty_cm,full_cm,low_pct,token_hash,created_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind(id,data.name.trim(),data.capacity_l,data.empty_cm,data.full_cm,data.low_pct??20,await digest(token),clock()).run();
  return reply({ok:true,tank_id:id,device_token:token,notice:'Guardá este token: se muestra una sola vez.'},201);
 }
 if(path==='/api/water/history' && request.method==='GET') {
  const u=new URL(request.url),tank=u.searchParams.get('tank'),n=Number(u.searchParams.get('hours'));
  if(!tank || !/^[\w-]{10,64}$/.test(tank))return reply({error:'ID de tanque inválido'},400);
  const hours=Number.isFinite(n)&&n>0?Math.min(168,Math.max(1,Math.floor(n))):24;
  const rows=await env.DB.prepare('SELECT ts,distance_cm,percent,liters,battery_v FROM water_readings WHERE tank_id=? AND ts>=? ORDER BY ts DESC LIMIT 2100').bind(tank,clock()-hours*3600000).all();
  return reply({tank,hours,readings:(rows.results||[]).reverse()});
 }
 return reply({error:'Ruta o método no disponible'},404);
}
