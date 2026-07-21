const STORAGE = { items: "calendar.items.v1", reminders: "calendar.reminders.v1" };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const fmtDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const parseDate = value => { const [y,m,d] = value.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (date, amount) => { const copy = new Date(date); copy.setDate(copy.getDate()+amount); return copy; };
const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

const demoItems = [
  {id:crypto.randomUUID(),title:"Dentist appointment",type:"appointment",date:fmtDate(new Date()),start:"14:00",end:"16:00",location:"Center City",notes:"Bring insurance card",repeat:"none",reminder:"60",completed:false},
  {id:crypto.randomUUID(),title:"Anatomy study block",type:"academic",date:fmtDate(addDays(new Date(),1)),start:"08:00",end:"10:00",location:"",notes:"Cardiovascular system",repeat:"none",reminder:"30",completed:false},
  {id:crypto.randomUUID(),title:"Grocery shopping",type:"task",date:fmtDate(addDays(new Date(),2)),start:"19:00",end:"",location:"",notes:"",repeat:"none",reminder:"none",completed:false}
];

const state = {
  view:"week", cursor:new Date(), selectedDate:fmtDate(new Date()),
  items:JSON.parse(localStorage.getItem(STORAGE.items) || "null") || demoItems,
  reminders:JSON.parse(localStorage.getItem(STORAGE.reminders) || "{}"),
  supabase:null, user:null
};

function saveLocal(){localStorage.setItem(STORAGE.items,JSON.stringify(state.items));localStorage.setItem(STORAGE.reminders,JSON.stringify(state.reminders));}
function mondayOf(date){const copy=new Date(date);const day=copy.getDay()||7;copy.setDate(copy.getDate()-day+1);copy.setHours(0,0,0,0);return copy;}
function readableTime(value){if(!value)return "All day";const [h,m]=value.split(":").map(Number);return new Intl.DateTimeFormat([], {hour:"numeric",minute:"2-digit"}).format(new Date(2000,0,1,h,m));}
function longDate(value){return parseDate(value).toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"});}
function recurrenceMatches(item,dateString){
  if(item.date===dateString)return true;if(!item.repeat||item.repeat==="none"||dateString<item.date)return false;
  const start=parseDate(item.date),date=parseDate(dateString),days=Math.round((date-start)/86400000);
  if(item.repeat==="daily")return true;if(item.repeat==="weekly")return days%7===0;
  if(item.repeat==="weekdays")return date.getDay()>0&&date.getDay()<6;
  if(item.repeat==="monthly")return date.getDate()===start.getDate();return false;
}
function itemsForDate(dateString){return state.items.filter(item=>recurrenceMatches(item,dateString)).sort((a,b)=>(a.start||"99:99").localeCompare(b.start||"99:99"));}

function render(){
  const board=$("#calendarBoard");board.className=`board ${state.view}`;board.innerHTML="";
  let dates=[];
  if(state.view==="week"){const start=mondayOf(state.cursor);dates=Array.from({length:7},(_,i)=>addDays(start,i));$("#periodTitle").textContent=`${start.toLocaleDateString([], {month:"long",day:"numeric"})} – ${addDays(start,6).toLocaleDateString([], {month:"long",day:"numeric",year:"numeric"})}`;}
  else{const first=new Date(state.cursor.getFullYear(),state.cursor.getMonth(),1);const start=mondayOf(first);dates=Array.from({length:42},(_,i)=>addDays(start,i));$("#periodTitle").textContent=state.cursor.toLocaleDateString([], {month:"long",year:"numeric"});}
  for(const date of dates)board.append(dayCell(date));
  $$(".view-switcher button").forEach(button=>button.classList.toggle("active",button.dataset.view===state.view));renderUpNext();
}
function dayCell(date){
  const dateString=fmtDate(date),items=itemsForDate(dateString),cell=document.createElement("article");
  cell.className="day-column";if(dateString===fmtDate(new Date()))cell.classList.add("today");if(state.view==="month"&&date.getMonth()!==state.cursor.getMonth())cell.classList.add("outside");cell.dataset.date=dateString;
  cell.innerHTML=`<header class="day-header"><span class="day-name">${date.toLocaleDateString([], {weekday:"short"}).toUpperCase()}</span><span class="day-number">${date.getDate()}</span></header><div class="pins"></div><button class="add-day" type="button" aria-label="Add item">＋</button>`;
  const pins=cell.querySelector(".pins"),limit=state.view==="month"?3:8;
  items.slice(0,limit).forEach(item=>pins.append(pin(item,dateString)));if(items.length>limit)pins.insertAdjacentHTML("beforeend",`<div class="more-pins">+${items.length-limit} more</div>`);
  cell.addEventListener("click",event=>{if(!event.target.closest(".pin")&&!event.target.closest(".add-day"))openDay(dateString)});
  cell.querySelector(".add-day").addEventListener("click",event=>{event.stopPropagation();openItemForm(null,dateString)});
  cell.addEventListener("dragover",event=>event.preventDefault());cell.addEventListener("drop",event=>{event.preventDefault();const id=event.dataTransfer.getData("text/plain"),item=state.items.find(x=>x.id===id);if(item){item.date=dateString;saveAndSync();render();toast("Item moved");}});return cell;
}
function pin(item,occurrenceDate){
  const button=document.createElement("button");button.type="button";button.className=`pin ${item.type}${item.completed?" completed":""}`;button.draggable=true;button.innerHTML=`<strong>${escapeHTML(item.title)}</strong><small>${item.start?readableTime(item.start):"All day"}${item.location?` · ${escapeHTML(item.location)}`:""}</small>`;
  button.addEventListener("dragstart",event=>event.dataTransfer.setData("text/plain",item.id));button.addEventListener("click",event=>{event.stopPropagation();openItemForm(item,occurrenceDate)});return button;
}
function renderUpNext(){
  const list=$("#upNextList"),today=fmtDate(new Date());const upcoming=state.items.filter(item=>!item.completed&&item.date>=today).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).slice(0,3);
  list.innerHTML=upcoming.length?upcoming.map(item=>`<article class="up-card"><span class="up-dot" style="background:var(--${item.type})"></span><div><strong>${escapeHTML(item.title)}</strong><small>${longDate(item.date)} · ${readableTime(item.start)}</small></div></article>`).join(""):`<div class="empty-state">Nothing upcoming. Enjoy the open space.</div>`;
}
function openDay(dateString){
  state.selectedDate=dateString;$("#drawerTitle").textContent=longDate(dateString);$("#dailyReminder").value=state.reminders[dateString]||"";renderDrawerItems();$("#scrim").hidden=false;$("#dayDrawer").classList.add("open");$("#dayDrawer").setAttribute("aria-hidden","false");
}
function closeDay(){$("#dayDrawer").classList.remove("open");$("#dayDrawer").setAttribute("aria-hidden","true");$("#scrim").hidden=true;}
function renderDrawerItems(){
  const list=$("#drawerItems"),items=itemsForDate(state.selectedDate);list.innerHTML=items.length?items.map(item=>`<article class="drawer-item ${item.type}"><header><button type="button" data-edit="${item.id}"><strong>${escapeHTML(item.title)}</strong></button><small>${readableTime(item.start)}</small></header>${item.location?`<p>⌖ ${escapeHTML(item.location)}</p>`:""}${item.notes?`<p>${escapeHTML(item.notes)}</p>`:""}${item.type==="task"?`<label class="task-check"><input type="checkbox" data-complete="${item.id}" ${item.completed?"checked":""}> ${item.completed?"Completed":"Mark complete"}</label>`:""}</article>`).join(""):`<div class="empty-state">No pins for this day yet.</div>`;
  $$('[data-edit]').forEach(button=>button.addEventListener("click",()=>openItemForm(state.items.find(x=>x.id===button.dataset.edit),state.selectedDate)));
  $$('[data-complete]').forEach(box=>box.addEventListener("change",()=>{const item=state.items.find(x=>x.id===box.dataset.complete);item.completed=box.checked;saveAndSync();renderDrawerItems();render();}));
}
function openItemForm(item,dateString=state.selectedDate){
  $("#itemForm").reset();$("#itemId").value=item?.id||"";$("#itemTitle").value=item?.title||"";$("#itemType").value=item?.type||"personal";$("#itemDate").value=dateString||item?.date||fmtDate(new Date());$("#startTime").value=item?.start||"";$("#endTime").value=item?.end||"";$("#itemLocation").value=item?.location||"";$("#itemNotes").value=item?.notes||"";$("#repeatRule").value=item?.repeat||"none";$("#reminderMinutes").value=item?.reminder||"none";$("#allDay").checked=!item?.start;$("#deleteItemButton").hidden=!item;$("#formEyebrow").textContent=item?"EDIT PIN":"NEW PIN";$("#formTitle").textContent=item?"Edit item":"Add an item";toggleTimeFields();$("#itemDialog").showModal();
}
function saveItem(){
  if(!$("#itemForm").reportValidity())return;const id=$("#itemId").value||crypto.randomUUID();const item={id,title:$("#itemTitle").value.trim(),type:$("#itemType").value,date:$("#itemDate").value,start:$("#allDay").checked?"":$("#startTime").value,end:$("#allDay").checked?"":$("#endTime").value,location:$("#itemLocation").value.trim(),notes:$("#itemNotes").value.trim(),repeat:$("#repeatRule").value,reminder:$("#reminderMinutes").value,completed:state.items.find(x=>x.id===id)?.completed||false};
  const index=state.items.findIndex(x=>x.id===id);if(index>=0)state.items[index]=item;else state.items.push(item);saveAndSync();scheduleLocalNotification(item);$("#itemDialog").close();render();if($("#dayDrawer").classList.contains("open"))renderDrawerItems();toast(index>=0?"Pin updated":"Item pinned");
}
function deleteItem(){const id=$("#itemId").value;if(!id)return;state.items=state.items.filter(item=>item.id!==id);saveAndSync();$("#itemDialog").close();render();if($("#dayDrawer").classList.contains("open"))renderDrawerItems();toast("Item deleted");}
function toggleTimeFields(){const disabled=$("#allDay").checked;$("#startTime").disabled=disabled;$("#endTime").disabled=disabled;}

function search(){
  const query=$("#searchInput").value.trim().toLowerCase(),type=$("#searchType").value,incomplete=$("#incompleteOnly").checked;let results=state.items.filter(item=>(type==="all"||item.type===type)&&(!incomplete||(item.type==="task"&&!item.completed))&&(!query||[item.title,item.notes,item.location,item.date,item.type].join(" ").toLowerCase().includes(query))).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,30);
  $("#searchResults").innerHTML=results.map(item=>`<button class="search-result" type="button" data-result="${item.id}"><span><strong>${escapeHTML(item.title)}</strong><br><small>${escapeHTML(item.type)}</small></span><small>${longDate(item.date)}</small></button>`).join("")||(query?`<div class="empty-state">No matching pins found.</div>`:"");
  $$('[data-result]').forEach(button=>button.addEventListener("click",()=>{const item=state.items.find(x=>x.id===button.dataset.result);openItemForm(item,item.date);$("#searchPanel").hidden=true;}));
}
function toast(message){const node=$("#toast");node.textContent=message;node.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove("show"),2200);}
async function scheduleLocalNotification(item){
  if(item.reminder==="none"||!item.start||!("Notification" in window))return;if(Notification.permission==="default")await Notification.requestPermission();if(Notification.permission!=="granted")return;
  const when=new Date(`${item.date}T${item.start}:00`).getTime()-Number(item.reminder)*60000,delay=when-Date.now();if(delay>0&&delay<2147483647)setTimeout(()=>new Notification(item.title,{body:item.notes||`${readableTime(item.start)}${item.location?` · ${item.location}`:""}`,icon:"./icons/icon.svg"}),delay);
}

