import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waterApi,pruneWaterHistory} from '../src/water.mjs';

const ADMIN='admin-test-token-with-sufficient-length';
const DEVICE='a'.repeat(64);
const id='tank-test-0001';
const hash=async str=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str))),v=>v.toString(16).padStart(2,'0')).join('');
const makeRequest=(path,token,body)=>new Request('https://local.invalid'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
const tank=()=>({id,capacity_l:1000,empty_cm:100,full_cm:10,token_hash:null});

test('ESP32: una sola sentencia atómica limita dos lecturas simultáneas',async()=>{
 const row=tank();row.token_hash=await hash(DEVICE);
 let inserted=0;
 const statements=[];
 const DB={prepare(sql){return {bind(...args){this.args=args;return this},async first(){return row},async run(){statements.push({sql,args:this.args});return {meta:{changes:inserted++===0?1:0}}}}}};
 const req=()=>makeRequest('/api/water/ingest/'+id,DEVICE,{distance_cm:55});
 const [first,second]=await Promise.all([waterApi(req(),{DB},{clock:()=>1792000000000}),waterApi(req(),{DB},{clock:()=>1792000000000})]);
 assert.deepEqual([first.status,second.status].sort(),[200,429]);
 assert.equal(statements.length,2);
 assert.match(statements[0].sql,/WHERE NOT EXISTS/);
 assert.deepEqual(statements[0].args.slice(-2),[id,1792000000000-30000]);
});

test('administrador rota token y persiste sólo su hash',async()=>{
 const calls=[];const DB={prepare(sql){return {bind(...args){calls.push({sql,args});return this},async first(){return {id}},async run(){return {meta:{changes:1}}}}}};
 const r=await waterApi(makeRequest('/api/water/tanks/'+id+'/rotate-token',ADMIN,{}),{DB,ADMIN_TOKEN:ADMIN});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.match(body.device_token,/^[a-f0-9]{64}$/);
 assert.equal(calls.at(-1).args[1],id);
 assert.equal(calls.at(-1).args[0],await hash(body.device_token));
 assert.equal(calls.at(-1).args.includes(body.device_token),false);
});

test('sin clave de administrador no se pueden rotar tokens',async()=>{
 const DB={prepare(){throw Error('no database read expected')}};
 assert.equal((await waterApi(makeRequest('/api/water/tanks/'+id+'/rotate-token','fake',{}),{DB,ADMIN_TOKEN:ADMIN})).status,401);
});

test('mantenimiento borra sólo lecturas de agua anteriores a 180 días',async()=>{
 let call;const DB={prepare(sql){return {bind(...args){call={sql,args};return this},async run(){return {meta:{changes:4}}}}}};
 const current=1792000000000;
 const result=await pruneWaterHistory({DB},{clock:()=>current});
 assert.deepEqual(result,{ok:true,removed:4,cutoff:current-180*86400000});
 assert.equal(call.sql,'DELETE FROM water_readings WHERE ts < ?');
 assert.deepEqual(call.args,[current-180*86400000]);
});
