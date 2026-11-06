const HIGH_IMPACT_ACTIONS = new Set(['boss', 'blackout']);
export const STANDARD_ACTIONS = new Set(['ammo', 'repair', 'slow', 'mob']);
export const ULTIMATE_ACTIONS = new Set(['light', 'barrier', 'boss', 'blackout', 'jam', 'frenzy']);
export const GOOD_ACTION_SET = new Set(['ammo', 'repair', 'light', 'slow', 'barrier']);
const ALL_ACTIONS = [
  'ammo',
  'repair',
  'light',
  'slow',
  'barrier',
  'mob',
  'boss',
  'blackout',
  'jam',
  'frenzy'
];

export class CooldownManager {
  constructor(rateLimits = {}) {
    this.baseCooldownMs = rateLimits.baseCooldownMs ?? 3000;
    this.bossCooldownMs = rateLimits.bossCooldownMs ?? 4000;
    this.blackoutCooldownMs = rateLimits.blackoutCooldownMs ?? 8000;
    this.userThrottleMs = rateLimits.userThrottleMs ?? 2000;
    this.minCooldownMs = 500;

    // Rolling 5-second window of message timestamps
    this.messageTimestamps = [];
    // Per-user last action timestamp: Map<username, timestamp>
    this.userLastAction = new Map();
    // Per-action last execution timestamp: Map<action, timestamp>
    this.actionLastExecuted = new Map();

    // Community Action Charge Gauge state (RELAY-04)
    this.chargeBuckets = new Map();
    this.mvpContributions = {
      good: new Map(),
      bad: new Map()
    };
    this.levelTallies = {
      goodActions: 0,
      badActions: 0
    };
  }

  updateConfig(rateLimits = {}) {
    if (typeof rateLimits.baseCooldownMs === 'number') this.baseCooldownMs = rateLimits.baseCooldownMs;
    if (typeof rateLimits.bossCooldownMs === 'number') this.bossCooldownMs = rateLimits.bossCooldownMs;
    if (typeof rateLimits.blackoutCooldownMs === 'number') this.blackoutCooldownMs = rateLimits.blackoutCooldownMs;
    if (typeof rateLimits.userThrottleMs === 'number') this.userThrottleMs = rateLimits.userThrottleMs;
  }

  _pruneWindow(now) {
    const cutoff = now - 5000;
    while (this.messageTimestamps.length > 0 && this.messageTimestamps[0] < cutoff) {
      this.messageTimestamps.shift();
    }
  }

  getChatVelocityFactor(now = Date.now()) {
    this._pruneWindow(now);
    const messagesPerSecond = this.messageTimestamps.length / 5;
    // Scale gently: 10 msgs/sec -> +0.5 velocity factor, capped at 2.0
    return Math.min(2.0, messagesPerSecond / 20);
  }

  getEffectiveCooldown(action, viewerCount = 0, now = Date.now()) {
    const cleanAction = String(action || '').toLowerCase();
    let cBase = this.baseCooldownMs;
    if (cleanAction === 'boss') {
      cBase = this.bossCooldownMs;
    } else if (cleanAction === 'blackout') {
      cBase = this.blackoutCooldownMs;
    }
    const v = Math.max(0, Number(viewerCount) || 0);
    const chatVelocityFactor = this.getChatVelocityFactor(now);

    const cEffective = Math.max(
      this.minCooldownMs,
      cBase * (1 + Math.min(v, 100) / 50) * (1 + chatVelocityFactor)
    );
    return Math.round(cEffective);
  }

  getRequiredCharges(action, viewerCount = 0, swarmPreset = null) {
    const cleanAction = String(action || '').toLowerCase();
    const v = Math.max(0, Number(viewerCount) || 0);

    if (swarmPreset === 'solo' || (v <= 3 && swarmPreset !== 'class' && swarmPreset !== 'chaos')) {
      return 1;
    }

    if (swarmPreset === 'chaos' || v > 30) {
      if (STANDARD_ACTIONS.has(cleanAction)) return 5;
      if (HIGH_IMPACT_ACTIONS.has(cleanAction)) return 15;
      return 10;
    }

    // Medium / Classroom (4-30 viewers or swarmPreset === 'class')
    if (STANDARD_ACTIONS.has(cleanAction)) return 3;
    if (HIGH_IMPACT_ACTIONS.has(cleanAction)) return 8;
    return 5;
  }

  _recordContribution(displayName, team) {
    const cleanTeam = team === 'bad' ? 'bad' : 'good';
    const map = this.mvpContributions[cleanTeam];
    map.set(displayName, (map.get(displayName) || 0) + 1);
  }

