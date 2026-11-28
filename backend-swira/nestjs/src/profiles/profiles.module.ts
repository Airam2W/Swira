import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Profile, ProfileSchema } from './profile.schema.js';
import { Prediction, PredictionSchema } from './prediction.schema.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([
    { name: Profile.name, schema: ProfileSchema },
    { name: Prediction.name, schema: PredictionSchema },
  ])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
