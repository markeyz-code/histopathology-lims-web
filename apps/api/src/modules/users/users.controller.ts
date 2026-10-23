import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated, User as UserDto, UserSummary } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserListQueryDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('pathologists')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'List active pathologists for assignment and worklist filters' })
  pathologists(): Promise<UserSummary[]> {
    return this.usersService.pathologists();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List laboratory staff' })
  list(@Query() query: UserListQueryDto): Promise<Paginated<UserDto>> {
    return this.usersService.list(query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a staff account with a temporary password' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a staff member, role or active state' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.update(id, dto, user);
  }

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reset a staff member password and revoke refresh tokens' })
  resetPassword(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: true }> {
    return this.usersService.resetPassword(id, dto.password, user);
  }
}
