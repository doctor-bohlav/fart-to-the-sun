const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SpaceGame, distance } = require('../game.js');

function create() { let seed = 42; return new SpaceGame({ random: () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; } }); }
function step(game, seconds, input = {}) { for (let t = 0; t < seconds; t += 1 / 60) game.tick(1 / 60, input); }
function bossGame(stage = 0) { const game = create(); game.start(); game.stage = stage; game.launch(); game.startBoss(); return game; }

test('free beans refill an empty belly repeatedly without spending credits', () => {
  const g = create(); g.start(); g.player.gas = 0; const credits = g.credits;
  assert.equal(g.buyBeans(), true); assert.equal(g.player.gas, g.maxGas); assert.equal(g.credits, credits);
  g.launch(); g.player.gas = 2; g.openShop(); g.buyBeans(); g.closeShop();
  assert.equal(g.player.gas, g.maxGas); assert.equal(g.mode, 'flight'); assert.equal(g.credits, credits);
});

test('boost spends gas, generates farts, and advances the route faster', () => {
  const normal = create(), boost = create(); for (const g of [normal, boost]) { g.start(); g.launch(); }
  step(normal, 2); step(boost, 2, { fart: true, up: true });
  assert.ok(boost.progress > normal.progress * 2); assert.ok(boost.player.gas < 80); assert.ok(boost.stats.farts >= 3);
  assert.ok(boost.particles.some(p => p.gas));
});

test('zero gas never soft-locks movement or free delivery', () => {
  const g = create(); g.start(); g.launch(); g.player.gas = 0; const x = g.player.x;
  step(g, .5, { right: true, fart: true, fire: true });
  assert.ok(g.player.x > x); assert.equal(g.player.gas, 0); assert.equal(g.shots.filter(s => s.owner === 'player').length, 0);
  assert.equal(g.openShop(), true); g.buyBeans(); g.closeShop(); assert.ok(g.active);
});

test('shop and pause freeze combat, timers and route progress', () => {
  const g = bossGame(); g.openShop(); const hp = g.player.hp, age = g.boss.age, x = g.player.x;
  step(g, 5, { right: true, fire: true }); assert.equal(g.boss.age, age); assert.equal(g.player.x, x); assert.equal(g.player.hp, hp);
  g.closeShop(); assert.equal(g.mode, 'boss'); g.pause(); step(g, 4); assert.equal(g.boss.age, age); g.resume(); assert.equal(g.mode, 'boss');
});

test('upgrades require credits and a planet, enforce caps and apply bonuses', () => {
  const g = create(); g.start(); assert.ok(g.buyUpgrade('suit')); assert.equal(g.maxHP, 135); assert.equal(g.player.hp, 135); assert.equal(g.credits, 35);
  assert.equal(g.buyUpgrade('blaster'), false); g.credits = 2000;
  for (let i = 0; i < 3; i++) assert.ok(g.buyUpgrade('tank'));
  assert.equal(g.maxGas, 220); assert.equal(g.buyUpgrade('tank'), false);
  g.launch(); g.openShop(); assert.equal(g.buyUpgrade('blaster'), false); assert.equal(g.buyUpgrade('unknown'), false);
});

test('Space Serpent has 1000 HP, ignores shots and takes TNT damage', () => {
  const g = bossGame(); assert.equal(g.boss.hp, 1000);
  assert.equal(g.hitBoss(100, 'pea'), false); assert.equal(g.boss.hp, 1000);
  g.hitBoss(250, 'tnt'); assert.equal(g.boss.hp, 750);
  g.hitBoss(250, 'tnt'); g.hitBoss(250, 'tnt'); g.hitBoss(250, 'tnt');
  assert.equal(g.stage, 1); assert.equal(g.mode, 'dock'); assert.equal(g.stats.bosses, 1); assert.equal(g.player.hp, g.maxHP);
});

test('farts stun the serpent and clear nearby hostile shots', () => {
  const g = bossGame(); g.player.x = g.boss.x - 180; g.player.y = g.boss.y;
  g.enemyShot(g.player.x + 40, g.player.y, Math.PI); g.fart();
  assert.ok(g.boss.stun > 1); assert.equal(g.boss.hp, 1000); assert.ok(g.shots.every(s => s.dead));
  const oldX = g.boss.x; step(g, .5); assert.equal(g.boss.x, oldX);
});

test('floating TNT is collected, capped at five, then physically hits the serpent', () => {
  const g = bossGame(); g.pickups = []; g.spawnPickup('tnt', g.player.x, g.player.y); g.tick(1 / 60);
  assert.equal(g.player.tnt, 1); assert.ok(g.throwTNT()); step(g, 2.5); assert.equal(g.boss.hp, 750);
  g.player.tnt = 5; g.spawnPickup('tnt', g.player.x, g.player.y); g.tick(1 / 60); assert.equal(g.player.tnt, 5);
});

test('Space Wasp progresses through sting, laser and baby-wasp phases', () => {
  const g = bossGame(1); const b = g.boss; b.timer = 0; g.tick(1 / 60); assert.equal(b.attack, 'windup');
  b.hp = 800; b.timer = 0; g.tick(1 / 60); assert.equal(b.phase, 2); b.timer = 0; g.tick(1 / 60); assert.equal(b.attack, 'laser-warn');
  b.timer = 0; g.tick(1 / 60); assert.equal(b.attack, 'laser');
  b.hp = 400; g.tick(1 / 60); assert.equal(b.phase, 3); b.timer = 0; g.tick(1 / 60); assert.equal(g.enemies.filter(e => e.kind === 'baby').length, 3);
});

