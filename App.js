'use strict';
/* صلوات شمار v1.6.0 */
const APP_VERSION=document.querySelector('meta[name="app-version"]')?.content||'1.6.0';
const KEY='salavat_shomar_data_v1',$=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const num=v=>{v=Number(v);return Number.isFinite(v)?v:0};
const cnt=v=>Math.max(0,Math.floor(num(v)));
const fa=v=>String(v??0).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const pad=n=>String(n).padStart(2,'0');
const dayKey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
/* هفته از شنبه شروع می‌شود؛ کلید = تاریخ شنبهٔ همان هفته */
const weekKey=(d=new Date())=>{const s=new Date(d.getFullYear(),d.getMonth(),d.getDate());s.setDate(s.getDate()-(s.getDay()+1)%7);return dayKey(s)};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

/* ---------- state ---------- */
const DEF={count:0,total:0,today:0,week:0,goal:100,groupTarget:1000,mode:'personal',history:[],groups:[],deletedGroups:[],clearedAt:0,sound:true,vibrate:true,theme:'light',lastDate:'',lastWeek:'',deviceId:'',updatedAt:0};
function normalize(p){
  p=p&&typeof p==='object'?p:{};
  const s={...DEF,...p};
  ['count','total','today','week'].forEach(k=>s[k]=cnt(s[k]));
  s.goal=Math.max(1,cnt(s.goal)||100);
  s.groupTarget=Math.max(1,cnt(s.groupTarget)||1000);
  s.mode=s.mode==='group'?'group':'personal';
  s.theme=s.theme==='dark'?'dark':'light';
  s.sound=s.sound!==false;s.vibrate=s.vibrate!==false;
  s.clearedAt=num(s.clearedAt);s.updatedAt=num(s.updatedAt);
  s.history=(Array.isArray(p.history)?p.history:[]).filter(h=>h&&typeof h==='object')
    .map(h=>({id:String(h.id??uid()),amount:Math.max(1,cnt(h.amount)||1),memorial:!!h.memorial,ts:num(h.ts)||num(h.id)}))
    .filter(h=>h.ts>=s.clearedAt);
  s.deletedGroups=(Array.isArray(p.deletedGroups)?p.deletedGroups:[]).map(String);
  s.groups=(Array.isArray(p.groups)?p.groups:[]).filter(g=>g&&g.name)
    .map(g=>({id:String(g.id??uid()),name:String(g.name),target:Math.max(1,cnt(g.target)||1),ts:num(g.ts)||num(g.id)}))
    .filter(g=>!s.deletedGroups.includes(g.id));
  s.lastDate=typeof s.lastDate==='string'?s.lastDate:'';
  s.lastWeek=/^\d{4}-\d\d-\d\d$/.test(s.lastWeek)?s.lastWeek:'';
  s.deviceId=s.deviceId||uid();
  return s;
}
function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)))}catch(e){console.warn(e);return normalize({})}}
function save(){state.updatedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn('save failed',e)}}
/* ادغام بدون از دست رفتن داده: تنظیمات/شمارنده‌ها از نسخهٔ جدیدتر، تاریخچه و گروه‌ها اجتماع بر اساس id */
function merge(a,b){
  const [o,n]=a.updatedAt>b.updatedAt?[b,a]:[a,b];
  const m={...o,...n,deviceId:a.deviceId};
  m.clearedAt=Math.max(a.clearedAt,b.clearedAt);
  m.deletedGroups=[...new Set([...a.deletedGroups,...b.deletedGroups])];
  const h=new Map();[...a.history,...b.history].forEach(x=>{if(x.ts>=m.clearedAt)h.set(x.id,x)});
  m.history=[...h.values()].sort((x,y)=>y.ts-x.ts).slice(0,200);
  const g=new Map();[...a.groups,...b.groups].forEach(x=>{if(!m.deletedGroups.includes(x.id))g.set(x.id,x)});
  m.groups=[...g.values()].sort((x,y)=>y.ts-x.ts);
  return m;
}
let state=load();

function checkDateReset(){
  const d=dayKey(),w=weekKey();let ch=false;
  if(state.lastDate&&state.lastDate!==d){state.count=0;state.today=0;ch=true}
  if(state.lastWeek&&state.lastWeek!==w){state.week=0;ch=true}
  if(state.lastDate!==d||state.lastWeek!==w){state.lastDate=d;state.lastWeek=w;ch=true}
  if(ch)save();
  return ch;
}

