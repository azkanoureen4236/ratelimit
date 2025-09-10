import { Injectable, Req, Res } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class RateLimitMiddleware {
  private readonly limit = 100;
  private readonly ttl = 15 * 60;
  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const redisClient = this.redisService.getClient();
    const ip = req.ip || req.connection.remoteAddress;

    const key = `ratelimit:${ip}`;
    const requests = await redisClient.incr(key);

    if (requests === 1) {
      await redisClient.expire(key, this.ttl);
    }
    console.log(`RateLimit check for IP: ${ip}, requests: ${requests}`);
    if (requests > this.limit) {
      const retryAfter = await redisClient.ttl(key);
      return res.status(429).json({
        message: 'Rate limit exceeded',
        retryAfter,
      });
    }

    const remaining = Math.max(this.limit - requests, 0);
    res.setHeader('X-RateLimit-Limit', this.limit);
    res.setHeader('X-RateLimit-Remaining', remaining);

    console.log(
      `RateLimit check passed for IP: ${ip}, remaining: ${remaining}`,
    );
    next();
  }
}
