import { cooldownManager as defaultCooldownManager } from './cooldownManager.js';

export const GOOD_ACTIONS = ['ammo', 'repair', 'light', 'slow', 'barrier'];
export const BAD_ACTIONS = ['mob', 'boss', 'blackout', 'jam', 'frenzy'];

export const SWARM_PRESETS = {
  solo: {
    name: 'solo',
    count: 1,
    prefix: 'TestBot'
  },
  class: {
    name: 'class',
    count: 25,
    prefix: 'Audience'
  },
  chaos: {
    name: 'chaos',
    count: 50,
    prefix: 'ChaosBot'
  }
};

export function createRoster(presetName = 'class') {
  const key = String(presetName || 'class').toLowerCase();
  const preset = SWARM_PRESETS[key] || SWARM_PRESETS.class;
  const roster = [];
  for (let i = 1; i <= preset.count; i++) {
    roster.push(`${preset.prefix}_${i}`);
  }
  return {
    preset: preset.name,
    roster
  };
}

export class BotSwarmEngine {
  constructor(cm = defaultCooldownManager) {
    this.cooldownManager = cm;
    this.timer = null;
    this.running = false;
    this.preset = 'class';
    this.roster = [];
    this.rate = 2;
    this.phase = 'PLAYING'; // 'LOBBY' | 'PLAYING'
    this.onActionCallback = null;
    this.onVoteCallback = null;
  }

  setPhase(phase) {
    this.phase = String(phase).toUpperCase() === 'LOBBY' ? 'LOBBY' : 'PLAYING';
    return this.phase;
  }

  start(presetName = 'class', actionsPerSecond = 2, onActionGenerated = null, onVoteGenerated = null) {
    this.stop();

    const { preset, roster } = createRoster(presetName);
    this.preset = preset;
    this.roster = roster;
    this.rate = Math.max(1, Math.min(20, Number(actionsPerSecond) || 2));
    this.running = true;
    if (onActionGenerated) this.onActionCallback = onActionGenerated;
    if (onVoteGenerated) this.onVoteCallback = onVoteGenerated;

    const intervalMs = Math.max(50, Math.floor(1000 / this.rate));

    const tick = () => {
      if (!this.running || this.roster.length === 0) return;

      const botName = this.roster[Math.floor(Math.random() * this.roster.length)];
      const isGood = Math.random() < 0.5;
      const team = isGood ? 'good' : 'bad';

      if (this.phase === 'LOBBY') {
        if (this.onVoteCallback) {
          this.onVoteCallback({
            type: 'VOTE',
            team,
            user: botName,
            source: 'mock',
            timestamp: Date.now()
          });
        }
        return;
      }

      const pool = isGood ? GOOD_ACTIONS : BAD_ACTIONS;
      const action = pool[Math.floor(Math.random() * pool.length)];

      if (this.onActionCallback) {
        this.onActionCallback({
          type: 'ACTION',
          action,
          team,
          user: botName,
          source: 'mock',
          cooldownChecked: false,
          swarmPreset: this.preset,
          timestamp: Date.now()
        });
      }
    };

    // Execute an immediate first tick so callers receive prompt feedback
    tick();
    this.timer = setInterval(tick, intervalMs);

    return this.getStatus();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.roster = [];
    return this.getStatus();
  }

  triggerSingle(action, team, username = 'StreamerDev') {
    const cleanAction = String(action || 'ammo').toLowerCase();
    const resolvedTeam =
      team || (GOOD_ACTIONS.includes(cleanAction) ? 'good' : 'bad');
    const payload = {
      type: 'ACTION',
      action: cleanAction,
      team: resolvedTeam,
      user: username || 'StreamerDev',
      source: 'mock',
      cooldownChecked: true,
      timestamp: Date.now()
    };
    if (this.onActionCallback) {
      this.onActionCallback(payload);
    }
    return payload;
  }

  triggerVote(team = 'good', username = 'StreamerDev') {
    const cleanTeam = String(team).toLowerCase() === 'bad' ? 'bad' : 'good';
    const payload = {
      type: 'VOTE',
      team: cleanTeam,
      user: username || 'StreamerDev',
      source: 'mock',
      timestamp: Date.now()
    };
    if (this.onVoteCallback) {
      this.onVoteCallback(payload);
    }
    return payload;
  }

  emitPostMatchChatter(winningTeam, onMessageCallback) {
    if (!this.roster || this.roster.length === 0) return [];
    const goodReactions = [
      'GG STREAMER!!',
      'TEAM GOOD FTW! 😇',
      'Ez points ez life!',
      'Shield carried hard!',
      'Best guardian angels in the game!'
    ];
    const badReactions = [
      'RIP STREAMER LMAO 💀',
      'TEAM BAD DESTROYED YOU!',
      'My horde was unstoppable!',
      'FREE CHANNEL POINTS SABOTEURS WIN!',
      'That jam was brutal lol'
    ];
    const saltReactions = [
      'NOOO MY CHANNEL POINTS 😭',
      'Rigged! Chat threw!',
      'I believed in you streamer...',
      'Unlucky rng Sadge'
    ];
    const count = Math.min(6, Math.max(3, Math.floor(this.roster.length / 4)));
    const messages = [];
    const shuffledBots = [...this.roster].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const bot = shuffledBots[i % shuffledBots.length];
      let text = '';
      if (winningTeam === 'refund') {
        text = 'Refunded! Push tie gg';
      } else if (winningTeam === 'good') {
        text = i % 3 === 0
          ? saltReactions[Math.floor(Math.random() * saltReactions.length)]
          : goodReactions[Math.floor(Math.random() * goodReactions.length)];
      } else {
        text = i % 3 === 0
          ? saltReactions[Math.floor(Math.random() * saltReactions.length)]
          : badReactions[Math.floor(Math.random() * badReactions.length)];
      }
      const msg = { user: bot, text, timestamp: Date.now() + i * 250 };
      messages.push(msg);
      if (onMessageCallback) {
        setTimeout(() => onMessageCallback(msg), i * 300);
      }
    }
    return messages;
  }

  getStatus() {
    return {
      running: this.running,
      preset: this.preset,
      activeBots: this.running ? this.roster.length : 0,
      rate: this.rate,
      phase: this.phase
    };
  }
}

export const botSwarm = new BotSwarmEngine();
export default botSwarm;
