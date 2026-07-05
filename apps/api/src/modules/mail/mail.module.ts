import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sgTransport = require('nodemailer-sendgrid') as (opts: { apiKey: string }) => unknown;

import { join } from 'path';

@Global()
@Module({
  imports: [
    ConfigModule,
  MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        transport: sgTransport({
      apiKey: process.env.SENDGRID_API_KEY!, // ← clave de API
    }) as any, // cast para contentar a TS
        defaults: {
          from: `${cfg.get('MAIL_FROM_NAME')} <${cfg.get('MAIL_FROM_ADDRESS')}>`,
        },
        template: {
          // si dejas los .hbs en la raíz del repo:
          dir: join(process.cwd(), 'templates'),
          adapter: new HandlebarsAdapter({}, { inlineCssEnabled: true }),
          options: { strict: true },
        },
      }),
    }),
  ],
  controllers:[MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
