import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TatCheckService } from './tat-check.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class JobsController {
  constructor(private readonly tatCheck: TatCheckService) {}

  @Post('tat-check')
  @UseGuards(RolesGuard)
  @Roles('LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Run the TAT breach check for this laboratory now' })
  async runTatCheck(): Promise<{ flagged: number }> {
    const flagged = await this.tatCheck.runCurrentLab();
    return { flagged };
  }
}
