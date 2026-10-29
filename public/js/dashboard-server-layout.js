const SECTION = 'server-layout';
const cache = new Map();
let renderToken = 0;

function isDemo() { return location.pathname.startsWith('/demo'); }
function guildId() { const m = location.pathname.match(/\/(?:dashboard\/server|demo\/server)\/([^/]+)/); return m ? decodeURIComponent(m[1]) : null; }
function active() { return location.hash.toLowerCase() === '#server-layout'; }
function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function href() { return `${location.pathname}#${SECTION}`; }
function fmtDate(v) { if (!v) return 'Unknown'; const d = new Date(v); return Number.isNaN(d.getTime()) ? 'Unknown' : new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(d); }

function demoData() {
  return {
    layout: { guild: { name:'Meowz Community' }, roles:[{id:'r1',name:'Admin',position:4,color:0x8b5cf6},{id:'r2',name:'Moderator',position:3,color:0x22d3ee},{id:'r3',name:'Members',position:1,color:0}], channels:[
      {id:'c1',name:'INFORMATION',type:'category',position:0},{id:'c2',name:'welcome',type:'text',parentId:'c1',position:0},{id:'c3',name:'rules',type:'text',parentId:'c1',position:1},
      {id:'c4',name:'COMMUNITY',type:'category',position:1},{id:'c5',name:'general',type:'text',parentId:'c4',position:0},{id:'c6',name:'General',type:'voice',parentId:'c4',position:1},{id:'c7',name:'suggestions',type:'forum',parentId:'c4',position:2}
    ] },
    snapshots:[{id:'demo-snapshot-1',name:'Before channel cleanup',reason:'Safe demo snapshot',createdAt:new Date(Date.now()-86400000).toISOString(),source:'dashboard'}]
  };
}

