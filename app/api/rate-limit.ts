import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

interface LocalRateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

const hasUpstashConfig =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashRatelimit = hasUpstashConfig
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.fixedWindow(MAX_REQUESTS_PER_WINDOW, "60 s"),
      prefix: "courtshare:rate-limit",
      analytics: true,
    })
  : null;

// Local fallback for development or if Upstash env vars are missing.
const localStore: LocalRateLimitStore = {};

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (upstashRatelimit) {
    const result = await upstashRatelimit.limit(identifier);
    return {
      allowed: result.success,
      remaining: Math.max(0, result.remaining ?? 0),
      resetTime: result.reset ?? Date.now() + RATE_LIMIT_WINDOW_MS,
    };
  }

  const now = Date.now();
  const record = localStore[identifier];

  if (!record || now > record.resetTime) {
    localStore[identifier] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - record.count,
    resetTime: record.resetTime,
  };
}

if (!upstashRatelimit) {
  setInterval(() => {
    const now = Date.now();
    Object.keys(localStore).forEach((key) => {
      if (localStore[key].resetTime < now) {
        delete localStore[key];
      }
    });
  }, RATE_LIMIT_WINDOW_MS);
}

