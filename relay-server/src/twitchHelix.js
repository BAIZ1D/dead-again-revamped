import { StaticAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { sanitizeChannelName } from './twitchIRC.js';

let pollInterval = null;
let activeApiClient = null;
let broadcasterId = null;
let activeChannel = '';
let activePredictionId = null;

export function stopHelix() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function isHelixPredictionReady() {
  return Boolean(activeApiClient && broadcasterId);
}

export async function createChannelPrediction({
  title = 'Will Chat be GOOD or BAD this run?',
  durationSeconds = 60
} = {}) {
  if (!activeApiClient || !broadcasterId) {
    return { ok: false, mode: 'chat', reason: 'unauthenticated' };
  }

  if (activePredictionId) {
    try {
      await activeApiClient.predictions.cancelPrediction(broadcasterId, activePredictionId);
    } catch {
      // Ignore error if prediction already locked/resolved/cancelled
    }
    activePredictionId = null;
  }

  const autoLockAfter = Math.max(30, Math.min(1800, Number(durationSeconds) || 60));

  try {
    const pred = await activeApiClient.predictions.createPrediction(broadcasterId, {
      title: String(title || 'Will Chat be GOOD or BAD this run?').slice(0, 45),
      outcomes: ['TEAM GOOD', 'TEAM BAD'],
      autoLockAfter
    });
    activePredictionId = pred.id;
    const goodOutcomeId = pred.outcomes && pred.outcomes[0] ? pred.outcomes[0].id : null;
    const badOutcomeId = pred.outcomes && pred.outcomes[1] ? pred.outcomes[1].id : null;
    return {
      ok: true,
      mode: 'helix',
      predictionId: pred.id,
      outcomes: { goodOutcomeId, badOutcomeId }
    };
  } catch (err) {
    console.log(`[Helix] Prediction creation fallback to chat mode: ${err.message}`);
    return { ok: false, mode: 'chat', reason: err.message };
  }
}

export async function getChannelPrediction(predictionId = activePredictionId) {
  if (!activeApiClient || !broadcasterId || !predictionId) {
    return null;
  }
  try {
    const pred = await activeApiClient.predictions.getPredictionById(broadcasterId, predictionId);
    if (!pred) return null;
    return {
      id: pred.id,
      status: pred.status,
      outcomes: (pred.outcomes || []).map((o) => ({
        id: o.id,
        title: o.title,
        users: o.users || 0,
        channelPoints: o.channelPoints || 0,
        topPredictors: (o.topPredictors || [])
          .map((p) => p.userDisplayName || p.userName)
          .filter(Boolean)
      }))
    };
  } catch (err) {
    console.warn(`[Helix] getChannelPrediction error: ${err.message}`);
    return null;
  }
}

export function getActivePredictionId() {
  return activePredictionId;
}

export async function lockChannelPrediction(predictionId = activePredictionId) {
  if (!activeApiClient || !broadcasterId || !predictionId) {
    return { ok: false };
  }
  try {
    await activeApiClient.predictions.lockPrediction(broadcasterId, predictionId);
    return { ok: true, predictionId };
  } catch (err) {
    console.warn(`[Helix] lockChannelPrediction error: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

export async function resolveChannelPrediction(predictionId = activePredictionId, winningOutcomeId) {
  if (!activeApiClient || !broadcasterId || !predictionId || !winningOutcomeId) {
    return { ok: false, reason: 'missing_params' };
  }
  try {
    await activeApiClient.predictions.resolvePrediction(broadcasterId, predictionId, winningOutcomeId);
    activePredictionId = null;
    return { ok: true, predictionId, winningOutcomeId };
  } catch (err) {
    activePredictionId = null;
    console.warn(`[Helix] resolveChannelPrediction error: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

export async function cancelChannelPrediction(predictionId = activePredictionId) {
  if (!activeApiClient || !broadcasterId || !predictionId) {
    return { ok: false };
  }
  try {
    await activeApiClient.predictions.cancelPrediction(broadcasterId, predictionId);
    activePredictionId = null;
    return { ok: true };
  } catch (err) {
    activePredictionId = null;
    console.warn(`[Helix] cancelChannelPrediction error: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

export function setupHelix(config = {}, onViewerUpdate = null) {
  stopHelix();
  activeApiClient = null;
  broadcasterId = null;
  activePredictionId = null;

  const clientId = (config.twitchClientId || '').trim();
  const accessToken = (config.twitchAccessToken || '').trim().replace(/^oauth:/i, '');
  const cleanChannel = sanitizeChannelName(config.channel || '');
  activeChannel = cleanChannel;

  if (!clientId || !accessToken || !cleanChannel || cleanChannel === 'mock') {
    console.log('[Helix] Operating in unauthenticated / IRC-only mode (viewerCount: 0)');
    if (onViewerUpdate) {
      onViewerUpdate(0);
    }
    return {
      authenticated: false,
      viewerCount: 0,
      stop: stopHelix
    };
  }

  let apiClient = null;
  try {
    const authProvider = new StaticAuthProvider(clientId, accessToken);
    apiClient = new ApiClient({ authProvider });
    activeApiClient = apiClient;
  } catch (err) {
    console.warn('[Helix] Failed to initialize Twurple client, falling back to IRC-only mode:', err.message);
    if (onViewerUpdate) {
      onViewerUpdate(0);
    }
    return {
      authenticated: false,
      viewerCount: 0,
      stop: stopHelix
    };
  }

  async function pollViewerCount() {
    try {
      if (!broadcasterId && activeChannel) {
        const user = await apiClient.users.getUserByName(activeChannel);
        broadcasterId = user ? user.id : null;
      }
      const stream = await apiClient.streams.getStreamByUserName(cleanChannel);
      const viewers = stream ? stream.viewers : 0;
      if (onViewerUpdate) {
        onViewerUpdate(viewers);
      }
    } catch (err) {
      console.warn(`[Helix] Viewer poll notice for #${cleanChannel}: ${err.message}`);
      if (onViewerUpdate) {
        onViewerUpdate(0);
      }
    }
  }

  // Initial poll + 30-second interval
  pollViewerCount();
  pollInterval = setInterval(pollViewerCount, 30000);

  return {
    authenticated: true,
    apiClient,
    stop: stopHelix
  };
}
