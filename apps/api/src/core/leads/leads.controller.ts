import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { LeadsService } from './leads.service';

@ApiTags('Leads')
@Controller()
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Public()
  @Post('leads')
  create(@Body() body: unknown) {
    return this.leads.create(body);
  }

  @Get('super-admin/leads')
  @Roles('SUPER_ADMIN')
  list() {
    return this.leads.list();
  }

  @Patch('super-admin/leads/:id')
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.leads.update(id, body);
  }
}
