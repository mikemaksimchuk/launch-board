/* Chore-d for Overlord: per-field records, deterministic merges, no credentials. */
(function (root) {
  'use strict';
  const APP = 'launch-pad-mv-admin';
  function stable(x) {
    if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k)+':'+stable(x[k])).join(',') + '}';
    return JSON.stringify(x);
  }
  function valid(r) {
    if(!r || typeof r.id!=='string' || !/^[A-Za-z0-9|:._-]{1,300}$/.test(r.id) || /(?:^|[|:._-])(?:__proto__|constructor|prototype)(?:$|[|:._-])/.test(r.id) ||
      typeof r.touched!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.touched) || !Number.isFinite(Date.parse(r.touched)))return false;
    const v=r.value;
    const stamp=x=>x===null || (typeof x==='string' && Number.isFinite(Date.parse(x)));
    const month=x=>typeof x==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
    const id=x=>typeof x==='string' && /^[a-z0-9]{1,64}$/.test(x);
    if(r.kind==='name')return r.id==='name'&&typeof v==='string'&&v.length<=80;
    if(!v || typeof v!=='object' || Array.isArray(v))return false;
    if(r.kind==='check')return r.id.startsWith('check:')&&typeof v.done==='boolean'&&stamp(v.completedAt) && (!v.title||typeof v.title==='string');
    if(r.kind==='trip')return id(v.id)&&month(v.month)&&typeof v.label==='string'&&v.label.length<=120&&typeof v.deleted==='boolean'&&r.id==='trip:'+v.month+'|'+v.id;
    if(r.kind==='tripcheck')return id(v.trip)&&month(v.month)&&['cal','wrike','loc','time','ken','tax'].includes(v.step)&&typeof v.done==='boolean'&&stamp(v.completedAt)&&r.id==='tripcheck:'+v.month+'|'+v.trip+'|'+v.step;
    if(r.kind==='catalog')return r.id==='catalog'&&Array.isArray(v.weekly)&&Array.isArray(v.monthly)&&Array.isArray(v.tripSteps);
    return false;
  }
  function merge(a, b) {
    const by = new Map();
    [...a, ...b].forEach(r => {
      if (!valid(r)) throw new Error('Invalid admin task record; existing data was not replaced.');
      const old = by.get(r.id);
      if (!old || r.touched > old.touched || (r.touched === old.touched && stable(r) > stable(old))) by.set(r.id, r);
    });
    return [...by.values()].sort((x,y)=>x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  }
  function readPayload(data) {
    if (!data || data.app !== APP || data.version !== 1 || !Array.isArray(data.records))
      throw new Error('Unrecognized admin task data; nothing was overwritten.');
    return merge([], data.records);
  }
  function payload(records) { return {app:APP, version:1, records:merge([],records)}; }
  function project(records) {
    const state = {name:'', checks:{}, trips:{}, dates:{}, tripDates:{}, lastBackup:''};
    records.forEach(r => {
      if(r.kind==='name') state.name=String(r.value || '');
      if(r.kind==='check') {
        state.checks[r.id.slice(6)]=!!r.value.done;
        if(r.value.done) state.dates[r.id.slice(6)]=r.value.completedAt || null;
      }
      if(r.kind==='trip' && !r.value.deleted) {
        const v=r.value;
        if(!state.trips[v.month]) state.trips[v.month]=[];
        state.trips[v.month].push({id:v.id,label:v.label,checks:{}});
      }
    });
    records.forEach(r => {
      if(r.kind!=='tripcheck')return;
      const v=r.value, t=(state.trips[v.month]||[]).find(t=>t.id===v.trip);
      if(t){t.checks[v.step]=!!v.done;if(v.done) state.tripDates[v.month+'|'+v.trip+'|'+v.step]=v.completedAt || null;}
    });
    Object.values(state.trips).forEach(ts=>ts.sort((a,b)=>a.id.localeCompare(b.id)));
    return state;
  }
  function changes(base, next, records, time, unknownDates) {
    const patches=[], by=new Map(records.map(r=>[r.id,r]));
    const max = records.reduce((n,r)=>Math.max(n,Date.parse(r.touched)||0),0);
    const touched=new Date(Math.max(Date.parse(time),max+1)).toISOString();
    const put=(id,kind,value)=>patches.push({id,kind,value,touched});
    if(base.name!==next.name) put('name','name',String(next.name||'').slice(0,80));
    new Set([...Object.keys(base.checks||{}),...Object.keys(next.checks||{})]).forEach(k=>{
      if(!!base.checks[k]===!!next.checks[k])return;
      const old=by.get('check:'+k);
      put('check:'+k,'check',{...(old?old.value:{}),done:!!next.checks[k],completedAt:next.checks[k]?(unknownDates?null:time):null});
    });
    const tripMap=s=>new Map(Object.entries(s.trips||{}).flatMap(([m,ts])=>ts.map(t=>[m+'|'+t.id,{...t,month:m}])));
    const a=tripMap(base),b=tripMap(next);
    new Set([...a.keys(),...b.keys()]).forEach(k=>{
      const old=a.get(k),n=b.get(k);
      if(!n){put('trip:'+k,'trip',{id:old.id,month:old.month,label:old.label,deleted:true});return;}
      if(!old || old.label!==n.label)put('trip:'+k,'trip',{id:n.id,month:n.month,label:n.label,deleted:false});
      new Set([...Object.keys(old?.checks||{}),...Object.keys(n.checks||{})]).forEach(step=>{
        if(!!old?.checks?.[step]===!!n.checks[step])return;
        put('tripcheck:'+k+'|'+step,'tripcheck',{month:n.month,trip:n.id,step,done:!!n.checks[step],completedAt:n.checks[step]?(unknownDates?null:time):null});
      });
    });
    return patches;
  }
  const api={APP,stable,merge,readPayload,payload,project,changes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.LBAdminCore=api;
})(typeof window!=='undefined'?window:this);
