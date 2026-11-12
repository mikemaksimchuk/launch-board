/* Uses the existing LAUNCH PAD encryption and GitHub configuration. No new credentials. */
(function(){
'use strict';
const C=window.LBAdminCore, PATH='admin-tasks.json';
let records=[],scope='',busy=false,again=false,timer=null,lastSHA=null,lastMessage='',listeners=[],lastGood='',storageError='',configStale=false;
const cfg=()=>typeof cfgd==='function'&&cfgd();
const identity=()=>cfg()?SYNC.repo+'|'+PATH:'local';
const key=()=> 'LBX.admin.v1:'+scope;
function emit(){listeners.forEach(fn=>fn());}
function persist(){try{localStorage.setItem(key(),JSON.stringify(C.payload(records)));storageError='';return true;}catch(e){storageError='Could not save on this device. Keep this page open and export a backup.';return false;}}
function switchScope(){
 const next=identity();if(next===scope)return;
 let loaded=[];
 try{const raw=localStorage.getItem('LBX.admin.v1:'+next);if(raw)loaded=C.readPayload(JSON.parse(raw));}
 catch(e){lastMessage='Saved admin data could not be read. The original cache has been preserved. Export/recover it before continuing.';throw new Error(lastMessage);}
 // Moving from local-only use to the configured repository must carry checks over.
 if(scope==='local' && next!=='local')loaded=C.merge(loaded,records);
 scope=next;records=loaded;lastSHA=null;lastGood='';storageError='';
 persist();
 lastMessage=cfg()?'Checking shared admin tasks…':'Saved on this device. Set up LAUNCH PAD sync to use another device.';
 emit();
}
function queue(){clearTimeout(timer);timer=setTimeout(()=>sync(),1000);}
function write(patches){switchScope();records=C.merge(records,patches);persist();emit();queue();}
async function sync(){
 if(configStale){lastMessage='Sync settings changed in another tab. Reload this page before syncing admin tasks.';emit();return;}
 try{switchScope();}catch(e){return;}
 if(!cfg()){emit();return;}
 if(busy){again=true;return;}
 busy=true;const target=identity(),pass=SYNC.pass,token=SYNC.token;
 const same=()=>!configStale&&identity()===target&&SYNC.pass===pass&&SYNC.token===token;
 lastMessage='Syncing MV Admin tasks…';emit();
 try{
  for(let attempt=0;attempt<3;attempt++){
   const remote=await gh('GET',null,null,PATH);
   if(!same())throw new Error('Sync settings changed. Retry with the current settings.');
   let incoming=[];
   if(remote){
    const decrypted=await open_(decodeURIComponent(escape(atob(remote.content.replace(/\n/g,'')))));
    incoming=C.readPayload(decrypted);
   }
   if(!same())throw new Error('Sync settings changed.');
   records=C.merge(records,incoming);persist();emit();
   const snapshot=C.stable(records);
   if(snapshot===C.stable(incoming)){
    lastSHA=remote?.sha||null;break;
   }
   const body=await seal(C.payload(records));
   if(!same())throw new Error('Sync settings changed.');
   try{
    const result=await gh('PUT',body,remote?.sha,PATH,'MV Admin tasks');
    if(!same())throw new Error('Sync settings changed.');
    lastSHA=result?.content?.sha||null;
    if(C.stable(records)!==snapshot)again=true;
    break;
   }catch(e){if(/GitHub (409|422)/.test(e.message)&&attempt<2)continue;throw e;}
  }
  lastGood=new Date().toISOString();
  lastMessage='Synced '+new Date(lastGood).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'. Updates refresh while LAUNCH PAD is open.';
 }catch(e){lastMessage='Not synced: '+e.message+' Your local changes are kept; use Sync admin tasks to retry.';}
 finally{busy=false;emit();if(again){again=false;queue();}}
}
function getRecords(){switchScope();return JSON.parse(JSON.stringify(records));}
function commit(base,next,unknown){switchScope();write(C.changes(base,next,records,new Date().toISOString(),unknown));}
function seed(catalog,items){
 switchScope();const by=new Map(records.map(r=>[r.id,r]));const patches=[];
 if(!by.has('catalog'))patches.push({id:'catalog',kind:'catalog',value:catalog,touched:'2026-11-12T00:00:00.000Z'});
 items.forEach(i=>{if(!by.has('check:'+i.key))patches.push({id:'check:'+i.key,kind:'check',value:{done:false,completedAt:null,title:i.title,period:i.period},touched:'1970-01-01T00:00:00.000Z'});});
 if(patches.length)write(patches);
}
function mergeImport(rows){switchScope();write(C.merge(records,rows));}
window.LBAdmin={mount:null,records:getRecords,commit,seed,mergeImport,sync,status:()=>[lastMessage,storageError].filter(Boolean).join(' '),storageOK:()=>!storageError,subscribe:fn=>listeners.push(fn),payload:()=>C.payload(getRecords())};
window.addEventListener('storage',e=>{
 if(e.key===key() && e.newValue){try{
  const incoming=C.readPayload(JSON.parse(e.newValue)),merged=C.merge(records,incoming);
  const changed=C.stable(records)!==C.stable(merged);records=merged;
  if(C.stable(merged)!==C.stable(incoming))persist();
  if(changed){emit();queue();}
 }catch(err){lastMessage='Could not read updated local admin tasks. Existing records were kept.';emit();}}
 else if(e.key==='launchboard-sync'){configStale=true;lastMessage='Sync settings changed in another tab. Reload this page before syncing admin tasks.';emit();}
});
window.addEventListener('focus',()=>sync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
setInterval(()=>{if(!document.hidden)sync();},15000);
// Existing Sync buttons also sync this tab; no handlers or task behavior replaced.
document.addEventListener('click',e=>{if(e.target.closest('#bSync,#bSyncTop'))sync();});
})();


window.LBAdmin.mount = function (host) {
  const root=host.attachShadow({mode:"open"});
  root.innerHTML="<style>\n:host{display:block;--bg:var(--page);--surface-2:var(--surface2);--ink:var(--text);--heading:var(--text);--hover:var(--shade);--link:var(--a11yOrange);--link-hover:var(--text);--attn:var(--a11yOrange);--due-bg:var(--cream);--due-edge:var(--orange);--pill-now-bg:var(--text);--pill-now-ink:var(--surface);--pill-due-bg:var(--a11yOrange);--pill-due-ink:var(--surface);--pill-soft-bg:var(--surface2);--pill-soft-ink:var(--text);--th-bg:var(--darkTeal);--th-ink:#fff;--meter-bg:var(--line);--meter-fill:var(--midTeal);--focus:var(--a11yOrange);--box-fill:var(--green);--box-edge:var(--a11yGreen);--box-done:var(--surface2);--box-done-edge:var(--midTeal);--box-mark:var(--text);--logo-plate:#fff;--logo-pad:6px 10px;box-sizing:border-box;font-family:inherit;color:var(--text)}\n*,*::before,*::after{box-sizing:inherit}\n :host{scroll-padding-top:env(safe-area-inset-top, 0px)}\n:host{margin:0;background:var(--bg);color:var(--ink);font-family:Figtree,Poppins,\"Segoe UI\",Roboto,\"Helvetica Neue\",sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}\na{color:var(--link);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}\na:hover{color:var(--link-hover);text-decoration-thickness:2px}\n:focus-visible{outline:3px solid var(--focus);outline-offset:2px;border-radius:4px}\n.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\nbutton{font:inherit}\n\n.wrap{max-width:880px;margin:0 auto;padding:16px 20px 48px}\n\n/* Tools bar: backup and theme */\n.utility{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;margin-bottom:18px}\n.backup{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}\n.btn-util{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--teal);font-size:.875rem;font-weight:700;cursor:pointer}\n.btn-util:hover{box-shadow:inset 0 0 0 100px var(--hover)}\n.btn-util svg{width:16px;height:16px;flex:none}\n.util-status{margin:0;font-size:.8125rem;color:var(--muted)}\n.theme{display:inline-flex;align-items:center;margin:0;padding:3px;border:1px solid var(--line);border-radius:999px;background:var(--surface)}\n.theme input{position:absolute;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}\n.theme label{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:.875rem;font-weight:700;color:var(--teal);cursor:pointer}\n.theme label:hover{background:var(--hover)}\n.theme label svg{width:16px;height:16px;flex:none}\n.theme input:checked + label{background:var(--pill-now-bg);color:var(--pill-now-ink)}\n.theme input:focus-visible + label{outline:3px solid var(--focus);outline-offset:2px}\n\n.backup-panel{margin:0 0 18px;padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:inset 5px 0 0 var(--due-edge)}\n.backup-panel p{margin:0 0 8px}\n.backup-panel textarea{display:block;width:100%;min-height:120px;padding:8px;font:.8125rem/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;resize:vertical}\n.bp-actions{display:flex;align-items:center;gap:12px;margin-top:10px}\n\n/* Masthead */\n.masthead{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;padding-bottom:14px;border-bottom:4px solid var(--green)}\n.masthead h1{margin:0;font-size:clamp(1.6rem,1.2rem + 1.6vw,2.2rem);line-height:1.1;font-weight:800;letter-spacing:-.02em;color:var(--heading)}\n.logo{display:block;height:40px;width:auto;background:var(--logo-plate);padding:var(--logo-pad);border-radius:8px}\n\n/* Name and week card */\n.idcard{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);margin-top:18px;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}\n.idcell{padding:16px 20px}\n.idcell + .idcell{border-left:1px solid var(--line)}\n.idlabel{display:block;margin:0 0 6px;font-size:.875rem;font-weight:700;color:var(--teal)}\n#nameInput{display:block;width:100%;margin:0;padding:2px 0 4px;font:inherit;font-size:1rem;line-height:1.5;color:var(--ink);background:none;border:0;border-bottom:2px solid var(--line);border-radius:0;box-shadow:none;-webkit-appearance:none;appearance:none}\n#nameInput::placeholder{color:var(--muted)}\n#nameInput:focus{border-bottom-color:var(--teal)}\n#nameInput:-webkit-autofill,#nameInput:-webkit-autofill:hover,#nameInput:-webkit-autofill:focus{-webkit-text-fill-color:var(--ink);-webkit-box-shadow:0 0 0 100px var(--surface) inset;box-shadow:0 0 0 100px var(--surface) inset;transition:background-color 9999s ease-out 0s}\n.weekline{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 10px;margin:0}\n.weeknum{font-size:2rem;line-height:1.1;font-weight:800;letter-spacing:-.02em;color:var(--heading)}\n.weekyear{font-size:1rem;font-weight:600;color:var(--muted)}\n.weekdates{margin:4px 0 0;font-size:1rem}\n@media (max-width:620px){\n  .idcard{grid-template-columns:1fr}\n  .idcell + .idcell{border-left:0;border-top:1px solid var(--line)}\n}\n\n/* Reference documents drawer */\n.drawer{margin-top:14px;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}\n.drawer > summary{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;padding:12px 18px;list-style:none;cursor:pointer;font-weight:700;color:var(--heading)}\n.drawer > summary::-webkit-details-marker{display:none}\n.drawer > summary:hover{background:var(--hover)}\n.drawer > summary:focus-visible{outline-offset:-3px;border-radius:12px}\n.drawer-note{font-size:.875rem;font-weight:600;color:var(--muted)}\n.doclist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 32px;margin:0;padding:4px 18px 16px;list-style:none;border-top:1px solid var(--line)}\n.doclist li{padding-top:10px}\n.doclist a{font-weight:700}\n.doclist p{margin:2px 0 0;font-size:.875rem;color:var(--muted)}\n@media (max-width:700px){.doclist{grid-template-columns:minmax(0,1fr)}}\n\n/* Notices */\n.callout{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 16px;margin:0 0 12px;padding:12px 18px;background:var(--due-bg);border:1px solid var(--line);border-radius:12px;box-shadow:inset 5px 0 0 var(--due-edge)}\n.callout p{margin:0;font-weight:600}\n.storage-note{margin-top:14px}\n\n/* Month bar */\n.monthbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:30px 0 12px}\n.monthbar h2{margin:0 6px;min-width:10ch;font-size:1.5rem;line-height:1.2;font-weight:800;letter-spacing:-.015em;color:var(--heading)}\n.iconbtn{display:grid;place-items:center;width:40px;height:40px;padding:0;border:1px solid var(--line);border-radius:50%;background:var(--surface);color:var(--teal);cursor:pointer}\n.iconbtn:hover{box-shadow:inset 0 0 0 100px var(--hover)}\n.iconbtn svg{width:20px;height:20px}\n#todayBtn{margin-left:auto}\n.btn{border:0;border-radius:999px;padding:9px 16px;background:var(--pill-now-bg);color:var(--pill-now-ink);font-weight:700;font-size:.9375rem;cursor:pointer}\n.btn:hover{filter:brightness(1.08)}\n.btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1.5px dashed var(--line);border-radius:10px;background:transparent;color:var(--teal);font-weight:700;font-size:.9375rem;cursor:pointer}\n.btn-ghost:hover{background:var(--hover)}\n.btn-ghost svg{width:16px;height:16px}\n.btn-text{padding:6px 4px;border:0;background:none;color:var(--link);font-size:.875rem;font-weight:600;text-decoration:underline;text-underline-offset:2px;cursor:pointer}\n\n/* Accordions */\n.acc{margin:0 0 10px;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}\n.acc > summary{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;min-height:58px;padding:14px 18px;list-style:none;cursor:pointer}\n.acc > summary::-webkit-details-marker{display:none}\n.acc > summary:hover{background:var(--hover)}\n.acc > summary:focus-visible{outline-offset:-3px;border-radius:12px}\n.chev{flex:none;width:20px;height:20px;color:var(--teal);transition:transform .18s ease}\ndetails[open] > summary .chev{transform:rotate(90deg)}\n.acc-title{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;flex:1 1 220px;min-width:0}\n.acc-name{font-size:1.125rem;font-weight:800;color:var(--heading)}\n.acc-dates{font-size:.9375rem;font-weight:600;color:var(--muted)}\n.pill{align-self:center;padding:3px 9px;border-radius:999px;font-size:.75rem;font-weight:700;white-space:nowrap}\n.pill-now{background:var(--pill-now-bg);color:var(--pill-now-ink)}\n.pill-due{background:var(--pill-due-bg);color:var(--pill-due-ink)}\n.pill-soft{background:var(--pill-soft-bg);color:var(--pill-soft-ink)}\n.acc-status{display:flex;align-items:center;gap:10px;margin-left:auto;font-size:.9375rem;font-weight:600}\n.meter{display:block;width:72px;height:6px;border-radius:3px;background:var(--meter-bg);overflow:hidden}\n.meter > span{display:block;height:100%;border-radius:3px;background:var(--meter-fill)}\n.status-text.attn{color:var(--attn)}\n.status-text.muted{color:var(--muted)}\n.status-text.done{display:inline-flex;align-items:center;gap:6px;color:var(--teal)}\n.status-text.done svg{width:18px;height:18px}\n.week.is-current{box-shadow:inset 5px 0 0 var(--teal)}\n.monthend{margin-top:24px}\n.monthend.phase-due{background:var(--due-bg);box-shadow:inset 5px 0 0 var(--due-edge)}\n\n.panel{padding:2px 18px 18px;border-top:1px solid var(--line)}\n.panel-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:12px}\n.panel-note{margin:0;font-size:.9375rem;color:var(--muted)}\n.groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 36px}\n.groups.one{grid-template-columns:minmax(0,1fr)}\n@media (max-width:700px){.groups{grid-template-columns:minmax(0,1fr)}}\n.group{padding-top:16px}\n.group-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:2px}\n.group h3{margin:0;font-size:1rem;font-weight:700;line-height:1.35;color:var(--heading)}\n.group h3 a{color:var(--link)}\n.group-count{font-size:.8125rem;font-weight:600;color:var(--muted);white-space:nowrap}\n.group-count.is-complete{color:var(--teal)}\n.group-note{margin:2px 0 0 34px;font-size:.875rem;color:var(--muted)}\n\n/* Guide links */\n.docs{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}\n.doc{display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 8px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--link);font-size:.8125rem;font-weight:700;line-height:1.4;text-decoration:none}\n.doc:hover{border-color:currentColor;color:var(--link)}\n.doc svg{width:14px;height:14px;flex:none}\n\n/* Checklist items */\n.items{margin:0;padding:0;list-style:none}\n.row{display:flex;align-items:flex-start;gap:12px;padding:6px 0}\n.row label{line-height:1.45;cursor:pointer}\n.row input[type=\"checkbox\"]{flex:none;display:grid;place-content:center;width:22px;height:22px;margin:1px 0 0;border:2px solid var(--box-edge);border-radius:6px;background:var(--box-fill);cursor:pointer;-webkit-appearance:none;appearance:none;transition:background-color .12s ease,border-color .12s ease}\n.row input[type=\"checkbox\"]::before{content:\"\";width:13px;height:13px;background:var(--box-mark);clip-path:polygon(14% 44%,0 65%,50% 100%,100% 16%,80% 0,43% 62%);transform:scale(0);transition:transform .12s ease}\n.row input[type=\"checkbox\"]:hover:not(:checked){filter:brightness(1.07)}\n.row input[type=\"checkbox\"]:checked{background:var(--box-done);border-color:var(--box-done-edge)}\n.row input[type=\"checkbox\"]:checked::before{transform:scale(1)}\n.row input[type=\"checkbox\"]:focus-visible{outline:3px solid var(--focus);outline-offset:2px}\n.item.is-done > .row > label > .item-copy{color:var(--muted);text-decoration:line-through;text-decoration-thickness:1px}\n@media (forced-colors: active){\n  .row input[type=\"checkbox\"]{border-color:CanvasText;background:Canvas}\n  .row input[type=\"checkbox\"]::before{background:CanvasText}\n}\n\n/* Activity types reference */\n.sub{margin:2px 0 8px 34px}\n.sub > summary{display:inline-flex;align-items:center;gap:6px;padding:4px 0;list-style:none;color:var(--teal);font-size:.9375rem;font-weight:700;cursor:pointer}\n.sub > summary::-webkit-details-marker{display:none}\n.sub > summary .chev{width:16px;height:16px}\n.table-note{margin:6px 0 0;font-size:.875rem;color:var(--muted)}\n.table-wrap{margin-top:8px;overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface)}\n.table-wrap table{width:100%;min-width:760px;border-collapse:collapse;font-size:.875rem;line-height:1.35}\n.table-wrap th{padding:8px 10px;background:var(--th-bg);color:var(--th-ink);text-align:left;font-weight:700}\n.table-wrap td{padding:8px 10px;border-top:1px solid var(--line);vertical-align:top}\n.table-wrap tbody tr:nth-child(even) td{background:var(--surface-2)}\n.table-wrap td:first-child{width:34%;font-weight:700;color:var(--heading)}\n.table-wrap .def{display:block;margin-top:2px;font-weight:400;color:var(--muted)}\n.table-wrap .na{color:var(--muted);font-style:italic}\n\n/* Trips */\n.trips{display:grid;justify-items:start;gap:10px;margin:2px 0 10px 34px}\n.hint{margin:0;font-size:.875rem;color:var(--muted)}\n.trip{width:100%;padding:10px 14px 6px;background:var(--surface);border:1px solid var(--line);border-radius:10px}\n.trip-head{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px}\n.trip-name{flex:1 1 200px;min-width:0;padding:4px 0;font:inherit;font-weight:600;color:var(--ink);background:transparent;border:0;border-bottom:1.5px solid var(--line);border-radius:0}\n.trip-name::placeholder{color:var(--muted);font-weight:400}\n.trip-count{font-size:.8125rem;font-weight:600;color:var(--muted);white-space:nowrap}\n.trip-count.is-complete{color:var(--teal)}\n\n/* Footer */\n.foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;margin-top:36px;padding-top:14px;border-top:1px solid var(--line);font-size:.875rem;color:var(--muted)}\n.foot p{margin:0;max-width:60ch}\n\n@media (prefers-reduced-motion: reduce){\n  .chev,.row input[type=\"checkbox\"],.row input[type=\"checkbox\"]::before{transition:none}\n}\n\n.wrap{max-width:none;padding:12px 0 24px}.masthead{padding:18px 20px;border:1px solid var(--line);border-left:5px solid var(--orange);border-radius:12px;background:var(--surface2)}.masthead h1{font-size:1.6rem}.admin-kicker{margin:0 0 4px;font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800}.completion-stamp{display:block;font-size:.75rem;color:var(--muted);text-decoration:none;margin-top:2px}.logo{max-width:180px;object-fit:contain}.group h3,.idlabel,.btn-util,.doc,.btn-text,.chev,.theme label,.trip-count.is-complete,.group-count.is-complete{color:var(--text)}.admin-sync{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.admin-sync p{flex:1;font-size:.85rem;color:var(--muted);margin:0}.row label{min-width:0;overflow-wrap:anywhere}.row input[type=checkbox]{min-width:22px}.row{min-height:44px}.utility{margin-top:12px}.foot{margin-top:18px}[hidden]{display:none!important}\n\n.idcard{grid-template-columns:1fr}.idcard .idcell{border-left:0}\n</style>\n<div class=\"wrap\">\n  <div class=\"admin-sync\"><p id=\"adminSyncStatus\" role=\"status\" aria-live=\"polite\"></p><button class=\"btn-util\" type=\"button\" id=\"adminSync\">Sync admin tasks</button></div><div class=\"utility\">\n    <div class=\"backup\"><button class=\"btn-util\" type=\"button\" id=\"adminLegacy\" hidden>Import this browser\u2019s original checks</button>\n      <button type=\"button\" class=\"btn-util\" id=\"saveBackupBtn\">\n        <svg viewBox=\"0 0 20 20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14v2.5h12V14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n        Save backup\n      </button>\n      <button type=\"button\" class=\"btn-util\" id=\"importBackupBtn\">\n        <svg viewBox=\"0 0 20 20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M10 12V3m0 0L6.5 6.5M10 3l3.5 3.5M4 14v2.5h12V14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n        Import checklist backup\n      </button>\n      <input type=\"file\" id=\"importFile\" accept=\".json,application/json\" hidden>\n      <p class=\"util-status\" id=\"backupStatus\" role=\"status\" aria-live=\"polite\"></p>\n    </div>\n\n  </div>\n\n  <div class=\"backup-panel\" id=\"backupPanel\" hidden>\n    <p><strong>This view can\u2019t save files directly.</strong> Copy the text below into a new text file and name it something like <em>ai-strategist-backup.json</em>. You can bring it back later with Import backup.</p>\n    <label class=\"sr-only\" for=\"backupText\">Backup data</label>\n    <textarea id=\"backupText\" readonly></textarea>\n    <div class=\"bp-actions\">\n      <button type=\"button\" class=\"btn\" id=\"selectBackupBtn\">Select all</button>\n      <button type=\"button\" class=\"btn-text\" id=\"closeBackupBtn\">Close</button>\n    </div>\n  </div>\n\n\n\n  <section class=\"idcard\" aria-label=\"This week\">\n\n    <div class=\"idcell\">\n      <p class=\"idlabel\">This week</p>\n      <p class=\"weekline\"><span class=\"weeknum\" id=\"weekNum\"></span><span class=\"weekyear\" id=\"weekYear\"></span></p>\n      <p class=\"weekdates\" id=\"weekDates\"></p>\n    </div>\n  </section>\n\n  <details class=\"drawer\" id=\"docsDrawer\">\n    <summary>\n      <svg class=\"chev\" viewBox=\"0 0 20 20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7.5 4.5 13 10l-5.5 5.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n      <span>Reference documents</span><span class=\"drawer-note\">Policies and guides in one place</span>\n    </summary>\n    <ul class=\"doclist\" id=\"docList\"></ul>\n  </details>\n\n  <div class=\"callout storage-note\" id=\"storageNote\" role=\"status\" hidden>\n    <p>Could not save locally. Keep this page open, export a backup, and check sync status.</p>\n  </div>\n\n  <main>\n    <div class=\"monthbar\">\n      <button type=\"button\" class=\"iconbtn\" id=\"prevBtn\" aria-label=\"Previous month\">\n        <svg viewBox=\"0 0 20 20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12.5 4.5 7 10l5.5 5.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n      </button>\n      <h2 id=\"monthTitle\" aria-live=\"polite\"></h2>\n      <button type=\"button\" class=\"iconbtn\" id=\"nextBtn\" aria-label=\"Next month\">\n        <svg viewBox=\"0 0 20 20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7.5 4.5 13 10l-5.5 5.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n      </button>\n      <button type=\"button\" class=\"btn\" id=\"todayBtn\" hidden>Back to this week</button>\n    </div>\n    <div id=\"board\"></div>\n  </main>\n\n  <footer class=\"foot\"><p>Checklists and completion dates sync through your private LAUNCH PAD data repository. The theme follows LAUNCH PAD.</p></footer>\n</div>\n\n";
  const bridge=window.LBAdmin, core=window.LBAdminCore;
  'use strict';

  /* ---------- Helpers ---------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function $(sel) { return root.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  var NEWTAB = '<span class="sr-only"> (opens in a new tab)</span>';
  function a(href, text) {
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + text + NEWTAB + '</a>';
  }

  /* ---------- Reference documents ---------- */
  var DOCS = {
    eom: {
      url: 'https://docs.google.com/document/d/1c-YDzjPZouZ0JTXBnqZnz1frVaiZKVGv/edit?usp=sharing&ouid=115590178239407675998&rtpof=true&sd=true',
      title: 'End of Month Tasks (original list)', chip: 'Original list',
      about: 'The team’s original month-end checklist, including the activity-type definitions.'
    },
    addendum: {
      url: 'https://drive.google.com/file/d/17YgwEbJRpM1MLQ0jmflWBeJ16uRyqLFk/view?usp=sharing',
      title: 'Addendum to Travel Policy for Outreach Staff', chip: 'Travel addendum',
      about: 'Same-day travel for AI Strategists and Partnerships: full mileage, the $25 per diem, hotels and receipts.'
    },
    handbook: {
      url: 'https://drive.google.com/file/d/1JezwO42uecNmp9jbU_ANZfjOvMGq3erh/view?usp=sharing',
      title: 'Michigan Virtual Employee Handbook', chip: 'Handbook',
      about: 'The full mileage, travel, lodging and meal policy (pages 32–36).'
    },
    pcard: {
      url: 'https://drive.google.com/file/d/1ZMZ_nx6A9AYgpyIpF7xrZfv_3C5M4l4g/view?usp=sharing',
      title: 'Travel and P-Card Reference Guide', chip: 'P-Card guide',
      about: 'What goes in Wrike Pre- and Post-Trip requests, P-Card receipts in VSC, and the hotel tax-exempt form.'
    },
    mileage: {
      url: 'https://drive.google.com/file/d/1WAbPd2kBhWVC9Lm5guVTbAjm3okv__9I/view?usp=sharing',
      title: 'Mileage and Expense Tracking Guide', chip: 'Mileage guide',
      about: 'How to fill out the Frequent Traveler form: coding, business purpose, per diem and when it’s due.'
    },
    where: {
      url: 'https://drive.google.com/file/d/1nDG_5KKsW0dUWgdkQYVk3JIry-y1IEtP/view?usp=sharing',
      title: 'Travel Quick Guide: Which Path Do I Use?', chip: 'Which travel path?',
      about: 'Day trip or overnight, personal car or rental: which forms to use and where mileage and per diem go.'
    }
  };
  var DOC_ORDER = ['eom', 'addendum', 'handbook', 'pcard', 'mileage', 'where'];
  var DOC_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 1.75h5.25L12.5 5v9.25H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 2v3.25h3.25M6 8.5h4.5M6 11h4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  function docChips(keys) {
    return '<div class="docs"><span class="sr-only">Guides: </span>' + keys.map(function (k) {
      var d = DOCS[k];
      return '<a class="doc" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer">' + DOC_ICON + '<span>' + d.chip + '</span>' + NEWTAB + '</a>';
    }).join('') + '</div>';
  }

  /* ---------- Checklist content ---------- */
  var LINKS = {
    sams: 'https://docs.google.com/spreadsheets/d/1-QOh5A-U-Q3qr5Trhzn1TX4E2ni8YD6BBlYDzeybNB0/edit?usp=sharing',
    travel: 'https://docs.google.com/spreadsheets/d/1sfdpNG1j6sq388TIqWA0wbGARe93-_xEP2JTrRo59Vc/edit?usp=sharing',
    capacity: 'https://docs.google.com/spreadsheets/d/1lhG5ZR4IgImYBVR2yri5tosOgk_Oa9dWEFnuo7PaT6Y/edit?usp=sharing'
  };
  var MAIL = '<a href="mailto:apinvoice@michiganvirtual.org?subject=ACTION%3A%20Reimbursement%20Request">apinvoice@michiganvirtual.org</a>';

  var WEEKLY = [
    { id: 'cal', title: 'Calendar and working locations', items: [
      { id: 'review', html: 'Review and update your personal calendar — block off time as needed.' },
      { id: 'locations', html: 'Update working locations — office or remote.' },
      { id: 'strategist', html: 'Make sure the AI Strategist calendar is accurate for engagements.' }
    ]},
    { id: 'clients', title: 'Clients and communication', items: [
      { id: 'checkin', html: 'Follow up with clients on this week’s meetings, as needed.' },
      { id: 'prep', html: 'Send prep emails to clients for next week’s engagements.' },
      { id: 'wrike', html: 'Review the Wrike tasks assigned to you.' },
      { id: 'lookahead', html: 'Look ahead 6–8 weeks and share any upcoming Communications needs in the AI Lab Teams chat.' }
    ]},
    { id: 'service', title: 'Service agreements', items: [
      { id: 'lines', html: 'Update the ' + a(LINKS.sams, 'Service Agreement Management Spreadsheet') + ' for the week’s work — or at least start it.' }
    ]},
    { id: 'mileage', title: 'Mileage and travel', docs: ['where', 'mileage', 'addendum'], items: [
      { id: 'sheet', html: 'Log this week’s personal-car day trips on your Frequent Traveler form: only trips over 20 miles one way, never trips to the MV office.' },
      { id: 'posttrip', html: 'Submit a Post-Trip request in Wrike for each rental-car or overnight trip, within 5 business days of returning.' }
    ]},
    { id: 'card', title: 'P-Card (Visa Spend Clarity)', docs: ['pcard'], items: [
      { id: 'charges', html: 'Check VSC and code this week’s transactions.' },
      { id: 'code', html: 'Make sure every receipt is emailed or uploaded to VSC, within 48 hours of the charge.' }
    ]}
  ];

  var MONTHLY = [
    { id: 'sams', title: a(LINKS.sams, 'Service Agreement Management Spreadsheet'), items: [
      { id: 'fields', html: 'Complete fields D–L for all active service agreements.', extra: 'activity' }
    ]},
    { id: 'capacity', title: 'Capacity and client hours', items: [
      { id: 'tracker', html: 'Make sure your ' + a(LINKS.capacity, 'capacity tracker') + ' is up to date.' },
      { id: 'remaining', html: 'Check each client’s remaining hours.' },
      { id: 'low', html: 'If a bank is running low, email the client and Partnerships.' }
    ]},
    { id: 'wrike', title: 'Wrike AI hourly invoicing', items: [
      { id: 'clients', html: 'When the Wrike AI hourly invoicing notification arrives by email, check off each bank-of-hours client you served that month.' }
    ]},
    { id: 'reimb', title: 'Travel reimbursement', docs: ['mileage', 'where', 'addendum'],
      note: 'Due by the end of the first week of next month.', items: [
      { id: 'complete', html: 'Finish this month’s Frequent Traveler form (from the ' + a(LINKS.travel, 'Travel Reimbursement Template') + '): every trip, coding, business purpose, and per diem only where no meal was provided.' },
      { id: 'email', html: 'Email it to ' + MAIL + ' with the subject line <strong>ACTION: Reimbursement Request</strong>.' }
    ]},
    { id: 'plan', title: 'Next-month planning and communication', items: [
      { id: 'calendar', html: 'Review next month’s calendar.' },
      { id: 'clients', html: 'Reach out to clients to schedule planning meetings.' },
      { id: 'info', html: 'Gather any information you’ll need for the month ahead.' },
      { id: 'locations', html: 'Update the calendar for working locations — tentative is fine.' },
      { id: 'strategist', html: 'Verify the strategist calendar is up to date.' },
      { id: 'ftform', html: 'Start next month’s Frequent Traveler form: in Google Drive choose New, Google Sheets, From a template, then name it <strong>Month Year - Last Name</strong>.' },
      { id: 'travel', html: 'Input travel requests in Wrike for any trip needing a rental car or hotel.', extra: 'trips' }
    ]}
  ];

  var TRIP_STEPS = [
    { id: 'cal', text: 'Added to the strategist calendar' },
    { id: 'wrike', text: 'Pre-Trip request in Wrike, with hotel and car as needed' },
    { id: 'loc', text: 'Calendar updated — office or remote' },
    { id: 'time', text: 'Travel time for the event blocked on the calendar' },
    { id: 'ken', text: 'Travel approved by Ken' },
    { id: 'tax', text: 'Hotel stays: tax-exempt form packed and physical receipt kept' }
  ];

  // Labels and definitions from the original End of Month Tasks list; the other columns carried over from the earlier page.
  var ACTIVITY = [
    { name: 'Professional Learning Delivery', def: 'Live facilitation of professional learning with staff (in person or virtual). The time actively leading the session.', cols: ['Facilitate', 'Client', 'Prof. learning', 'Staff'], ex: 'District-provided professional development (DPPD)' },
    { name: 'Professional Learning Preparation', def: 'Designing and building a PD session before delivery.', cols: ['Prep', 'Internal', 'Prof. learning', 'Solo'], ex: 'Agendas, slides, or materials for DPPD' },
    { name: 'Collaborative Planning Sessions', def: 'Working sessions with clients to co-design or plan together, distinct from delivering learning to them.', cols: ['Prep', 'Client', 'Planning / co-design', 'Primary contact(s)'], ex: 'Planning upcoming events with the client' },
    { name: 'Meeting Planning & Preparation', def: 'Internal prep for a specific meeting, such as a task force, work group, or pushing into an existing meeting structure.', cols: ['Prep', 'Internal', 'Meeting / ops', 'Solo'], ex: 'Agendas, slides, or materials for meetings' },
    { name: 'Meeting Facilitation', def: 'Running or leading a meeting live.', cols: ['Facilitate', 'Client', 'Meeting / ops', 'Sub-group'], ex: 'AI task force or work group; principal or admin meeting' },
    { name: 'Follow-Up & Deliverables', def: 'Post-session work.', cols: ['Follow-up', 'Client', 'Meeting / ops', 'Solo'], ex: 'Summaries, data analysis, next steps; feedback folded into guidance documents' },
    { name: 'Facilitated Consulting Hours', def: 'Direct, client-facing consulting or coaching.', cols: ['Advise / coach', 'Client', 'Implementation / strategy', 'Primary contact(s)'], ex: '1:1 or small-group coaching for a client or stakeholder group' }
  ];

  function countItems(groups) { return groups.reduce(function (n, g) { return n + g.items.length; }, 0); }
  var WEEKLY_TOTAL = countItems(WEEKLY);

  var CHEV = '<svg class="chev" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4.5 10.5 8.5 14.5 15.5 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PLUS = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  /* State is backed by the encrypted LAUNCH PAD admin database. */
  var KEY = 'mv-ai-strategist-checklist-v1';
  var APP_ID = 'mv-ai-strategist-checklist';
  var storageOK=true, baseline, receiving=false;
  function blank(){return {name:'',checks:{},trips:{},dates:{},tripDates:{},lastBackup:''};}
  function load(){return core.project(bridge.records());}
  var state=load(); baseline=JSON.parse(JSON.stringify(state));
  function save(unknownDates){
    bridge.commit(baseline,state,unknownDates);
    state=load();baseline=JSON.parse(JSON.stringify(state));
  }
  function lastName() {
    var parts = (state.name || '').trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  /* ---------- Dates ---------- */
  var DAY = 86400000;
  function ymd(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { var x = ymd(d); return addDays(x, -((x.getDay() + 6) % 7)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // Storage key for a week (stable ISO id; never shown).
  function weekKey(monday) {
    var thu = addDays(monday, 3);
    var year = thu.getFullYear();
    var w1 = mondayOf(new Date(year, 0, 4));
    return year + '-W' + pad(1 + Math.round((monday - w1) / (7 * DAY)));
  }
  function monthKey(y, m) { return y + '-' + pad(m + 1); }
  // A work week belongs to the month that holds most of its weekdays (its Wednesday).
  function monthOfWeek(monday) { var wed = addDays(monday, 2); return { y: wed.getFullYear(), m: wed.getMonth() }; }
  function weeksOfMonth(y, m) {
    var mon = mondayOf(new Date(y, m, 1));
    if (addDays(mon, 2).getMonth() !== m) mon = addDays(mon, 7);
    var out = [];
    while (addDays(mon, 2).getMonth() === m) { out.push(mon); mon = addDays(mon, 7); }
    return out;
  }
  // Fiscal year runs October through September; week 1 is October’s first week.
  function fiscalWeek(monday) {
    var wed = addDays(monday, 2);
    var fy = wed.getMonth() >= 9 ? wed.getFullYear() : wed.getFullYear() - 1;
    var first = weeksOfMonth(fy, 9)[0];
    return { week: 1 + Math.round((monday - first) / (7 * DAY)), label: fy + '–' + pad((fy + 1) % 100) };
  }
  var fmtMD = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  var fmtLong = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  var fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  var fmtMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' });
  var fmtFull = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  function rangeShort(mon) {
    var fri = addDays(mon, 4);
    return mon.getMonth() === fri.getMonth()
      ? fmtMD.format(mon) + ' – ' + fri.getDate()
      : fmtMD.format(mon) + ' – ' + fmtMD.format(fri);
  }

  var curMon = mondayOf(new Date());
  var curMonth = monthOfWeek(curMon);
  var view = { y: curMonth.y, m: curMonth.m };
  var openState = new Map();
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- State helpers ---------- */
  function itemKey(scope, key, g, i) { return scope + '|' + key + '|' + g + '.' + i; }
  function isOn(k) { return !!state.checks[k]; }
  function tripsOf(mk) { return Array.isArray(state.trips[mk]) ? state.trips[mk] : []; }
  function findTrip(mk, id) { return tripsOf(mk).filter(function (t) { return t.id === id; })[0]; }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function weekDone(wk) {
    var n = 0;
    WEEKLY.forEach(function (g) { g.items.forEach(function (it) { if (isOn(itemKey('w', wk, g.id, it.id))) n++; }); });
    return n;
  }
  function monthEndCounts(mk) {
    var done = 0, total = 0;
    MONTHLY.forEach(function (g) { g.items.forEach(function (it) { total++; if (isOn(itemKey('m', mk, g.id, it.id))) done++; }); });
    tripsOf(mk).forEach(function (t) { TRIP_STEPS.forEach(function (s) { total++; if (t.checks && t.checks[s.id]) done++; }); });
    return { done: done, total: total };
  }
  function monthUsed(y, m) {
    var mk = monthKey(y, m);
    var wks = weeksOfMonth(y, m).map(weekKey);
    if (tripsOf(mk).length) return true;
    return Object.keys(state.checks).some(function (k) {
      if (!state.checks[k]) return false;
      if (k.indexOf('m|' + mk + '|') === 0) return true;
      return wks.some(function (w) { return k.indexOf('w|' + w + '|') === 0; });
    });
  }
  function monthInfo(y, m) {
    var weeks = weeksOfMonth(y, m);
    var finalMon = weeks[weeks.length - 1];
    var phase = curMon > finalMon ? 'past' : (curMon.getTime() === finalMon.getTime() ? 'due' : 'early');
    return { weeks: weeks, mk: monthKey(y, m), finalMon: finalMon, phase: phase };
  }
  function relOf(mon) {
    if (mon.getTime() === curMon.getTime()) return 'current';
    return mon < curMon ? 'past' : 'future';
  }

  /* ---------- Rendering ---------- */
  function renderNow() {
    var f = fiscalWeek(curMon);
    var fri = addDays(curMon, 4);
    $('#weekNum').textContent = 'Week ' + f.week;
    $('#weekYear').textContent = 'of fiscal year ' + f.label;
    $('#weekDates').textContent = fmtLong.format(curMon) + ' – ' + fmtLong.format(fri) + ', ' + fri.getFullYear();
  }

  function renderDocList() {
    $('#docList').innerHTML = DOC_ORDER.map(function (k) {
      var d = DOCS[k];
      return '<li>' + a(d.url, d.title) + '<p>' + d.about + '</p></li>';
    }).join('');
  }

  function progressHTML(done, total, isPast) {
    if (total > 0 && done === total) return '<span class="status-text done">' + CHECK + 'All done</span>';
    var pct = total ? Math.round(done / total * 100) : 0;
    var text = isPast ? (total - done) + ' left' : done + ' of ' + total + ' done';
    return '<span class="meter" aria-hidden="true"><span style="width:' + pct + '%"></span></span>' +
      '<span class="status-text' + (isPast ? ' attn' : '') + '">' + text + '</span>';
  }

  function itemHTML(scope, key, g, it) {
    var k = itemKey(scope, key, g.id, it.id);
    var cid = 'c-' + scope + '-' + key + '-' + g.id + '-' + it.id;
    var on = isOn(k);
    var html = typeof it.html === 'function' ? it.html(key) : it.html;
    var extra = '';
    if (it.extra === 'activity') extra = activityHTML(key);
    if (it.extra === 'trips') extra = '<div class="trips" id="trips-' + key + '">' + tripsInner(key) + '</div>';
    return '<li class="item' + (on ? ' is-done' : '') + '"><div class="row">' +
      '<input type="checkbox" id="' + cid + '" data-key="' + k + '"' + (on ? ' checked' : '') + '>' +
      '<label for="' + cid + '">' + '<span class="item-copy">'+html+'</span>' + '<span class="completion-stamp" data-date-key="'+k+'"></span></label></div>' + extra + '</li>';
  }

  function groupHTML(scope, key, g, context) {
    var gid = scope + '-' + key + '-' + g.id;
    return '<section class="group" aria-labelledby="h-' + gid + '">' +
      '<div class="group-head"><h3 id="h-' + gid + '"><span class="sr-only">' + context + ': </span>' + g.title + '</h3>' +
      '<span class="group-count" data-gstatus="' + scope + '|' + key + '|' + g.id + '"></span></div>' +
      (g.docs ? docChips(g.docs) : '') +
      '<ul class="items">' + g.items.map(function (it) { return itemHTML(scope, key, g, it); }).join('') + '</ul>' +
      (g.note ? '<p class="group-note">' + g.note + '</p>' : '') +
      '</section>';
  }

  function activityHTML(mk) {
    var id = 'act-' + mk;
    var open = openState.get(id) === true;
    var head = ['Description', 'Activity', 'Setting', 'Focus', 'Audience', 'Example'];
    var rows = ACTIVITY.map(function (r) {
      var mid = r.cols
        ? r.cols.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('')
        : '<td colspan="4" class="na">Not set yet</td>';
      return '<tr><td>' + esc(r.name) + '<span class="def">' + esc(r.def) + '</span></td>' + mid +
        '<td>' + (r.ex ? esc(r.ex) : '<span class="na">None listed</span>') + '</td></tr>';
    }).join('');
    return '<details class="sub" id="' + id + '"' + (open ? ' open' : '') + '><summary>' + CHEV + 'Activity types</summary>' +
      '<p class="table-note">These match the spreadsheet’s dropdown. Use them exactly: the description appears on the billing document clients receive.</p>' +
      '<div class="table-wrap" role="region" aria-label="Activity types" tabindex="0"><table><thead><tr>' +
      head.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows +
      '</tbody></table></div></details>';
  }

  function tripHTML(mk, t) {
    var tid = 't-' + mk + '-' + t.id;
    var name = t.label || '';
    return '<div class="trip" data-trip="' + t.id + '" data-month="' + mk + '">' +
      '<div class="trip-head">' +
      '<label class="sr-only" for="' + tid + '-name">Trip name</label>' +
      '<input type="text" class="trip-name" id="' + tid + '-name" data-trip-name value="' + esc(name) + '" placeholder="Where and when" autocomplete="off">' +
      '<span class="trip-count" data-tstatus="' + mk + '|' + t.id + '"></span>' +
      '<button type="button" class="btn-text" data-remove-trip aria-label="Remove ' + esc(name || 'this trip') + '">Remove</button>' +
      '</div><ul class="items">' +
      TRIP_STEPS.map(function (s) {
        var cid = tid + '-' + s.id;
        var on = !!(t.checks && t.checks[s.id]);
        return '<li class="item' + (on ? ' is-done' : '') + '"><div class="row">' +
          '<input type="checkbox" id="' + cid + '" data-trip-step="' + s.id + '"' + (on ? ' checked' : '') + '>' +
          '<label for="' + cid + '">' + '<span class="item-copy">'+s.text+'</span>' + '<span class="completion-stamp" data-trip-date="'+mk+'|'+t.id+'|'+s.id+'"></span></label></div></li>';
      }).join('') + '</ul></div>';
  }

  function tripsInner(mk) {
    var list = tripsOf(mk);
    var html = docChips(['where', 'pcard', 'handbook']);
    if (!list.length) html += '<p class="hint">Add each trip that needs a rental car or hotel to track its steps.</p>';
    html += list.map(function (t) { return tripHTML(mk, t); }).join('');
    html += '<button type="button" class="btn-ghost" data-add-trip="' + mk + '">' + PLUS + 'Add a trip</button>';
    return html;
  }

  function weekHTML(mon, isFinal) {
    var wk = weekKey(mon);
    var f = fiscalWeek(mon);
    var rel = relOf(mon);
    var id = 'wk-' + wk;
    var open = openState.has(id) ? openState.get(id) : rel === 'current';
    return '<details class="acc week' + (rel === 'current' ? ' is-current' : '') + '" id="' + id + '"' + (open ? ' open' : '') + '>' +
      '<summary>' + CHEV +
      '<span class="acc-title"><span class="acc-name">Week ' + f.week + '</span>' +
      '<span class="acc-dates">' + rangeShort(mon) + '</span>' +
      (rel === 'current' ? '<span class="pill pill-now">This week</span>' : '') +
      (isFinal ? '<span class="pill pill-soft">Month-end week</span>' : '') +
      '</span><span class="acc-status" data-wstatus="' + wk + '" data-rel="' + rel + '"></span></summary>' +
      '<div class="panel"><div class="groups">' +
      WEEKLY.map(function (g) { return groupHTML('w', wk, g, 'Week ' + f.week); }).join('') +
      '</div></div></details>';
  }

  function monthEndHTML(info) {
    var id = 'me-' + info.mk;
    var open = openState.has(id) ? openState.get(id) : info.phase === 'due';
    var monthName = fmtMonthName.format(new Date(view.y, view.m, 1));
    var opens = fmtMD.format(info.finalMon);
    var note = info.phase === 'early'
      ? '<p class="panel-note">Due in the final week of the month, the week of ' + opens + '. You can check things off early.</p>'
      : '';
    return '<details class="acc monthend phase-' + info.phase + '" id="' + id + '"' + (open ? ' open' : '') + '>' +
      '<summary>' + CHEV +
      '<span class="acc-title"><span class="acc-name">Month-end tasks</span><span class="acc-dates">' + monthName + '</span>' +
      (info.phase === 'due' ? '<span class="pill pill-due">Due this week</span>' : '') +
      '</span><span class="acc-status" data-mstatus="' + info.mk + '" data-phase="' + info.phase + '" data-opens="' + opens + '"></span></summary>' +
      '<div class="panel"><div class="panel-top">' + note + docChips(['eom']) + '</div><div class="groups one">' +
      MONTHLY.map(function (g) { return groupHTML('m', info.mk, g, 'Month-end'); }).join('') +
      '</div></div></details>';
  }

  function carryoverHTML(info, isCurrent) {
    if (!isCurrent || curMon.getTime() !== info.weeks[0].getTime()) return '';
    var pm = new Date(view.y, view.m - 1, 1);
    var py = pm.getFullYear(), pmn = pm.getMonth();
    var c = monthEndCounts(monthKey(py, pmn));
    if (c.done === c.total || !monthUsed(py, pmn)) return '';
    var name = fmtMonthName.format(pm);
    var left = c.total - c.done;
    return '<div class="callout" role="note"><p>' + name + '’s month-end list still has ' + left + ' open ' + (left === 1 ? 'item' : 'items') + '.</p>' +
      '<button type="button" class="btn" data-goto-monthend="' + py + '-' + pmn + '">Open ' + name + '</button></div>';
  }

  function renderMonth() {
    var info = monthInfo(view.y, view.m);
    var isCurrent = view.y === curMonth.y && view.m === curMonth.m;
    const occurrences=[];
    info.weeks.forEach(mon=>WEEKLY.forEach(g=>g.items.forEach(it=>occurrences.push({key:itemKey('w',weekKey(mon),g.id,it.id),title:it.html,period:weekKey(mon)}))));
    MONTHLY.forEach(g=>g.items.forEach(it=>occurrences.push({key:itemKey('m',info.mk,g.id,it.id),title:it.html,period:info.mk})));
    bridge.seed({weekly:WEEKLY,monthly:MONTHLY,tripSteps:TRIP_STEPS,referenceDocuments:DOCS},occurrences);
    $('#monthTitle').textContent = fmtMonth.format(new Date(view.y, view.m, 1));
    $('#prevBtn').setAttribute('aria-label', 'Previous month, ' + fmtMonth.format(new Date(view.y, view.m - 1, 1)));
    $('#nextBtn').setAttribute('aria-label', 'Next month, ' + fmtMonth.format(new Date(view.y, view.m + 1, 1)));
    $('#todayBtn').hidden = isCurrent;
    $('#board').innerHTML =
      carryoverHTML(info, isCurrent) +
      info.weeks.map(function (mon, i) { return weekHTML(mon, i === info.weeks.length - 1); }).join('') +
      monthEndHTML(info);
    updateCounts();
  }

  function updateCounts() {
    $$('[data-date-key],[data-trip-date]').forEach(el=>{
      const trip=el.dataset.tripDate, k=el.dataset.dateKey;
      const active=trip?Object.prototype.hasOwnProperty.call(state.tripDates,trip):state.checks[k];
      const stamp=trip?state.tripDates[trip]:state.dates[k];
      el.textContent=active?(stamp?'Completed '+new Date(stamp).toLocaleString():'Completed · original date not recorded'):'';
    });
    $$('[data-wstatus]').forEach(function (el) {
      el.innerHTML = progressHTML(weekDone(el.dataset.wstatus), WEEKLY_TOTAL, el.dataset.rel === 'past');
    });
    $$('[data-gstatus]').forEach(function (el) {
      var p = el.dataset.gstatus.split('|');
      var g = (p[0] === 'w' ? WEEKLY : MONTHLY).filter(function (x) { return x.id === p[2]; })[0];
      var done = 0;
      g.items.forEach(function (it) { if (isOn(itemKey(p[0], p[1], g.id, it.id))) done++; });
      var all = done === g.items.length;
      el.textContent = all ? 'Done' : done + ' of ' + g.items.length;
      el.classList.toggle('is-complete', all);
    });
    $$('[data-mstatus]').forEach(function (el) {
      var c = monthEndCounts(el.dataset.mstatus);
      var phase = el.dataset.phase;
      el.innerHTML = (phase === 'early' && c.done === 0)
        ? '<span class="status-text muted">Opens the week of ' + el.dataset.opens + '</span>'
        : progressHTML(c.done, c.total, phase === 'past');
    });
    $$('[data-tstatus]').forEach(function (el) {
      var p = el.dataset.tstatus.split('|');
      var t = findTrip(p[0], p[1]);
      var done = 0;
      TRIP_STEPS.forEach(function (s) { if (t && t.checks && t.checks[s.id]) done++; });
      var all = done === TRIP_STEPS.length;
      el.textContent = all ? 'Done' : done + ' of ' + TRIP_STEPS.length;
      el.classList.toggle('is-complete', all);
    });
  }

  function refreshTrips(mk) {
    var box = root.getElementById('trips-' + mk);
    if (box) box.innerHTML = tripsInner(mk);
    updateCounts();
  }

  function showStorageNote() { $('#storageNote').hidden = false; }

  function goMonth(y, m) {
    var d = new Date(y, m, 1);
    view = { y: d.getFullYear(), m: d.getMonth() };
    renderMonth();
  }

  function reveal(id) {
    var el = root.getElementById(id);
    if (!el) return;
    el.open = true;
    openState.set(id, true);
    el.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    var s = el.querySelector('summary');
    if (s) s.focus({ preventScroll: true });
  }

  /* ---------- Backup: save and import ---------- */
  var statusEl = $('#backupStatus');
  function setStatus(msg) { statusEl.textContent = msg; }
  function showLastBackup() {
    if (!state.lastBackup) { setStatus(''); return; }
    var d = new Date(state.lastBackup);
    setStatus(isNaN(d) ? '' : 'Last backup ' + fmtFull.format(d));
  }
  var downloadsP = (window.claude && typeof window.claude.use === 'function')
    ? Promise.resolve(window.claude.use('downloads')).catch(function () { return null; })
    : Promise.resolve(null);

  function backupData(){return JSON.stringify({...bridge.payload(),exportedAt:new Date().toISOString()},null,2);}
  function backupFilename() {
    var d = new Date();
    var who = lastName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return 'ai-strategist-checklist-backup' + (who ? '-' + who : '') + '-' +
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
  }
  function markBackedUp() { state.lastBackup = new Date().toISOString(); }
  function showBackupPanel() {
    var panel = $('#backupPanel');
    $('#backupText').value = backupData();
    panel.hidden = false;
    $('#selectBackupBtn').focus();
    markBackedUp();
    setStatus('Backup ready to copy below.');
  }
  // Outside claude.ai (for example, a copy hosted from a repo), a normal browser download works.
  function blobDownload() {
    try {
      var blob = new Blob([backupData()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = backupFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      markBackedUp();
      setStatus('Backup saved ' + fmtFull.format(new Date()) + '.');
      return true;
    } catch (e) { return false; }
  }
  function saveBackup() {
    setStatus('Preparing backup…');
    downloadsP.then(function (dl) {
      if (!dl) { if (!window.claude && blobDownload()) return; showBackupPanel(); return; }
      return dl.save({ filename: backupFilename(), data: backupData() }).then(function () {
        markBackedUp();
        setStatus('Backup saved ' + fmtFull.format(new Date()) + '.');
      }, function (err) {
        var code = err && err.code;
        if (code === 'declined') setStatus('Backup not saved.');
        else if (code === 'rate_limited') setStatus('A save prompt is already open. Try again in a moment.');
        else showBackupPanel();
      });
    });
  }

  var KEY_RE = /^(w\|\d{4}-W\d{2}|m\|\d{4}-\d{2})\|[a-z]+\.[a-z]+$/;
  function mergeBackup(data) {
    if (!data || typeof data !== 'object' || data.app !== APP_ID || !data.checks || typeof data.checks !== 'object') return null;
    var added = 0, tripsAdded = 0;
    Object.keys(data.checks).forEach(function (k) {
      if (data.checks[k] === true && KEY_RE.test(k) && !state.checks[k]) { state.checks[k] = true; added++; }
    });
    if (data.trips && typeof data.trips === 'object') {
      Object.keys(data.trips).forEach(function (mk) {
        if (!/^\d{4}-\d{2}$/.test(mk) || !Array.isArray(data.trips[mk])) return;
        if (!Array.isArray(state.trips[mk])) state.trips[mk] = [];
        var list = state.trips[mk];
        data.trips[mk].forEach(function (t) {
          if (!t || typeof t.id !== 'string' || !/^[a-z0-9]{1,24}$/.test(t.id)) return;
          var label = typeof t.label === 'string' ? t.label.slice(0, 120) : '';
          var checks = {};
          if (t.checks && typeof t.checks === 'object') {
            TRIP_STEPS.forEach(function (s) { if (t.checks[s.id] === true) checks[s.id] = true; });
          }
          var mine = list.filter(function (x) { return x.id === t.id; })[0];
          if (!mine) { list.push({ id: t.id, label: label, checks: checks }); tripsAdded++; return; }
          if (!mine.label) mine.label = label;
          mine.checks = mine.checks || {};
          Object.keys(checks).forEach(function (s) { if (!mine.checks[s]) { mine.checks[s] = true; added++; } });
        });
      });
    }
    if (!state.name && typeof data.name === 'string') state.name = data.name.slice(0, 80);
    return { checks: added, trips: tripsAdded };
  }

  function importBackup(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setStatus('That file is too large to be a checklist backup.'); return; }
    file.text().then(function (txt) {
      var data;
      try { data = JSON.parse(txt); } catch (e) { setStatus('That file isn’t a checklist backup: it couldn’t be read as JSON.'); return; }
      if(data.app===core.APP){
        try{bridge.mergeImport(core.readPayload(data));state=load();baseline=JSON.parse(JSON.stringify(state));nameInput.value=state.name;renderMonth();setStatus('Timestamped backup merged. Newer records kept.');}catch(e){setStatus(e.message);}return;
      }
      var res = mergeBackup(data);
      if (!res) { setStatus('That file isn’t a backup from this checklist.'); return; }
      save(true);
      nameInput.value = state.name;
      renderMonth();
      setStatus('Backup imported: ' + res.checks + ' ' + (res.checks === 1 ? 'check' : 'checks') + ' and ' +
        res.trips + ' ' + (res.trips === 1 ? 'trip' : 'trips') + ' added. Nothing already checked was removed.');
    }, function () { setStatus('That file couldn’t be opened.'); });
  }

  $('#saveBackupBtn').addEventListener('click', saveBackup);
  $('#importBackupBtn').addEventListener('click', function () { var f = $('#importFile'); f.value = ''; f.click(); });
  $('#importFile').addEventListener('change', function (e) { importBackup(e.target.files && e.target.files[0]); });
  $('#selectBackupBtn').addEventListener('click', function () { var t = $('#backupText'); t.focus(); t.select(); });
  $('#closeBackupBtn').addEventListener('click', function () { $('#backupPanel').hidden = true; $('#saveBackupBtn').focus(); });

  /* ---------- Events ---------- */
  var nameInput = {value:state.name};

  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('input[data-key]')) {
      if (t.checked) state.checks[t.dataset.key] = true; else delete state.checks[t.dataset.key];
      t.closest('.item').classList.toggle('is-done', t.checked);
      save(); updateCounts();
    } else if (t.matches('input[data-trip-step]')) {
      var box = t.closest('.trip');
      var trip = findTrip(box.dataset.month, box.dataset.trip);
      if (!trip) return;
      trip.checks = trip.checks || {};
      if (t.checked) trip.checks[t.dataset.tripStep] = true; else delete trip.checks[t.dataset.tripStep];
      t.closest('.item').classList.toggle('is-done', t.checked);
      save(); updateCounts();
    }
  });

  root.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.matches('input[data-trip-name]')) return;
    var box = t.closest('.trip');
    var trip = findTrip(box.dataset.month, box.dataset.trip);
    if (!trip) return;
    trip.label = t.value.slice(0,120);
    var rm = box.querySelector('[data-remove-trip]');
    if (rm) rm.setAttribute('aria-label', 'Remove ' + (t.value || 'this trip'));
    save();
  });

  root.addEventListener('toggle', function (e) {
    var t = e.target;
    if (t && t.tagName === 'DETAILS' && t.id) openState.set(t.id, t.open);
  }, true);

  root.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    if (btn.id === 'prevBtn') { goMonth(view.y, view.m - 1); return; }
    if (btn.id === 'nextBtn') { goMonth(view.y, view.m + 1); return; }
    if (btn.id === 'todayBtn') {
      goMonth(curMonth.y, curMonth.m);
      reveal('wk-' + weekKey(curMon));
      return;
    }
    if (btn.dataset.gotoMonthend) {
      var p = btn.dataset.gotoMonthend.split('-');
      var y = +p[0], m = +p[1];
      openState.set('me-' + monthKey(y, m), true);
      goMonth(y, m);
      reveal('me-' + monthKey(y, m));
      return;
    }
    if (btn.dataset.addTrip) {
      var mk = btn.dataset.addTrip;
      if (!Array.isArray(state.trips[mk])) state.trips[mk] = [];
      var t = { id: newId(), label: '', checks: {} };
      state.trips[mk].push(t);
      save(); refreshTrips(mk);
      var inp = root.getElementById('t-' + mk + '-' + t.id + '-name');
      if (inp) inp.focus();
      return;
    }
    if (btn.hasAttribute('data-remove-trip')) {
      var box = btn.closest('.trip');
      var mk2 = box.dataset.month, id = box.dataset.trip;
      var trip = findTrip(mk2, id);
      var hasData = trip && (trip.label || Object.keys(trip.checks || {}).some(function (k) { return trip.checks[k]; }));
      if (hasData && btn.dataset.armed !== '1') {
        btn.dataset.armed = '1';
        btn.textContent = 'Confirm remove';
        setTimeout(function () { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Remove'; } }, 4000);
        return;
      }
      state.trips[mk2] = tripsOf(mk2).filter(function (x) { return x.id !== id; });
      save(); refreshTrips(mk2);
      var add = root.querySelector('[data-add-trip="' + mk2 + '"]');
      if (add) add.focus();
      return;
    }
  });

  var pendingRefresh=false;
  function applyRemote(){
    $('#adminSyncStatus').textContent=bridge.status();
    $('#storageNote').hidden=bridge.storageOK();
    if(root.activeElement && root.activeElement.matches('input:not([type="checkbox"]),textarea')){pendingRefresh=true;return;}
    var fresh=load();
    if(core.stable(fresh)===core.stable(baseline)&&!pendingRefresh)return;
    state=fresh;baseline=JSON.parse(JSON.stringify(state));
    nameInput.value=state.name;renderMonth();pendingRefresh=false;
  }
  bridge.subscribe(()=>queueMicrotask(applyRemote));
  root.addEventListener('focusout',()=>{if(pendingRefresh)setTimeout(applyRemote,0);});
  $('#adminSync').onclick=()=>bridge.sync();
  try{
    const old=JSON.parse(localStorage.getItem(KEY)||'null');
    if(old&&(Object.keys(old.checks||{}).length||Object.keys(old.trips||{}).length)){
      const button=$('#adminLegacy');button.hidden=false;
      button.onclick=()=>{
        const res=mergeBackup({...old,app:APP_ID});
        if(res){save(true);renderMonth();nameInput.value=state.name;setStatus('Original checks copied. Historical completion dates were not recorded in the original.');button.hidden=true;}
      };
    }
  }catch(e){}

  // Roll over to the new week if the page stays open past Sunday.
  function checkRollover() {
    var m = mondayOf(new Date());
    if (m.getTime() === curMon.getTime()) return;
    var wasCurrent = view.y === curMonth.y && view.m === curMonth.m;
    curMon = m;
    curMonth = monthOfWeek(curMon);
    if (wasCurrent) view = { y: curMonth.y, m: curMonth.m };
    renderNow(); renderMonth();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkRollover(); });
  window.addEventListener('focus', checkRollover);

  /* ---------- Start ---------- */
  if (!storageOK) showStorageNote();
  renderNow();
  renderDocList();
  showLastBackup();
  renderMonth();
  $('#adminSyncStatus').textContent=bridge.status();
  bridge.sync();
};
