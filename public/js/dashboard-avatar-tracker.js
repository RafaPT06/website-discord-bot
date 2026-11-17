const guildId = location.pathname.match(/\/dashboard\/avatar-tracker\/(\d{15,25})\/?$/)?.[1];
const root = document.getElementById('list');
const message = document.getElementById('message');
const channels = document.getElementById('channel');
const base = '/api/dashboard/servers/' + encodeURIComponent(guildId || '') + '/avatar-trackers';
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let channelList = [];
async function api(url,options={}) {
  const response = await fetch(url,{...options,headers:{'content-type':'application/json'},credentials:'same-origin'});
  const body = await response.json().catch(()=>({}));
  if(!response.ok) throw Error(body.error || 'Request failed (' + response.status + ')');
  return body;
}
function channelOptions(value) {
  return '<option value="">Choose channel</option>' + channelList.map(c=>'<option value="'+esc(c.id)+'" '+(String(c.id)===String(value)?'selected':'')+'># '+esc(c.name)+'</option>').join('');
}
async function load() {
  try {
    const [data,server] = await Promise.all([api(base),api('/api/dashboard/servers/'+guildId)]);
    channelList = (server?.server?.channels || []).filter(c=>c.type===0 || c.typeName==='text' || c.type==='text');
    channels.innerHTML = channelOptions('');
    const users = data.trackers || [];
    root.innerHTML = users.length ? users.map(t=>'<div class="entry" data-id="'+esc(t.userId)+'"><strong>'+esc(t.username)+'</strong><small>'+esc(t.userId)+'</small><select aria-label="Notification channel">'+channelOptions(t.channelId)+'</select><label><input type="checkbox" '+(t.enabled?'checked':'')+'> Enabled</label><button data-action="save">Save</button><button data-action="delete">Remove</button></div>').join('') : '<p>No Roblox users tracked yet.</p>';
  } catch(err) { message.textContent = err.message; root.textContent = 'Could not load trackers.'; }
}
document.getElementById('add').addEventListener('submit',async event=>{
  event.preventDefault();message.textContent='Saving…';
  try { await api(base,{method:'POST',body:JSON.stringify({user:document.getElementById('user').value,channelId:channels.value})});document.getElementById('user').value='';message.textContent='Tracker added.';await load(); }
  catch(err){message.textContent=err.message;}
});
root.addEventListener('click',async event=>{
  const action=event.target.dataset.action;if(!action)return;
  const entry=event.target.closest('[data-id]');const userId=entry?.dataset.id;
  if(!userId)return;
  if(action==='delete' && !confirm('Remove this Roblox user from tracking?'))return;
  message.textContent='Saving…';
  try {
    await api(base+'/'+encodeURIComponent(userId),action==='delete'?{method:'DELETE'}:{method:'PATCH',body:JSON.stringify({channelId:entry.querySelector('select').value,enabled:entry.querySelector('input[type=checkbox]').checked})});
    message.textContent=action==='delete'?'Tracker removed.':'Tracker saved.';await load();
  } catch(err){message.textContent=err.message;}
});
if(guildId){document.getElementById('back').href='/dashboard/server/'+guildId;load();}
else {message.textContent='Invalid Discord server ID.';}
