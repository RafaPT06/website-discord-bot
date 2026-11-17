function updateLink() {
 const match=location.pathname.match(/\/dashboard\/server\/(\d{15,25})/);
 const container=document.querySelector('[data-server-detail-content]');
 if(!match || !container)return;
 let link=document.getElementById('meowz-avatar-tracker-link');
 if(!link){link=document.createElement('a');link.id='meowz-avatar-tracker-link';link.className='btn btn-secondary';link.textContent='Roblox Avatar Tracker';link.style.cssText='display:inline-flex;margin:12px 0';container.prepend(link);}
 link.href='/dashboard/avatar-tracker/'+match[1];
}
new MutationObserver(updateLink).observe(document.body,{childList:true,subtree:true});
addEventListener('popstate',updateLink);updateLink();
