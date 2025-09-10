// src/user/user.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  private readonly ttl = 60; // cache 60 seconds
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({ data: createUserDto });

    // Invalidate cache after new user is created
    const redis = this.redisService.getClient();
    await redis.del('users:all');

    this.logger.log(`User created. Cache invalidated for users:all`);

    return user;
  }

  async findAll() {
    const redis = this.redisService.getClient();
    const cacheKey = 'users:all';

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return JSON.parse(cached);
    }

    this.logger.log(`Cache miss for ${cacheKey}. Fetching from DB...`);

    // If not cached → fetch from DB
    const users = await this.prisma.user.findMany();

    // Save to cache
    await redis.set(cacheKey, JSON.stringify(users), 'EX', this.ttl);

    return users;
  }

  async findOne(id: number) {
    const redis = this.redisService.getClient();
    const cacheKey = `user:${id}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return JSON.parse(cached);
    }

    this.logger.log(`Cache miss for ${cacheKey}. Fetching from DB...`);

    // Fetch from DB
    const user = await this.prisma.user.findUnique({ where: { id } });

    // Save to cache
    if (user) {
      await redis.set(cacheKey, JSON.stringify(user), 'EX', this.ttl);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    // Invalidate cache for this user + all users
    const redis = this.redisService.getClient();
    await redis.del(`user:${id}`);
    await redis.del('users:all');

    this.logger.log(`User ${id} updated. Cache invalidated.`);

    return user;
  }

  async remove(id: number) {
    const user = await this.prisma.user.delete({ where: { id } });

    // Invalidate cache
    const redis = this.redisService.getClient();
    await redis.del(`user:${id}`);
    await redis.del('users:all');

    this.logger.log(`User ${id} removed. Cache invalidated.`);

    return user;
  }
}
