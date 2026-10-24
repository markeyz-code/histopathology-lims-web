import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { PlatformService } from './platform.service';

@ApiTags('Platform administration')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('super-admin')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.platform.overview(user);
  }

  @Get('organizations')
  organizations(@CurrentUser() user: AuthenticatedUser) {
    return this.platform.organizations(user);
  }

  @Post('organizations')
  createOrganization(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.platform.createOrganization(body, user);
  }

  @Get('organizations/:id')
  organization(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.platform.organization(id, user);
  }

  @Patch('organizations/:id')
  updateOrganization(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.updateOrganization(id, body, user);
  }

  @Post('organizations/:id/labs')
  provisionLab(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.provisionLab(id, body, user);
  }

  @Post('onboard')
  onboard(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.platform.onboard(body, user);
  }

  @Post('labs/:id/invite-admin')
  inviteAdmin(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.inviteAdmin(id, body, user);
  }

  @Patch('labs/:id/organization')
  assignLab(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.assignLab(id, body, user);
  }

  @Patch('labs/:id/status')
  setLabStatus(
    @Param('id') id: string,
    @Body() body: { active?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platform.setLabActive(id, body.active !== false, user);
  }
}
