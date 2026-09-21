/* The simulation is independent of the browser and renderer. Units are world pixels. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const PLANETS = [
    { name: 'Earth', color: '#83bfa6', label: 'HOME SWEET HOME' },
    { name: 'Gassius', color: '#b9a0e9', label: 'THE LAVENDER GIANT', boss: 'Space Serpent', health: 1000 },
    { name: 'Hive Nine', color: '#e6b96d', label: 'PLEASE DO NOT POKE', boss: 'Space Wasp', health: 1200 },
    { name: 'Cinder', color: '#e29179', label: 'A ROCK WITH ATTITUDE', boss: 'Gravity Golem', health: 1400 },
    { name: 'The Sun', color: '#ffd58b', label: 'THE BIG, BRIGHT FINISH' }
  ];
  const UPGRADE_INFO = {
    tank: { name: 'Bigger belly', description: '+40 maximum fart power.', icon: '≋', base: 70 },
    blaster: { name: 'Spicy beans', description: '+12 fart-shot damage.', icon: '✷', base: 85 },
    suit: { name: 'Comfy suit', description: '+35 health. Fully repairs suit.', icon: '♡', base: 65 }
  };
  class SpaceGame {
    constructor({ random = Math.random, onEvent = () => {} } = {}) {
      this.random = random; this.onEvent = onEvent; this.w = 1440; this.h = 900;
      this.mode = 'menu'; this.time = 0; this.reset();
    }
    reset() {
      this.stage = 0; this.progress = 0; this.credits = 100;
      this.upgrades = { tank: 0, blaster: 0, suit: 0 };
      this.player = { x: 300, y: this.h * .55, vx: 0, vy: 0, angle: 0, hp: 100, gas: 100, tnt: 0, invincible: 0 };
      this.stats = { farts: 0, defeated: 0, beans: 0, time: 0, bosses: 0 };
      this.clearSpace(); this.fartTimer = 0; this.shotTimer = 0; this.throwTimer = 0; this.lowGasWarned = false;
    }
    clearSpace() {
      this.enemies = []; this.shots = []; this.pickups = []; this.particles = []; this.floaters = []; this.rings = [];
      this.boss = null; this.spawnTimer = 2; this.pickupTimer = 1; this.flareTimer = 3;
    }
    get maxHP() { return 100 + this.upgrades.suit * 35; }
    get maxGas() { return 100 + this.upgrades.tank * 40; }
    get damage() { return 28 + this.upgrades.blaster * 12; }
    get target() { return PLANETS[Math.min(this.stage + 1, 4)]; }
    get active() { return this.mode === 'flight' || this.mode === 'boss'; }
    emit(type, data = {}) { this.onEvent({ type, ...data }); }
    start() { this.reset(); this.mode = 'dock'; this.emit('dock', { first: true }); }
    launch() {
      if (this.mode !== 'dock') return false;
      if (this.player.gas < 10) { this.emit('toast', { text: 'Fill your belly with FREE beans before launch!' }); return false; }
      this.clearSpace(); this.progress = 0; this.player.x = this.w * .2; this.player.y = this.h * .55;
      this.player.vx = this.player.vy = 0; this.player.invincible = 2; this.mode = 'flight';
      this.emit('launch'); this.emit('toast', { text: this.stage === 0 ? 'WASD to steer · Hold SPACE to fart · J to fire. Let’s go!' : `Next stop: ${this.target.name}. Make some noise!` });
      return true;
    }
    buyBeans() {
      if (!['dock', 'shop'].includes(this.mode)) return false;
      this.player.gas = this.maxGas; this.stats.beans++; this.lowGasWarned = false;
      this.emit('beans'); this.emit('toast', { text: 'Belly full. Wallet untouched. Beans are always FREE.' }); return true;
    }
    upgradeCost(key) { return UPGRADE_INFO[key] ? UPGRADE_INFO[key].base + this.upgrades[key] * 60 : Infinity; }
    buyUpgrade(key) {
      if (this.mode !== 'dock' || !UPGRADE_INFO[key] || this.upgrades[key] >= 3) return false;
      const cost = this.upgradeCost(key); if (this.credits < cost) return false;
      this.credits -= cost; this.upgrades[key]++;
      if (key === 'suit') this.player.hp = this.maxHP;
      if (key === 'tank') this.player.gas = this.maxGas;
      this.emit('upgrade'); this.emit('toast', { text: `${UPGRADE_INFO[key].name} upgraded. Looking gassy!` }); return true;
    }
    openShop() { if (!this.active) return false; this.returnMode = this.mode; this.mode = 'shop'; this.emit('shop'); return true; }
    closeShop() { if (this.mode === 'shop') { this.mode = this.returnMode; this.emit('resume'); } }
    pause() { if (!this.active) return false; this.returnMode = this.mode; this.mode = 'paused'; this.emit('pause'); return true; }
    resume() { if (this.mode === 'paused') { this.mode = this.returnMode; this.emit('resume'); } }
    checkpoint() { return { version: 1, stage: this.stage, credits: this.credits, upgrades: { ...this.upgrades }, stats: { ...this.stats }, gas: this.player.gas, tnt: this.player.tnt }; }
    restore(save) {
      if (!save || save.version !== 1 || !Number.isInteger(save.stage) || save.stage < 0 || save.stage > 3 || !save.upgrades || !save.stats) return false;
      if (!Object.keys(UPGRADE_INFO).every(k => Number.isInteger(save.upgrades[k]) && save.upgrades[k] >= 0 && save.upgrades[k] <= 3)) return false;
      if (!Number.isFinite(save.credits) || save.credits < 0 || !Number.isFinite(save.gas) || !Number.isFinite(save.tnt)) return false;
      if (!Object.keys(this.stats).every(k => Number.isFinite(save.stats[k]) && save.stats[k] >= 0)) return false;
      this.reset(); this.stage = save.stage; this.credits = Math.floor(save.credits); this.upgrades = { ...save.upgrades }; this.stats = { ...save.stats };
      this.player.hp = this.maxHP; this.player.gas = clamp(save.gas, 0, this.maxGas); this.player.tnt = clamp(Math.floor(save.tnt), 0, 5);
      this.mode = 'dock'; this.emit('dock', { restored: true }); return true;
    }
    resize(w, h) {
      const ratio = h / this.h;
      for (const list of [[this.player], this.enemies, this.shots, this.pickups, this.particles, this.rings, this.boss ? [this.boss] : []]) for (const item of list) item.y *= ratio;
      this.w = w; this.h = h;
    }
    rand(lo, hi) { return lo + this.random() * (hi - lo); }
    burst(x, y, color, count = 15, force = 120) {
      for (let i = 0; i < count; i++) { const a = this.rand(0, TAU), life = this.rand(.35, .95); this.particles.push({ x, y, vx: Math.cos(a) * this.rand(20, force), vy: Math.sin(a) * this.rand(20, force), life, maxLife: life, r: this.rand(3, 10), color }); }
    }
    float(text, x, y, color = '#c5ef70') { this.floaters.push({ text, x, y, color, life: 1.4 }); }
    damagePlayer(amount) {
      const p = this.player; if (p.invincible > 0 || !this.active) return;
      p.hp = Math.max(0, p.hp - amount); p.invincible = 1.1; this.burst(p.x, p.y, '#b6a1ed', 12); this.float(`−${amount}`, p.x, p.y - 50, '#fa988d'); this.emit('hurt');
      if (p.hp <= 0) { this.mode = 'dead'; this.emit('dead'); }
    }
    fart() {
      const p = this.player; this.stats.farts++; this.emit('fart');
      this.rings.push({ x: p.x, y: p.y, r: 22, maxR: 180, life: .5, maxLife: .5, color: '#c5ef70' });
      for (const enemy of this.enemies) if (distance(p, enemy) < 185) { enemy.stun = 1.8; enemy.hp -= 38 + this.upgrades.blaster * 8; }
      const boss = this.boss;
      if (boss && distance(p, boss) < boss.radius + 185) {
        boss.stun = Math.max(boss.stun, 1.6); this.float('STINK STUN!', boss.x, boss.y - boss.radius, '#c5ef70');
      }
      for (const s of this.shots) if (s.owner === 'enemy' && distance(p, s) < 180) { s.dead = true; this.burst(s.x, s.y, '#c5ef70', 3); }
    }
    fire(input) {
      const p = this.player; let angle = 0;
      if (Number.isFinite(input.aimX)) angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
      else {
        const targets = [...this.enemies.filter(e => e.hp > 0), ...(this.boss ? [this.boss] : [])];
        targets.sort((a, b) => distance(p, a) - distance(p, b));
        if (targets.length) angle = Math.atan2(targets[0].y - p.y, targets[0].x - p.x);
      }
      this.shots.push({ x: p.x + Math.cos(angle) * 35, y: p.y + Math.sin(angle) * 35, vx: Math.cos(angle) * 780, vy: Math.sin(angle) * 780, r: 7, life: 2.4, owner: 'player', damage: this.damage, kind: 'pea' });
      p.gas = Math.max(0, p.gas - .8); this.emit('shot');
    }
    throwTNT(input = {}) {
      const p = this.player; if (p.tnt <= 0) { this.emit('toast', { text: 'No TNT! Fly into a floating red TNT crate to collect it.' }); return false; }
      p.tnt--; let target = this.boss;
      if (target?.kind === 3 && target.satellites.some(s => s.hp > 0)) target = this.satelliteTargets().filter(s => s.ref.hp > 0).sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (!target) target = this.enemies.filter(e => e.hp > 0).sort((a, b) => distance(p, a) - distance(p, b))[0];
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Number.isFinite(input.aimX) ? Math.atan2(input.aimY - p.y, input.aimX - p.x) : 0;
      this.shots.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 560, vy: Math.sin(angle) * 560, r: 16, life: 4, owner: 'player', damage: 250, kind: 'tnt', target });
      this.emit('throw'); return true;
    }
    spawnEnemy(baby = false) {
      const b = this.boss;
      this.enemies.push({ x: baby && b ? b.x : this.w + 40, y: baby && b ? b.y + this.rand(-100, 100) : this.rand(this.h * .31, this.h * .79), vx: -this.rand(65, 100), vy: 0, r: baby ? 19 : 26, hp: baby ? 50 : 65 + this.stage * 15, stun: 0, timer: this.rand(1.4, 3), kind: baby ? 'baby' : 'drone', age: 0 });
    }
    spawnPickup(kind, x, y) {
      this.pickups.push({ kind, x: x ?? this.rand(this.w * .22, this.w * .69), y: y ?? this.rand(this.h * .34, this.h * .8), r: kind === 'tnt' ? 20 : 13, age: 0, life: 22 });
    }
    startBoss() {
      if (this.stage >= 3) { this.win(); return; }
      this.mode = 'boss'; this.progress = 1;
      this.enemies = []; this.shots = []; this.pickups = this.pickups.filter(p => p.kind === 'tnt');
      this.boss = { kind: this.stage + 1, name: this.target.boss, hp: this.target.health, maxHP: this.target.health, x: this.w * .76, y: this.h * .55, radius: this.stage === 0 ? 100 : 80, age: 0, stun: 0, phase: 1, attack: 'idle', timer: 2, angle: Math.PI, satellites: Array.from({ length: 3 }, (_, i) => ({ hp: 150, angle: i * TAU / 3 })), exposed: 0 };
      this.player.invincible = 2;
      this.spawnPickup('tnt', this.w * .36, this.h * .44); this.spawnPickup('tnt', this.w * .44, this.h * .7);
      this.emit('boss'); this.emit('toast', { text: `${this.boss.name} approaches! ${this.stage === 0 ? 'Collect TNT, then press E to throw.' : this.stage === 1 ? 'Dodge the sting. Fire with J or click!' : 'Throw TNT at the three orbiting shield nodes!'}` });
    }
    satelliteTargets() { const b = this.boss; if (!b) return []; return b.satellites.map(s => ({ x: b.x + Math.cos(b.age * .55 + s.angle) * 145, y: b.y + Math.sin(b.age * .55 + s.angle) * 145, ref: s })); }
    hitBoss(damage, kind = 'pea') {
      const b = this.boss; if (!b || this.mode !== 'boss') return false;
      if (b.kind === 1 && kind !== 'tnt') { if (b.hintTime === undefined || b.age > b.hintTime + 3) { this.float('TNT BREAKS THE SCALES', b.x, b.y - 120, '#fa988d'); b.hintTime = b.age; } return false; }
      if (b.kind === 3 && b.satellites.some(s => s.hp > 0)) { this.burst(b.x - 70, b.y, '#b6a1ed', 3); return false; }
      b.hp = Math.max(0, b.hp - damage); this.float(`−${damage}`, b.x + this.rand(-35, 35), b.y - 70, '#ffaf7b'); this.burst(b.x, b.y, '#ffaf7b', kind === 'tnt' ? 35 : 5, 160); this.emit(kind === 'tnt' ? 'explosion' : 'hit');
      if (b.hp === 0) this.defeatBoss();
      return true;
    }
    defeatBoss() {
      const b = this.boss; this.burst(b.x, b.y, this.target.color, 70, 300);
      this.credits += 180 + this.stage * 70; this.stats.bosses++; this.stage++;
      this.player.hp = this.maxHP; this.boss = null; this.mode = 'dock'; this.enemies = []; this.shots = [];
      this.emit('victory'); this.emit('dock', { first: false });
    }
    win() { this.progress = 1; this.mode = 'won'; this.emit('win'); }
    enemyShot(x, y, angle, speed = 240, kind = 'bolt', r = 8) { this.shots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, owner: 'enemy', life: 7, kind, damage: kind === 'solar' ? 16 : 10 }); }
    tickBoss(dt) {
      const b = this.boss, p = this.player; if (!b) return;
      b.age += dt; b.stun = Math.max(0, b.stun - dt);
      const phase = b.kind === 2 ? (b.hp > b.maxHP * 2 / 3 ? 1 : b.hp > b.maxHP / 3 ? 2 : 3) : 1;
      if (phase !== b.phase) { b.phase = phase; b.attack = 'idle'; b.timer = 1.5; this.emit('phase', { phase }); this.emit('toast', { text: phase === 2 ? 'PHASE 2 — Laser eyes! Move out of the red beam.' : 'PHASE 3 — Baby wasps! Fart to stun the swarm.' }); }
      if (b.stun > 0) return;
      b.timer -= dt;
      if (b.kind === 1) {
        b.x += (this.w * .76 + Math.sin(b.age * .48) * 130 - b.x) * dt * 2;
        b.y += (this.h * .56 + Math.sin(b.age * .85) * Math.min(170, this.h * .17) - b.y) * dt * 2;
        if (b.timer <= 0) { const a = Math.atan2(p.y - b.y, p.x - b.x); for (let i = -2; i <= 2; i++) this.enemyShot(b.x - 60, b.y, a + i * .2, 210, 'venom', 11); b.timer = 2.4; this.emit('enemy-shot'); }
      } else if (b.kind === 2) {
        if (b.attack === 'charge') {
          b.x += Math.cos(b.angle) * 750 * dt; b.y += Math.sin(b.angle) * 750 * dt;
          b.x = clamp(b.x, 70, this.w - 70); b.y = clamp(b.y, this.h * .29, this.h * .86);
          if (b.timer <= 0) { b.attack = 'recover'; b.timer = 1.7; }
        } else if (b.attack === 'windup') {
          if (b.timer <= 0) { b.attack = 'charge'; b.timer = .7; this.emit('sting'); }
        } else if (b.attack === 'laser-warn') {
          if (b.timer <= 0) { b.attack = 'laser'; b.timer = .65; this.emit('laser'); }
        } else if (b.attack === 'laser') {
          const dx = p.x - b.x, dy = p.y - b.y, along = dx * Math.cos(b.angle) + dy * Math.sin(b.angle), across = Math.abs(-dx * Math.sin(b.angle) + dy * Math.cos(b.angle));
          if (along > 0 && across < 28) this.damagePlayer(18);
          if (b.timer <= 0) { b.attack = 'recover'; b.timer = 2; }
        } else {
          b.x += (this.w * .77 - b.x) * dt * 1.7; b.y += (this.h * .54 + Math.sin(b.age * 1.6) * 100 - b.y) * dt * 1.7;
          if (b.timer <= 0) {
            b.angle = Math.atan2(p.y - b.y, p.x - b.x);
            if (b.phase === 2) { b.attack = 'laser-warn'; b.timer = 1.15; }
            else if (b.phase === 3 && this.enemies.length < 7 && b.lastSwarm !== true) { for (let i = 0; i < 3; i++) this.spawnEnemy(true); b.timer = 2; b.lastSwarm = true; this.emit('swarm'); }
            else { b.attack = 'windup'; b.timer = .85; b.lastSwarm = false; }
          }
        }
      } else {
        b.y += (this.h * .55 + Math.sin(b.age * .6) * 65 - b.y) * dt * 2;
        const shielded = b.satellites.some(s => s.hp > 0);
        if (!shielded) { b.exposed += dt; if (b.exposed >= 11) { b.satellites.forEach(s => s.hp = 150); b.exposed = 0; this.emit('toast', { text: 'The golem rebuilt its shields. TNT the three nodes!' }); } }
        if (b.timer <= 0) { for (let i = 0; i < 10; i++) this.enemyShot(b.x, b.y, i * TAU / 10 + b.age, 165, 'gravity', 12); b.timer = 3; this.rings.push({ x: b.x, y: b.y, r: 70, maxR: 450, life: 1.5, maxLife: 1.5, color: '#b6a1ed' }); }
        if (shielded) { const d = Math.max(distance(p, b), 50); p.x += (b.x - p.x) / d * 34 * dt; p.y += (b.y - p.y) / d * 34 * dt; }
      }
      if (distance(p, b) < b.radius + 19) this.damagePlayer(b.kind === 2 ? 17 : 12);
      if (b.kind === 3) for (const s of this.satelliteTargets()) if (s.ref.hp > 0 && distance(p, s) < 43) this.damagePlayer(12);
    }
    tick(dt, input = {}) {
      dt = clamp(dt, 0, .05); this.time += dt;
      this.tickEffects(dt);
      if (!this.active) return;
      this.stats.time += dt;
      const p = this.player;
      p.invincible = Math.max(0, p.invincible - dt);
      this.fartTimer -= dt; this.shotTimer -= dt; this.throwTimer -= dt;
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0), my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const length = Math.hypot(mx, my); if (length) { mx /= length; my /= length; }
      p.boosting = !!input.fart && p.gas > .3;
      if (p.boosting) {
        p.gas = Math.max(0, p.gas - dt * 11); if (!length) mx = 1;
        if (this.fartTimer <= 0) { this.fart(); this.fartTimer = .66; }
        const angle = Math.atan2(my, mx);
        const life = this.rand(.45, .9);
        this.particles.push({ x: p.x - Math.cos(angle) * 33, y: p.y - Math.sin(angle) * 33, vx: -Math.cos(angle) * this.rand(60, 155), vy: -Math.sin(angle) * this.rand(60, 155) + this.rand(-45, 45), life, maxLife: life, r: this.rand(13, 30), color: '#b7d96b', gas: true });
      }
      const speed = p.boosting ? 460 : 250;
      p.vx += (mx * speed - p.vx) * Math.min(1, dt * 8); p.vy += (my * speed - p.vy) * Math.min(1, dt * 8);
      p.x = clamp(p.x + p.vx * dt, 45, this.w - 65); p.y = clamp(p.y + p.vy * dt, this.h * .29, this.h * .87);
      p.angle += (clamp(p.vy / 700, -.45, .45) - p.angle) * dt * 6;
      if (input.fire && this.shotTimer <= 0 && p.gas >= .8) { this.fire(input); this.shotTimer = .18; }
      if (input.throw && this.throwTimer <= 0) { this.throwTNT(input); this.throwTimer = .65; }
      if (p.gas < 15 && !this.lowGasWarned) { this.lowGasWarned = true; this.emit('toast', { text: 'Running on fumes! Press B for a FREE bean refill.' }); }
      if (this.mode === 'flight') {
        this.progress += dt * (p.boosting ? .042 : .018);
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { if (this.enemies.length < 7) this.spawnEnemy(); this.spawnTimer = this.rand(3, 5) - this.stage * .35; }
        if (this.stage === 3) {
          this.flareTimer -= dt; if (this.flareTimer <= 0) { const y = this.rand(this.h * .31, this.h * .83); for (let i = 0; i < 5; i++) this.enemyShot(this.w + i * 42, y + Math.sin(i) * 40, Math.PI, 270, 'solar', 16); this.flareTimer = 4; }
        }
        if (this.progress >= 1) { this.startBoss(); if (!this.active) return; }
      }
      if (this.mode === 'boss') this.tickBoss(dt);
      if (!this.active) return;
      this.pickupTimer -= dt;
      if (this.pickupTimer <= 0) {
        if (this.pickups.filter(e => e.kind === 'tnt').length < 4) this.spawnPickup('tnt');
        if (this.random() > .6) this.spawnPickup('heart');
        if (this.mode === 'flight') this.spawnPickup('coin');
        this.pickupTimer = this.mode === 'boss' ? 3.2 : 5;
      }
      for (const e of this.enemies) {
        e.age += dt; e.stun = Math.max(0, e.stun - dt);
        if (e.stun <= 0) {
          if (e.kind === 'baby') { const a = Math.atan2(p.y - e.y, p.x - e.x); e.x += Math.cos(a) * 135 * dt; e.y += Math.sin(a) * 135 * dt; }
          else { e.x += e.vx * dt; e.y += Math.sin(e.age * 2) * 30 * dt; e.timer -= dt;
            if (e.timer <= 0 && e.x < this.w - 60) { this.enemyShot(e.x - 20, e.y, Math.atan2(p.y - e.y, p.x - e.x), 190 + this.stage * 20); e.timer = 2.5; }
          }
          if (distance(p, e) < e.r + 25) this.damagePlayer(10);
        }
      }
      this.tickShots(dt);
      if (!this.active) return;
      for (const e of this.enemies) if (e.hp <= 0) { this.credits += e.kind === 'baby' ? 10 : 18; this.stats.defeated++; this.burst(e.x, e.y, '#ffaf7b', 16); this.float(`+${e.kind === 'baby' ? 10 : 18} ✧`, e.x, e.y); this.emit('enemy-down'); }
      this.enemies = this.enemies.filter(e => e.hp > 0 && e.x > -100);
      for (const item of this.pickups) {
        item.age += dt; item.life -= dt;
        if (distance(p, item) < item.r + 41) {
          if (item.kind === 'tnt' && p.tnt >= 5) continue;
          if (item.kind === 'tnt') { p.tnt++; this.float('+1 TNT', item.x, item.y, '#ffaf7b'); }
          if (item.kind === 'coin') { this.credits += 25; this.float('+25 ✧', item.x, item.y); }
          if (item.kind === 'heart') { p.hp = Math.min(this.maxHP, p.hp + 20); this.float('+20 HEALTH', item.x, item.y, '#b6a1ed'); }
          item.life = 0; this.emit('pickup'); this.burst(item.x, item.y, '#c5ef70', 6);
        }
      }
      this.pickups = this.pickups.filter(p => p.life > 0);
    }
    tickShots(dt) {
      for (const s of this.shots) {
        if (s.dead) continue;
        s.life -= dt;
        if (s.kind === 'tnt' && s.target) {
          let target = s.target;
          if (target.ref && this.boss) target = this.satelliteTargets().find(t => t.ref === target.ref) || target;
          const a = Math.atan2(target.y - s.y, target.x - s.x); s.vx += (Math.cos(a) * 560 - s.vx) * dt * 5; s.vy += (Math.sin(a) * 560 - s.vy) * dt * 5;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.owner === 'enemy') { if (distance(s, this.player) < s.r + 24) { this.damagePlayer(s.damage); s.dead = true; } }
        else {
          for (const e of this.enemies) if (!s.dead && e.hp > 0 && distance(e, s) < e.r + s.r) { e.hp -= s.damage; s.dead = true; this.burst(s.x, s.y, s.kind === 'tnt' ? '#ffaf7b' : '#c5ef70', s.kind === 'tnt' ? 25 : 6); if (s.kind === 'tnt') this.emit('explosion'); }
          if (!s.dead && this.boss?.kind === 3) for (const t of this.satelliteTargets()) if (t.ref.hp > 0 && distance(s, t) < 30 + s.r) {
            s.dead = true; if (s.kind === 'tnt') { t.ref.hp = 0; this.burst(t.x, t.y, '#b6a1ed', 25); this.emit('explosion'); if (this.boss.satellites.every(sat => sat.hp <= 0)) { this.boss.exposed = 0; this.emit('toast', { text: 'SHIELD DOWN! Shoot the glowing core with J / click!' }); } }
            else this.float('USE TNT', t.x, t.y, '#b6a1ed');
          }
          // A guided charge can reach a shield node on the far side of the core.
          const seekingShield = s.kind === 'tnt' && s.target?.ref?.hp > 0;
          if (!s.dead && !seekingShield && this.boss && distance(s, this.boss) < this.boss.radius + s.r) { s.dead = true; this.hitBoss(s.damage, s.kind); if (!this.active) return; }
        }
      }
      this.shots = this.shots.filter(s => !s.dead && s.life > 0 && s.x > -150 && s.x < this.w + 200 && s.y > -100 && s.y < this.h + 100);
    }
    tickEffects(dt) {
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.5; if (p.gas) p.r += dt * 21; }
      this.particles = this.particles.filter(p => p.life > 0).slice(-550);
      for (const f of this.floaters) { f.life -= dt; f.y -= dt * 35; }
      this.floaters = this.floaters.filter(f => f.life > 0);
      for (const r of this.rings) { r.life -= dt; r.r += dt * (r.maxR - 22) / r.maxLife; }
      this.rings = this.rings.filter(r => r.life > 0);
    }
  }
  const api = { SpaceGame, PLANETS, UPGRADE_INFO, clamp, distance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window === 'undefined' ? globalThis : window);
