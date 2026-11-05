import {
  createChannelPrediction,
  getChannelPrediction,
  lockChannelPrediction,
  resolveChannelPrediction,
  cancelChannelPrediction
} from './twitchHelix.js';

export class PredictionManager {
  constructor() {
    this.status = 'IDLE'; // 'IDLE' | 'LOBBY' | 'LOCKED' | 'RESOLVED'
    this.mode = 'chat'; // 'helix' | 'chat'
    this.level = 1;
    this.title = 'Will Chat be GOOD or BAD this run?';
    this.durationSeconds = 60;
    this.remainingSeconds = 60;
    this.votesByUser = new Map();
    this.helixData = {
      predictionId: null,
      outcomes: null,
      goodUsers: 0,
      badUsers: 0,
      goodPoints: 0,
      badPoints: 0
    };
    this.lockedResult = null;
    this.outcomeResult = null;
    this.tickInterval = null;
    this.helixPollInterval = null;
    this.onStateCallback = null;
    this.onLockedCallback = null;
    this.onOutcomeResolvedCallback = null;
    this.onPhaseChangeCallback = null;
  }

  stopTimers() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.helixPollInterval) {
      clearInterval(this.helixPollInterval);
      this.helixPollInterval = null;
    }
  }

  setDuration(seconds) {
    const num = Number(seconds);
    if (!Number.isFinite(num) || num <= 0) return this.durationSeconds;
    this.durationSeconds = Math.max(5, Math.min(1800, Math.round(num)));
    if (this.status === 'IDLE') {
      this.remainingSeconds = this.durationSeconds;
    }
    return this.durationSeconds;
  }

  async _syncHelixPredictors() {
    if (this.status !== 'LOBBY' || this.mode !== 'helix' || !this.helixData.predictionId) {
      return;
    }
    const pred = await getChannelPrediction(this.helixData.predictionId);
    if (!pred || !Array.isArray(pred.outcomes)) return;

    const goodOutcome = pred.outcomes[0];
    const badOutcome = pred.outcomes[1];
    let changed = false;

    if (goodOutcome) {
      this.helixData.goodUsers = Number(goodOutcome.users) || 0;
      this.helixData.goodPoints = Number(goodOutcome.channelPoints) || 0;
      for (const predictorName of goodOutcome.topPredictors || []) {
        const displayName = String(predictorName || '').trim().replace(/^@/, '');
        if (!displayName) continue;
        const key = displayName.toLowerCase();
        if (!this.votesByUser.has(key)) {
          this.votesByUser.set(key, {
            displayName,
            team: 'good',
            source: 'helix',
            timestamp: Date.now()
          });
          changed = true;
        }
      }
    }

    if (badOutcome) {
      this.helixData.badUsers = Number(badOutcome.users) || 0;
      this.helixData.badPoints = Number(badOutcome.channelPoints) || 0;
      for (const predictorName of badOutcome.topPredictors || []) {
        const displayName = String(predictorName || '').trim().replace(/^@/, '');
        if (!displayName) continue;
        const key = displayName.toLowerCase();
        if (!this.votesByUser.has(key)) {
          this.votesByUser.set(key, {
            displayName,
            team: 'bad',
            source: 'helix',
            timestamp: Date.now()
          });
          changed = true;
        }
      }
    }

    if (changed) {
      this._emitState();
    }
  }

  _emitState() {
    const payload = this.getStatePayload();
    if (this.onStateCallback) {
      this.onStateCallback(payload);
    }
    return payload;
  }

  async startPrediction({ level = 1, durationSeconds = this.durationSeconds } = {}) {
    this.stopTimers();

    this.status = 'LOBBY';
    this.level = Math.max(1, Number(level) || 1);
    const cleanDuration = Math.max(5, Math.min(1800, Number(durationSeconds) || this.durationSeconds || 60));
    this.durationSeconds = cleanDuration;
    this.remainingSeconds = cleanDuration;
    this.votesByUser.clear();
    this.helixData = {
      predictionId: null,
      outcomes: null,
      goodUsers: 0,
      badUsers: 0,
      goodPoints: 0,
      badPoints: 0
    };
    this.lockedResult = null;
    this.outcomeResult = null;

    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback('LOBBY', this.level);
    }

    const helixRes = await createChannelPrediction({
      title: this.title,
      durationSeconds: this.durationSeconds
    });

    this.mode = helixRes && helixRes.ok ? 'helix' : 'chat';
    this.helixData.predictionId = (helixRes && helixRes.predictionId) || null;
    this.helixData.outcomes = (helixRes && helixRes.outcomes) || null;

    this._emitState();

    this.tickInterval = setInterval(() => {
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      if (this.remainingSeconds <= 0) {
        this.lockPrediction('timer');
      } else {
        this._emitState();
      }
    }, 1000);

    if (this.mode === 'helix' && this.helixData.predictionId) {
      this.helixPollInterval = setInterval(() => {
        this._syncHelixPredictors();
      }, 2500);
    }

    return this.getStatePayload();
  }

  registerVote({ user, team, source = 'irc', timestamp = Date.now() } = {}) {
    if (this.status !== 'LOBBY') {
      return {
        accepted: false,
        reason: 'prediction_not_open',
        state: this.getStatePayload()
      };
    }

    const displayName = String(user || 'Anonymous').trim().replace(/^@/, '') || 'Anonymous';
    const key = displayName.toLowerCase();
    const cleanTeam = String(team || 'good').toLowerCase() === 'bad' ? 'bad' : 'good';

    const existing = this.votesByUser.get(key);
    if (existing && existing.team === cleanTeam) {
      return {
        accepted: false,
        reason: 'duplicate_vote',
        switched: false,
        state: this.getStatePayload()
      };
    }

    const switched = Boolean(existing && existing.team !== cleanTeam);
    if (existing) {
      this.votesByUser.delete(key);
    }
    this.votesByUser.set(key, {
      displayName,
      team: cleanTeam,
      source,
      timestamp
    });

    const state = this._emitState();
    return {
      accepted: true,
      switched,
      team: cleanTeam,
      user: displayName,
      state
    };
  }

  computeTallies() {
    const teamGood = [];
    const teamBad = [];

    for (const entry of this.votesByUser.values()) {
      if (entry.team === 'bad') {
        teamBad.push(entry.displayName);
      } else {
        teamGood.push(entry.displayName);
      }
    }

    const goodCount = Math.max(teamGood.length, this.helixData.goodUsers || 0);
    const badCount = Math.max(teamBad.length, this.helixData.badUsers || 0);
    const totalCount = goodCount + badCount;

    let goodPct = 50;
    let badPct = 50;

    if (totalCount > 0 && goodCount !== badCount) {
      goodPct = Math.round((goodCount / totalCount) * 100);
      badPct = 100 - goodPct;
    }

    const recentGoodVoters = teamGood.slice(-6).reverse();
    const recentBadVoters = teamBad.slice(-6).reverse();

    return {
      goodCount,
      badCount,
      totalVoters: totalCount,
      goodPct,
      badPct,
      teamGood,
      teamBad,
      recentGoodVoters,
      recentBadVoters,
      goodPoints: this.helixData.goodPoints || 0,
      badPoints: this.helixData.badPoints || 0
    };
  }

  async lockPrediction(reason = 'manual') {
    if (this.status === 'LOCKED' && this.lockedResult) {
      return this.lockedResult;
    }

    this.stopTimers();
    this.status = 'LOCKED';
    this.remainingSeconds = 0;

    if (this.mode === 'helix' && this.helixData.predictionId) {
      await lockChannelPrediction(this.helixData.predictionId);
    }

    const tallies = this.computeTallies();
    this.lockedResult = {
      type: 'PREDICTION_LOCKED',
      status: 'LOCKED',
      reason,
      mode: this.mode,
      level: this.level,
      title: this.title,
      goodCount: tallies.goodCount,
      badCount: tallies.badCount,
      totalVoters: tallies.totalVoters,
      goodPct: tallies.goodPct,
      badPct: tallies.badPct,
      teamGood: tallies.teamGood,
      teamBad: tallies.teamBad,
      recentGoodVoters: tallies.recentGoodVoters,
      recentBadVoters: tallies.recentBadVoters,
      predictionId: this.helixData.predictionId,
      outcomes: this.helixData.outcomes,
      timestamp: Date.now()
    };

    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback('PLAYING', this.level);
    }

    if (this.onLockedCallback) {
      this.onLockedCallback(this.lockedResult);
    }

    return this.lockedResult;
  }

  calculateMultiplier(winner) {
    if (winner === 'refund') {
      return { multiplier: 1.0, multiplierText: '1:1.0x (REFUNDED)' };
    }
    let ratio = 1.0;
    if (this.mode === 'helix' && (this.helixData.goodPoints > 0 || this.helixData.badPoints > 0)) {
      const totalPoints = this.helixData.goodPoints + this.helixData.badPoints;
      const winningPoints = winner === 'good' ? this.helixData.goodPoints : this.helixData.badPoints;
      ratio = winningPoints > 0 ? (totalPoints / winningPoints) : 1.0;
    } else {
      const tallies = this.computeTallies();
      const totalVotes = tallies.totalVoters;
      const winningVotes = winner === 'good' ? tallies.goodCount : tallies.badCount;
      ratio = winningVotes > 0 ? (totalVotes / winningVotes) : 1.0;
    }
    const clampedRatio = Math.max(1.0, Math.min(50.0, Number(ratio) || 1.0));
    return {
      multiplier: Math.round(clampedRatio * 100) / 100,
      multiplierText: '1:' + clampedRatio.toFixed(1) + 'x'
    };
  }

  async resolvePrediction(winner, matchOutcome = {}, options = {}) {
    const isForce = Boolean(options.force || matchOutcome.force);
    if (!isForce && this.status === 'RESOLVED' && this.outcomeResult) {
      return this.outcomeResult;
    }

    this.stopTimers();

    const totalActions = (matchOutcome.goodActions || 0) + (matchOutcome.badActions || 0);
    let finalWinner = winner === 'good' ? 'good' : winner === 'bad' ? 'bad' : 'refund';
    let refundReason = null;

    if (totalActions === 0) {
      finalWinner = 'refund';
      refundReason = 'pacifist_zero_actions';
    } else if ((matchOutcome.state === 2 || matchOutcome.winner === 'refund') && totalActions < 3) {
      finalWinner = 'refund';
      refundReason = 'threshold_early_death';
    } else if (matchOutcome.state !== 2 && matchOutcome.finalGoodPct !== undefined && matchOutcome.targetGoodPct !== undefined && matchOutcome.finalGoodPct === matchOutcome.targetGoodPct) {
      finalWinner = 'refund';
      refundReason = 'exact_ratio_tie';
    } else if (winner === 'refund' || matchOutcome.winner === 'refund') {
      finalWinner = 'refund';
      refundReason = matchOutcome.refundReason || matchOutcome.reason || 'manual_refund';
    }

    const multiplierInfo = this.calculateMultiplier(finalWinner);

    if (this.mode === 'helix' && this.helixData.predictionId) {
      if (finalWinner === 'refund') {
        await cancelChannelPrediction(this.helixData.predictionId);
      } else {
        const winningOutcomeId = finalWinner === 'good'
          ? this.helixData.outcomes?.goodOutcomeId
          : this.helixData.outcomes?.badOutcomeId;
        if (winningOutcomeId) {
          await resolveChannelPrediction(this.helixData.predictionId, winningOutcomeId);
        } else {
          await cancelChannelPrediction(this.helixData.predictionId);
        }
      }
    }

    this.status = 'RESOLVED';

    const defaultTallies = this.computeTallies();
    this.outcomeResult = {
      type: 'OUTCOME_RESOLVED',
      status: 'RESOLVED',
      level: this.level,
      winner: finalWinner,
      refundReason: finalWinner === 'refund' ? refundReason : null,
      multiplier: multiplierInfo.multiplier,
      multiplierText: multiplierInfo.multiplierText,
      mode: this.mode,
      predictionId: this.helixData.predictionId,
      matchOutcome: {
        level: this.level,
        winner: finalWinner,
        finalGoodPct: matchOutcome.finalGoodPct ?? defaultTallies.goodPct,
        targetGoodPct: matchOutcome.targetGoodPct ?? defaultTallies.goodPct,
        goodActions: matchOutcome.goodActions ?? 0,
        badActions: matchOutcome.badActions ?? 0,
        totalActions,
        mvpGood: matchOutcome.mvpGood || null,
        mvpBad: matchOutcome.mvpBad || null,
        causeOfDeath: matchOutcome.causeOfDeath || ''
      },
      timestamp: Date.now()
    };

    if (this.onOutcomeResolvedCallback) {
      this.onOutcomeResolvedCallback(this.outcomeResult);
    }

    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback('OUTCOME', this.level);
    }

    this._emitState();
    return this.outcomeResult;
  }

  async cancelActivePrediction(reason = 'manual_reset') {
    if (this.status === 'LOBBY' || this.status === 'LOCKED') {
      if (this.mode === 'helix' && this.helixData.predictionId) {
        await cancelChannelPrediction(this.helixData.predictionId);
      }
      this.stopTimers();
      this.status = 'IDLE';
      this.lockedResult = null;
      this.outcomeResult = null;
      this._emitState();
      return { ok: true, reason };
    }
    return { ok: false, reason: 'not_active' };
  }

  getStatePayload() {
    const tallies = this.computeTallies();
    return {
      type: 'PREDICTION_STATE',
      status: this.status,
      mode: this.mode,
      level: this.level,
      title: this.title,
      remainingSeconds: this.remainingSeconds,
      durationSeconds: this.durationSeconds,
      goodCount: tallies.goodCount,
      badCount: tallies.badCount,
      goodPoints: tallies.goodPoints,
      badPoints: tallies.badPoints,
      goodPct: tallies.goodPct,
      badPct: tallies.badPct,
      recentGoodVoters: tallies.recentGoodVoters,
      recentBadVoters: tallies.recentBadVoters,
      totalVoters: tallies.totalVoters,
      lockedResult: this.lockedResult,
      outcomeResult: this.outcomeResult,
      timestamp: Date.now()
    };
  }
}

export const predictionManager = new PredictionManager();
