import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from './profiles.module.js';
import { Prediction, PredictionSchema } from './prediction.schema.js';
import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';

@Module({
  imports: [ConfigModule, AuthModule, ProfilesModule,
    MongooseModule.forFeature([{ name: Prediction.name, schema: PredictionSchema }])],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
