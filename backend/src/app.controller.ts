import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppService } from './app.service';
import { ObservabilityService } from './modules/observability/observability.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly observabilityService: ObservabilityService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(@Req() request: Request): string {
    const expectedToken = this.configService.get<string>('METRICS_AUTH_TOKEN');
    if (expectedToken) {
      const providedToken = request.header('x-metrics-token');
      if (providedToken !== expectedToken) {
        throw new UnauthorizedException('Invalid metrics token');
      }
    }

    return this.observabilityService.renderPrometheusMetrics();
  }
}
