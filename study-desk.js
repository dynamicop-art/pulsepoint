const $=id=>document.getElementById(id);
let key='',state={tasks:[],note:''},deadlines=[];
function save(){try{localStorage.setItem(key,JSON.stringify(state));$('deskSave').textContent='✓ Saved on this device for your account.';}catch{$('deskSave').textContent='Could not save. Keep this page open and copy your notes.';}}
function render(){
 const root=$('deskTasks');root.replaceChildren();
 state.tasks.forEach((task,i)=>{const row=document.createElement('div');row.className='desk-task';const cb=document.createElement('input');cb.type='checkbox';cb.id=`desk-task-${i}`;cb.checked=task.done;const label=document.createElement('label');label.htmlFor=cb.id;label.textContent=task.text;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Delete ${task.text}`);cb.onchange=()=>{task.done=cb.checked;save();render();};remove.onclick=()=>{state.tasks.splice(i,1);save();render();$('taskInput').focus();};row.append(cb,label,remove);root.append(row);});
 const done=state.tasks.filter(t=>t.done).length;$('deskProgress').textContent=state.tasks.length?`${done} / ${state.tasks.length} completed${done===state.tasks.length?' · Great work!':''}`:'Start with one small goal.';$('deskMeter').max=state.tasks.length||1;$('deskMeter').value=done;
}
export function initStudyDesk(uid){
 key=`studyDesk:v10:${uid}`;state={tasks:[],note:''};
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){state.tasks=Array.isArray(saved.tasks)?saved.tasks.filter(t=>typeof t?.text==='string').slice(0,30).map(t=>({text:t.text.slice(0,160),done:!!t.done})):[];state.note=typeof saved.note==='string'?saved.note.slice(0,5000):'';}}catch{$('deskSave').textContent='Storage unavailable or unreadable. New changes will try to save.';}
 $('deskNote').value=state.note;$('deskNote').oninput=()=>{state.note=$('deskNote').value;save();};
 $('taskForm').onsubmit=e=>{e.preventDefault();const text=$('taskInput').value.trim();if(!text)return;if(state.tasks.length>=30){$('deskProgress').textContent='Remove an old goal before adding more (maximum 30).';return;}state.tasks.push({text,done:false});$('taskInput').value='';save();render();};render();
 $('exportDeadlines').onclick=exportCalendar;
}
function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function updateDeadlines(items){
 deadlines=items.filter(a=>/^\d{4}-\d{2}-\d{2}$/.test(a.dueDate||'')).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 const today=localDate(),late=deadlines.filter(a=>a.dueDate<today).length,due=deadlines.filter(a=>a.dueDate===today).length;
 $('deadlineSummary').textContent=deadlines.length?`${late} overdue · ${due} due today · ${deadlines.length} pending deadlines`:'You’re all caught up — no pending dated assignments.';$('exportDeadlines').disabled=!deadlines.length;
}
function escapeICS(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');}
function fold(line){let out='',part='';for(const ch of line){if(new TextEncoder().encode(part+ch).length>73){out+=part+'\r\n';part=' ';}part+=ch;}return out+part;}
function exportCalendar(){
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Arpan Learning Suite//Study Desk//EN','CALSCALE:GREGORIAN'];
 for(const a of deadlines){const end=new Date(`${a.dueDate}T12:00:00`);end.setDate(end.getDate()+1);lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(a.id)}@arpan-learning-suite`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${a.dueDate.replaceAll('-','')}`,`DTEND;VALUE=DATE:${localDate(end).replaceAll('-','')}`,`SUMMARY:${escapeICS(a.title)}`,`DESCRIPTION:${escapeICS(a.description||'Assignment deadline')}`,'END:VEVENT');}
 lines.push('END:VCALENDAR');const url=URL.createObjectURL(new Blob([lines.map(fold).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='assignment-deadlines.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('deadlineSummary').textContent='Calendar downloaded. Import it into your calendar app; changes require a new export.';
}
// Refresh date-sensitive summaries after midnight or returning to the page.
setInterval(()=>{if($('deadlineSummary')&&deadlines.length)updateDeadlines(deadlines);},60000);
