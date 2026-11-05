/** @format */

class APGNetwork {
	constructor() {
		this.ws = null;
		this.connected = false;
		this.isMock = false;
		this.hasHelixAuth = false;
		this.channel = "";
		this.viewerCount = 0;
		this.reconnectDelay = 1000;
		this.maxReconnectDelay = 5000;
		this.listeners = {
			action: [],
			vote: [],
			status: [],
			prediction: [],
			predictionLocked: [],
			charge: [],
			outcomeResolved: [],
		};
		this.lastAudioCue = { good: 0, bad: 0 };
		this.lastOutcome = null;
		this.reconnectTimer = null;
		this.localTimer = null;
		this.prediction = this._createDefaultPrediction();
		this.lockedPrediction = null;
		this.chargeState = {};
	}

	_createDefaultPrediction(level = 1, durationSeconds = 60) {
		return {
			status: "IDLE",
			mode: "chat",
			level: level,
			title: "Will Chat be GOOD or BAD this run?",
			remainingSeconds: durationSeconds,
			durationSeconds: durationSeconds,
			goodCount: 0,
			badCount: 0,
			goodPct: 50,
			badPct: 50,
			recentGoodVoters: [],
			recentBadVoters: [],
			totalVoters: 0,
			lockRequested: false,
		};
	}

	_stopLocalTimer() {
		if (this.localTimer) {
			clearInterval(this.localTimer);
			this.localTimer = null;
		}
	}

	_applyPredictionState(predData) {
		if (!predData || typeof predData !== "object") return;
		this.prediction = Object.assign({}, this.prediction, predData);
		if (predData.status === "LOCKED") {
			this.lockedPrediction = Object.assign({}, this.lockedPrediction || {}, predData);
		}
	}

	send(payload) {
		if (this.ws && this.ws.readyState === 1) {
			try {
				this.ws.send(JSON.stringify(payload));
				return true;
			} catch (err) {
				return false;
			}
		}
		return false;
	}

	sendMatchOutcome(payload) {
		return this.send(Object.assign({ type: "MATCH_OUTCOME" }, payload));
	}

	startPrediction(level = 1, durationSeconds = 60) {
		this._stopLocalTimer();
		this.prediction = this._createDefaultPrediction(level, durationSeconds);
		this.prediction.status = "LOBBY";
		this.chargeState = {};

		this.send({ type: "START_PREDICTION", level: level });

		var self = this;
		this.localTimer = setInterval(function () {
			if (!self.connected && self.prediction && self.prediction.status === "LOBBY") {
				self.prediction.remainingSeconds = Math.max(0, (self.prediction.remainingSeconds || 0) - 1);
				for (var i = 0; i < self.listeners.prediction.length; i++) {
					self.listeners.prediction[i](self.prediction);
				}
				if (self.prediction.remainingSeconds <= 0) {
					self.lockPrediction();
				}
			}
		}, 1000);
	}

	lockPrediction() {
		this._stopLocalTimer();
		if (this.send({ type: "LOCK_PREDICTION" })) {
			if (this.prediction) {
				this.prediction.lockRequested = true;
			}
			return;
		}

		if (!this.connected && this.prediction) {
			this.prediction.status = "LOCKED";
			this.prediction.remainingSeconds = 0;
			this.lockedPrediction = {
				status: "LOCKED",
				mode: "chat",
				level: this.prediction.level,
				goodCount: this.prediction.goodCount || 0,
				badCount: this.prediction.badCount || 0,
				goodPct: typeof this.prediction.goodPct === "number" ? this.prediction.goodPct : 50,
				badPct: typeof this.prediction.badPct === "number" ? this.prediction.badPct : 50,
				teamGood: this.prediction.recentGoodVoters || [],
				teamBad: this.prediction.recentBadVoters || [],
			};
			for (var i = 0; i < this.listeners.predictionLocked.length; i++) {
				self_notifyLocked(this.listeners.predictionLocked[i], this.lockedPrediction);
			}
		}
	}

