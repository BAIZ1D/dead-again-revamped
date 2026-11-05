import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { setupIRC, sanitizeChannelName, disconnectIRC, parseChatMessage, sendChatMessage } from './twitchIRC.js';
import { setupHelix, stopHelix } from './twitchHelix.js';
import { cooldownManager } from './cooldownManager.js';
import { botSwarm, GOOD_ACTIONS } from './botSwarm.js';
import { predictionManager } from './predictionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeConfigPath = process.env.APG_CONFIG_PATH
  ? path.resolve(process.env.APG_CONFIG_PATH)
  : path.resolve(__dirname, '../config.json');

export function getActiveConfigPath() {
  return activeConfigPath;
}

const defaultConfig = {
  channel: '',
  port: 8080,
  predictionDurationSec: 60,
  twitchClientId: '',
  twitchClientSecret: '',
  twitchAccessToken: '',
  isMock: false,
  rateLimits: {
    baseCooldownMs: 3000,
    bossCooldownMs: 8000,
    userThrottleMs: 2000
  }
};

function loadConfig() {
  try {
    if (fs.existsSync(activeConfigPath)) {
      const raw = fs.readFileSync(activeConfigPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...defaultConfig,
        ...parsed,
        rateLimits: {
          ...defaultConfig.rateLimits,
          ...(parsed.rateLimits || {})
        }
      };
    }
  } catch (err) {
    console.warn(`[Config] Failed to parse config at ${activeConfigPath}:`, err.message);
    try {
      const backupPath = `${activeConfigPath}.bak`;
      if (fs.existsSync(activeConfigPath)) {
        fs.renameSync(activeConfigPath, backupPath);
        console.warn(`[Config] Corrupt config file backed up to ${backupPath}. Re-seeding fresh defaults.`);
      }
    } catch (bakErr) {
      console.error(`[Config] Failed to backup corrupt config file:`, bakErr.message);
    }
  }

  // Auto-seed defaults if missing or corrupted
  try {
    fs.mkdirSync(path.dirname(activeConfigPath), { recursive: true });
    fs.writeFileSync(activeConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
  } catch (writeErr) {
    console.error(`[Config] Failed to seed default config at ${activeConfigPath}:`, writeErr.message);
  }
  return { ...defaultConfig };
}

function saveConfig(newConfig) {
  try {
    fs.mkdirSync(path.dirname(activeConfigPath), { recursive: true });
    const tempPath = `${activeConfigPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(newConfig, null, 2), 'utf8');
    fs.renameSync(tempPath, activeConfigPath);
  } catch (err) {
    console.error(`[Config] Failed to persist config to ${activeConfigPath}:`, err.message);
  }
}

let config = loadConfig();
cooldownManager.updateConfig(config.rateLimits);
predictionManager.setDuration(config.predictionDurationSec || 60);

let currentChannel = sanitizeChannelName(config.channel);
let activeViewerCount = 0;
let ircConnected = false;
let isMock = Boolean(config.isMock);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const gameDistPath = path.resolve(__dirname, '../../main/dist');
const dashboardPath = path.resolve(__dirname, '../public');

// Serve dashboard static assets at /dashboard
app.use('/dashboard', express.static(dashboardPath));
app.get('/dashboard', (req, res) => {
  const indexFile = path.join(dashboardPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(200).send('<!DOCTYPE html><html><body><h1>APG Streamer Dashboard</h1></body></html>');
  }
});

// Serve compiled game client static directory at root /
app.use(express.static(gameDistPath));

export function getStatusPayload() {
  const swarmStatus = botSwarm.getStatus();
  const effectiveMock = isMock || swarmStatus.running || currentChannel === 'mock';
  const effectiveViewers = swarmStatus.running
    ? Math.max(activeViewerCount, swarmStatus.activeBots)
    : activeViewerCount;

  return {
    type: 'STATUS',
    connected: true,
    ircConnected,
    channel: currentChannel || '',
    viewers: effectiveViewers,
    mode: effectiveMock ? 'mock' : currentChannel ? 'live' : 'idle',
    hasHelixAuth: Boolean(config.twitchClientId && config.twitchAccessToken),
    swarm: swarmStatus,
    predictionDurationSec: predictionManager.durationSeconds,
    prediction: predictionManager.getStatePayload(),
    chargeState: cooldownManager.getChargeState(effectiveViewers, swarmStatus.running ? swarmStatus.preset : null),
    levelTallies: { ...cooldownManager.levelTallies },
    timestamp: Date.now()
  };
}

export function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Wire PredictionManager callbacks
predictionManager.onStateCallback = (statePayload) => {
  broadcast(statePayload);
};

predictionManager.onLockedCallback = (lockedPayload) => {
  broadcast(lockedPayload);
  broadcast({
    type: 'LOG',
    level: 'system',
    text: `[PREDICTION LOCKED] Level ${lockedPayload.level}: ${lockedPayload.goodPct}% GOOD (${lockedPayload.goodCount}) vs ${lockedPayload.badPct}% BAD (${lockedPayload.badCount})`,
    timestamp: Date.now()
  });
};

predictionManager.onPhaseChangeCallback = (newPhase) => {
  botSwarm.setPhase(newPhase);
  if (newPhase === 'LOBBY') {
    cooldownManager.resetCharges();
  }
  broadcast(getStatusPayload());
};

predictionManager.onOutcomeResolvedCallback = (outcomeResult) => {
  broadcast(outcomeResult);
  broadcast(getStatusPayload());
};

export function formatChatAnnouncement(outcomeResult) {
  const level = outcomeResult.level || 1;
  const winner = outcomeResult.winner;
  const match = outcomeResult.matchOutcome || {};
  if (winner === 'refund') {
    const reasonText = outcomeResult.refundReason === 'pacifist_zero_actions'
      ? 'PACIFIST RUN / ZERO ACTIONS'
      : outcomeResult.refundReason === 'threshold_early_death'
      ? 'EARLY DEATH SAFEGUARD (<3 ACTIONS)'
      : outcomeResult.refundReason === 'exact_ratio_tie'
      ? 'EXACT RATIO TIE'
      : 'PUSH / REFUND';
    return `[DEAD AGAIN] ⚖ Level ${level} Outcome: ${reasonText}! All Channel Points refunded to viewers.`;
  }
  const teamText = winner === 'good' ? 'TEAM GOOD WON!' : 'TEAM BAD DESTROYED STREAMER!';
  const karmaText = `${match.finalGoodPct ?? 50}% Good vs ${match.targetGoodPct ?? 50}% Target`;
  const mvpGood = match.mvpGood && match.mvpGood.user ? ` | 😇 MVP: @${match.mvpGood.user} (${match.mvpGood.score || 0} pts)` : '';
  const mvpBad = match.mvpBad && match.mvpBad.user ? ` | 😈 Traitor: @${match.mvpBad.user} (${match.mvpBad.score || 0} pts)` : '';
  return `[DEAD AGAIN] 🏆 Level ${level} Outcome: ${teamText} (${karmaText}) | Payout ${outcomeResult.multiplierText} |${mvpGood}${mvpBad}`;
}

export async function handleMatchOutcome(payload = {}) {
  const outcomeResult = await predictionManager.resolvePrediction(payload.winner, payload);
  broadcast(outcomeResult);
  broadcast(getStatusPayload());

  const announcement = formatChatAnnouncement(outcomeResult);
  if (currentChannel) {
    try {
      await sendChatMessage(currentChannel, announcement);
    } catch (err) {
      console.warn('[IRC] Failed to post match outcome announcement:', err.message);
    }
  }

  const swarmStatus = botSwarm.getStatus();
  const effectiveMock = isMock || swarmStatus.running || currentChannel === 'mock';
  if (effectiveMock || !config.twitchClientId || !config.twitchAccessToken) {
    broadcast({
      type: 'LOG',
      level: 'info',
      text: `[MOCK PAYOUT] Distributed Channel Points at ${outcomeResult.multiplierText} return to winning predictors.`,
      timestamp: Date.now()
    });
  }

  botSwarm.emitPostMatchChatter(outcomeResult.winner, (botMsg) => {
    broadcast({
      type: 'LOG',
      level: 'info',
      user: botMsg.user,
      text: botMsg.text,
      source: 'swarm',
      timestamp: botMsg.timestamp
    });
  });

  return outcomeResult;
}

function handleActionEvent(eventData, options = {}) {
  const action = String(eventData.action || '').toLowerCase();
  if (!action) return { allowed: false, reason: 'missing_action' };

  const team =
    eventData.team || (GOOD_ACTIONS.includes(action) ? 'good' : 'bad');
  const user = eventData.user || 'Anonymous';
  const source = eventData.source || 'irc';
  const timestamp = eventData.timestamp || Date.now();

  const swarmStatus = botSwarm.getStatus();
  const effectiveViewers = swarmStatus.running
    ? Math.max(activeViewerCount, swarmStatus.activeBots)
    : activeViewerCount;

  const bypassCooldown = Boolean(options.bypassCooldown);
  const swarmPreset = eventData.swarmPreset || (swarmStatus.running ? swarmStatus.preset : null);

  const check = cooldownManager.checkAction(user, action, effectiveViewers, {
    bypassCooldown,
    swarmPreset,
    team
  });

  if (check.chargePacket) {
    broadcast(check.chargePacket);
  }

  if (!check.allowed) {
    if (check.reason === 'charging') {
      broadcast({
        type: 'LOG',
        level: 'info',
        text: `@${check.user} charged !${action} (${check.current}/${check.required})`,
        action,
        team,
        user: check.user,
        current: check.current,
        required: check.required,
        source,
        timestamp
      });
    }
    return check;
  }

  const finalUser = check.user || user;
  const contributors = check.contributors || [finalUser];

  const actionPacket = {
    type: 'ACTION',
    action,
    team,
    user: finalUser,
    contributors,
    current: check.current || 1,
    required: check.required || 1,
    levelTallies: { ...cooldownManager.levelTallies },
    source,
    timestamp
  };

  broadcast(actionPacket);
  broadcast({
    type: 'LOG',
    level: 'info',
    text: `@${finalUser} triggered ${action.toUpperCase()} (${team})`,
    action,
    team,
    user: finalUser,
    contributors,
    source,
    timestamp
  });

  return { allowed: true, packet: actionPacket, ...check };
}

function handleVoteEvent(eventData) {
  const team = String(eventData.team || 'good').toLowerCase() === 'bad' ? 'bad' : 'good';
  const user = eventData.user || 'Anonymous';
  const source = eventData.source || 'irc';
  const timestamp = eventData.timestamp || Date.now();

  const res = predictionManager.registerVote({
    user,
    team,
    source,
    timestamp
  });

  if (!res.accepted) {
    return { accepted: false, reason: res.reason };
  }

  const votePacket = {
    type: 'VOTE',
    team: res.team,
    user: res.user,
    switched: res.switched,
    source,
    timestamp
  };

  broadcast(votePacket);
  broadcast({
    type: 'LOG',
    level: 'info',
    text: res.switched
      ? `@${res.user} switched vote to Team ${res.team.toUpperCase()}`
      : `@${res.user} voted Team ${res.team.toUpperCase()}`,
    team: res.team,
    user: res.user,
    switched: res.switched,
    source,
    timestamp
  });

  return { accepted: true, packet: votePacket };
}

// Configure BotSwarm callbacks
botSwarm.onActionCallback = (payload) => handleActionEvent(payload);
botSwarm.onVoteCallback = (payload) => handleVoteEvent(payload);

function connectTwitchBridges() {
  currentChannel = sanitizeChannelName(config.channel);
  isMock = Boolean(config.isMock) || currentChannel === 'mock';

  setupIRC(
    currentChannel,
    (actionPayload) => handleActionEvent(actionPayload),
    (votePayload) => handleVoteEvent(votePayload),
    (statusUpdate) => {
      ircConnected = Boolean(statusUpdate.connected);
      broadcast(getStatusPayload());
    }
  );

  setupHelix(config, (viewerCount) => {
    activeViewerCount = viewerCount;
    broadcast(getStatusPayload());
  });
}

// WebSocket Connection & Heartbeat Management
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Immediately send current STATUS and PREDICTION_STATE packets
  ws.send(JSON.stringify(getStatusPayload()));
  ws.send(JSON.stringify(predictionManager.getStatePayload()));
  if (predictionManager.status === 'LOCKED' && predictionManager.lockedResult) {
    ws.send(JSON.stringify(predictionManager.lockedResult));
  }
  if (predictionManager.status === 'RESOLVED' && predictionManager.outcomeResult) {
    ws.send(JSON.stringify(predictionManager.outcomeResult));
  }

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      } else if (msg.type === 'START_PREDICTION') {
        predictionManager.startPrediction({
          level: msg.level || 1,
          durationSeconds: msg.duration || config.predictionDurationSec || 60
        });
      } else if (msg.type === 'LOCK_PREDICTION') {
        predictionManager.lockPrediction('streamer_skip');
      } else if (msg.type === 'MATCH_OUTCOME') {
        await handleMatchOutcome(msg);
      } else if (msg.type === 'RESET_LEVEL') {
        await predictionManager.cancelActivePrediction('reset_level');
        cooldownManager.resetCharges();
        broadcast(getStatusPayload());
      } else if (msg.type === 'ACTION') {
        handleActionEvent(msg, { bypassCooldown: msg.source === 'manual' });
      } else if (msg.type === 'VOTE') {
        handleVoteEvent(msg);
      }
    } catch {
      // Ignore malformed messages
    }
  });
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// REST API Endpoints
app.get('/api/status', (req, res) => {
  res.json(getStatusPayload());
});

app.get('/api/config', (req, res) => {
  res.json({
    channel: config.channel || '',
    port: config.port || 8080,
    predictionDurationSec: config.predictionDurationSec || 60,
    twitchClientId: config.twitchClientId || '',
    hasAccessToken: Boolean(config.twitchAccessToken),
    isMock: Boolean(config.isMock),
    rateLimits: config.rateLimits,
    status: getStatusPayload()
  });
});

app.post('/api/config', (req, res) => {
  const {
    channel,
    twitchClientId,
    twitchClientSecret,
    twitchAccessToken,
    predictionDurationSec,
    isMock: reqMock
  } = req.body || {};

  if (typeof channel === 'string') {
    config.channel = sanitizeChannelName(channel);
  }
  if (typeof twitchClientId === 'string') {
    config.twitchClientId = twitchClientId.trim();
  }
  if (typeof twitchClientSecret === 'string') {
    config.twitchClientSecret = twitchClientSecret.trim();
  }
  if (typeof twitchAccessToken === 'string') {
    config.twitchAccessToken = twitchAccessToken.trim();
  }
  if (predictionDurationSec !== undefined) {
    config.predictionDurationSec = predictionManager.setDuration(predictionDurationSec);
  }
  if (typeof reqMock === 'boolean') {
    config.isMock = reqMock;
  }

  saveConfig(config);
  connectTwitchBridges();

  const status = getStatusPayload();
  broadcast(status);

  res.json({
    ok: true,
    channel: config.channel,
    status
  });
});

app.post('/api/prediction/start', async (req, res) => {
  const { level, duration } = req.body || {};
  const state = await predictionManager.startPrediction({
    level: level || predictionManager.level || 1,
    durationSeconds: duration || config.predictionDurationSec || 60
  });
  res.json({ ok: true, prediction: state });
});

app.post('/api/prediction/lock', async (req, res) => {
  const locked = await predictionManager.lockPrediction('dashboard');
  res.json({ ok: true, prediction: locked });
});

app.post('/api/prediction/resolve', async (req, res) => {
  const { winner = 'good' } = req.body || {};
  const cleanWinner = String(winner).toLowerCase() === 'bad' ? 'bad' : 'good';
  const outcomeResult = await handleMatchOutcome({
    winner: cleanWinner,
    state: 3,
    force: true,
    finalGoodPct: cleanWinner === 'good' ? 70 : 30,
    targetGoodPct: 50,
    goodActions: cleanWinner === 'good' ? 10 : 3,
    badActions: cleanWinner === 'good' ? 3 : 10
  });
  res.json({ ok: true, result: outcomeResult });
});

app.post('/api/prediction/refund', async (req, res) => {
  const outcomeResult = await handleMatchOutcome({
    winner: 'refund',
    force: true,
    reason: 'manual_override_refund',
    goodActions: 0,
    badActions: 0
  });
  res.json({ ok: true, result: outcomeResult });
});

app.post('/api/prediction/config', (req, res) => {
  const { duration } = req.body || {};
  const updated = predictionManager.setDuration(duration || 60);
  config.predictionDurationSec = updated;
  saveConfig(config);
  const state = predictionManager.getStatePayload();
  broadcast(state);
  broadcast(getStatusPayload());
  res.json({
    ok: true,
    predictionDurationSec: updated,
    prediction: state
  });
});

app.post('/api/trigger', (req, res) => {
  const {
    action,
    team,
    user = 'StreamerDev',
    type = 'ACTION',
    rawChat,
    bypassCooldown = true
  } = req.body || {};

  if (rawChat && typeof rawChat === 'string') {
    const parsed = parseChatMessage(rawChat, user);
    if (!parsed) {
      return res.json({ ok: false, reason: 'unrecognized_chat_command' });
    }
    if (parsed.type === 'VOTE') {
      const voteRes = handleVoteEvent({ ...parsed, source: 'mock' });
      return res.json({ ok: Boolean(voteRes.accepted), ...voteRes });
    }
    const actRes = handleActionEvent(
      { ...parsed, source: 'mock' },
      { bypassCooldown: Boolean(req.body.bypassCooldown) }
    );
    return res.json({ ok: Boolean(actRes.allowed), ...actRes });
  }

  if (String(type).toUpperCase() === 'VOTE' || action === 'vote_good' || action === 'vote_bad') {
    const voteTeam = action === 'vote_bad' ? 'bad' : (team || 'good');
    const voteRes = handleVoteEvent({
      team: voteTeam,
      user,
      source: 'mock',
      timestamp: Date.now()
    });
    return res.json({ ok: Boolean(voteRes.accepted), ...voteRes });
  }

  const result = handleActionEvent(
    {
      action,
      team,
      user,
      source: 'mock',
      timestamp: Date.now()
    },
    { bypassCooldown: Boolean(bypassCooldown) }
  );

  res.json({ ok: result.allowed, ...result });
});

app.post('/api/swarm/start', (req, res) => {
  const { preset = 'class', rate = 2 } = req.body || {};
  botSwarm.setPhase(predictionManager.status === 'LOBBY' ? 'LOBBY' : 'PLAYING');
  const swarmStatus = botSwarm.start(
    preset,
    rate,
    (actionPayload) => handleActionEvent(actionPayload),
    (votePayload) => handleVoteEvent(votePayload)
  );
  isMock = true;
  const status = getStatusPayload();
  broadcast(status);
  broadcast({
    type: 'LOG',
    level: 'system',
    text: `[SWARM] Started ${swarmStatus.preset.toUpperCase()} preset (${swarmStatus.activeBots} bots @ ${swarmStatus.rate}/sec, phase: ${swarmStatus.phase})`,
    timestamp: Date.now()
  });
  res.json({ ok: true, swarm: swarmStatus, status });
});

app.post('/api/swarm/stop', (req, res) => {
  const swarmStatus = botSwarm.stop();
  isMock = Boolean(config.isMock);
  const status = getStatusPayload();
  broadcast(status);
  broadcast({
    type: 'LOG',
    level: 'system',
    text: '[SWARM] Stopped bot swarm simulation',
    timestamp: Date.now()
  });
  res.json({ ok: true, swarm: swarmStatus, status });
});

// Defensive Error Handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const port = Number(process.env.PORT) || config.port || 8080;
    const host = process.env.APG_HOST || '127.0.0.1';
    console.error(`[APG Relay] ERROR: Port ${port} on ${host} is already in use.`);
    console.error(`[APG Relay] Free port ${port} or run with PORT=${port + 1} npm start.`);
    process.exit(1);
  } else {
    console.error('[APG Relay] Server error:', err);
  }
});

process.on('unhandledRejection', (reason) => {
  console.warn('[APG Relay] Unhandled Promise Rejection:', reason);
});

let isShuttingDown = false;

export async function shutdownRelay(reason = 'SHUTDOWN') {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[APG Relay] Teardown triggered (reason: ${reason})`);

  // Hard safety timeout of 1500ms to guarantee exit
  const safetyTimeout = setTimeout(() => {
    console.warn(`[APG Relay] Teardown exceeded 1500ms safety timeout; forcing exit`);
    process.exit(0);
  }, 1500);
  if (typeof safetyTimeout.unref === 'function') {
    safetyTimeout.unref();
  }

  try {
    predictionManager.stopTimers();
    botSwarm.stop();
    stopHelix();
    await disconnectIRC();

    // Close WebSocket clients and server
    wss.clients.forEach((client) => {
      try {
        client.close(1000, 'Server shutting down');
      } catch (_) {}
    });
    await new Promise((resolve) => wss.close(() => resolve()));

    // Close HTTP server
    await new Promise((resolve) => server.close(() => resolve()));

    clearTimeout(safetyTimeout);
    console.log('[APG Relay] Clean shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('[APG Relay] Error during teardown:', err);
    clearTimeout(safetyTimeout);
    process.exit(0);
  }
}

// Process termination signals
process.on('SIGINT', () => shutdownRelay('SIGINT'));
process.on('SIGTERM', () => shutdownRelay('SIGTERM'));

// Child Process IPC lifecycle hooks
if (typeof process.send === 'function') {
  // Parent disconnect trap: exit immediately if parent Electron process terminates or crashes
  process.on('disconnect', () => {
    console.log('[APG Relay] Parent process disconnected, shutting down relay immediately');
    shutdownRelay('PARENT_DISCONNECT');
  });

  // Graceful shutdown IPC message from desktop launcher
  process.on('message', async (msg) => {
    if (msg && msg.type === 'SHUTDOWN') {
      console.log('[APG Relay] Received IPC SHUTDOWN message');
      await shutdownRelay('IPC_SHUTDOWN');
    }
  });
}

const HOST = process.env.APG_HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || config.port || 8080;
server.listen(PORT, HOST, () => {
  console.log(`[APG Relay] Game Client live at http://${HOST}:${PORT}/`);
  console.log(`[APG Relay] Streamer Dashboard at http://${HOST}:${PORT}/dashboard`);

  if (typeof process.send === 'function') {
    process.send({ type: 'RELAY_READY', port: PORT, host: HOST });
  }

  connectTwitchBridges();
});