async function json(url, options={}) {
  const response = await fetch(url,{cache:'no-store',headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const data = await response.json().catch(()=>null);
  if (!response.ok) throw new Error(data?.error || `Request failed with ${response.status}`);
  return data;
}

async function load(id, force=false) {
  if (!force && cache.has(id)) return cache.get(id);
  if (isDemo()) { const data=demoData(); cache.set(id,data); return data; }
  const [layoutResult,snapshotResult] = await Promise.all([
    json(`/api/dashboard/servers/${encodeURIComponent(id)}/layout`),
    json(`/api/dashboard/servers/${encodeURIComponent(id)}/layout/snapshots`),
  ]);
  const data={layout:layoutResult.layout || layoutResult.serverLayout || layoutResult,snapshots:snapshotResult.snapshots || []};
  cache.set(id,data); return data;
}

function typeName(ch={}) {
  const raw=String(ch.typeName ?? ch.type ?? '').toLowerCase();
  if (raw.includes('category') || raw==='4') return 'category';
  if (raw.includes('voice') || raw==='2' || raw==='13') return 'voice';
  if (raw.includes('forum') || raw==='15') return 'forum';
  if (raw.includes('announcement') || raw==='5') return 'announcement';
  return 'text';
}
function icon(type){ return type==='voice'?'◖':type==='forum'?'▤':type==='announcement'?'◉':'#'; }
function normalizeLayout(input={}) { return { guild:input.guild || {}, roles:Array.isArray(input.roles)?input.roles:[], channels:Array.isArray(input.channels)?input.channels:[] }; }

function channelTree(layout) {
  const channels=layout.channels;
  const cats=channels.filter(c=>typeName(c)==='category').sort((a,b)=>(a.position??0)-(b.position??0));
  const uncategorized=channels.filter(c=>typeName(c)!=='category' && !c.parentId && !c.parent_id);
  const group=(title,items,id='')=>`<section class="layout-category"><div class="layout-category-head"><strong>${esc(title)}</strong><span>${items.length}</span></div><div class="layout-channel-list">${items.length?items.sort((a,b)=>(a.position??0)-(b.position??0)).map(channelRow).join(''):'<div class="layout-empty-row">No channels</div>'}</div></section>`;
  return `${uncategorized.length?group('UNCATEGORIZED',uncategorized):''}${cats.map(cat=>{const id=String(cat.id);const kids=channels.filter(c=>String(c.parentId??c.parent_id??'')===id);return group(cat.name||'CATEGORY',kids,id);}).join('')}` || '<div class="layout-empty">No channels were returned.</div>';
}
function channelRow(ch){ const type=typeName(ch); const overwriteCount=Array.isArray(ch.permissionOverwrites)?ch.permissionOverwrites.length:Array.isArray(ch.permission_overwrites)?ch.permission_overwrites.length:0; return `<div class="layout-channel"><span class="layout-channel-icon">${icon(type)}</span><div><strong>${esc(ch.name||'channel')}</strong><small>${esc(type)}${overwriteCount?` · ${overwriteCount} override${overwriteCount===1?'':'s'}`:''}</small></div><em>${Number(ch.position??0)+1}</em></div>`; }
function roleList(roles){ const sorted=[...roles].sort((a,b)=>(b.position??0)-(a.position??0)); return sorted.length?sorted.map(r=>{const color=Number(r.color||0);const dot=color?`#${color.toString(16).padStart(6,'0')}`:'currentColor';return `<div class="layout-role"><span style="--role-color:${esc(dot)}"></span><div><strong>@${esc(r.name||'role')}</strong><small>Position ${esc(r.position??0)}${r.managed?' · Managed':''}</small></div></div>`;}).join(''):'<div class="layout-empty">No roles were returned.</div>'; }

function snapshotList(items){ return items.length?items.map(s=>`<button class="layout-snapshot" type="button" data-layout-snapshot="${esc(s.id)}"><span><strong>${esc(s.name||'Snapshot')}</strong><small>${esc(fmtDate(s.createdAt||s.created_at))}${s.reason?` · ${esc(s.reason)}`:''}</small></span><em>Compare</em></button>`).join(''):'<div class="layout-empty"><strong>No snapshots yet</strong><span>Create one before making major server changes.</span></div>'; }

function page(id,data){ const layout=normalizeLayout(data.layout); const categories=layout.channels.filter(c=>typeName(c)==='category').length; const actualChannels=layout.channels.length-categories; return `<section class="server-layout-page" data-server-layout-page data-guild-id="${esc(id)}">
  ${isDemo()?'<div class="dash-note demo-note"><strong>Demo Mode</strong><span>Server Layout uses fake structure and snapshots here. Creating snapshots is disabled.</span></div>':''}
  <div class="layout-hero"><div><span>Server Structure</span><h2>Server Layout</h2><p>Inspect the live Discord structure and capture safe restore points before major changes.</p></div><button type="button" class="dash-save-btn" data-create-layout-snapshot ${isDemo()?'disabled':''}>Create Snapshot</button></div>
  <div class="layout-stats"><article><span>Categories</span><strong>${categories}</strong></article><article><span>Channels</span><strong>${actualChannels}</strong></article><article><span>Roles</span><strong>${layout.roles.length}</strong></article><article><span>Snapshots</span><strong>${data.snapshots.length}</strong></article></div>
  <div class="layout-main-grid"><article class="dash-card layout-structure-card"><div class="dash-card-head"><div><span>Live Discord</span><h2>Channel structure</h2><p>Categories and channels are shown in their current Discord order.</p></div><b class="status enabled">Live</b></div><div class="layout-tree">${channelTree(layout)}</div></article>
  <aside class="layout-side"><article class="dash-card"><div class="dash-card-head"><div><span>Hierarchy</span><h2>Roles</h2><p>Highest roles are shown first.</p></div><b>${layout.roles.length}</b></div><div class="layout-role-list">${roleList(layout.roles)}</div></article>
  <article class="dash-card"><div class="dash-card-head"><div><span>Restore points</span><h2>Snapshots</h2><p>Compare a saved structure with the server as it exists now.</p></div><button type="button" class="layout-refresh" data-refresh-layout aria-label="Refresh layout">↻</button></div><div class="layout-snapshot-list">${snapshotList(data.snapshots)}</div></article></aside></div>
  <div class="layout-diff-host" data-layout-diff-host hidden></div>
</section>`; }

function diffCount(diff){ const summary=diff?.summary||{}; if (Number.isFinite(summary.total)) return summary.total; const arrays=['added','removed','changed','moved']; return arrays.reduce((n,k)=>n+(Array.isArray(diff?.[k])?diff[k].length:0),0); }
function renderDiff(diff,snapshot){ const summary=diff?.summary||{}; const sections=diff?.changes||diff; const rows=[]; const add=(label,val,kind)=>{if(Array.isArray(val)) val.forEach(x=>rows.push(`<div class="layout-diff-row ${kind}"><b>${esc(label)}</b><span>${esc(x.name||x.label||x.id||'Item')}</span><em>${esc(kind)}</em></div>`));}; add('Channel',sections.addedChannels||sections.channels?.added||sections.added,'added'); add('Channel',sections.removedChannels||sections.channels?.removed||sections.removed,'removed'); add('Changed',sections.changedChannels||sections.channels?.changed||sections.changed,'changed'); add('Role',sections.addedRoles||sections.roles?.added,'added'); add('Role',sections.removedRoles||sections.roles?.removed,'removed'); add('Role',sections.changedRoles||sections.roles?.changed,'changed'); const total=summary.total ?? rows.length ?? diffCount(diff); return `<article class="dash-card layout-diff-card"><div class="dash-card-head"><div><span>Snapshot comparison</span><h2>${esc(snapshot?.name||'Saved snapshot')}</h2><p>${total?`${esc(total)} structural change${Number(total)===1?'':'s'} detected.`:'No structural changes detected.'}</p></div><button type="button" class="dash-secondary-btn" data-close-layout-diff>Close</button></div><div class="layout-diff-summary"><span class="added">+ ${esc(summary.added??'—')} added</span><span class="removed">− ${esc(summary.removed??'—')} removed</span><span class="changed">~ ${esc(summary.changed??'—')} changed</span></div><div class="layout-diff-list">${rows.length?rows.join(''):'<div class="layout-empty"><strong>Structure matches this snapshot</strong><span>No channel or role differences were returned.</span></div>'}</div><div class="dash-note"><strong>Preview only</strong><span>Meowz cannot restore or replace server structure from this page yet.</span></div></article>`; }

function ensureNav(){ const linkHref=href(); document.querySelectorAll('.dash-tabs').forEach(nav=>{if(!nav.querySelector('[data-server-layout-tab]')){const a=document.createElement('a');a.href=linkHref;a.dataset.serverLayoutTab='true';a.textContent='Server Layout';nav.append(a);}}); document.querySelectorAll('.dash-side-nav').forEach(nav=>{if(nav.querySelector('small')?.textContent?.trim()!=='Dashboard'||nav.querySelector('[data-server-layout-tab]'))return;const a=document.createElement('a');a.href=linkHref;a.dataset.serverLayoutTab='true';a.innerHTML='<span></span>Server Layout';nav.append(a);}); document.querySelectorAll('.dash-mobile-drawer .dash-drawer-group').forEach(group=>{if(group.querySelector('small')?.textContent?.trim()!=='Dashboard'||group.querySelector('[data-server-layout-tab]'))return;const a=document.createElement('a');a.href=linkHref;a.dataset.serverLayoutTab='true';a.textContent='Server Layout';group.append(a);}); document.querySelectorAll('[data-server-layout-tab]').forEach(a=>a.classList.toggle('is-active',active())); }

async function render(force=false){ if(!active())return; const id=guildId(); const host=document.querySelector('[data-server-tab-content]'); if(!id||!host)return; const token=++renderToken; host.dataset.activeSection=SECTION; host.innerHTML='<div class="layout-loading"><strong>Loading server structure…</strong><span>Reading channels, roles and snapshots.</span></div>'; try{const data=await load(id,force);if(token!==renderToken||!active())return;host.innerHTML=page(id,data);bind(id,data);}catch(err){if(token!==renderToken)return;host.innerHTML=`<div class="dash-card layout-error"><span>Server Layout</span><h2>Could not load server structure</h2><p>${esc(err.message||'Try again later.')}</p><button class="dash-secondary-btn" data-refresh-layout>Try Again</button></div>`;bind(id,null);} }

function bind(id,data){ const root=document.querySelector('[data-server-layout-page]')||document.querySelector('[data-server-tab-content]'); root?.querySelector('[data-refresh-layout]')?.addEventListener('click',()=>{cache.delete(id);render(true);}); root?.querySelector('[data-create-layout-snapshot]')?.addEventListener('click',async e=>{if(isDemo())return;const name=prompt('Snapshot name','Manual snapshot');if(name===null)return;const reason=prompt('Reason (optional)','Before server changes');e.currentTarget.disabled=true;e.currentTarget.textContent='Creating…';try{await json(`/api/dashboard/servers/${encodeURIComponent(id)}/layout/snapshots`,{method:'POST',body:JSON.stringify({name,reason})});cache.delete(id);await render(true);}catch(err){alert(`Could not create snapshot: ${err.message}`);}finally{if(e.currentTarget.isConnected){e.currentTarget.disabled=false;e.currentTarget.textContent='Create Snapshot';}}}); root?.querySelectorAll('[data-layout-snapshot]').forEach(btn=>btn.addEventListener('click',async()=>{const sid=btn.dataset.layoutSnapshot;const snap=data?.snapshots?.find(s=>String(s.id)===String(sid));const diffHost=root.querySelector('[data-layout-diff-host]');if(!diffHost)return;btn.disabled=true;btn.querySelector('em').textContent='Loading…';try{const diff=isDemo()?{summary:{total:2,added:1,removed:0,changed:1},changes:{addedChannels:[{name:'media'}],changedChannels:[{name:'general'}]}}:await json(`/api/dashboard/servers/${encodeURIComponent(id)}/layout/snapshots/${encodeURIComponent(sid)}/diff`);diffHost.hidden=false;diffHost.innerHTML=renderDiff(diff.diff||diff,snap);diffHost.scrollIntoView({behavior:'smooth',block:'start'});diffHost.querySelector('[data-close-layout-diff]')?.addEventListener('click',()=>{diffHost.hidden=true;diffHost.innerHTML='';});}catch(err){alert(`Could not compare snapshot: ${err.message}`);}finally{btn.disabled=false;btn.querySelector('em').textContent='Compare';}})); }

function intercept(event){ const a=event.target.closest('[data-server-layout-tab]'); if(!a)return; const u=new URL(a.href,location.origin); if(u.pathname!==location.pathname)return; event.preventDefault(); if(location.hash!=='#server-layout')history.pushState(null,'','#server-layout'); ensureNav(); render(); }

const observer=new MutationObserver(()=>{ensureNav();if(active())render();});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',intercept,true);
window.addEventListener('hashchange',()=>{ensureNav();if(active())render();});
window.addEventListener('popstate',()=>{ensureNav();if(active())render();});
ensureNav(); if(active())setTimeout(()=>render(),0);