	connect(url) {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		var wsUrl =
			url ||
			(window.location.protocol === "https:" ? "wss://" : "ws://") +
				(window.location.host || "localhost:8080");

		try {
			this.ws = new WebSocket(wsUrl);
		} catch (e) {
			this._scheduleReconnect(url);
			return;
		}

		var self = this;

		this.ws.onopen = function () {
			self.connected = true;
			self.reconnectDelay = 1000;
			self._notifyStatus();
			if (typeof g_state !== "undefined" && g_state === STATE_LOBBY && self.prediction && self.prediction.status === "LOBBY") {
				self.send({ type: "START_PREDICTION", level: self.prediction.level || 1 });
			}
		};

		this.ws.onmessage = function (event) {
			try {
				if (!event || typeof event.data !== "string") return;
				var data = JSON.parse(event.data);
				if (!data || typeof data.type !== "string") return;

				if (data.type === "STATUS") {
					self.connected = !!data.connected;
					self.channel = data.channel || "";
					self.viewerCount = data.viewers || 0;
					self.isMock = data.mode === "mock";
					self.hasHelixAuth = !!data.hasHelixAuth;
					if (data.prediction) {
						self._applyPredictionState(data.prediction);
					}
					self._notifyStatus();
				} else if (data.type === "PREDICTION_STATE") {
					self._stopLocalTimer();
					self._applyPredictionState(data);
					for (var p = 0; p < self.listeners.prediction.length; p++) {
						self.listeners.prediction[p](self.prediction);
					}
				} else if (data.type === "PREDICTION_LOCKED") {
					self._stopLocalTimer();
					self.lockedPrediction = data;
					self.prediction = Object.assign({}, self.prediction, data, {
						status: "LOCKED",
						remainingSeconds: 0,
					});
					for (var l = 0; l < self.listeners.predictionLocked.length; l++) {
						self.listeners.predictionLocked[l](self.lockedPrediction);
					}
				} else if (data.type === "CHARGE_UPDATE") {
					if (typeof data.action === "string") {
						self.chargeState[data.action] = data;
					}
					for (var c = 0; c < self.listeners.charge.length; c++) {
						self.listeners.charge[c](data);
					}
				} else if (data.type === "ACTION") {
					if (typeof data.action !== "string" || typeof data.team !== "string") return;
					self.playActionSound(data.team);
					for (var i = 0; i < self.listeners.action.length; i++) {
						self.listeners.action[i](data);
					}
				} else if (data.type === "VOTE") {
					if (typeof data.team !== "string") return;
					for (var j = 0; j < self.listeners.vote.length; j++) {
						self.listeners.vote[j](data);
					}
				} else if (data.type === "OUTCOME_RESOLVED") {
					self.lastOutcome = data;
					for (var r = 0; r < self.listeners.outcomeResolved.length; r++) {
						self.listeners.outcomeResolved[r](data);
					}
				}
			} catch (err) {
				// Discard invalid or malformed packets silently
			}
		};

		this.ws.onclose = function () {
			self.connected = false;
			self._notifyStatus();
			self._scheduleReconnect(url);
		};

		this.ws.onerror = function () {
			console.warn("[APGNetwork] Connection error");
		};
	}

	_scheduleReconnect(url) {
		var self = this;
		var jitter = Math.random() * 500;
		var delay = Math.min(this.maxReconnectDelay, this.reconnectDelay * 1.5) + jitter;
		this.reconnectDelay = delay;
		this.reconnectTimer = setTimeout(function () {
			self.connect(url);
		}, delay);
	}

	_notifyStatus() {
		var statusObj = {
			connected: this.connected,
			isMock: this.isMock,
			hasHelixAuth: this.hasHelixAuth,
			channel: this.channel,
			viewerCount: this.viewerCount,
		};
		for (var i = 0; i < this.listeners.status.length; i++) {
			this.listeners.status[i](statusObj);
		}
	}

	onAction(callback) {
		if (typeof callback === "function") {
			this.listeners.action.push(callback);
		}
	}