/* ---------- theme / status ---------- */
function applyTheme(){
  document.body.classList.toggle('dark',state.theme==='dark');
  if($('darkToggle'))$('darkToggle').checked=state.theme==='dark';
  try{localStorage.setItem('salavat_theme',state.theme)}catch(e){}
}
function showStatus(m){const e=$('counterStatus');if(!e)return;e.textContent=m;clearTimeout(showStatus.t);showStatus.t=setTimeout(()=>{e.textContent=''},3000)}

/* ---------- counter ---------- */
function addCount(n=1,memorial=false){
  checkDateReset(); /* قبل از افزایش، تا اولین ضربهٔ بعد از نیمه‌شب گم نشود */
  n=Math.max(1,Math.floor(num(n)));
  state.count+=n;state.today+=n;state.week+=n;state.total+=n;
  state.history.unshift({id:uid(),amount:n,memorial,ts:Date.now()});
  state.history=state.history.slice(0,200);
  save();renderCounter();renderHistory();
  if(state.vibrate&&navigator.vibrate)try{navigator.vibrate(memorial?[30,40,30]:18)}catch(e){}
  if(state.sound)playClick();
  showStatus(memorial?'یک صلوات به نیت مرحوم عبدالعزیز رسولی هدیه شد 🤲':'صلوات ثبت شد 🌿');
}
function removeCount(){
  if(state.count<=0)return showStatus('شمارنده صفر است.');
  const h=state.history[0];
  if(h){if(h.amount>1)h.amount--;else state.history.shift()} /* تاریخچه با شمارنده هماهنگ بماند */
  state.count--;
  state.today=Math.max(0,state.today-1);state.week=Math.max(0,state.week-1);state.total=Math.max(0,state.total-1);
  save();renderCounter();renderHistory();
}
function resetCount(){
  if(!confirm('آیا می‌خواهید شمارنده امروز صفر شود؟'))return;
  state.count=0;save();renderCounter();showStatus('شمارنده صفر شد.');
}
function renderCounter(){
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
  const group=state.mode==='group';
  const goal=Math.max(1,group?state.groupTarget:state.goal);
  set('counterNumber',fa(state.count));set('todayStat',fa(state.today));
  set('weekStat',fa(state.week));set('totalStat',fa(state.total));
  set('goalText',`${fa(goal)} صلوات`);
  if($('progressBar'))$('progressBar').style.width=Math.min(100,state.count/goal*100)+'%';
  set('targetBadge',group?`هدف گروه: ${fa(goal)}`:'صلوات‌های امروز');
  set('counterModeText',group?'گروهی':'شخصی');
  set('countSub',state.count>=goal?'ماشاءالله؛ به هدف رسیدی 🤲':`${fa(goal-state.count)} صلوات تا رسیدن به هدف`);
}
function applyMode(){
  document.body.dataset.mode=state.mode;
  $('groupField')?.classList.toggle('hidden',state.mode!=='group'); /* قبلاً بعد از بارگذاری مجدد درست نمایش داده نمی‌شد */
  const r=document.querySelector(`input[name="countMode"][value="${state.mode}"]`);
  if(r)r.checked=true;
}
function setMode(m){state.mode=m==='group'?'group':'personal';applyMode();save();renderCounter()}

/* ---------- history / groups ---------- */
function historyHTML(items){
  if(!items.length)return '<div class="empty">هنوز فعالیتی ثبت نشده است.</div>';
  return items.map(i=>`<div class="item"><div class="list-row"><strong>${i.memorial?'🤲 صلوات هدیه‌ای':'🌿 ثبت صلوات'}</strong><strong>+${fa(i.amount)}</strong></div><p class="small">${esc(new Date(i.ts).toLocaleString('fa-IR'))}</p></div>`).join('');
}
function renderHistory(){
  if($('historyList'))$('historyList').innerHTML=historyHTML(state.history.slice(0,5));
  if($('fullHistoryList'))$('fullHistoryList').innerHTML=historyHTML(state.history);
}
function clearHistory(){
  if(!state.history.length)return alert('تاریخچه‌ای برای حذف وجود ندارد.');
  if(!confirm('آیا از پاک کردن تاریخچه مطمئن هستید؟'))return;
  state.history=[];state.clearedAt=Date.now();save();renderHistory();
}
function renderGroups(){
  const l=$('groupList');if(!l)return;
  l.innerHTML=state.groups.length?state.groups.map(g=>`<div class="item"><div class="list-row"><strong>${esc(g.name)}</strong><button type="button" class="danger delete-group" data-group-id="${esc(g.id)}">حذف</button></div><p class="small">هدف: ${fa(g.target)} صلوات</p></div>`).join(''):'<div class="empty">هنوز گروهی ایجاد نشده است.</div>';
}
function createGroup(){
  const ni=$('newGroupName'),ti=$('newGroupTarget');
  const name=ni?.value.trim(),target=Math.floor(num(ti?.value));
  if(!name)return alert('نام گروه را وارد کنید.');
  if(target<1)return alert('هدف گروه را وارد کنید.');
  state.groups.unshift({id:uid(),name,target,ts:Date.now()});
  save();renderGroups();ni.value='';ti.value='';showStatus('گروه جدید ایجاد شد.');
}
function deleteGroup(id){
  if(!confirm('آیا این گروه حذف شود؟'))return;
  id=String(id);
  state.groups=state.groups.filter(g=>g.id!==id);
  state.deletedGroups.push(id);save();renderGroups();
}

