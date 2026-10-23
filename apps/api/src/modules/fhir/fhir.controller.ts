import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { FhirSearchDto } from './dto/fhir.dto';
import { FhirService } from './fhir.service';

@ApiTags('FHIR R4')
@Controller('fhir/r4')
export class FhirController {
  constructor(private readonly fhir: FhirService) {}

  @Public()
  @Get('metadata')
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 CapabilityStatement' })
  metadata() {
    return this.fhir.capabilityStatement();
  }

  @Get('Patient/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 Patient read' })
  patient(@Param('id', ParseObjectIdPipe) id: string) {
    return this.fhir.patient(id);
  }

  @Get('Patient')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 Patient search by identifier or _id' })
  patients(@Query() query: FhirSearchDto) {
    return this.fhir.searchPatients(query);
  }

  @Get('ServiceRequest/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 ServiceRequest read' })
  serviceRequest(@Param('id', ParseObjectIdPipe) id: string) {
    return this.fhir.serviceRequest(id);
  }

  @Get('ServiceRequest')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 ServiceRequest search' })
  serviceRequests(@Query() query: FhirSearchDto) {
    return this.fhir.searchServiceRequests(query);
  }

  @Get('Specimen/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 Specimen read' })
  specimen(@Param('id', ParseObjectIdPipe) id: string) {
    return this.fhir.specimen(id);
  }

  @Get('Specimen')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 Specimen search' })
  specimens(@Query() query: FhirSearchDto) {
    return this.fhir.searchSpecimens(query);
  }

  @Get('DiagnosticReport/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 DiagnosticReport read' })
  diagnosticReport(@Param('id', ParseObjectIdPipe) id: string) {
    return this.fhir.diagnosticReport(id);
  }

  @Get('DiagnosticReport')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json; charset=utf-8')
  @ApiOperation({ summary: 'FHIR R4 DiagnosticReport search by subject, status or date' })
  diagnosticReports(@Query() query: FhirSearchDto) {
    return this.fhir.searchDiagnosticReports(query);
  }
}
