/* UI, input and deliberately ridiculous synthesized sound effects. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), SAVE_KEY = 'fart-to-the-sun:checkpoint:v1';
  const canvas = $('universe'), keys = new Set();
  let renderer, game, last = performance.now(), toastUntil = 0, modalType = '', savedCheckpoint = null, pointerDown = false, pointer = null, audio = null, soundOn = false, previousFocus = null;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const soundSVG = enabled => `<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6l5 4z${enabled ? 'M15 8q5 4 0 8M18 5q8 7 0 14' : 'M16 9l5 6m0-6-5 6'}"/></svg>`;
  function toggleSound(force) {
    soundOn = force ?? !soundOn;
    if (soundOn) {
      try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(() => {}); } catch { soundOn = false; }
    }
    $('sound').innerHTML = soundSVG(soundOn); $('sound').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound');
  }
  function playSound(type) {
    if (!soundOn || !audio || audio.state !== 'running') return;
    const tones = { shot:[280,120,.065,.025,'triangle'], hit:[170,70,.07,.035,'square'], pickup:[540,890,.15,.035,'sine'], beans:[180,620,.35,.045,'triangle'], upgrade:[380,980,.28,.04,'triangle'], throw:[150,450,.2,.035,'sine'], 'enemy-down':[110,35,.23,.04,'sawtooth'], explosion:[85,20,.4,.07,'sawtooth'], hurt:[150,60,.22,.05,'square'], launch:[100,440,.7,.035,'triangle'], victory:[440,880,.7,.06,'triangle'], win:[400,1200,1.5,.06,'triangle'], boss:[160,55,.8,.05,'sawtooth'], laser:[600,80,.5,.025,'sawtooth'], sting:[250,80,.25,.03,'sawtooth'], phase:[220,500,.4,.04,'square'] };
    const t = audio.currentTime;
    if (type === 'fart') {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), filter = audio.createBiquadFilter();
      oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(85 + Math.random()*35,t); oscillator.frequency.exponentialRampToValueAtTime(29,t+.3);
      filter.type='lowpass'; filter.frequency.setValueAtTime(460,t); filter.frequency.exponentialRampToValueAtTime(110,t+.3);
      gain.gain.setValueAtTime(.001,t); gain.gain.linearRampToValueAtTime(.11,t+.018); gain.gain.exponentialRampToValueAtTime(.001,t+.34);
      oscillator.connect(filter);filter.connect(gain);gain.connect(audio.destination);oscillator.start(t);oscillator.stop(t+.36);
      oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();gain.disconnect();};return;
    }
    const def=tones[type]; if(!def)return;
    const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=def[4];oscillator.frequency.setValueAtTime(def[0],t);oscillator.frequency.exponentialRampToValueAtTime(def[1],t+def[2]);gain.gain.setValueAtTime(def[3],t);gain.gain.exponentialRampToValueAtTime(.001,t+def[2]);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(t);oscillator.stop(t+def[2]);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  function readSave(){try{return JSON.parse(localStorage.getItem(SAVE_KEY));}catch{return null;}}
  function save(){savedCheckpoint=game.checkpoint();try{localStorage.setItem(SAVE_KEY,JSON.stringify(savedCheckpoint));}catch{/* Private mode still supports an in-memory checkpoint. */}}
  function clearInput(){keys.clear();pointerDown=false;}
  function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');toastUntil=performance.now()+4200;}
  function openModal(type,html){
    if(!modalType)previousFocus=document.activeElement;
    modalType=type;clearInput();$('modal').innerHTML=html;$('modal-backdrop').classList.remove('hidden');syncMode();
    requestAnimationFrame(()=>{const focus=$('modal').querySelector('[data-autofocus]')||$('modal').querySelector('button:not(:disabled)');focus?.focus({preventScroll:true});});
  }
  function closeModal(){modalType='';$('modal-backdrop').classList.add('hidden');$('modal').innerHTML='';clearInput();previousFocus?.focus?.({preventScroll:true});syncMode();}
  const modalHeader=(eyebrow,title,subtitle)=>`<div class="eyebrow">✦ ${eyebrow}</div><h2 id="modal-title">${title}</h2><p class="subtitle">${subtitle}</p>`;
  function beansCard(){return `<div class="bean-shop"><div class="bean-can">🫘</div><div class="bean-info"><strong>The universe’s best fuel.</strong><p>One refill. Maximum fart power.<br>Currently ${Math.ceil(game.player.gas)} / ${game.maxGas} gas.</p></div><button class="shop-buy" id="buy-beans">BUY BEANS<small>0 CREDITS · ALWAYS FREE</small></button></div>`;}
  function bindBeans(render){$('buy-beans').onclick=()=>{game.buyBeans();if(game.mode==='dock')save();render();};}
  function showDock(first=false){
    const planet=PLANETS[game.stage],target=game.target;
    const intro=first?'Your mission: reach the Sun. Your fuel: beans. Stock up, pick an upgrade, and prepare for a deeply unserious journey.':game.stage===3?'Gravity Golem down. Only one flight stands between you and the Sun. Refuel, upgrade, and dodge the solar flares.':`Guardian defeated. Welcome to ${planet.name}! Your suit is repaired, your checkpoint is saved, and the bean buffet is open.`;
    const cards=Object.entries(UPGRADE_INFO).map(([key,info])=>`<article class="upgrade"><span class="upgrade-icon">${info.icon}</span><strong>${info.name}</strong><p>${info.description}<br>LEVEL ${game.upgrades[key]} / 3</p><button data-upgrade="${key}" ${game.upgrades[key]>=3||game.credits<game.upgradeCost(key)?'disabled':''}>${game.upgrades[key]>=3?'MAXED OUT':`${game.upgradeCost(key)} ✧ · UPGRADE`}</button></article>`).join('');
    openModal('dock',`${modalHeader(`${planet.label} · PLANET ${game.stage+1} / 4`,first?'Ready, Captain Toot?':`Touchdown on ${planet.name}.`,intro)}${beansCard()}<div class="shop-heading"><span>PLANET PIT STOP · UPGRADES</span><b>${game.credits} ✧ CREDITS</b></div><div class="upgrades">${cards}</div><div class="modal-footer"><p>NEXT STOP<br><span class="green">${target.name.toUpperCase()}</span> ${target.boss?`· ${target.boss}`:'· VICTORY AWAITS'}</p><button class="primary" id="launch" data-autofocus>LET’S RIP <span>↗</span></button></div>`);
    const back=document.createElement('button');back.className='modal-close';back.textContent='×';back.setAttribute('aria-label','Return to title');back.onclick=home;$('modal').appendChild(back);
    bindBeans(()=>showDock(first));
    for(const button of $('modal').querySelectorAll('[data-upgrade]'))button.onclick=()=>{if(game.buyUpgrade(button.dataset.upgrade)){save();showDock(first);}};
    $('launch').onclick=()=>{save();game.launch();};
  }
  function showShop(){openModal('shop',`${modalHeader('ORBITAL BEAN DELIVERY · OPEN 24/7','Running on fumes?','Space is big. Beans are free. Take a breather and fill up — the universe can wait. Upgrades are available at planet pit stops.')}${beansCard()}<div class="modal-footer"><p>✓ NO CHARGE<br>✓ NO DELIVERY FEE</p><button class="primary" id="return-flight" data-autofocus>BACK TO SPACE <span>↗</span></button></div>`);bindBeans(showShop);$('return-flight').onclick=()=>game.closeShop();}
  function showPause(){openModal('pause',`${modalHeader('HOLDING IN THE FART','Taking a breather.','Your adventure is paused. Your last planet checkpoint is saved.')}<div class="modal-footer"><button class="secondary" id="home">Back to title</button><button class="primary" id="resume" data-autofocus>KEEP RIPPING <span>↗</span></button></div>`);$('resume').onclick=()=>game.resume();$('home').onclick=home;}
  function showHelp(){
    const wasActive=game.active;if(wasActive)game.pause();
    const oldType=modalType;
    openModal('help',`${modalHeader('CAPTAIN’S FIELD GUIDE','A crash course in gas.','Visit three planets, defeat their guardians, then reach the Sun to win.')}<button class="modal-close" id="close-help" aria-label="Close instructions">×</button><div class="help-grid"><div><kbd>WASD</kbd> / <kbd>↑ ↓ ← →</kbd><strong>Steer your suit</strong>You can always drift, even with an empty belly.</div><div><kbd>SPACE</kbd><strong>Let it rip</strong>Hold to boost. Nearby foes get stunned and enemy shots get cleared.</div><div><kbd>J</kbd> / <kbd>CLICK</kbd><strong>Fart blaster</strong>J aims at the nearest enemy. Click to aim manually. Costs a little gas.</div><div><kbd>E</kbd><strong>Throw TNT</strong>Fly into red crates to collect them. Throws home in on bosses and shield nodes.</div><div><kbd>B</kbd><strong>Buy free beans</strong>Refill anywhere, as often as you need. Buy upgrades when you land.</div><div><kbd>ESC</kbd> / <kbd>P</kbd><strong>Pause the chaos</strong>Checkpoints save at each planet. Press M to toggle the fart soundtrack.</div></div><p class="help-tip"><span class="green">GUARDIAN INTEL</span><br><b>Space Serpent:</b> 1,000 HP. TNT hurts it; farts stun it.<br><b>Space Wasp:</b> sting charge → laser eyes → baby wasp swarm.<br><b>Gravity Golem:</b> TNT its three shield nodes, then shoot its exposed core.</p><div class="modal-footer"><p>${coarsePointer?'On touch screens, use the on-screen controls.':'Tip: boost in short bursts to save your beans.'}</p><button class="primary" id="got-it" data-autofocus>GOT IT <span>↗</span></button></div>`);
    const dismiss=()=>{if(wasActive)game.resume();else if(oldType==='pause')showPause();else if(oldType==='dock')showDock(game.stage===0);else if(oldType==='shop')showShop();else closeModal();};$('got-it').onclick=dismiss;$('close-help').onclick=dismiss;
  }
  function showDead(){openModal('dead',`${modalHeader('A MINOR ATMOSPHERIC INCIDENT','Out of puff. Not out of hope.','Your suit needs a little love. Retry from your last planet with a repaired suit and another chance at glory.')}<div class="stats"><div><b>${game.stats.farts}</b><span>FARTS FARTED</span></div><div><b>${game.stats.defeated}</b><span>FOES DEFEATED</span></div><div><b>${game.stats.bosses} / 3</b><span>GUARDIANS DOWN</span></div></div><div class="modal-footer"><button class="secondary" id="home">Back to title</button><button class="primary" id="retry" data-autofocus>TRY AGAIN <span>↗</span></button></div>`);$('home').onclick=home;$('retry').onclick=()=>{if(!game.restore(savedCheckpoint||readSave()))game.start();};}
  function showWin(){
    try{localStorage.removeItem(SAVE_KEY);}catch{}savedCheckpoint=null;
    const mins=Math.floor(game.stats.time/60),secs=Math.floor(game.stats.time%60).toString().padStart(2,'0');
    openModal('won',`${modalHeader('MISSION COMPLETE · CERTIFIED SOLAR LEGEND','You farted to the Sun.','Three planets. Three defeated guardians. One incredibly brave digestive system. Captain Toot, you absolute legend.')}<div class="stats"><div><b>${game.stats.farts}</b><span>HEROIC FARTS</span></div><div><b>${game.stats.beans}</b><span>FREE BEAN REFILLS</span></div><div><b>${mins}:${secs}</b><span>FLIGHT TIME</span></div></div><p class="help-tip">✦ The Sun has been reached. The galaxy will never smell the same.</p><div class="modal-footer"><button class="secondary" id="home">Back to title</button><button class="primary" id="play-again" data-autofocus>ONE MORE RIP <span>↗</span></button></div>`);$('home').onclick=home;$('play-again').onclick=()=>game.start();
  }
  function home(){game.mode='menu';game.clearSpace();closeModal();$('continue').classList.toggle('hidden',!readSave()&&!savedCheckpoint);}
  function syncMode(){
    const menu=game.mode==='menu',active=game.active;
    $('menu').classList.toggle('hidden',!menu);$('hud').classList.toggle('hidden',menu);$('pause').classList.toggle('hidden',!active&&game.mode!=='paused');
    $('touch-controls').classList.toggle('hidden',!coarsePointer||!active||!!modalType);
    $('status-text').textContent=menu?'AN INTERPLANETARY BAD IDEA':game.mode==='dock'?'PIT STOP · BEANS ON THE HOUSE':game.mode==='won'?'MISSION COMPLETE · ABSOLUTE LEGEND':'CAPTAIN TOOT · DEEP SPACE DIVISION';
  }
  function event(e){
    playSound(e.type);
    if(e.type==='toast')toast(e.text);
    else if(e.type==='dock'){save();showDock(e.first);}
    else if(e.type==='launch'||e.type==='resume')closeModal();
    else if(e.type==='shop')showShop();
    else if(e.type==='pause')showPause();
    else if(e.type==='dead')showDead();
    else if(e.type==='win')showWin();
    syncMode();
  }
  function updateHUD(){
    const p=game.player,b=game.boss;
    $('health-number').textContent=`${Math.ceil(p.hp)} / ${game.maxHP}`;$('gas-number').textContent=`${Math.ceil(p.gas)} / ${game.maxGas}`;
    $('health-bar').style.width=`${p.hp/game.maxHP*100}%`;$('gas-bar').style.width=`${p.gas/game.maxGas*100}%`;$('gas-bar').style.background=p.gas<15?'#ffaf7b':'#c5ef70';
    $('credits').textContent=game.credits;$('tnt-number').textContent=p.tnt;$('destination').textContent=game.target.name;$('leg-label').textContent=`LEG ${String(game.stage+1).padStart(2,'0')} / 04`;$('travel-bar').style.width=`${Math.min(100,game.progress*100)}%`;
    $('boss-panel').classList.toggle('hidden',!b);
    if(b){$('boss-name').textContent=b.name.toUpperCase();$('boss-health').textContent=`${Math.ceil(b.hp)} / ${b.maxHP}`;$('boss-bar').style.width=`${b.hp/b.maxHP*100}%`;$('boss-tag').textContent=b.stun>0?'STUNNED!':b.kind===2?`PHASE ${b.phase} / 3`:'PLANET GUARDIAN';$('boss-tip').textContent=b.kind===1?'Collect red TNT crates → E to throw. SPACE nearby to stun.':b.kind===2?(b.phase===1?'STING ATTACK · Dodge the marked line, then fire!':b.phase===2?'LASER EYES · Get out of the red beam before it fires!':'BABY WASPS · Fart to stun the swarm. Keep firing!'):b.satellites.some(s=>s.hp>0)?'TNT the 3 orbiting shield nodes. Watch the gravity pull!':`CORE EXPOSED · Fire! Shields return in ${Math.ceil(11-b.exposed)}s.`;}
    $('objective').textContent=b?`Defeat ${b.name} to land on ${game.target.name}.`:game.mode==='dock'?'Refuel, upgrade, and prepare to launch.':game.stage===3?'Final flight! Dodge solar flares and reach the Sun.':`Reach ${game.target.name}. Hold SPACE for fart propulsion.`;
  }
  try{renderer=new SpaceRenderer(canvas);}catch(error){console.error(error);$('webgl-error').classList.remove('hidden');return;}
  game=new SpaceGame({onEvent:event});
  function resize(){const size=renderer.resize();game.resize(size.w,size.h);}
  resize();window.addEventListener('resize',resize);
  $('menu-route').innerHTML=PLANETS.map((p,i)=>`<div class="route-node"><i class="mini-planet ${i===4?'sun':''}" style="--planet:${p.color}"></i><small>${String(i+1).padStart(2,'0')} ${p.name}</small></div>`).join('');
  $('continue').classList.toggle('hidden',!readSave());
  $('start').onclick=()=>{toggleSound(true);game.start();};
  $('continue').onclick=()=>{toggleSound(true);if(!game.restore(readSave()||savedCheckpoint)){toast('That checkpoint could not be loaded. Starting fresh.');game.start();}};
  $('sound').onclick=()=>toggleSound();$('help').onclick=showHelp;$('pause').onclick=()=>game.mode==='paused'?game.resume():game.pause();$('beans-hud').onclick=()=>game.openShop();
  $('brand').onclick=e=>{e.preventDefault();if(game.active)game.pause();else if(!modalType)home();};
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(key==='tab'&&modalType){const items=[...$('modal').querySelectorAll('button:not(:disabled),a[href]')];if(items.length){const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
    if(key==='escape'||key==='p'){if(e.repeat)return;e.preventDefault();if(modalType==='help')$('close-help').click();else if(game.mode==='shop')game.closeShop();else if(game.mode==='paused')game.resume();else game.pause();return;}
    if(key==='m'&&!e.repeat){toggleSound();return;}
    if(!game.active)return;
    if([' ','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','j','e','b'].includes(key)){e.preventDefault();keys.add(key);}
    if(key==='b'&&!e.repeat)game.openShop();
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{clearInput();if(game.active)game.pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(game.active)game.pause();}});
  canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();pointer={x:(e.clientX-rect.left)/rect.width*game.w,y:(e.clientY-rect.top)/rect.height*game.h};});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!game.active)return;const rect=canvas.getBoundingClientRect();pointer={x:(e.clientX-rect.left)/rect.width*game.w,y:(e.clientY-rect.top)/rect.height*game.h};pointerDown=true;});
  window.addEventListener('pointerup',()=>pointerDown=false);window.addEventListener('pointercancel',clearInput);
  for(const button of document.querySelectorAll('[data-key]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);});button.addEventListener('pointerup',()=>keys.delete(button.dataset.key));button.addEventListener('pointercancel',()=>keys.delete(button.dataset.key));button.addEventListener('lostpointercapture',()=>keys.delete(button.dataset.key));}
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(game.active)game.pause();toast('Graphics paused. Waiting for your browser to restore WebGL…');});
  canvas.addEventListener('webglcontextrestored',()=>{try{renderer=new SpaceRenderer(canvas);resize();toast('Graphics restored. Ready to keep ripping.');}catch{$('webgl-error').classList.remove('hidden');}});
  let hudTimer=0;
  function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;game.tick(dt,{left:keys.has('a')||keys.has('arrowleft'),right:keys.has('d')||keys.has('arrowright'),up:keys.has('w')||keys.has('arrowup'),down:keys.has('s')||keys.has('arrowdown'),fart:keys.has(' '),fire:keys.has('j')||pointerDown,throw:keys.has('e'),aimX:pointerDown?pointer?.x:undefined,aimY:pointerDown?pointer?.y:undefined});renderer.render(game,dt);hudTimer+=dt;if(hudTimer>.08){updateHUD();hudTimer=0;}if(toastUntil&&now>toastUntil){$('toast').classList.add('hidden');toastUntil=0;}requestAnimationFrame(frame);}
  syncMode();updateHUD();requestAnimationFrame(frame);
})();
