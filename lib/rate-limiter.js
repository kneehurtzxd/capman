/**
 * Rate Limiter for handling API requests and batch downloads.
 */
class RateLimiter {
  constructor(maxConcurrent = 2, delayMs = 1500) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
    this.active = 0;
    this.queue = [];
  }

  /**
   * Executed a function with rate limiting.
   * @param {Function} fn - Async function to execute.
   * @returns {Promise}
   */
  async execute(fn) {
    if (this.active >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.active++;
    try {
      const result = await fn();
      // Ensure minimum delay between requests logic can be added here
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
      return result;
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  /**
   * Executes a function with exponential backoff retry.
   * @param {Function} fn
   * @param {number} maxRetries
   * @param {number} baseDelay
   * @param {number} multiplier
   */
  async executeWithRetry(fn, maxRetries = 3, baseDelay = 5000, multiplier = 2.5) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(fn);
      } catch (error) {
        if (attempt === maxRetries) throw error;

        // Handle 429 or other retryable errors (network)
        if (error.status === 429 || error.message.includes('429') || error.message.includes('network')) {
          const delay = baseDelay * Math.pow(multiplier, attempt);
          console.log(`Rate limited. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RateLimiter;
} else {
  (typeof globalThis !== 'undefined' ? globalThis : window).RateLimiter = RateLimiter;
}
