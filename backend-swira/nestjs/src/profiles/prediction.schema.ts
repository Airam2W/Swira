import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PredictionDocument = HydratedDocument<Prediction>;

@Schema({ collection: 'guias_perfil', timestamps: true, versionKey: false, strict: true })
export class Prediction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId: Types.ObjectId;

  @Prop({ required: true, match: /^[a-f0-9]{64}$/ })
  inputHash: string;

  @Prop({ required: true, min: 0, max: 100 })
  clinicalProbability: number;

  @Prop({ required: true, min: 0, max: 100 })
  behavioralProbability: number;

  @Prop({ required: true })
  summary: string;

  @Prop({ type: [String], default: [] })
  explanations: string[];

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  chartData: Record<string, unknown>;

  @Prop({ required: true, default: Date.now })
  generatedAt: Date;

  @Prop({ required: true, default: Date.now })
  refreshedAt: Date;
}

export const PredictionSchema = SchemaFactory.createForClass(Prediction);
PredictionSchema.index({ ownerId: 1, profileId: 1, generatedAt: -1 });