/* ---------- sound (یک AudioContext مشترک) ---------- */
let actx;
function playClick(){
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    actx=actx||new C();if(actx.state==='suspended')actx.resume();
    const o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime;
    o.type='sine';o.frequency.value=720;
    g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.07,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.08);
    o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+.09);
  }catch(e){}
}

/* ---------- clock / prayer ---------- */
function updateClock(){
  const n=new Date();
  if($('clock'))$('clock').textContent=n.toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  if($('prayerDate'))$('prayerDate').textContent=n.toLocaleDateString('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}
/* ⚠ زمان‌های ثابت و نمونه‌اند، نه محاسبهٔ واقعی بر اساس شهر */
const PRAYERS=[['fajr','صبح','05:00'],['sunrise','طلوع','06:30'],['dhuhr','ظهر','12:15'],['maghrib','مغرب','18:15'],['isha','عشا','19:30']];
function renderPrayer(){
  PRAYERS.forEach(([id,,t])=>{if($(id))$(id).textContent=fa(t)});
  const now=new Date(),m=now.getHours()*60+now.getMinutes();
  const list=PRAYERS.filter(p=>p[0]!=='sunrise');
  const nx=list.find(p=>{const[h,mi]=p[2].split(':');return h*60+ +mi>m})||list[0];
  if($('nextPrayer'))$('nextPrayer').textContent=nx[1];
}
function tick(){
  updateClock();
  if(dayKey()!==state.lastDate){checkDateReset();renderAll()} /* برنامهٔ باز در نیمه‌شب هم صفر می‌شود */
}

/* ---------- navigation / dialogs ---------- */
function showTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('hidden',t.id!==id));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.arg===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
window.showTab=showTab;
function openDialog(id){const d=$(id);if(!d)return;if(d.showModal){if(!d.open)d.showModal()}else d.setAttribute('open','')}
function closeDialog(id){const d=$(id);if(!d)return;if(d.close){if(d.open)d.close()}else d.removeAttribute('open')}

/* ---------- PWA install / network ---------- */
let deferredPrompt=null;
const hideInstall=()=>$('installBanner')?.classList.add('hidden');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBanner')?.classList.remove('hidden')});
$('installAppBtn')?.addEventListener('click',async()=>{
  if(!deferredPrompt)return;
  try{await deferredPrompt.prompt();await deferredPrompt.userChoice}catch(e){}
  deferredPrompt=null;hideInstall();
});
$('closeInstallBtn')?.addEventListener('click',hideInstall);
window.addEventListener('appinstalled',hideInstall);
function updateNetwork(){
  const on=navigator.onLine;
  $('networkDot')?.classList.toggle('online',on);
  if($('networkText'))$('networkText').textContent=on?'متصل به اینترنت':'بدون اتصال؛ اطلاعات روی دستگاه';
}
window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);

