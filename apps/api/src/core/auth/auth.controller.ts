import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponse } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService, type MeResponse } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { acceptInviteSchema } from '@lims/shared';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in to a laboratory with lab code, email and password' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('accept-invite')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept an administrator invitation and set a password' })
  acceptInvite(@Body() body: unknown): Promise<AuthResponse> {
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    return this.authService.acceptInvite(parsed.data.token, parsed.data.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token and issue a new access token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  logout(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    return this.authService.logout(user);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current user and laboratory' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.authService.me(user.id);
  }
}