  checkAction(user, action, viewerCount = 0, options = {}) {
    const now = Date.now();
    const displayName = String(user || 'Anonymous').trim().replace(/^@/, '') || 'Anonymous';
    const normalizedUser = displayName.toLowerCase();
    const cleanAction = String(action || '').toLowerCase();
    const team = options.team || (GOOD_ACTION_SET.has(cleanAction) ? 'good' : 'bad');
    const bypassCooldown = Boolean(options.bypassCooldown);
    const required = this.getRequiredCharges(cleanAction, viewerCount, options.swarmPreset);

    // Record incoming activity in rolling velocity window
    this.messageTimestamps.push(now);
    this._pruneWindow(now);

    if (cleanAction === 'divine_flash') {
      return {
        allowed: true,
        completed: true,
        current: 1,
        required: 1,
        user: displayName,
        contributors: [displayName],
        effectiveCooldownMs: 0,
        levelTallies: { ...this.levelTallies }
      };
    }

    if (bypassCooldown) {
      this.chargeBuckets.set(cleanAction, { count: 0, contributors: [] });
      this.userLastAction.set(normalizedUser, now);
      this.actionLastExecuted.set(cleanAction, now);
      this._recordContribution(displayName, team);
      this.levelTallies[team === 'good' ? 'goodActions' : 'badActions']++;

      return {
        allowed: true,
        completed: true,
        current: required,
        required,
        user: displayName,
        contributors: [displayName],
        effectiveCooldownMs: 0,
        levelTallies: { ...this.levelTallies },
        chargePacket: {
          type: 'CHARGE_UPDATE',
          action: cleanAction,
          team,
          current: required,
          required,
          user: displayName,
          contributors: [displayName],
          completed: true,
          timestamp: now,
          levelTallies: { ...this.levelTallies }
        }
      };
    }

    // 1. Check per-user throttle (2000ms)
    const lastUserTime = this.userLastAction.get(normalizedUser);
    if (lastUserTime !== undefined) {
      const elapsedUser = now - lastUserTime;
      if (elapsedUser < this.userThrottleMs) {
        return {
          allowed: false,
          reason: 'user_throttled',
          remainingMs: this.userThrottleMs - elapsedUser,
          levelTallies: { ...this.levelTallies }
        };
      }
    }

    // 2. Check dynamic viewer-scaled action cooldown
    const effectiveCooldown = this.getEffectiveCooldown(cleanAction, viewerCount, now);
    const lastActionTime = this.actionLastExecuted.get(cleanAction);
    if (lastActionTime !== undefined) {
      const elapsedAction = now - lastActionTime;
      if (elapsedAction < effectiveCooldown) {
        return {
          allowed: false,
          reason: 'action_cooldown',
          remainingMs: effectiveCooldown - elapsedAction,
          effectiveCooldownMs: effectiveCooldown,
          levelTallies: { ...this.levelTallies }
        };
      }
    }

    // Passed throttle & cooldown: record per-user timestamp
    this.userLastAction.set(normalizedUser, now);

    // Accumulate community charge
    const bucket = this.chargeBuckets.get(cleanAction) || { count: 0, contributors: [] };
    bucket.count += 1;
    if (!bucket.contributors.includes(displayName)) {
      bucket.contributors.push(displayName);
    }
    this.chargeBuckets.set(cleanAction, bucket);
    this._recordContribution(displayName, team);

    if (bucket.count < required) {
      const contributorsSnapshot = [...bucket.contributors];
      return {
        allowed: false,
        reason: 'charging',
        completed: false,
        current: bucket.count,
        required,
        user: displayName,
        contributors: contributorsSnapshot,
        levelTallies: { ...this.levelTallies },
        chargePacket: {
          type: 'CHARGE_UPDATE',
          action: cleanAction,
          team,
          current: bucket.count,
          required,
          user: displayName,
          contributors: contributorsSnapshot,
          completed: false,
          timestamp: now,
          levelTallies: { ...this.levelTallies }
        }
      };
    }

    // Charge reached 100%
    const finalContributors = [...bucket.contributors];
    this.chargeBuckets.set(cleanAction, { count: 0, contributors: [] });
    this.actionLastExecuted.set(cleanAction, now);
    this.levelTallies[team === 'good' ? 'goodActions' : 'badActions']++;

    return {
      allowed: true,
      completed: true,
      current: required,
      required,
      user: displayName,
      contributors: finalContributors,
      effectiveCooldownMs: effectiveCooldown,
      levelTallies: { ...this.levelTallies },
      chargePacket: {
        type: 'CHARGE_UPDATE',
        action: cleanAction,
        team,
        current: required,
        required,
        user: displayName,
        contributors: finalContributors,
        completed: true,
        timestamp: now,
        levelTallies: { ...this.levelTallies }
      }
    };
  }

  resetCharges() {
    this.chargeBuckets.clear();
    this.actionLastExecuted.clear();
    this.userLastAction.clear();
    this.levelTallies = {
      goodActions: 0,
      badActions: 0
    };
  }

  getChargeState(viewerCount = 0, swarmPreset = null) {
    const actions = {};
    for (const act of ALL_ACTIONS) {
      const bucket = this.chargeBuckets.get(act) || { count: 0, contributors: [] };
      actions[act] = {
        current: bucket.count,
        required: this.getRequiredCharges(act, viewerCount, swarmPreset),
        contributors: [...bucket.contributors]
      };
    }
    return {
      actions,
      levelTallies: { ...this.levelTallies }
    };
  }

  reset() {
    this.messageTimestamps = [];
    this.resetCharges();
    this.mvpContributions.good.clear();
    this.mvpContributions.bad.clear();
  }
}

export const cooldownManager = new CooldownManager();
export default cooldownManager;