/* ---------- backup / sync ---------- */
const syncMsg=m=>{if($('syncStatus'))$('syncStatus').textContent=m};
function exportData(){
  const blob=new Blob([JSON.stringify({app:'salavat-shomar',version:APP_VERSION,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='salavat-backup-'+dayKey()+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  syncMsg('فایل پشتیبان ذخیره شد.');
}
async function importData(file){
  try{
    const j=JSON.parse(await file.text());
    if(!j||j.app!=='salavat-shomar'||!j.state)throw new Error('bad file');
    state=merge(state,normalize(j.state));
    save();checkDateReset();applyTheme();applyMode();renderAll();
    syncMsg('اطلاعات با موفقیت ادغام شد.');
  }catch(e){syncMsg('فایل پشتیبان معتبر نیست.')}
}
$('exportBtn')?.addEventListener('click',exportData);
$('importBtn')?.addEventListener('click',()=>$('importFile')?.click());
$('importFile')?.addEventListener('change',e=>{const f=e.target.files[0];if(f)importData(f);e.target.value=''});
/* همگام‌سازی بین تب‌های باز */
window.addEventListener('storage',e=>{
  if(e.key!==KEY||!e.newValue)return;
  try{state=merge(state,normalize(JSON.parse(e.newValue)));applyTheme();applyMode();renderAll()}catch(_){}
});

/* ---------- settings ---------- */
function renderSettings(){
  if($('darkToggle'))$('darkToggle').checked=state.theme==='dark';
  if($('soundToggle'))$('soundToggle').checked=state.sound;
  if($('vibrateToggle'))$('vibrateToggle').checked=state.vibrate;
}
function clearAllData(){
  if(!confirm('تمام اطلاعات شمارنده، تاریخچه و گروه‌ها حذف شود؟'))return;
  state=normalize({deviceId:state.deviceId,clearedAt:Date.now(),deletedGroups:[...state.deletedGroups,...state.groups.map(g=>g.id)]});
  checkDateReset();applyTheme();applyMode();renderAll();showStatus('تمام اطلاعات پاک شد.');
}
function memorialSalavat(){
  addCount(1,true);
  if($('memorialStatus'))$('memorialStatus').textContent='صلوات شما به نیت مرحوم عبدالعزیز رسولی هدیه شد 🤲';
}
function renderAll(){renderCounter();renderHistory();renderGroups();renderSettings();renderPrayer();updateClock();updateNetwork()}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-action]');
  if(a){
    const {action,arg}=a.dataset;
    if(action==='toggleDark'){state.theme=state.theme==='dark'?'light':'dark';applyTheme();save();return}
    if(action==='showTab')return showTab(arg);
    if(action==='openAccount')return openDialog('accountDialog');
  }
  const c=e.target.closest('[data-close-dialog]');
  if(c)return closeDialog(c.dataset.closeDialog);
  const d=e.target.closest('.delete-group');
  if(d)deleteGroup(d.dataset.groupId);
});
$('countButton')?.addEventListener('click',()=>addCount(1,false));
$('minusButton')?.addEventListener('click',removeCount);
$('resetButton')?.addEventListener('click',resetCount);
document.querySelectorAll('input[name="countMode"]').forEach(r=>r.addEventListener('change',()=>{if(r.checked)setMode(r.value)}));
$('groupTarget')?.addEventListener('input',e=>{const v=Math.floor(num(e.target.value));if(v>0){state.groupTarget=v;save();renderCounter()}});
$('createGroupButton')?.addEventListener('click',createGroup);
$('clearHistoryButton')?.addEventListener('click',clearHistory);
$('memorialButton')?.addEventListener('click',memorialSalavat);
$('modalMemorialButton')?.addEventListener('click',()=>{memorialSalavat();closeDialog('aboutDialog')});
$('darkToggle')?.addEventListener('change',e=>{state.theme=e.target.checked?'dark':'light';applyTheme();save()});
$('soundToggle')?.addEventListener('change',e=>{state.sound=e.target.checked;save()});
$('vibrateToggle')?.addEventListener('change',e=>{state.vibrate=e.target.checked;save()});
$('helpButton')?.addEventListener('click',()=>openDialog('helpDialog'));
$('aboutButton')?.addEventListener('click',()=>openDialog('aboutDialog'));
$('clearDataButton')?.addEventListener('click',clearAllData);
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)closeDialog(d.id)}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&checkDateReset())renderAll()});
/* کلید Space: فقط در تب خانه، بدون دیالوگ باز و وقتی فوکوس روی کنترل دیگری نیست */
document.addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  if(document.querySelector('dialog[open]')||$('homeTab')?.classList.contains('hidden'))return;
  if(/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement?.tagName))return;
  e.preventDefault();addCount(1,false);
});

/* ---------- service worker ---------- */
async function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname))return;
  try{
    const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    reg.addEventListener('updatefound',()=>{
      const w=reg.installing;if(!w)return;
      w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)console.log('نسخهٔ جدید برنامه آماده است.')});
    });
  }catch(e){console.warn('Service Worker registration failed:',e)}
}

/* ---------- init ---------- */
(function init(){
  checkDateReset();applyTheme();applyMode();
  if($('groupTarget'))$('groupTarget').value=state.groupTarget;
  if($('versionText'))$('versionText').textContent=APP_VERSION;
  renderAll();registerServiceWorker();setInterval(tick,1000);
})();
