import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExtractionService } from './extraction.service';
import { ExtractionController } from './extraction.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ExtractionController],
  providers: [ExtractionService],
  exports: [ExtractionService], // Export for use in other modules
})
export class ExtractionModule {}
