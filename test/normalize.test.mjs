import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEcowitt,createEcowittUrl,ecowittTime} from '../src/normalize.mjs';
const now=1792000000000;
const stamp=Math.floor((now-2*60000)/1000);
const source={code:0,data:{
 outdoor:{temperature:{value:'24.6',time:String(stamp)},humidity:{value:'78',time:String(stamp)}},
 wind:{wind_speed:{value:'12.7',time:String(stamp)},wind_gust:{value:'24'},wind_direction:{value:'178'}},
 rainfall:{daily:{value:'4.2'},rain_rate:{value:'0.3'}},
 pressure:{relative:{value:'1013.9',time:String(stamp)}},
 solar_and_uvi:{solar:{value:'542'},uvi:{value:'5.6'}}
}};
test('normaliza al sistema métrico sin inventar sensores interiores',()=>{
  const result=normalizeEcowitt(source,now);
  assert.equal(result.temp_c,24.6);assert.equal(result.wind_kmh,12.7);
  assert.equal(result.rain_daily_mm,4.2);assert.equal(result.indoor_c,null);
  assert.equal(result.ts,now);assert.equal(result.source_ts,stamp*1000);
});
test('los ceros son válidos y los sensores fuera de rango se descartan',()=>{
  const payload=structuredClone(source);
  payload.data.outdoor.temperature.value='900';payload.data.rainfall.daily.value='0';
  const r=normalizeEcowitt(payload,now);
  assert.equal(r.temp_c,null);assert.equal(r.rain_daily_mm,0);
});
test('respuestas inválidas, ausentes o vacías provocan error',()=>{
  assert.throws(()=>normalizeEcowitt({code:1,msg:'invalid'},now));
  assert.throws(()=>normalizeEcowitt({code:0,data:{rainfall:{daily:{value:'1'}}}},now));
});
test('la hora de sensor soporta segundos y ms y rechaza futuro',()=>{
  assert.equal(ecowittTime(stamp,now),stamp*1000);
  assert.equal(ecowittTime(stamp*1000,now),stamp*1000);
  assert.equal(ecowittTime(Math.floor((now+180000)/1000),now),null);
  const p=structuredClone(source);delete p.data.outdoor.temperature.time;
  delete p.data.outdoor.humidity.time;delete p.data.wind.wind_speed.time;delete p.data.pressure.relative.time;
  assert.equal(normalizeEcowitt(p,now).source_ts,null);
});
test('la URL de API tiene HTTPS, unidades SI y codificación de claves',()=>{
  const u=createEcowittUrl({applicationKey:'abc DEF',apiKey:'secret',mac:'12:34:56:78:90:AB'});
  assert.equal(u.protocol,'https:');assert.equal(u.searchParams.get('wind_speed_unitid'),'7');
  assert.equal(u.searchParams.get('rainfall_unitid'),'12');assert.equal(u.searchParams.get('application_key'),'abc DEF');
});