test('telegraphed laser locks direction and damages only players in its beam', () => {
  const g = bossGame(1), b = g.boss;
  b.hp = 700; g.tick(1 / 60); b.attack = 'laser'; b.angle = Math.PI; b.timer = .5;
  g.player.x = b.x - 300; g.player.y = b.y + 100; g.player.invincible = 0; g.tick(1 / 60); assert.equal(g.player.hp, 100);
  g.player.y = b.y; g.tick(1 / 60); assert.equal(g.player.hp, 82);
});

test('Gravity Golem shields block damage; homing TNT reaches every orbiting node', () => {
  const g = bossGame(2); assert.equal(g.hitBoss(250, 'tnt'), false);
  g.player.x = 330; g.player.y = g.boss.y; g.player.tnt = 5;
  // Throw from one side, including at a node whose flight path crosses the core.
  for (let i = 0; i < 3; i++) { g.throwTNT(); step(g, 2); }
  assert.ok(g.boss.satellites.every(s => s.hp === 0));
  assert.equal(g.hitBoss(200, 'pea'), true); assert.equal(g.boss.hp, 1200);
  g.boss.exposed = 10.99; g.tick(.04); assert.ok(g.boss.satellites.every(s => s.hp > 0));
});

test('injury has a grace period, death stops combat, and checkpoint restores safely', () => {
  const g = create(); g.start(); const save = g.checkpoint(); g.launch(); g.player.invincible = 0;
  g.damagePlayer(30); g.damagePlayer(30); assert.equal(g.player.hp, 70);
  g.player.invincible = 0; g.damagePlayer(100); assert.equal(g.mode, 'dead');
  assert.equal(g.restore(save), true); assert.equal(g.mode, 'dock'); assert.equal(g.player.hp, g.maxHP);
  assert.equal(g.restore({ ...save, stage: 99 }), false); assert.equal(g.restore({ ...save, upgrades: { ...save.upgrades, tank: -1 } }), false); assert.equal(g.restore({ ...save, gas: NaN }), false);
});

test('normal fart shots defeat space enemies and earn upgrade credits', () => {
  const g = create(); g.start(); g.launch(); g.spawnEnemy(); const enemy=g.enemies[0];enemy.x=g.player.x+150;enemy.y=g.player.y;
  const credits=g.credits; step(g,1,{fire:true});assert.equal(g.stats.defeated,1);assert.equal(g.credits,credits+18);
});

test('complete route lands at every planet and wins only upon reaching the Sun', () => {
  const g = create(); g.start();
  for (let stage = 0; stage < 3; stage++) {
    assert.equal(g.stage, stage); assert.equal(g.mode, 'dock'); g.buyBeans(); g.launch();
    g.progress = .9999; g.tick(1 / 60, { fart: true }); assert.equal(g.mode, 'boss');
    if (stage === 2) g.boss.satellites.forEach(s => s.hp = 0);
    while (g.boss) g.hitBoss(250, 'tnt');
    const restored = create(); assert.equal(restored.restore(g.checkpoint()), true); assert.equal(restored.stage, stage + 1);
  }
  assert.equal(g.stats.bosses, 3); assert.notEqual(g.mode, 'won'); g.buyBeans(); g.launch();
  g.progress = .9999; g.tick(1 / 60, { fart: true }); assert.equal(g.mode, 'won'); assert.equal(g.target.name, 'The Sun');
});

test('a pilot can win through ordinary controls, pickups and purchases without changing game state', () => {
  let seed = 72;
  const g = new SpaceGame({ random: () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; } });
  g.start();
  for (let frame = 0; frame < 60 * 240 && g.mode !== 'won' && g.mode !== 'dead'; frame++) {
    if (g.mode === 'dock') {
      g.buyBeans(); for (const type of ['suit', 'blaster', 'tank']) g.buyUpgrade(type); g.launch();
    }
    if (g.player.gas < 20) { g.openShop(); g.buyBeans(); g.closeShop(); }
    const p = g.player, b = g.boss;
    let target = { x: 330, y: g.h * .57 + Math.sin(g.stats.time * .7) * 170 };
    const pickup = g.pickups.filter(t => (t.kind === 'heart' && p.hp < g.maxHP - 15) || (t.kind === 'tnt' && p.tnt < 5)).sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (pickup) target = pickup;
    let mx = target.x - p.x, my = target.y - p.y;
    for (const shot of g.shots) if (shot.owner === 'enemy' && distance(p, shot) < 140) { mx += (p.x - shot.x) * 3; my += (p.y - shot.y) * 3; }
    if (b && distance(p, b) < 210) { mx -= 300; my += p.y > b.y ? 200 : -200; }
    g.tick(1 / 60, { left: mx < -14, right: mx > 14, up: my < -14, down: my > 14, fart: !pickup && g.mode === 'flight', fire: !b || b.kind !== 1, throw: !!b && p.tnt > 0 });
  }
  assert.equal(g.mode, 'won'); assert.equal(g.stats.bosses, 3); assert.ok(g.player.hp > 0);
  assert.ok(g.stats.defeated > 0); assert.ok(g.stats.beans > 3); assert.ok(g.stats.farts > 50);
});
