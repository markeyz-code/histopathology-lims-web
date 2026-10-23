import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated, Patient as PatientDto } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreatePatientDto, PatientListQueryDto, UpdatePatientDto } from './dto/patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Search and paginate patients' })
  list(@Query() query: PatientListQueryDto): Promise<Paginated<PatientDto>> {
    return this.patientsService.list(query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('RECEPTIONIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Register a patient; MRN is auto-generated when omitted' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ): Promise<PatientDto> {
    return this.patientsService.create(dto, user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Get a patient' })
  get(@Param('id', ParseObjectIdPipe) id: string): Promise<PatientDto> {
    return this.patientsService.get(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('RECEPTIONIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Correct patient demographics' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePatientDto,
  ): Promise<PatientDto> {
    return this.patientsService.update(id, dto, user);
  }
}
