import { Body, Controller, Post } from "@nestjs/common";
import { MailService } from "./mail.service";


@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Post('welcome')
  async sendWelcome(@Body() body: { to: string; name: string; useCidImage?: boolean }) {
    await this.mail.sendWelcomeEmail(body);
    return { ok: true };
  }
}