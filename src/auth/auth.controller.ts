import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Iniciar sesion: devuelve el token JWT' })
  @Public()
  @Throttle({ login: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos de la sesion actual' })
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  // Cualquier usuario autenticado cambia su propia clave y recibe un token nuevo
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar mi contrasena (devuelve un token nuevo)' })
  @Patch('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<{ accessToken: string }> {
    return this.authService.changePassword(user.id, dto);
  }
}