async function initSupabase(){
  const config=window.CALENDAR_CONFIG||{};if(!config.supabaseUrl||!config.supabaseAnonKey||!window.supabase)return;
  state.supabase=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);const {data}=await state.supabase.auth.getSession();state.user=data.session?.user||null;updateAccountUI();if(state.user)await loadCloud();state.supabase.auth.onAuthStateChange(async(_,session)=>{state.user=session?.user||null;updateAccountUI();if(state.user)await loadCloud();});
}
async function sign(mode){
  if(!state.supabase){$("#syncStatus").textContent="Add your Supabase URL and public key in config.js first.";return;}const email=$("#email").value,password=$("#password").value;if(!email||password.length<8){$("#syncStatus").textContent="Enter an email and a password with at least 8 characters.";return;}
  const action=mode==="up"?state.supabase.auth.signUp({email,password}):state.supabase.auth.signInWithPassword({email,password});const {error}=await action;$("#syncStatus").textContent=error?error.message:(mode==="up"?"Account created. Check your email if confirmation is enabled.":"Signed in and syncing.");
}
function updateAccountUI(){$("#accountButton").textContent=state.user?.email?.slice(0,2).toUpperCase()||"AM";$("#syncStatus").textContent=state.user?`Syncing as ${state.user.email}`:"Local mode is active";}
async function loadCloud(){const {data,error}=await state.supabase.from("calendar_items").select("*").eq("user_id",state.user.id);if(!error&&data?.length){state.items=data.map(row=>row.payload);saveLocal();render();}else if(!error)await syncCloud();}
async function syncCloud(){if(!state.supabase||!state.user)return;await state.supabase.from("calendar_items").delete().eq("user_id",state.user.id);if(state.items.length)await state.supabase.from("calendar_items").insert(state.items.map(item=>({id:item.id,user_id:state.user.id,payload:item})));}
function saveAndSync(){saveLocal();syncCloud();}

