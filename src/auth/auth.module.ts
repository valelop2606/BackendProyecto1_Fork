import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const seconds = config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS');
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          // Segundos numericos: la expiracion coincide con lo configurado
          signOptions: { expiresIn: seconds },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Todas las rutas requieren JWT salvo las marcadas con @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Sin este segundo guardia, @Roles() no se evalua en ninguna ruta
    { provide: APP_GUARD, useClass: RolesGuard },
    // La tasa se evalua en la frontera: el abuso recibe 429
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AuthModule {}
