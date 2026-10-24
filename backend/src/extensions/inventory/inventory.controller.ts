import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  AdjustLotDto,
  CompleteStainRunDto,
  CreateReagentLotDto,
  CreateStainRunDto,
  ReagentLotQueryDto,
  StainRunQueryDto,
  UpdateReagentLotDto,
  ValidateLotDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('lots')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'List reagent and antibody lots with expiry state' })
  lots(@Query() query: ReagentLotQueryDto) {
    return this.inventory.listLots(query);
  }

  @Post('lots')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST')
  @ApiOperation({ summary: 'Register a received reagent or antibody lot in quarantine' })
  createLot(@Body() dto: CreateReagentLotDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.createLot(dto, user);
  }

  @Patch('lots/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST')
  @ApiOperation({ summary: 'Update lot storage, expiry or quantity' })
  updateLot(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateReagentLotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.updateLot(id, dto, user);
  }

  @Post('lots/:id/validate')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  @ApiOperation({ summary: 'Validate a quarantined lot and make it usable' })
  validateLot(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ValidateLotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.validateLot(id, dto, user);
  }

  @Post('lots/:id/reject')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  @ApiOperation({ summary: 'Reject a lot after QC failure' })
  rejectLot(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ValidateLotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.rejectLot(id, dto, user);
  }

  @Post('lots/:id/adjust')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST')
  @ApiOperation({ summary: 'Adjust lot stock with an audit trail' })
  adjustLot(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdjustLotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.adjustLot(id, dto, user);
  }

  @Get('stain-runs')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'List stain runs linked to reagent lots' })
  runs(@Query() query: StainRunQueryDto) {
    return this.inventory.listRuns(query);
  }

  @Post('stain-runs')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST')
  @ApiOperation({ summary: 'Start a stain run; rejects expired or unvalidated lots' })
  createRun(@Body() dto: CreateStainRunDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.createRun(dto, user);
  }

  @Post('stain-runs/:id/complete')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST')
  @ApiOperation({ summary: 'Record QC; a passing run marks the linked slide STAINED' })
  completeRun(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CompleteStainRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.completeRun(id, dto, user);
  }

  @Post('expiry-check')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  @ApiOperation({ summary: 'Run expiry alerts now' })
  expiryCheck() {
    return this.inventory.checkExpiries();
  }
}
