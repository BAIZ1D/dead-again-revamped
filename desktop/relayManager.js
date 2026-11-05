import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export class RelayManager {
  /**
   * @param {number} port Allocated port for HTTP/WS
   * @param {string} configPath Absolute path to user config.json
   * @param {string} host Host interface, default '127.0.0.1'
   */
  constructor(port, configPath, host = '127.0.0.1') {
    this.port = port;
    this.configPath = configPath;
    this.host = host;
    this.child = null;
    this.isStopping = false;
  }

  /**
   * Spawns relay child process, injects environment variables, and awaits RELAY_READY IPC handshake.
   * @param {number} timeoutMs Max wait time for readiness (default 10000ms)
   * @returns {Promise<{ type: string, port: number, host: string }>}
   */
  start(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const relayEntry = fileURLToPath(new URL('../relay-server/src/index.js', import.meta.url));

      this.child = fork(relayEntry, [], {
        env: {
          ...process.env,
          PORT: String(this.port),
          APG_CONFIG_PATH: this.configPath,
          APG_HOST: this.host
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      });

      const readyTimer = setTimeout(() => {
        this.stop().catch(() => {});
        reject(new Error(`[RelayManager] Relay server startup timed out after ${timeoutMs}ms on port ${this.port}`));
      }, timeoutMs);

      this.child.on('message', (msg) => {
        if (msg && msg.type === 'RELAY_READY') {
          clearTimeout(readyTimer);
          resolve(msg);
        }
      });

      this.child.on('error', (err) => {
        clearTimeout(readyTimer);
        reject(err);
      });

      this.child.on('exit', (code, signal) => {
        if (!this.isStopping) {
          console.warn(`[RelayManager] Relay process exited unexpectedly with code ${code}, signal ${signal}`);
        }
      });
    });
  }

  /**
   * Sends graceful SHUTDOWN IPC message to relay child with a 1500ms safety timeout,
   * falling back to SIGKILL to guarantee zero zombie processes holding ports.
   * @returns {Promise<void>}
   */
  stop() {
    if (!this.child || this.child.killed) {
      return Promise.resolve();
    }
    this.isStopping = true;

    return new Promise((resolve) => {
      const childRef = this.child;

      const forceKillTimer = setTimeout(() => {
        if (childRef && !childRef.killed) {
          console.warn(`[RelayManager] Relay did not exit in 1500ms; force killing (SIGKILL)`);
          try {
            childRef.kill('SIGKILL');
          } catch (_) {}
        }
        this.child = null;
        resolve();
      }, 1500);

      childRef.once('exit', () => {
        clearTimeout(forceKillTimer);
        this.child = null;
        resolve();
      });

      try {
        if (typeof childRef.send === 'function' && childRef.connected) {
          childRef.send({ type: 'SHUTDOWN' });
        } else {
          childRef.kill('SIGTERM');
        }
      } catch (err) {
        console.warn('[RelayManager] Failed to send SHUTDOWN message, falling back to SIGTERM:', err.message);
        try {
          childRef.kill('SIGTERM');
        } catch (_) {}
      }
    });
  }
}
