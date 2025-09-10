import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';
import { PrismaService } from 'prisma/prisma.service';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';

@Module({
  imports: [UserModule, RedisModule],
  controllers: [UserController],
  providers: [UserService, PrismaService, RedisService],
  exports: [RedisService],
})
export class AppModule {}
