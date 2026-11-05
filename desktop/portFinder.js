import net from 'net';

/**
 * Checks whether a specific port is currently available on the given host.
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>}
 */
export function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port, host);
  });
}

/**
 * Probes preferred port (8085) and sequentially scans fallback range (8086–8105).
 * @param {number} startPort Default 8085
 * @param {number} maxAttempts Default 20
 * @param {string} host Default '127.0.0.1'
 * @returns {Promise<number>} Resolved available port
 */
export async function findAvailablePort(startPort = 8085, maxAttempts = 20, host = '127.0.0.1') {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const port = startPort + offset;
    const free = await isPortAvailable(port, host);
    if (free) {
      return port;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${startPort + maxAttempts - 1} on host ${host}`);
}
