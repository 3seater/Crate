/**
 * API request queue to prevent rate limiting.
 * Throttles requests with minimum delay between calls.
 */
import { metrics } from "@sentry/nextjs";

class ApiQueue {
  private readonly queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRequest = 0;
  private readonly minDelay = 100; // 100ms between requests

  /**
   * Add a request to the queue
   */
  add<T>(fn: () => Promise<T>): Promise<T> {
    const queuedAt = Date.now();
    metrics.count("api_queue_enqueued", 1);

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        const startedAt = Date.now();
        metrics.distribution("api_queue_wait_ms", startedAt - queuedAt, {
          unit: "millisecond",
        });

        try {
          const result = await fn();
          metrics.count("api_queue_success", 1);
          resolve(result);
        } catch (error) {
          metrics.count("api_queue_failure", 1);
          reject(error);
        } finally {
          metrics.distribution(
            "api_queue_execution_ms",
            Date.now() - startedAt,
            {
              unit: "millisecond",
            }
          );
          metrics.gauge("api_queue_depth", this.queue.length);
        }
      });
      metrics.gauge("api_queue_depth", this.queue.length);
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequest;

      if (timeSinceLastRequest < this.minDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minDelay - timeSinceLastRequest)
        );
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastRequest = Date.now();
        await fn();
      }
    }
    this.processing = false;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

export const apiQueue = new ApiQueue();
