import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { BillyConversationService } from './billy-conversation.service';

@Public()
@Controller('billy/conversations')
export class BillyConversationController {
  constructor(private readonly service: BillyConversationService) {}

  @Get()
  findAll(@Query('recruiterId') recruiterId: string) {
    return this.service.findAll(recruiterId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: { recruiterId: string }) {
    return this.service.create(dto.recruiterId);
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: { title: string }) {
    return this.service.updateTitle(id, dto.title);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
