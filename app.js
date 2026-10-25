"use strict";
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ready = SUPABASE_URL.startsWith('https://') && !SUPABASE_PUBLISHABLE_KEY.startsWith('PASTE_');
let db = null;
let currentUser = null;
let tasks = [];
let currentView = 'Home';
let signingUp = false;
let authMode = 'signin';
let notesSaveTimer = null;
let notesLoadCounter = 0;
let notesLoaded = false;
let busy = false;
let loadCounter = 0;
const habits = [{name:'Drink enough water',days:[0,0,0,0,0,0,0]}, {name:'Read a book',days:[0,0,0,0,0,0,0]}, {name:'Exercise',days:[0,0,0,0,0,0,0]}, {name:'Get 7+ hours sleep',days:[0,0,0,0,0,0,0]}];
const storageGet = k => { try {return localStorage.getItem(k)} catch {return null} };
const storageSet = (k,v) => { try {localStorage.setItem(k,v)} catch {} };
const notify = (message, good=false) => { $('authMessage').textContent=message; $('authMessage').classList.toggle('success', good); };
const errorText = err => err?.message || 'Something went wrong. Please try again.';
function setBusy(value) { busy=value; $('authSubmit').disabled=value; $('openAdd').disabled=value; }
function resetForm() { $('taskForm').reset(); delete $('taskForm').dataset.editId; $('taskForm').querySelector('h2').textContent='＋ Add New Task'; $('taskForm').querySelector('[type="submit"]').textContent='Save Task'; }
function openModal() { resetForm(); $('modal').classList.add('open'); $('taskName').focus(); }
function closeModal() { $('modal').classList.remove('open'); resetForm(); }
function dateText(s) {return s ? new Date(s+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : 'No date';}
function isOwnTask(id) {return tasks.find(t=>t.id===id);}
function mapTask(row) {return {id:row.id,name:row.name,cat:row.category,date:row.due_date||'',priority:row.priority,status:row.status};}
async function loadTasks() {
 if(!currentUser)return;
 const uid=currentUser.id; const serial=++loadCounter;
 $('statusNote').textContent='Loading your tasks…';
 const {data,error}=await db.from('planner_tasks').select('id,user_id,name,category,due_date,priority,status').eq('user_id',uid).order('created_at',{ascending:false});
 if(serial!==loadCounter || !currentUser || currentUser.id!==uid)return;
 if(error){$('statusNote').textContent='Could not load tasks: '+errorText(error);return;}
 tasks=data.map(mapTask);$('statusNote').textContent='';render();
}
function render() {
 const q=$('search').value.trim().toLowerCase();
 let visible=tasks.filter(t=>t.name.toLowerCase().includes(q)||t.cat.toLowerCase().includes(q));
 visible=visible.filter(t => currentView==='Archive' ? t.status==='Completed' : t.status!=='Completed');
 const done=tasks.filter(t=>t.status==='Completed').length,progress=tasks.filter(t=>t.status==='In Progress').length,pending=tasks.filter(t=>t.status==='Pending').length;
 $('total').textContent=tasks.length;$('completed').textContent=done;$('inprogress').textContent=progress;$('pending').textContent=pending;
 $('percent').textContent=(tasks.length?Math.round(done/tasks.length*100):0)+'%';
 $('donut').style.setProperty('--pct',(tasks.length?done/tasks.length*100:0)+'%');
 $('legDone').textContent=done;$('legProgress').textContent=progress;$('legPending').textContent=pending;$('legTotal').textContent=tasks.length;
 $('taskSectionTitle').textContent=currentView==='Archive'?'▣ Completed Archive':'🗓 Active Tasks';
 $('taskList').innerHTML=visible.length?visible.map(t=>`<div class="taskrow ${t.status==='Completed'?'done':''}">
  ${currentView==='Archive'?'<span class="archive-check" aria-hidden="true">✓</span>':`<input type="checkbox" aria-label="Mark completed" onchange="toggleTask('${t.id}',this.checked)">`}
  <div><div class="taskname">${esc(t.name)}</div><div class="muted">${t.priority==='High'?'🔴 ':t.priority==='Low'?'🟢 ':'🟡 '}${esc(t.priority)} priority · ${esc(t.status)}</div></div>
  <span class="pill ${esc(t.cat)}">${esc(t.cat)}</span>
  <span class="task-actions">${currentView==='Archive'
    ? `<button class="restore-btn" type="button" aria-label="Restore task" title="Restore to Tasks" onclick="restoreTask('${t.id}')">↶</button>`
    : `<button class="delete" type="button" aria-label="Edit task" title="Edit" onclick="editTask('${t.id}')">✎</button>`}
    <button class="delete" type="button" aria-label="Delete task" title="Delete" onclick="deleteTask('${t.id}')">×</button></span></div>`).join(''):(currentView==='Archive'?'<div class="empty">Your archive is empty ☁️<br>Completed tasks will appear here.</div>':'<div class="empty">No active tasks ☁️<br>Add a task to get started!</div>');
 const upcoming=tasks.filter(t=>t.date&&t.status!=='Completed').sort((a,b)=>a.date.localeCompare(b.date));
 $('deadlines').innerHTML=upcoming.length?upcoming.slice(0,5).map(t=>`<div class="deadline"><span>${esc(t.name)}<br><small class="muted">${esc(t.cat)}</small></span><span class="due">${dateText(t.date)}</span></div>`).join(''):'<div class="empty">No deadlines yet.</div>';
 $('habits').innerHTML=habits.map((h,i)=>`<div class="habit"><span>${esc(h.name)}</span><div class="week">${h.days.map((v,j)=>`<button class="day ${v?'on':''}" type="button" onclick="toggleHabit(${i},${j})">${'MTWTFSS'[j]}</button>`).join('')}</div></div>`).join('');
}
window.editTask=id=>{const t=isOwnTask(id);if(!t)return; resetForm(); $('taskName').value=t.name;$('taskCat').value=t.cat;$('taskDate').value=t.date;$('taskPriority').value=t.priority;$('taskStatus').value=t.status;$('taskForm').dataset.editId=id;$('taskForm').querySelector('h2').textContent='✎ Edit Task';$('taskForm').querySelector('[type="submit"]').textContent='Save Changes';$('modal').classList.add('open');$('taskName').focus();};
window.toggleTask=async(id,checked)=>{const t=isOwnTask(id);if(!t||busy)return;setBusy(true);const {error}=await db.from('planner_tasks').update({status:checked?'Completed':'Pending'}).eq('id',id).eq('user_id',currentUser.id);setBusy(false);if(error){alert(errorText(error));render();return;}await loadTasks();};
window.restoreTask=async id=>{const t=isOwnTask(id);if(!t||t.status!=='Completed'||busy||!currentUser)return;setBusy(true);const {error}=await db.from('planner_tasks').update({status:'Pending'}).eq('id',id).eq('user_id',currentUser.id);setBusy(false);if(error){alert('Could not restore task: '+errorText(error));return;}await loadTasks();};
window.deleteTask=async id=>{if(!isOwnTask(id)||busy||!confirm('Delete this task?'))return;setBusy(true);const {error}=await db.from('planner_tasks').delete().eq('id',id).eq('user_id',currentUser.id);setBusy(false);if(error){alert(errorText(error));return;}await loadTasks();};
window.toggleHabit=(i,j)=>{habits[i].days[j]=habits[i].days[j]?0:1;storageSet('planner_habits_'+currentUser.id,JSON.stringify(habits));render();};
$('openAdd').onclick=openModal; $('cancel').onclick=closeModal; $('modal').onclick=e=>{if(e.target===$('modal'))closeModal();};
$('taskForm').onsubmit=async e=>{
 e.preventDefault();if(busy||!currentUser)return;
 const editId=$('taskForm').dataset.editId;
 const name=$('taskName').value.trim();if(!name)return;
 const data={name,category:$('taskCat').value,due_date:$('taskDate').value||null,priority:$('taskPriority').value,status:$('taskStatus').value};
 setBusy(true);
 const request=editId?db.from('planner_tasks').update(data).eq('id',editId).eq('user_id',currentUser.id):db.from('planner_tasks').insert({...data,user_id:currentUser.id});
 const {error}=await request;setBusy(false);
 if(error){alert('Could not save task: '+errorText(error));return;}
 closeModal();await loadTasks();
};
$('quickForm').onsubmit=async e=>{e.preventDefault();if(busy||!currentUser)return;const name=$('quickName').value.trim();if(!name)return;setBusy(true);const {error}=await db.from('planner_tasks').insert({user_id:currentUser.id,name,category:'Personal',priority:'Medium',status:'Pending'});setBusy(false);if(error){alert(errorText(error));return;}$('quickName').value='';await loadTasks();};
$('search').addEventListener('input',render);
$('resetHabits').onclick=()=>{if(!confirm('Reset this week’s habit check-ins?'))return;habits.forEach(h=>h.days=[0,0,0,0,0,0,0]);storageSet('planner_habits_'+currentUser.id,JSON.stringify(habits));render();};
async function loadNotes(){
 if(!currentUser)return;
 const uid=currentUser.id, serial=++notesLoadCounter;
 notesLoaded=false; $('notes').disabled=true; $('notesStatus').textContent='Loading notes...';
 const {data,error}=await db.from('planner_notes').select('content').eq('user_id',uid).maybeSingle();
 if(serial!==notesLoadCounter||currentUser?.id!==uid)return;
 if(error){$('notesStatus').textContent='Notes not connected — run notes_database.sql in Supabase.';return;}
 $('notes').value=data?.content||'';notesLoaded=true;$('notes').disabled=false;
 $('notesStatus').textContent='Notes synced to your account ✓';
}
async function saveNotes(uid,value){
 if(currentUser?.id!==uid||!notesLoaded)return;
 $('notesStatus').textContent='Saving...';
 const {error}=await db.from('planner_notes').upsert({user_id:uid,content:value,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 if(currentUser?.id!==uid)return;
 $('notesStatus').textContent=error?'Could not save note: '+errorText(error):'Saved to your account ✓';
}
$('notes').addEventListener('input',()=>{
 if(!currentUser||!notesLoaded)return;
 const uid=currentUser.id, value=$('notes').value;
 clearTimeout(notesSaveTimer);
 $('notesStatus').textContent='Unsaved changes...';
 notesSaveTimer=setTimeout(()=>saveNotes(uid,value),700);
});
const now=new Date();$('todayDate').textContent=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric'});const hour=now.getHours();$('greeting').textContent=hour<12?'Good Morning! ☁️':hour<18?'Good Day! ☁️':'Good Evening! 🌙';
document.querySelectorAll('.nav button').forEach(button=>button.onclick=()=>{
 document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));button.classList.add('active');currentView=button.dataset.view;
 if(currentView==='Notes')$('notesPanel').scrollIntoView({behavior:'smooth',block:'start'});
 if(currentView==='Tasks'||currentView==='Archive')document.querySelector('.layout').scrollIntoView({behavior:'smooth'});
 if(currentView==='Habit Tracker')$('habits').scrollIntoView({behavior:'smooth'});
 if(currentView==='Calendar')$('deadlines').scrollIntoView({behavior:'smooth'});
 render();
});
function applyUser(user){
 loadCounter++;
 currentUser=user;
 $('authScreen').style.display=user?'none':'grid';
 $('signOut').hidden=!user;$('accountEmail').textContent=user?.email||'';
 tasks=[];render();
 if(user){
   const saved=storageGet('planner_habits_'+user.id);
   if(saved){try{const old=JSON.parse(saved);if(Array.isArray(old)&&old.length===habits.length)old.forEach((h,i)=>{if(Array.isArray(h.days))habits[i].days=h.days.map(v=>v?1:0).slice(0,7);});}catch{}}
   else habits.forEach(h=>h.days=[0,0,0,0,0,0,0]);
   $('notes').value=storageGet('planner_notes_'+user.id)||'';
   loadTasks();
 }else{$('notes').value='';habits.forEach(h=>h.days=[0,0,0,0,0,0,0]);$('statusNote').textContent='';}
}
function setAuthMode(mode){
 authMode=mode; signingUp=mode==='signup'; notify('');
 const emailOnly=mode==='request';
 $('authPassword').hidden=emailOnly;
 $('passwordLabel').hidden=emailOnly;
 $('authPassword').required=!emailOnly;
 $('authPassword').autocomplete=mode==='recovery'?'new-password':mode==='signup'?'new-password':'current-password';
 $('authPassword').value='';
 $('authSubmit').textContent=({signin:'Sign In',signup:'Create Account',request:'Send Reset Email',recovery:'Save New Password'})[mode];
 $('authSubtitle').textContent=({signin:'Sign in to your personal task space.',signup:'Create an account to save your own tasks.',request:'Enter your email to receive a password reset link.',recovery:'Set a new password for your account.'})[mode];
 $('authForgot').hidden=mode!=='signin';
 $('authToggle').hidden=mode==='request'||mode==='recovery';
 $('authBack').hidden=mode==='signin'||mode==='signup';
 $('authToggle').textContent=signingUp?'Already have an account? Sign In':"Don't have an account? Sign Up";
}
$('authToggle').onclick=()=>setAuthMode(authMode==='signup'?'signin':'signup');
$('authForgot').onclick=()=>setAuthMode('request');
$('authBack').onclick=()=>setAuthMode('signin');
$('authForm').onsubmit=async e=>{
 e.preventDefault();if(!ready){notify('First, set your Supabase Project URL and publishable key in config.js.');return;}if(busy)return;
 setBusy(true);notify('');const email=$('authEmail').value.trim(),password=$('authPassword').value;
 try{
  if(authMode==='request'){
   const redirectTo=window.location.origin+window.location.pathname;
   const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
   if(error)throw error;
   notify('If this email is registered, a reset link will be sent. Check your inbox.',true);
   return;
  }
  if(authMode==='recovery'){
   const {error}=await db.auth.updateUser({password});
   if(error)throw error;
   setAuthMode('signin');
   notify('Password updated. You can sign in with your new password.',true);
   await db.auth.signOut();
   applyUser(null);
   return;
  }
  const {data,error}=authMode==='signup'?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
  if(error)throw error;
  if(authMode==='signup'&&!data.session){notify('Account created. Check your email for the verification link, then sign in.',true);return;}
  if(data.user)applyUser(data.user);
 }catch(err){notify(errorText(err));}
 finally{setBusy(false);}
};
$('signOut').onclick=async()=>{if(!db)return;const {error}=await db.auth.signOut();if(error)alert(errorText(error));else applyUser(null);};
async function boot(){
 if(!ready){notify('Setup required: open config.js and enter your Supabase URL and publishable key.');return;}
 if(!window.supabase?.createClient){notify('Could not load Supabase library. Check your internet connection and refresh.');return;}
 try{
  db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
  const recoveryInUrl=window.location.hash.includes('type=recovery')||new URLSearchParams(window.location.search).get('type')==='recovery';
  db.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'){
    setAuthMode('recovery');$('authScreen').style.display='grid';
   }else if(event==='SIGNED_OUT'&&authMode!=='recovery')applyUser(null);
   else if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&session?.user&&authMode!=='recovery'&&!recoveryInUrl&&session.user.id!==currentUser?.id)applyUser(session.user);
  });
  const {data,error}=await db.auth.getUser();
  if(error&&error.name!=='AuthSessionMissingError')console.warn(error);
  if(!recoveryInUrl)applyUser(data?.user||null);
  else {$('authScreen').style.display='grid';setAuthMode('recovery');}
 }catch(err){notify('Supabase setup error: '+errorText(err));}
}
boot();
