import tmi from 'tmi.js';

export const VALID_ACTIONS = {
  // Team Good
  '!ammo': { action: 'ammo', team: 'good' },
  '!repair': { action: 'repair', team: 'good' },
  '!light': { action: 'light', team: 'good' },
  '!slow': { action: 'slow', team: 'good' },
  '!barrier': { action: 'barrier', team: 'good' },
  // Team Bad
  '!mob': { action: 'mob', team: 'bad' },
  '!boss': { action: 'boss', team: 'bad' },
  '!blackout': { action: 'blackout', team: 'bad' },
  '!jam': { action: 'jam', team: 'bad' },
  '!frenzy': { action: 'frenzy', team: 'bad' }
};

export const VOTE_SHORTHANDS = {
  '!good': 'good',
  '!g': 'good',
  '!bad': 'bad',
  '!b': 'bad'
};

export function sanitizeChannelName(rawChannel) {
  if (!rawChannel || typeof rawChannel !== 'string') return '';
  return rawChannel
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?twitch\.tv\//i, '')
    .replace(/[@#\s/]/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}

export function parseChatMessage(rawText, username = 'Anonymous') {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (!text) return null;

  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase();

  if (VALID_ACTIONS[command]) {
    const { action, team } = VALID_ACTIONS[command];
    return {
      type: 'ACTION',
      action,
      team,
      user: username,
      source: 'irc',
      timestamp: Date.now()
    };
  }

  if (VOTE_SHORTHANDS[command]) {
    return {
      type: 'VOTE',
      team: VOTE_SHORTHANDS[command],
      user: username,
      source: 'irc',
      timestamp: Date.now()
    };
  }

  if (command === '!vote' && parts.length > 1) {
    const target = parts[1].toLowerCase();
    if (target === 'good' || target === 'g' || target === 'bad' || target === 'b') {
      return {
        type: 'VOTE',
        team: target.startsWith('b') ? 'bad' : 'good',
        user: username,
        source: 'irc',
        timestamp: Date.now()
      };
    }
  }

  return null;
}

let activeClient = null;

export async function sendChatMessage(channel, message) {
  if (!activeClient || !channel || !message) {
    return { ok: false, reason: 'not_connected' };
  }
  const cleanChannel = sanitizeChannelName(channel);
  if (!cleanChannel || cleanChannel === 'mock') {
    return { ok: false, reason: 'mock_channel' };
  }
  try {
    // Only attempt to speak if client has an identity and is connected
    if (activeClient.readyState() === 'OPEN') {
      await activeClient.say(cleanChannel, String(message).slice(0, 490));
      return { ok: true };
    }
    return { ok: false, reason: 'socket_not_open' };
  } catch (err) {
    console.warn(`[IRC] sendChatMessage notice for #${cleanChannel}: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

export async function disconnectIRC() {
  if (activeClient) {
    try {
      await activeClient.disconnect();
    } catch {
      // Ignore disconnect errors when switching channels
    }
    activeClient = null;
  }
}

export function setupIRC(channelName, onAction, onVote, onStatus, credentials = null) {
  const cleanChannel = sanitizeChannelName(channelName);

  // Clean up previous connection if any
  if (activeClient) {
    disconnectIRC();
  }

  if (!cleanChannel || cleanChannel === 'mock') {
    if (onStatus) {
      onStatus({
        connected: false,
        channel: cleanChannel,
        mode: cleanChannel === 'mock' ? 'mock' : 'idle'
      });
    }
    return {
      channel: cleanChannel,
      client: null,
      disconnect: disconnectIRC
    };
  }

  const clientConfig = {
    options: { debug: false },
    connection: { reconnect: true, secure: true },
    channels: [cleanChannel]
  };

  if (credentials && credentials.username && credentials.password) {
    clientConfig.identity = {
      username: credentials.username,
      password: credentials.password
    };
  }

  const client = new tmi.Client(clientConfig);
  activeClient = client;

  client.on('connected', () => {
    console.log(`[IRC] Connected to #${cleanChannel} (Anonymous Read-Only Fallback: ${!clientConfig.identity})`);
    if (onStatus) {
      onStatus({
        connected: true,
        channel: cleanChannel,
        mode: 'live'
      });
    }
  });

  client.on('disconnected', (reason) => {
    console.log(`[IRC] Disconnected from #${cleanChannel}: ${reason || 'closed'}`);
    if (onStatus) {
      onStatus({
        connected: false,
        channel: cleanChannel,
        mode: 'idle'
      });
    }
  });

  client.on('message', (channel, tags, message, self) => {
    if (self) return;
    const username = (tags && (tags['display-name'] || tags.username)) || 'Anonymous';
    const parsed = parseChatMessage(message, username);
    if (!parsed) return;

    if (parsed.type === 'ACTION' && onAction) {
      onAction(parsed);
    } else if (parsed.type === 'VOTE' && onVote) {
      onVote(parsed);
    }
  });

  client.connect().catch((err) => {
    console.warn(`[IRC] Could not connect to #${cleanChannel}: ${err.message}`);
    if (onStatus) {
      onStatus({
        connected: false,
        channel: cleanChannel,
        mode: 'idle',
        error: err.message
      });
    }
  });

  return {
    channel: cleanChannel,
    client,
    disconnect: disconnectIRC
  };
}
