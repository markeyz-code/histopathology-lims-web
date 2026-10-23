import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { NotificationQueryDto } from './dto/notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'In-app notifications for the signed-in user and role' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto) {
    return this.notifications.listForUser(user.id, user.role, query);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all in-app notifications for this user as read' })
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id, user.role);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one in-app notification as read' })
  read(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(id, user.id, user.role);
  }

  @Get('outbox')
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Outbox of every in-app, email, SMS and WhatsApp message' })
  outbox(@Query() query: NotificationQueryDto) {
    return this.notifications.outbox(query);
  }

  @Post(':id/retry')
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Retry an external message that failed delivery' })
  retry(@Param('id', ParseObjectIdPipe) id: string) {
    return this.notifications.retry(id);
  }
}
