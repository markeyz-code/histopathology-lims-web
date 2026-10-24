import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  AssignQaReviewDto,
  CompleteQaReviewDto,
  CreateQaReviewDto,
  QaQueryDto,
  StartQaReviewDto,
} from './dto/qa.dto';
import { QaService } from './qa.service';

@ApiTags('Quality assurance')
@ApiBearerAuth()
@Controller('qa')
export class QaController {
  constructor(private readonly qa: QaService) {}

  @Get('reviews')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List peer reviews, second opinions and discrepancies' })
  list(@Query() query: QaQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qa.list(query, user);
  }

  @Get('stats')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'QA workload and discrepancy summary' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.qa.stats(user);
  }

  @Get('reviews/:id')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'QA review detail' })
  detail(@Param('id', ParseObjectIdPipe) id: string) {
    return this.qa.get(id);
  }

  @Post('reviews')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Request a peer review, second opinion or discrepancy review' })
  create(@Body() dto: CreateQaReviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qa.create(dto, user);
  }

  @Post('reviews/:id/assign')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign a pathologist reviewer' })
  assign(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AssignQaReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qa.assign(id, dto, user);
  }

  @Post('reviews/:id/start')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Start review work' })
  start(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: StartQaReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qa.start(id, dto, user);
  }

  @Post('reviews/:id/complete')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Record agreement or a coded discrepancy' })
  complete(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CompleteQaReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qa.complete(id, dto, user);
  }
}