function bind(){
  $$(".view-switcher button").forEach(button=>button.addEventListener("click",()=>{state.view=button.dataset.view;render();}));
  $("#previousButton").addEventListener("click",()=>{state.cursor=state.view==="week"?addDays(state.cursor,-7):new Date(state.cursor.getFullYear(),state.cursor.getMonth()-1,1);render();});
  $("#nextButton").addEventListener("click",()=>{state.cursor=state.view==="week"?addDays(state.cursor,7):new Date(state.cursor.getFullYear(),state.cursor.getMonth()+1,1);render();});
  $("#todayButton").addEventListener("click",()=>{state.cursor=new Date();render();});$("#addItemButton").addEventListener("click",()=>openItemForm(null,fmtDate(new Date())));$("#drawerAddButton").addEventListener("click",()=>openItemForm(null,state.selectedDate));
  $("#scrim").addEventListener("click",closeDay);$("[data-close-drawer]").addEventListener("click",closeDay);$("#saveItemButton").addEventListener("click",saveItem);$("#deleteItemButton").addEventListener("click",deleteItem);$("#allDay").addEventListener("change",toggleTimeFields);
  $("#dailyReminder").addEventListener("input",()=>{state.reminders[state.selectedDate]=$("#dailyReminder").value;saveAndSync();});
  $(".search-toggle").addEventListener("click",()=>{$("#searchPanel").hidden=!$("#searchPanel").hidden;if(!$("#searchPanel").hidden){$("#searchInput").focus();search();}});["#searchInput","#searchType","#incompleteOnly"].forEach(selector=>$(selector).addEventListener("input",search));
  $("#viewTasksButton").addEventListener("click",()=>{$("#searchPanel").hidden=false;$("#searchType").value="task";$("#incompleteOnly").checked=true;search();});
  $("#accountButton").addEventListener("click",()=>$("#accountDialog").showModal());$("#signInButton").addEventListener("click",()=>sign("in"));$("#signUpButton").addEventListener("click",()=>sign("up"));
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeDay();if(event.key==="/"&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();$("#searchPanel").hidden=false;$("#searchInput").focus();search();}});
}

bind();render();initSupabase();if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
