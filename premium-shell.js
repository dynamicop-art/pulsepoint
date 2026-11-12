/* Arrange existing tools before the Firebase module attaches its handlers. */
(()=>{
 const $=s=>document.querySelector(s),home=$('#home');if(!home)return;
 document.body.classList.add('premium-student');
 function view(id,title,copy){const el=document.createElement('section');el.id=id;el.className='tab hidden';const h=document.createElement('h2');h.className='view-title';h.textContent=title;const p=document.createElement('p');p.className='muted';p.textContent=copy;el.append(h,p);home.after(el);return el;}
 const desk=view('desk','My Desk','তোমার নিজের পড়ার জায়গা — plan, notes ও focus timer।');
 const updates=view('updates','Updates','Teacher-এর খবর ও আজকের অনুপ্রেরণা।');
 const account=view('account','Your Profile','নিজের পরিচয়, নিজের মতো করে।');
 desk.append($('.study-desk'),$('.ai-coach-card'));
 updates.append($('#noticeList').closest('.card'),$('.motivation-card'));
 $('#progress').prepend($('.home-performance'));
 const panel=$('#homeMorePanel');account.append(panel);panel.open=true;panel.querySelector('summary b').textContent='Profile settings';panel.querySelector('summary small').textContent='Change your profile photo';
 $('#progress').append($('.weekly-goal-card'),$('.leaderboard-card'),$('#streakCount').closest('.home-mini-tools'));
 desk.append($('#pomoRing').closest('.card'));
 $('#notes').append($('#subjects').closest('.card'));
 for(const el of home.querySelectorAll('.home-primary-grid,.home-insight-grid')){while(el.firstChild)el.before(el.firstChild);el.remove();}
 const hero=document.createElement('section');hero.className='focus-launch';hero.setAttribute('aria-label','Daily focus');hero.innerHTML=`<div><span class="section-kicker">MAKE ROOM FOR A SMALL WIN</span><h2>একটু শুরু করো।<br>অনেকটা এগিয়ে যাও।</h2><p id="dailyStarter">একটা topic বেছে নাও। ১০ মিনিট মন দিয়ে পড়ো।</p><div class="launch-actions"><button id="quickFocus" type="button">▶ Start 10-minute focus</button><button data-open-tab="desk" class="secondary" type="button">My Desk ↗</button></div><p id="focusFeedback" role="status">Small steps count. Start when you’re ready.</p></div><img src="study-art.svg" width="180" height="130" alt="" aria-hidden="true"><div class="focus-week"><span>YOUR FOCUS WEEK</span><div id="focusWeek" aria-label="Completed focus sessions over the past seven days"></div><small id="focusWeekCaption">Complete a focus session to light up a day.</small></div>`;
 home.prepend(hero);
 const starters=['আজকের challenge: না দেখে একটি concept নিজের ভাষায় বলো।','আজকের challenge: আগের একটি ভুল প্রশ্ন আবার চেষ্টা করো।','আজকের challenge: একটি topic-এর তিনটি key point লেখো।','আজকের challenge: একটি formula-এর ব্যবহার উদাহরণ দিয়ে বোঝাও।','আজকের challenge: পড়া শেষে নিজেকে দুটি প্রশ্ন করো।','আজকের challenge: কঠিন topic-টি বন্ধুকে বোঝানোর মতো করে বলো।','আজকের challenge: গতকালের পড়া দুই মিনিটে মনে করার চেষ্টা করো।'];
 $('#dailyStarter').textContent=starters[new Date().getDay()];
 const nav=$('.student-nav');for(const [id,label,icon] of [['desk','My Desk','◫'],['updates','Updates','◉'],['account','Profile','◎']]){const b=document.createElement('button');b.dataset.tab=id;b.textContent=`${icon} ${label}`;nav.insertBefore(b,$('#moreNavBtn'));const m=document.createElement('button');m.dataset.openTab=id;m.innerHTML=`${icon}<span>${label}</span>`;$('.nav-sheet-grid').append(m);}
 const focus=document.createElement('button');focus.id='focusView';focus.type='button';focus.className='secondary utility-btn';focus.textContent='◐ Calm mode';focus.setAttribute('aria-pressed','false');$('.utility-strip').append(focus);focus.onclick=()=>{const on=document.body.classList.toggle('calm-mode');focus.setAttribute('aria-pressed',String(on));focus.textContent=on?'◑ Exit calm mode':'◐ Calm mode';};
 $('#pomoMode').insertAdjacentHTML('afterbegin','<option value="10">Focus 10 min</option>');
 const pulse=document.createElement('button');pulse.id='focusStatus';pulse.type='button';pulse.className='secondary utility-btn hidden';pulse.dataset.openTab='desk';$('.utility-strip').append(pulse);
 $('.version-badge').textContent='LEARNING, AT YOUR PACE';
})();
