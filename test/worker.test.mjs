import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';

function makeDb(){
  const queries=[];
  return {
    queries,
    prepare(sql){
      return {
        bind(...params){this.params=params;return this},
        async first(){queries.push({sql,params:this.params||[]});if(sql.includes('station_state'))return {last_poll_ts:null,last_success_ts:null,last_error:null};return null},
        async all(){queries.push({sql,params:this.params||[]});return {results:[]}},
        async run(){queries.push({sql,params:this.params||[]});return {success:true}}
      }
    }
  }
}
const req=(path,token,method='GET')=>new Request('https://demo.workers.dev'+path,{method,headers:token?{'authorization':'Bearer '+token}:{}});
test('bloquea consultas no autorizadas',async()=>{
 const DB=makeDb(),env={DB,ADMIN_TOKEN:'a'.repeat(28)};
 const r=await worker.fetch(req('/api/history?hours=24'),env);
 assert.equal(r.status,401);
 assert.equal(DB.queries.length,0);
});
test('el historial requiere token y limita el rango consultado',async()=>{
 const DB=makeDb(),token='a'.repeat(28),env={DB,ADMIN_TOKEN:token};
 const res=await worker.fetch(req('/api/history?hours=600',token),env);
 const json=await res.json();assert.equal(res.status,200);assert.equal(json.hours,168);
 assert.equal(json.readings.length,0);
 assert.equal(DB.queries.length,1);
});
test('no publica API si la clave de panel es débil',async()=>{
 const r=await worker.fetch(req('/api/health','short'),{DB:makeDb(),ADMIN_TOKEN:'short'});
 assert.equal(r.status,503);
});
