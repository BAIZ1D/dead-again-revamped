(() => {
  const wsStatusBadge = document.getElementById('ws-status-badge');
  const channelBadge = document.getElementById('channel-badge');
  const viewerBadge = document.getElementById('viewer-badge');
  const authModeIndicator = document.getElementById('auth-mode-indicator');

  const configForm = document.getElementById('channel-config-form');
  const channelInput = document.getElementById('channel-input');
  const clientIdInput = document.getElementById('client-id-input');
  const clientSecretInput = document.getElementById('client-secret-input');
  const accessTokenInput = document.getElementById('access-token-input');
  const saveFeedback = document.getElementById('save-feedback');

  // Prediction Controls
  const predictionStatusPill = document.getElementById('prediction-status-pill');
  const predictionLevelLabel = document.getElementById('prediction-level-label');
  const predictionTimerDisplay = document.getElementById('prediction-timer-display');
  const predictionGoodLabel = document.getElementById('prediction-good-label');
  const predictionBadLabel = document.getElementById('prediction-bad-label');
  const predictionGoodBar = document.getElementById('prediction-good-bar');
  const predictionBadBar = document.getElementById('prediction-bad-bar');
  const durationButtons = document.querySelectorAll('.btn-duration');
  const openPredictionBtn = document.getElementById('open-prediction-btn');
  const lockPredictionBtn = document.getElementById('lock-prediction-btn');

  const presetButtons = document.querySelectorAll('.btn-preset');
  const rateSlider = document.getElementById('swarm-rate-slider');
  const rateDisplay = document.getElementById('swarm-rate-display');
  const swarmToggleBtn = document.getElementById('swarm-toggle-btn');
  const swarmStatusPill = document.getElementById('swarm-status-pill');

  const fakeChatUser = document.getElementById('fake-chat-user');
  const fakeChatInput = document.getElementById('fake-chat-input');
  const fakeChatSend = document.getElementById('fake-chat-send');

  // Live Karma & Divine Flash Controls
  const liveKarmaGoodLabel = document.getElementById('live-karma-good-label');
  const liveKarmaBadLabel = document.getElementById('live-karma-bad-label');
  const liveKarmaGoodFill = document.getElementById('live-karma-good-fill');
  const liveKarmaBadFill = document.getElementById('live-karma-bad-fill');
  const liveKarmaTargetPin = document.getElementById('live-karma-target-pin');
  const liveKarmaTargetLabel = document.getElementById('live-karma-target-label');
  const divineFlashDemoBtn = document.getElementById('divine-flash-demo-btn');

  // Match Outcome Elements
  const outcomeStatusPill = document.getElementById('outcome-status-pill');
  const outcomeWinnerBadge = document.getElementById('outcome-winner-badge');
  const outcomeMultiplierBadge = document.getElementById('outcome-multiplier-badge');
  const outcomeLevelReason = document.getElementById('outcome-level-reason');
  const outcomeKarmaVsTarget = document.getElementById('outcome-karma-vs-target');
  const outcomeMvpGood = document.getElementById('outcome-mvp-good');
  const outcomeMvpBad = document.getElementById('outcome-mvp-bad');
  const forceResolveGoodBtn = document.getElementById('force-resolve-good-btn');
  const forceResolveBadBtn = document.getElementById('force-resolve-bad-btn');
  const forceRefundBtn = document.getElementById('force-refund-btn');

  const triggerPads = document.querySelectorAll('.trigger-pad');
  const eventLog = document.getElementById('event-log-container');
  const clearLogBtn = document.getElementById('clear-log-btn');

  let selectedPreset = 'class';
  let selectedDuration = 60;
  let currentLevel = 1;
  let swarmRunning = false;
  let ws = null;
  let lockedGoodTargetPct = 50;
  let lastKnownTallies = { goodActions: 0, badActions: 0 };
  const MAX_LOG_ENTRIES = 100;

  function formatTime(ts = Date.now()) {
    const d = new Date(ts);
    return d.toTimeString().split(' ')[0];
  }

  function formatCountdown(seconds = 0) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = String(Math.floor(s / 60)).padStart(2, '0');
    const secs = String(s % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function appendLog({ time, badgeText, badgeClass, user, message }) {
    const row = document.createElement('div');
    row.className = 'log-entry';

    const timeEl = document.createElement('span');
    timeEl.className = 'log-time';
    timeEl.textContent = `[${time || formatTime()}]`;
    row.appendChild(timeEl);

    if (badgeText) {
      const badgeEl = document.createElement('span');
      badgeEl.className = `log-badge ${badgeClass || 'badge-system'}`;
      badgeEl.textContent = badgeText;
      row.appendChild(badgeEl);
    }

    if (user) {
      const userEl = document.createElement('span');
      userEl.className = 'log-user';
      userEl.textContent = `@${user}`;
      row.appendChild(userEl);
    }

    const msgEl = document.createElement('span');
    msgEl.className = 'log-msg';
    msgEl.textContent = message;
    row.appendChild(msgEl);

    eventLog.appendChild(row);

    while (eventLog.children.length > MAX_LOG_ENTRIES) {
      eventLog.removeChild(eventLog.firstChild);
    }

    eventLog.scrollTop = eventLog.scrollHeight;
  }

  function syncDurationButtons(durationSec) {
    const num = Number(durationSec) || 60;
    selectedDuration = num;
    durationButtons.forEach((btn) => {
      if (Number(btn.getAttribute('data-duration')) === num) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updatePredictionUI(pred) {
    if (!pred) return;

    currentLevel = pred.level || 1;
    if (predictionLevelLabel) {
      predictionLevelLabel.textContent = `LEVEL ${currentLevel}`;
    }

    const status = pred.status || 'IDLE';
    const mode = pred.mode === 'helix' ? 'TWITCH HELIX' : 'CHAT POLL';

    if (predictionStatusPill) {
      if (status === 'LOBBY') {
        predictionStatusPill.textContent = `LOBBY OPEN (${mode})`;
      } else if (status === 'LOCKED') {
        predictionStatusPill.textContent = 'LOCKED';
      } else {
        predictionStatusPill.textContent = 'IDLE';
      }
    }

    const remaining =
      status === 'LOCKED'
        ? 0
        : pred.remainingSeconds !== undefined
        ? pred.remainingSeconds
        : selectedDuration;

    if (predictionTimerDisplay) {
      predictionTimerDisplay.textContent = formatCountdown(remaining);
      if (status === 'LOBBY' && remaining <= 10) {
        predictionTimerDisplay.classList.add('urgent');
      } else {
        predictionTimerDisplay.classList.remove('urgent');
      }
    }

    const goodPct = pred.goodPct !== undefined ? pred.goodPct : 50;
    const badPct = pred.badPct !== undefined ? pred.badPct : 50;
    const goodCount = pred.goodCount ?? 0;
    const badCount = pred.badCount ?? 0;

    if (predictionGoodLabel) {
      predictionGoodLabel.textContent = `GOOD ${goodPct}% (${goodCount})`;
    }
    if (predictionBadLabel) {
      predictionBadLabel.textContent = `BAD ${badPct}% (${badCount})`;
    }
    if (predictionGoodBar) {
      predictionGoodBar.style.width = `${goodPct}%`;
    }
    if (predictionBadBar) {
      predictionBadBar.style.width = `${badPct}%`;
    }

    if (pred.status === 'LOCKED' && pred.goodPct !== undefined) {
      lockedGoodTargetPct = pred.goodPct;
      updateLiveKarmaUI(lastKnownTallies);
    } else if (pred.lockedResult && pred.lockedResult.goodPct !== undefined) {
      lockedGoodTargetPct = pred.lockedResult.goodPct;
      updateLiveKarmaUI(lastKnownTallies);
    }

    if (pred.durationSeconds) {
      syncDurationButtons(pred.durationSeconds);
    }
  }

  function updateLiveKarmaUI(levelTallies) {
    if (levelTallies) {
      lastKnownTallies = {
        goodActions: Number(levelTallies.goodActions) || 0,
        badActions: Number(levelTallies.badActions) || 0
      };
    }
    const goodActions = lastKnownTallies.goodActions;
    const badActions = lastKnownTallies.badActions;
    const total = goodActions + badActions;
    const liveGoodPct = total === 0 ? 50 : Math.round((goodActions / total) * 100);
    const liveBadPct = 100 - liveGoodPct;

    if (liveKarmaGoodLabel) {
      liveKarmaGoodLabel.textContent = `LIVE GOOD: ${liveGoodPct}% (${goodActions})`;
    }
    if (liveKarmaBadLabel) {
      liveKarmaBadLabel.textContent = `LIVE BAD: ${liveBadPct}% (${badActions})`;
    }
    if (liveKarmaGoodFill) {
      liveKarmaGoodFill.style.width = `${liveGoodPct}%`;
    }
    if (liveKarmaBadFill) {
      liveKarmaBadFill.style.width = `${liveBadPct}%`;
    }
    if (liveKarmaTargetPin) {
      liveKarmaTargetPin.style.left = `${lockedGoodTargetPct}%`;
      liveKarmaTargetPin.title = `Locked Target: ${lockedGoodTargetPct}% Good`;
    }
    if (liveKarmaTargetLabel) {
      const isGoodLeading = liveGoodPct >= lockedGoodTargetPct;
      liveKarmaTargetLabel.textContent = `TARGET: ${lockedGoodTargetPct}% GOOD | ${isGoodLeading ? '▲ GOOD LEADING' : '▼ BAD LEADING'}`;
      if (isGoodLeading) {
        liveKarmaTargetLabel.classList.remove('bad-leading');
        liveKarmaTargetLabel.classList.add('good-leading');
      } else {
        liveKarmaTargetLabel.classList.remove('good-leading');
        liveKarmaTargetLabel.classList.add('bad-leading');
      }
    }
  }

  function updateChargeBadge(action, current, required) {
    if (!action) return;
    const cleanAction = String(action).toLowerCase();
    const el = document.querySelector(`.pad-charge[data-charge-badge="${cleanAction}"]`);
    if (!el) return;
    const c = Number(current) || 0;
    const r = Number(required) || 1;
    el.textContent = `${c}/${r}`;
    if (c > 0 && c < r) {
      el.classList.add('charging');
    } else {
      el.classList.remove('charging');
    }
  }

  function updateOutcomeUI(outcomeData) {
    if (!outcomeData) return;
    const winner = outcomeData.winner || 'refund';
    const match = outcomeData.matchOutcome || {};
    const level = outcomeData.level || match.level || currentLevel;

    if (outcomeStatusPill) {
      if (winner === 'refund') {
        const reason = outcomeData.refundReason || 'PUSH / REFUND';
        outcomeStatusPill.textContent = `RESOLVED: REFUND (${reason})`;
      } else {
        outcomeStatusPill.textContent = `RESOLVED: TEAM ${winner.toUpperCase()}`;
      }
    }

    if (outcomeWinnerBadge) {
      outcomeWinnerBadge.className = 'outcome-winner-badge';
      if (winner === 'good') {
        outcomeWinnerBadge.classList.add('winner-good');
        outcomeWinnerBadge.textContent = '★ TEAM GOOD WON! ★';
      } else if (winner === 'bad') {
        outcomeWinnerBadge.classList.add('winner-bad');
        outcomeWinnerBadge.textContent = '☠ TEAM BAD WON! ☠';
      } else {
        outcomeWinnerBadge.classList.add('winner-refund');
        outcomeWinnerBadge.textContent = '⚖ REFUND / PUSH ⚖';
      }
    }

    if (outcomeMultiplierBadge) {
      outcomeMultiplierBadge.textContent = `PAYOUT: ${outcomeData.multiplierText || '1:1.0x'}`;
    }

    if (outcomeLevelReason) {
      const deathText = match.causeOfDeath ? ` (${match.causeOfDeath})` : '';
      const refundText = outcomeData.refundReason ? ` [${outcomeData.refundReason}]` : '';
      outcomeLevelReason.textContent = `Level ${level}${deathText}${refundText}`;
    }

    if (outcomeKarmaVsTarget) {
      const finalGood = match.finalGoodPct !== undefined ? match.finalGoodPct : 50;
      const targetGood = match.targetGoodPct !== undefined ? match.targetGoodPct : 50;
      outcomeKarmaVsTarget.textContent = `${finalGood}% Good vs ${targetGood}% Target (${match.goodActions || 0}G / ${match.badActions || 0}B)`;
    }

    if (outcomeMvpGood) {
      if (match.mvpGood && match.mvpGood.user) {
        const score = match.mvpGood.score || 0;
        const title = match.mvpGood.title ? ` [${match.mvpGood.title}]` : '';
        outcomeMvpGood.textContent = `@${match.mvpGood.user} (${score} pts)${title}`;
      } else {
        outcomeMvpGood.textContent = 'None';
      }
    }

    if (outcomeMvpBad) {
      if (match.mvpBad && match.mvpBad.user) {
        const score = match.mvpBad.score || 0;
        const title = match.mvpBad.title ? ` [${match.mvpBad.title}]` : '';
        outcomeMvpBad.textContent = `@${match.mvpBad.user} (${score} pts)${title}`;
      } else {
        outcomeMvpBad.textContent = 'None';
      }
    }
  }

  function updateStatusUI(status) {
    if (!status) return;

    const ch = status.channel || 'none';
    channelBadge.textContent = `CHANNEL: #${ch}`;
    if (viewerBadge) {
      viewerBadge.textContent = `VIEWERS: ${status.viewers ?? 0}`;
    }

    if (status.hasHelixAuth) {
      authModeIndicator.textContent = 'Twitch Helix + IRC Mode (Authenticated)';
    } else {
      authModeIndicator.textContent = 'Anonymous IRC Mode (Zero setup required)';
    }

    if (status.mode === 'mock') {
      wsStatusBadge.className = 'status-badge mock';
      wsStatusBadge.textContent = '● DEV MOCK ACTIVE';
    } else if (status.connected) {
      wsStatusBadge.className = 'status-badge connected';
      wsStatusBadge.textContent = ch !== 'none' && ch !== '' ? `● LIVE #${ch}` : '● RELAY CONNECTED';
    } else {
      wsStatusBadge.className = 'status-badge disconnected';
      wsStatusBadge.textContent = '● DISCONNECTED';
    }

    if (status.swarm) {
      swarmRunning = Boolean(status.swarm.running);
      const phaseSuffix = status.swarm.phase ? ` [${status.swarm.phase}]` : '';
      if (swarmRunning) {
        swarmToggleBtn.classList.add('active');
        swarmToggleBtn.textContent = `STOP BOT SWARM (${status.swarm.activeBots} BOTS ACTIVE)`;
        swarmStatusPill.textContent = `RUNNING: ${status.swarm.preset.toUpperCase()} (${status.swarm.activeBots} BOTS)${phaseSuffix}`;
      } else {
        swarmToggleBtn.classList.remove('active');
        swarmToggleBtn.textContent = 'START BOT SWARM';
        swarmStatusPill.textContent = 'SWARM IDLE (0 BOTS)';
      }
    }

    if (status.chargeState) {
      if (status.chargeState.actions) {
        for (const [action, data] of Object.entries(status.chargeState.actions)) {
          updateChargeBadge(action, data.current, data.required);
        }
      }
      if (status.chargeState.levelTallies) {
        updateLiveKarmaUI(status.chargeState.levelTallies);
      }
    }
    if (status.levelTallies) {
      updateLiveKarmaUI(status.levelTallies);
    }

    if (status.predictionDurationSec) {
      syncDurationButtons(status.predictionDurationSec);
    }
    if (status.prediction) {
      updatePredictionUI(status.prediction);
      if (status.prediction.outcomeResult) {
        updateOutcomeUI(status.prediction.outcomeResult);
      }
    }
  }

  async function loadInitialConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.channel) channelInput.value = data.channel;
      if (data.twitchClientId) clientIdInput.value = data.twitchClientId;
      if (data.predictionDurationSec) syncDurationButtons(data.predictionDurationSec);
      if (data.status) updateStatusUI(data.status);
    } catch (err) {
      appendLog({
        badgeText: 'WARN',
        badgeClass: 'badge-system',
        message: `Failed to fetch initial config: ${err.message}`
      });
    }
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      appendLog({
        badgeText: 'WS',
        badgeClass: 'badge-system',
        message: `Connected to APG Relay Server at ${wsUrl}`
      });
    };

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'STATUS') {
          updateStatusUI(packet);
        } else if (packet.type === 'PREDICTION_STATE') {
          updatePredictionUI(packet);
        } else if (packet.type === 'PREDICTION_LOCKED') {
          if (packet.goodPct !== undefined) {
            lockedGoodTargetPct = packet.goodPct;
          }
          updatePredictionUI(packet);
          updateLiveKarmaUI(lastKnownTallies);
          appendLog({
            time: formatTime(packet.timestamp),
            badgeText: 'LOCKED',
            badgeClass: 'badge-system',
            message: `Level ${packet.level}: ${packet.goodPct}% GOOD (${packet.goodCount}) vs ${packet.badPct}% BAD (${packet.badCount})`
          });
        } else if (packet.type === 'CHARGE_UPDATE') {
          updateChargeBadge(packet.action, packet.current, packet.required);
          if (packet.levelTallies) {
            updateLiveKarmaUI(packet.levelTallies);
          }
          if (!packet.completed) {
            const isGood = packet.team === 'good';
            appendLog({
              time: formatTime(packet.timestamp),
              badgeText: `CHARGE ${packet.current}/${packet.required}`,
              badgeClass: isGood ? 'badge-good' : 'badge-bad',
              user: packet.user,
              message: `charged !${packet.action}`
            });
          }
        } else if (packet.type === 'ACTION') {
          updateChargeBadge(packet.action, 0, packet.required || 1);
          if (packet.levelTallies) {
            updateLiveKarmaUI(packet.levelTallies);
          }
          const isGood = packet.team === 'good';
          appendLog({
            time: formatTime(packet.timestamp),
            badgeText: isGood ? 'GOOD BUFF' : 'BAD SABOTAGE',
            badgeClass: isGood ? 'badge-good' : 'badge-bad',
            user: packet.user,
            message: `triggered !${packet.action} (${packet.source || 'irc'})`
          });
        } else if (packet.type === 'VOTE') {
          const isGood = packet.team === 'good';
          appendLog({
            time: formatTime(packet.timestamp),
            badgeText: `VOTE ${packet.team.toUpperCase()}`,
            badgeClass: isGood ? 'badge-good' : 'badge-bad',
            user: packet.user,
            message: packet.switched
              ? `switched vote to Team ${packet.team.toUpperCase()}`
              : `joined Team ${packet.team.toUpperCase()}`
          });
        } else if (packet.type === 'OUTCOME_RESOLVED') {
          updateOutcomeUI(packet);
          const isGood = packet.winner === 'good';
          const isBad = packet.winner === 'bad';
          const badgeClass = isGood ? 'badge-good' : isBad ? 'badge-bad' : 'badge-system';
          appendLog({
            time: formatTime(packet.timestamp),
            badgeText: 'OUTCOME',
            badgeClass,
            message: `Level ${packet.level || 1} Outcome: ${packet.winner.toUpperCase()} (${packet.multiplierText})`
          });
        }
      } catch (err) {
        console.error('Failed to parse WS packet:', err);
      }
    };

    ws.onclose = () => {
      wsStatusBadge.className = 'status-badge disconnected';
      wsStatusBadge.textContent = '● RECONNECTING...';
      setTimeout(connectWebSocket, 2000);
    };
  }

  // Channel Configuration Form Submit
  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveFeedback.textContent = 'Saving...';

    const payload = {
      channel: channelInput.value.trim(),
      twitchClientId: clientIdInput.value.trim(),
      twitchClientSecret: clientSecretInput.value.trim(),
      twitchAccessToken: accessTokenInput.value.trim()
    };

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        channelInput.value = data.channel || '';
        saveFeedback.textContent = `✓ Saved & connected (#${data.channel || 'none'})`;
        updateStatusUI(data.status);
        appendLog({
          badgeText: 'CONFIG',
          badgeClass: 'badge-system',
          message: `Channel updated to #${data.channel || 'none'}`
        });
      }
    } catch (err) {
      saveFeedback.textContent = `Error: ${err.message}`;
    }
  });

  // Prediction Duration Preset Buttons
  durationButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const duration = Number(btn.getAttribute('data-duration')) || 60;
      syncDurationButtons(duration);
      try {
        const res = await fetch('/api/prediction/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration })
        });
        const data = await res.json();
        if (data.prediction) {
          updatePredictionUI(data.prediction);
        }
      } catch (err) {
        console.error('Failed to update prediction duration:', err);
      }
    });
  });

  if (openPredictionBtn) {
    openPredictionBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/prediction/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: currentLevel, duration: selectedDuration })
        });
        const data = await res.json();
        if (data.prediction) {
          updatePredictionUI(data.prediction);
        }
      } catch (err) {
        console.error('Failed to start prediction:', err);
      }
    });
  }

  if (lockPredictionBtn) {
    lockPredictionBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/prediction/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.prediction) {
          updatePredictionUI(data.prediction);
        }
      } catch (err) {
        console.error('Failed to lock prediction:', err);
      }
    });
  }

  // Preset Buttons
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      presetButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPreset = btn.getAttribute('data-preset') || 'class';

      if (swarmRunning) {
        await startSwarm();
      }
    });
  });

  // Chatter Rate Slider
  rateSlider.addEventListener('input', () => {
    rateDisplay.textContent = `${rateSlider.value} actions/sec`;
  });

  rateSlider.addEventListener('change', async () => {
    if (swarmRunning) {
      await startSwarm();
    }
  });

  async function startSwarm() {
    const rate = Number(rateSlider.value) || 3;
    const res = await fetch('/api/swarm/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: selectedPreset, rate })
    });
    const data = await res.json();
    if (data.status) updateStatusUI(data.status);
  }

  async function stopSwarm() {
    const res = await fetch('/api/swarm/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.status) updateStatusUI(data.status);
  }

  swarmToggleBtn.addEventListener('click', async () => {
    if (swarmRunning) {
      await stopSwarm();
    } else {
      await startSwarm();
    }
  });

  // Manual Trigger Pads (bypassCooldown: true per D-19)
  triggerPads.forEach((pad) => {
    pad.addEventListener('click', async () => {
      const action = pad.getAttribute('data-action');
      const team = pad.getAttribute('data-team');
      const type = pad.getAttribute('data-type') || 'ACTION';

      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          team,
          type,
          bypassCooldown: true,
          user: fakeChatUser.value.trim() || 'StreamerDev'
        })
      });
    });
  });

  if (divineFlashDemoBtn) {
    divineFlashDemoBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'divine_flash',
            team: 'good',
            type: 'ACTION',
            bypassCooldown: true,
            user: fakeChatUser.value.trim() || 'Streamer'
          })
        });
      } catch (err) {
        console.error('Failed to trigger Divine Flash demo:', err);
      }
    });
  }

  // Force Resolve / Refund Manual Override Buttons
  if (forceResolveGoodBtn) {
    forceResolveGoodBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/prediction/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winner: 'good' })
        });
        const data = await res.json();
        if (data.result) {
          updateOutcomeUI(data.result);
        }
      } catch (err) {
        console.error('Failed to force resolve good:', err);
      }
    });
  }

  if (forceResolveBadBtn) {
    forceResolveBadBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/prediction/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winner: 'bad' })
        });
        const data = await res.json();
        if (data.result) {
          updateOutcomeUI(data.result);
        }
      } catch (err) {
        console.error('Failed to force resolve bad:', err);
      }
    });
  }

  if (forceRefundBtn) {
    forceRefundBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/prediction/refund', {
          method: 'POST'
        });
        const data = await res.json();
        if (data.result) {
          updateOutcomeUI(data.result);
        }
      } catch (err) {
        console.error('Failed to force refund:', err);
      }
    });
  }

  // Fake Chat Box Submit (supports !good, !bad, !g, !b, !vote good/bad, and uses bypassCooldown: false so charge gauge works)
  async function sendFakeChat() {
    const raw = fakeChatInput.value.trim();
    if (!raw) return;
    const user = fakeChatUser.value.trim() || 'Audience_1';
    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase().replace(/^!/, '');

    if (cmd === 'good' || cmd === 'g' || cmd === 'bad' || cmd === 'b') {
      const voteTeam = cmd.startsWith('b') ? 'bad' : 'good';
      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'VOTE', team: voteTeam, user })
      });
    } else if (cmd === 'vote' && parts[1]) {
      const target = parts[1].toLowerCase();
      const voteTeam = target.startsWith('b') ? 'bad' : 'good';
      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'VOTE', team: voteTeam, user })
      });
    } else {
      const goodSet = new Set(['ammo', 'repair', 'light', 'slow', 'barrier']);
      const badSet = new Set(['mob', 'boss', 'blackout', 'jam', 'frenzy']);
      if (goodSet.has(cmd) || badSet.has(cmd)) {
        await fetch('/api/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ACTION',
            action: cmd,
            team: goodSet.has(cmd) ? 'good' : 'bad',
            bypassCooldown: false,
            user
          })
        });
      } else {
        appendLog({
          badgeText: 'CHAT',
          badgeClass: 'badge-system',
          user,
          message: raw
        });
      }
    }
    fakeChatInput.value = '';
  }

  fakeChatSend.addEventListener('click', sendFakeChat);
  fakeChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendFakeChat();
    }
  });

  clearLogBtn.addEventListener('click', () => {
    eventLog.innerHTML = '';
  });

  // Update Notification Pill & In-App Release Modal (PKG-07, D-09, D-10, D-12)
  const updatePill = document.getElementById('update-notification-pill');
  const updatePillVersion = document.getElementById('update-pill-version');
  const updatePillDismiss = document.getElementById('update-pill-dismiss');
  const updateModal = document.getElementById('update-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalVersionText = document.getElementById('modal-version-text');
  const modalChangelogBox = document.getElementById('modal-changelog-box');
  const btnDownloadGithub = document.getElementById('btn-download-github');
  const btnViewItch = document.getElementById('btn-view-itch');
  const btnSupportKofi = document.getElementById('btn-support-kofi');

  let currentUpdateInfo = null;

  function openExternal(url) {
    if (window.electronAPI && typeof window.electronAPI.openExternalUrl === 'function') {
      window.electronAPI.openExternalUrl(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function showUpdatePill(info) {
    if (!info || !info.latestVersion) return;
    currentUpdateInfo = info;
    if (sessionStorage.getItem('apg_update_dismissed') === '1') {
      return;
    }
    if (updatePillVersion) {
      updatePillVersion.textContent = `v${info.latestVersion}`;
    }
    if (updatePill) {
      updatePill.classList.remove('hidden');
    }
  }

  function openUpdateModal() {
    if (!currentUpdateInfo) return;
    if (modalVersionText) {
      modalVersionText.textContent = `Version ${currentUpdateInfo.latestVersion} is now available!`;
    }
    if (modalChangelogBox) {
      modalChangelogBox.textContent = currentUpdateInfo.releaseNotes || 'Check the releases page for full release notes and enhancements.';
    }
    if (updateModal) {
      updateModal.classList.remove('hidden');
    }
  }

  function dismissUpdate() {
    if (updateModal) updateModal.classList.add('hidden');
    if (updatePill) updatePill.classList.add('hidden');
    sessionStorage.setItem('apg_update_dismissed', '1');
  }

  if (updatePill) {
    updatePill.addEventListener('click', (e) => {
      if (e.target === updatePillDismiss || (updatePillDismiss && updatePillDismiss.contains(e.target))) {
        e.stopPropagation();
        dismissUpdate();
      } else {
        openUpdateModal();
      }
    });
  }

  if (updatePillDismiss) {
    updatePillDismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissUpdate();
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      dismissUpdate();
    });
  }

  if (btnDownloadGithub) {
    btnDownloadGithub.addEventListener('click', () => {
      const targetUrl = (currentUpdateInfo && currentUpdateInfo.htmlUrl) || 'https://github.com/BAIZ1D/dead-again-revamped/releases';
      openExternal(targetUrl);
    });
  }

  if (btnViewItch) {
    btnViewItch.addEventListener('click', () => {
      openExternal('https://baiz1d.itch.io/dead-again-revamped');
    });
  }

  if (btnSupportKofi) {
    btnSupportKofi.addEventListener('click', () => {
      openExternal('https://ko-fi.com/baiz1d');
    });
  }

  const kofiHeaderBtn = document.getElementById('kofi-header-btn');
  if (kofiHeaderBtn) {
    kofiHeaderBtn.addEventListener('click', (e) => {
      if (window.electronAPI && typeof window.electronAPI.openExternalUrl === 'function') {
        e.preventDefault();
        openExternal('https://ko-fi.com/baiz1d');
      }
    });
  }

  if (window.electronAPI && typeof window.electronAPI.onUpdateAvailable === 'function') {
    window.electronAPI.onUpdateAvailable((info) => {
      showUpdatePill(info);
    });
  }

  loadInitialConfig();
  connectWebSocket();
})();
