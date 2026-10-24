import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserModelName, UserSchema } from '../users/user.schema';
import { OrganizationModelName, OrganizationSchema } from './organization.schema';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizationModelName, schema: OrganizationSchema },
      { name: LabModelName, schema: LabSchema },
      { name: UserModelName, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
