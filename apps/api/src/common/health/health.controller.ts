import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Connection } from 'mongoose';
import { Public } from '../../common/decorators/auth.decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness and database configuration probe' })
  check() {
    const readyState = this.connection.readyState;
    return {
      status: readyState === 1 ? 'ok' : 'degraded',
      service: 'histopathology-lims-api',
      database: readyState === 1 ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
