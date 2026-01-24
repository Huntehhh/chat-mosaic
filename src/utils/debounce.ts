/**
 * Debounce, Throttle, and Rate Limiting Utilities
 *
 * General-purpose timing utilities for controlling function execution frequency.
 * Note: MessageDebouncer in services/ is specific to message batching.
 * These utilities are for general-purpose use throughout the codebase.
 *
 * @example
 * ```typescript
 * import { debounce, throttle, rateLimit } from '../utils/debounce';
 *
 * // Debounce: Wait for 300ms of inactivity before calling
 * const debouncedSave = debounce((data) => save(data), 300);
 *
 * // Throttle: Call at most once per 100ms
 * const throttledScroll = throttle((e) => handleScroll(e), 100);
 *
 * // Rate limit: Max 5 calls per second
 * const rateLimitedApi = rateLimit((req) => api(req), { maxCalls: 5, windowMs: 1000 });
 * ```
 */

/**
 * Creates a debounced version of a function that delays invocation
 * until after `delay` milliseconds have elapsed since the last call.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return debounced;
}

/**
 * Creates a debounced function that also supports immediate invocation
 * on the leading edge.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @param options - Configuration options
 * @returns Debounced function
 */
export function debounceWithOptions<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
  const { leading = false, trailing = true } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;
  let lastCallTime: number | undefined;
  let leadingCalled = false; // Track if we already executed on leading edge

  const debounced = (...args: Parameters<T>) => {
    const now = Date.now();
    const isFirstCall = lastCallTime === undefined;
    lastArgs = args;
    lastCallTime = now;

    if (leading && isFirstCall) {
      leadingCalled = true;
      fn(...args);
    } else {
      // New call after leading - mark that trailing should fire
      leadingCalled = false;
    }

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      // Only fire trailing if: trailing enabled AND we have args AND
      // (leading wasn't called OR new calls came after leading)
      if (trailing && lastArgs && !leadingCalled) {
        fn(...lastArgs);
      }
      timer = undefined;
      lastArgs = undefined;
      lastCallTime = undefined;
      leadingCalled = false;
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    lastArgs = undefined;
    lastCallTime = undefined;
    leadingCalled = false;
  };

  debounced.flush = () => {
    if (timer && lastArgs) {
      clearTimeout(timer);
      fn(...lastArgs);
      timer = undefined;
      lastArgs = undefined;
      lastCallTime = undefined;
      leadingCalled = false;
    }
  };

  return debounced;
}

/**
 * Creates a throttled version of a function that invokes at most
 * once per `limit` milliseconds.
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let inThrottle = false;
  let lastArgs: Parameters<T> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      timer = setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = undefined;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    inThrottle = false;
    lastArgs = undefined;
  };

  return throttled;
}

/**
 * Creates a rate-limited version of a function that allows at most
 * `maxCalls` invocations within a sliding `windowMs` window.
 *
 * Uses a circular buffer approach for O(1) cleanup instead of O(n) array.shift().
 *
 * @param fn - Function to rate limit
 * @param options - Rate limiting options
 * @returns Rate-limited function that returns true if called, false if rate limited
 */
export function rateLimit<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: { maxCalls: number; windowMs: number }
): (...args: Parameters<T>) => boolean {
  // Use a fixed-size circular buffer for O(1) operations
  const calls: number[] = new Array(options.maxCalls).fill(0);
  let head = 0; // Next position to write
  let count = 0; // Current number of valid entries

  return (...args: Parameters<T>): boolean => {
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Remove expired entries from the tail (oldest entries)
    // In a circular buffer, we check from the oldest entry forward
    while (count > 0) {
      const tailIdx = (head - count + options.maxCalls) % options.maxCalls;
      if (calls[tailIdx] < windowStart) {
        count--;
      } else {
        break;
      }
    }

    if (count >= options.maxCalls) {
      return false;
    }

    // Add new entry at head
    calls[head] = now;
    head = (head + 1) % options.maxCalls;
    count++;

    fn(...args);
    return true;
  };
}

/**
 * Creates a function that delays invocation by a specified amount.
 * Useful for intentional delays (e.g., animation timing).
 *
 * @param fn - Function to delay
 * @param delay - Delay in milliseconds
 * @returns Delayed function
 */
export function delay<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fn(...args) as ReturnType<T>);
      }, delayMs);
    });
  };
}

/**
 * Creates a function that only executes after being called n times.
 * Useful for waiting for multiple async operations to complete.
 *
 * @param n - Number of calls before execution
 * @param fn - Function to execute after n calls
 * @returns Function that tracks calls
 */
export function after<T extends (...args: unknown[]) => unknown>(
  n: number,
  fn: T
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let count = 0;
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    count++;
    if (count >= n) {
      return fn(...args) as ReturnType<T>;
    }
    return undefined;
  };
}

/**
 * Creates a function that can only be called once.
 * Subsequent calls return the result of the first call.
 *
 * @param fn - Function to wrap
 * @returns Function that only executes once
 */
export function once<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  let called = false;
  let result: ReturnType<T>;

  return (...args: Parameters<T>): ReturnType<T> => {
    if (!called) {
      called = true;
      result = fn(...args) as ReturnType<T>;
    }
    return result;
  };
}
