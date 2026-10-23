import { Discipline } from '../../../core/discipline/discipline.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Protocol } from '@lims/shared';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { CreateProtocolDto, ProtocolListQueryDto, UpdateProtocolDto } from './dto/protocol.dto';
import { ProtocolsService } from './protocols.service';

@ApiTags('Protocols')
@ApiBearerAuth()
@Discipline('HISTOPATHOLOGY')
@Controller('protocols')
export class ProtocolsController {
  constructor(private readonly protocolsService: ProtocolsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST')
  @ApiOperation({ summary: 'List active synoptic protocols' })
  list(@Query() query: ProtocolListQueryDto): Promise<Protocol[]> {
    return this.protocolsService.list(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Get one synoptic protocol' })
  get(@Param('id', ParseObjectIdPipe) id: string): Promise<Protocol> {
    return this.protocolsService.get(id);
  }

  @Post()
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a synoptic protocol (version 1)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProtocolDto,
  ): Promise<Protocol> {
    return this.protocolsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a protocol; content changes create a new version' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProtocolDto,
  ): Promise<Protocol> {
    return this.protocolsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate a protocol (never hard-deleted)' })
  deactivate(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Protocol> {
    return this.protocolsService.deactivate(id, user);
  }
}
