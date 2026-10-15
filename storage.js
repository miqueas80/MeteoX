// Local copy of recent real weather observations. Never stores API credentials.
// Kept separate from Service Worker: API requests always require online auth.
(() => {
  'use strict';
  const NAME='meteox-real-readings', STORE='snapshots';
  function open(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible'));
      const req=indexedDB.open(NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('No se pudo abrir el almacenamiento'));
    });
  }
  async function operate(type,fn){
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,type),store=tx.objectStore(STORE);
      const op=fn(store);
      op.onsuccess=()=>resolve(op.result);
      op.onerror=()=>reject(op.error||new Error('Error de almacenamiento'));
      tx.onabort=()=>reject(tx.error||new Error('Operación cancelada'));
    });}finally{db.close()}
  }
  window.MeteoCache={
    async read(){
      try{
        const v=await operate('readonly',s=>s.get('real'));
        return v && Array.isArray(v.readings) ? v : null;
      }catch{return null;}
    },
    async write(rows){
      if(!Array.isArray(rows))return false;
      // Cap storage to a week. No demo data and no token are saved.
      try{await operate('readwrite',s=>s.put({readings:rows.slice(-2100),cachedAt:Date.now()},'real'));return true;}
      catch{return false;}
    },
    async clear(){try{await operate('readwrite',s=>s.delete('real'));return true;}catch{return false;}}
  };
})();
