import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProtocolModelName, ProtocolSchema } from './protocol.schema';
import { ProtocolsController } from './protocols.controller';
import { ProtocolsService } from './protocols.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ProtocolModelName, schema: ProtocolSchema }])],
  controllers: [ProtocolsController],
  providers: [ProtocolsService],
  exports: [ProtocolsService],
})
export class ProtocolsModule {}
