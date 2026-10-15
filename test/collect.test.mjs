import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collect} from '../src/worker.mjs';
const stamp=1792000000000;
function envMaker(){
  const trace=[];
  const env={ECOWITT_APPLICATION_KEY:'a',ECOWITT_API_KEY:'sensitive',ECOWITT_MAC:'test-MAC',DB:{
    prepare(sql){return {
      bind(...params){this.params=params;return this},
      async first(){
        trace.push({sql,params:this.params});
        if(sql.includes('RETURNING id'))return {id:1};
        if(sql.includes('SELECT source_ts'))return {source_ts:null};
        return null;
      },
      async run(){trace.push({sql,params:this.params});return {success:true}}
    }}
  }};
  return {env,trace};
}
function payload(timeOffset=120000){
  const time=String(Math.floor((stamp-timeOffset)/1000));
  return {code:0,data:{outdoor:{temperature:{time,value:'22.7'},humidity:{time,value:'54'}}}};
}
test('recolecta lectura y guarda fuente de la medición',async()=>{
  const {env,trace}=envMaker();
  const result=await collect(env,{clock:()=>stamp,requestFetch:async()=>new Response(JSON.stringify(payload()),{status:200})});
  assert.equal(result.ok,true);
  assert.equal(result.source_ts,stamp-120000);
  assert.equal(trace.some(x=>x.sql.includes('INSERT INTO observations')),true);
  assert.equal(trace.some(x=>x.sql.includes('last_error=NULL')),true);
});
test('rechaza muestras congeladas sin fingir que son actuales',async()=>{
  const {env,trace}=envMaker();
  const result=await collect(env,{clock:()=>stamp,requestFetch:async()=>new Response(JSON.stringify(payload(40*60000)),{status:200})});
  assert.equal(result.ok,false);
  assert.match(result.error,/no envía datos recientes/);
  assert.equal(trace.some(x=>x.sql.includes('INSERT INTO observations')),false);
});
test('no filtra secretos en errores de la API',async()=>{
  const {env}=envMaker();
  const result=await collect(env,{clock:()=>stamp,requestFetch:async()=>{throw new Error('URL https://example.test?api_key=sensitive&mac=test-MAC')}});
  assert.equal(result.ok,false);assert.doesNotMatch(JSON.stringify(result),/sensitive|test-MAC|api_key/);
});
test('descarta la consulta cuando el cron ya reclamó intervalo',async()=>{
  const {env}=envMaker();env.DB.prepare=()=>({bind(){return this},async first(){return null}});
  const result=await collect(env,{clock:()=>stamp,requestFetch:async()=>{throw Error('no debería llamarse')}});
  assert.equal(result.skipped,true);
});
