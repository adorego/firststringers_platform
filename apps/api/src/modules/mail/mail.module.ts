import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import type { Transport, SentMessageInfo } from 'nodemailer';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sgTransport = require('nodemailer-sendgrid') as (opts: {
  apiKey: string;
}) => Transport<SentMessageInfo>;

@Global()
@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: sgTransport({ apiKey: process.env.SENDGRID_API_KEY! }),
        defaults: {
          from: process.env.MAIL_FROM ?? 'no-reply@firststringers.com',
        },
        template: {
          dir: join(process.cwd(), 'templates'),
          adapter: new HandlebarsAdapter({}, { inlineCssEnabled: true }),
          options: { strict: true },
        },
      }),
    }),
  ],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
