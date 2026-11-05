import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const BRAVE_BIN = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const PORT = 9223;
const TARGET_URL = 'http://localhost:8085/';

console.log('[Test] Launching Brave in headless mode on port', PORT);
const brave = spawn(BRAVE_BIN, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--no-sandbox',
  TARGET_URL
]);

brave.stderr.on('data', () => {});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCDPVersion() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    await sleep(300);
  }
  throw new Error('CDP failed to become ready');
}

async function getCDPTargets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return await res.json();
}

async function run() {
  try {
    const version = await getCDPVersion();
    console.log('[Test] Connected to browser:', version.Browser);

    const targets = await getCDPTargets();
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const wsUrl = pageTarget.webSocketDebuggerUrl;
    const ws = new (await import('ws')).default(wsUrl);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (data) => {
          const msg = JSON.parse(data);
          if (msg.id === id) {
            ws.off('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('[Test] Waiting 3 seconds for lobby initialization...');
    await sleep(3000);

    // Evaluate game globals
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        ({
          state: typeof g_state !== 'undefined' ? g_state : null,
          maxBullets: typeof MAX_AMMO_BULLETS !== 'undefined' ? MAX_AMMO_BULLETS : null,
          maxShells: typeof MAX_AMMO_SHELLS !== 'undefined' ? MAX_AMMO_SHELLS : null,
          maxRifle: typeof MAX_AMMO_RIFLE !== 'undefined' ? MAX_AMMO_RIFLE : null,
          savedEq: typeof g_savedEquipment !== 'undefined' && g_savedEquipment ? g_savedEquipment : null,
        })
      `,
      returnByValue: true
    });

    console.log('[Test] Lobby Evaluation:', JSON.stringify(evalRes.result.value, null, 2));

    // Simulate clicking to start game
    console.log('[Test] Dispatching click to enter gameplay...');
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 400,
      y: 300,
      button: 'left',
      clickCount: 1
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 400,
      y: 300,
      button: 'left',
      clickCount: 1
    });

    // Transition from Title/Lobby into Level 1 Gameplay
    console.log('[Test] Transitioning to Level 1 Gameplay...');
    await send('Runtime.evaluate', {
      expression: `
        startNewGame();
        enterLobbyState();
        startNextLevel();
        changeState(STATE_PLAYING);
      `
    });

    await sleep(2000);

    // Inspect player ammo in live gameplay
    const playRes = await send('Runtime.evaluate', {
      expression: `
        ({
          state: g_state,
          playerExists: Boolean(g_player),
          hp: g_player ? g_player.hp : null,
          bullets: g_player ? g_player.ammoBullets : null,
          shells: g_player ? g_player.ammoShells : null,
          rifle: g_player ? g_player.ammoRifle : null,
          gunAmmo: g_player && g_player.gun ? g_player.gun.ammo : null,
          totalAmmo: g_player ? g_player.getAmmoForCurrentGun() : null
        })
      `,
      returnByValue: true
    });

    console.log('[Test] Gameplay Player State:', JSON.stringify(playRes.result.value, null, 2));

    // Capture screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch-gameplay-phase6.png', Buffer.from(screenshot.data, 'base64'));
    console.log('[Test] Screenshot saved to scratch-gameplay-phase6.png');

    // Assertions
    const p = playRes.result.value;
    if (p.bullets !== 12) throw new Error('Expected 12 reserve bullets, got: ' + p.bullets);
    if (p.totalAmmo !== 18) throw new Error('Expected 18 total starting ammo, got: ' + p.totalAmmo);
    if (p.hp !== 3) throw new Error('Expected 3 base hearts, got: ' + p.hp);

    console.log('[Test] SUCCESS: All in-browser checks passed cleanly!');

    ws.close();
  } catch (err) {
    console.error('[Test] FAILED:', err);
    process.exitCode = 1;
  } finally {
    brave.kill('SIGKILL');
  }
}

run();
