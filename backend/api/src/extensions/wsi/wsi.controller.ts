import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { LinkWsiDto, WsiWebhookDto } from './dto/wsi.dto';
import { WsiService } from './wsi.service';

@ApiTags('Whole-slide imaging')
@Controller('wsi')
export class WsiController {
  constructor(private readonly wsi: WsiService) {}

  @Get(':barcode')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a slide barcode to its linked whole-slide image' })
  byBarcode(@Param('barcode') barcode: string) {
    return this.wsi.byBarcode(barcode);
  }

  @Post('slides/:id/link')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Attach a WSI image or viewer URL to a slide' })
  link(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: LinkWsiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wsi.link(id, dto, user);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({
    summary: 'Scanner webhook: link a WSI by slide barcode using an HMAC signature',
  })
  webhook(@Body() dto: WsiWebhookDto, @Headers('x-wsi-signature') signature?: string) {
    return this.wsi.webhook(dto, signature);
  }
}
