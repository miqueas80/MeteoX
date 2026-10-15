import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waterVolumeFraction,levelFromDistance,historyBucketMs,waterApi} from '../src/water.mjs';
import worker from '../src/worker.mjs';

test('volumen lineal mantiene compatibilidad con tanques verticales',()=>{
 assert.equal(waterVolumeFraction(0.25),0.25);
 assert.equal(levelFromDistance({distance_cm:75,empty_cm:100,full_cm:0,capacity_l:1000}).liters,250);
});
test('cilindro horizontal: fórmula de segmento circular, simetría y extremos',()=>{
 assert.equal(waterVolumeFraction(0,'horizontal_cylinder'),0);
 assert.equal(waterVolumeFraction(1,'horizontal_cylinder'),1);
 assert.equal(waterVolumeFraction(0.5,'horizontal_cylinder'),0.5);
 const quarter=waterVolumeFraction(0.25,'horizontal_cylinder');
 assert.ok(quarter>0.19&&quarter<0.20);
 assert.ok(Math.abs(quarter+waterVolumeFraction(0.75,'horizontal_cylinder')-1)<1e-10);
 const q=levelFromDistance({distance_cm:75,empty_cm:100,full_cm:0,capacity_l:1000,geometry:'horizontal_cylinder'});
 assert.equal(q.height_percent,25);
 assert.ok(q.liters>190&&q.liters<200);
});
test('descarta geometrías desconocidas y mediciones fuera de calibración',()=>{
 assert.equal(waterVolumeFraction(0.3,'other'),null);
 assert.equal(levelFromDistance({distance_cm:40,empty_cm:100,full_cm:0,capacity_l:100,geometry:'other'}),null);
 assert.equal(levelFromDistance({distance_cm:150,empty_cm:100,full_cm:0,capacity_l:100,geometry:'linear'}),null);
});
test('el muestreo histórico cubre 6 h, 24 h y 7 días con menos de 2100 puntos',()=>{
 for(const h of [6,24,168]){
   const d=historyBucketMs(h);
   assert.ok(d>=30000);
   assert.ok(Math.ceil(h*3600000/d)<=2100);
 }
 assert.ok(historyBucketMs(168)>historyBucketMs(24));
});
test('historial consulta todo el período solicitado con intervalos explícitos',async()=>{
 const calls=[];
 const DB={prepare(sql){return {bind(...args){calls.push({sql,args});return this},async all(){return {results:[{ts:123,percent:25,liters:100}]}}}}};
 const now=1792000000000, token='admin-token-very-long-and-unique';
 const request=new Request('https://demo.invalid/api/water/history?tank=tanque-test-00001&hours=168',{headers:{authorization:'Bearer '+token}});
 const r=await waterApi(request,{DB,ADMIN_TOKEN:token},{clock:()=>now});
 const payload=await r.json();
 assert.equal(r.status,200);assert.equal(payload.hours,168);
 assert.equal(payload.sampling_interval_ms,historyBucketMs(168));
 assert.equal(payload.readings.length,1);
 assert.match(calls[0].sql,/PARTITION BY/);
 assert.deepEqual(calls[0].args,[historyBucketMs(168),'tanque-test-00001',now-168*3600000]);
});
test('health: recibir datos no comprueba por sí solo que el sensor está actualizado',async()=>{
 const current=Date.now(),token='admin-token-very-long-and-unique';
 const DB={prepare(sql){return {async first(){if(sql.includes('station_state'))return {last_poll_ts:current,last_success_ts:current,last_error:null};return {ts:current,source_ts:null}}}}};
 const r=await worker.fetch(new Request('https://test.workers.dev/api/health',{headers:{authorization:'Bearer '+token}}),{DB,ADMIN_TOKEN:token,ECOWITT_API_KEY:'test',ECOWITT_APPLICATION_KEY:'test',ECOWITT_MAC:'test'});
 const body=await r.json();
 assert.equal(r.status,200);assert.equal(body.source_age_verifiable,false);
 assert.equal(body.stale,true);
 assert.equal(body.sensor_time_unverified,true);
});
