// Ecowitt Cloud API v3: values requested in SI units.
// A null value means "not received", never "zero".
export const UNITS = Object.freeze({
  temp_unitid: 1, pressure_unitid: 3, wind_speed_unitid: 7,
  rainfall_unitid: 12, solar_irradiance_unitid: 16
});
const get = (data, ...path) => path.reduce((o,k)=>o && typeof o === 'object' ? o[k] : undefined, data);
function measure(data, ...path) {
  const leaf = get(data,...path);
  const value = leaf?.value ?? leaf;
  if(value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const bound = (v, lo, hi) => v !== null && v >= lo && v <= hi ? v : null;

export function ecowittTime(value, now=Date.now()) {
  if(value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  if(!Number.isFinite(parsed)) return null;
  const ms = parsed >= 1e12 ? parsed : parsed * 1000;
  // Guard against malformed dates and future-clock skews.
  return ms > 946684800000 && ms <= now+120000 ? Math.floor(ms) : null;
}

export function normalizeEcowitt(payload, receivedAt=Date.now()) {
  if(!payload || typeof payload !== 'object' || Number(payload.code) !== 0 ||
     !payload.data || typeof payload.data !== 'object') {
    // Never log entire Ecowitt response because station metadata may be private.
    throw new Error('Respuesta Ecowitt inválida o rechazada');
  }
  const d=payload.data;
  const record={
    ts: receivedAt,
    temp_c:bound(measure(d,'outdoor','temperature'),-80,90),
    humidity_pct:bound(measure(d,'outdoor','humidity'),0,100),
    wind_kmh:bound(measure(d,'wind','wind_speed'),0,500),
    gust_kmh:bound(measure(d,'wind','wind_gust'),0,500),
    wind_dir_deg:bound(measure(d,'wind','wind_direction'),0,360),
    rain_daily_mm:bound(measure(d,'rainfall','daily'),0,3000),
    rain_rate_mmh:bound(measure(d,'rainfall','rain_rate'),0,1500),
    pressure_hpa:bound(measure(d,'pressure','relative'),300,1200),
    solar_wm2:bound(measure(d,'solar_and_uvi','solar'),0,1800),
    uv_index:bound(measure(d,'solar_and_uvi','uvi'),0,30),
    indoor_c:bound(measure(d,'indoor','temperature'),-80,90),
    indoor_humidity_pct:bound(measure(d,'indoor','humidity'),0,100),
    source_ts:null
  };
  const main=[record.temp_c,record.humidity_pct,record.wind_kmh,record.pressure_hpa];
  if(main.every(x=>x===null)) throw new Error('Ecowitt no devolvió mediciones principales');
  // A conservative oldest-known time across usable primary channels.
  // Not all gateways provide per-channel timestamps, so null remains possible.
  const keys=[
    [record.temp_c, 'outdoor','temperature'],
    [record.humidity_pct,'outdoor','humidity'],
    [record.wind_kmh,'wind','wind_speed'],
    [record.pressure_hpa,'pressure','relative']
  ];
  const times=keys.filter(([val])=>val!==null).map(([,group,field])=>ecowittTime(get(d,group,field,'time'),receivedAt)).filter(v=>v!==null);
  record.source_ts=times.length ? Math.min(...times) : ecowittTime(payload.time,receivedAt);
  return record;
}

export function createEcowittUrl({applicationKey,apiKey,mac}) {
  if(![applicationKey,apiKey,mac].every(x=>typeof x==='string' && x.trim()))
    throw new Error('Faltan credenciales de Ecowitt en el servidor');
  const url=new URL('https://api.ecowitt.net/api/v3/device/real_time');
  Object.entries({application_key:applicationKey,api_key:apiKey,mac,call_back:'all',...UNITS})
    .forEach(([k,v])=>url.searchParams.set(k,String(v)));
  return url;
}