	onVote(callback) {
		if (typeof callback === "function") {
			this.listeners.vote.push(callback);
		}
	}

	onStatus(callback) {
		if (typeof callback === "function") {
			this.listeners.status.push(callback);
		}
	}

	onPrediction(callback) {
		if (typeof callback === "function") {
			this.listeners.prediction.push(callback);
		}
	}

	onPredictionLocked(callback) {
		if (typeof callback === "function") {
			this.listeners.predictionLocked.push(callback);
		}
	}

	onCharge(callback) {
		if (typeof callback === "function") {
			this.listeners.charge.push(callback);
		}
	}

	onOutcomeResolved(callback) {
		if (typeof callback === "function") {
			this.listeners.outcomeResolved.push(callback);
		}
	}

	playActionSound(team) {
		var now = Date.now();
		if (team === "good") {
			if (now - this.lastAudioCue.good < 200) return;
			this.lastAudioCue.good = now;
			if (typeof soundTeamGood !== "undefined") {
				soundTeamGood.play();
			}
		} else if (team === "bad") {
			if (now - this.lastAudioCue.bad < 200) return;
			this.lastAudioCue.bad = now;
			if (typeof soundTeamBad !== "undefined") {
				soundTeamBad.play();
			}
		}
	}

	renderBadge() {
		if (typeof mainCanvasSize === "undefined") return;

		var x = mainCanvasSize.x - 12;
		var y = 20;
		var fontSize = 14;

		if (this.connected) {
			if (this.isMock) {
				// DEV MOCK: Amber dot
				drawTextScreen("● DEV MOCK", vec2(x, y), fontSize, new Color(1, 0.7, 0.1), 2, colorBlack, "right");
			} else {
				// LIVE: Bright Green dot with channel name and optional viewer count
				var badgeText =
					"● LIVE #" +
					(this.channel || "channel") +
					(this.viewerCount > 0 ? " | " + this.viewerCount + " viewers" : "");
				drawTextScreen(badgeText, vec2(x, y), fontSize, new Color(0.2, 1, 0.3), 2, colorBlack, "right");
			}
		} else {
			// RECONNECTING: Flashing red/amber dot using LittleJS frame counter
			var blink = typeof frame !== "undefined" ? Math.sin(frame / 10) > 0 : true;
			var col = blink ? new Color(1, 0.2, 0.2) : new Color(0.5, 0.5, 0.5);
			drawTextScreen("○ RECONNECTING...", vec2(x, y), fontSize, col, 2, colorBlack, "right");
		}

		if (typeof g_state !== "undefined" && g_state === STATE_PLAYING && this.lockedPrediction) {
			var goodPct = typeof this.lockedPrediction.goodPct === "number" ? this.lockedPrediction.goodPct : 50;
			var badPct = typeof this.lockedPrediction.badPct === "number" ? this.lockedPrediction.badPct : 50;
			var predText = "PREDICTED: " + goodPct + "% GOOD / " + badPct + "% BAD";
			drawTextScreen(predText, vec2(x, 38), 13, colorBullet, 2, colorBlack, "right");
		}

		if (typeof g_state !== "undefined" && g_state === STATE_PLAYING) {
			var mobCount = typeof g_enemies !== "undefined" ? g_enemies.length : 0;
			var isFinalStand = typeof g_apgManager !== "undefined" && g_apgManager && g_apgManager.finalStand;
			var mobText = "MOBS: " + mobCount + "/25" + (isFinalStand ? " [FINAL STAND]" : mobCount >= 25 ? " [MAX]" : "");
			var mobCol = mobCount >= 25 || isFinalStand ? colorBlood : colorZombie;
			drawTextScreen(mobText, vec2(x, this.lockedPrediction ? 55 : 38), 13, mobCol, 2, colorBlack, "right");
		}
	}
}

function self_notifyLocked(cb, payload) {
	if (typeof cb === "function") {
		cb(payload);
	}
}

var g_apgNetwork = new APGNetwork();
