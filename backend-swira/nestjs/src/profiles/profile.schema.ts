import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument } from 'mongoose';

export type ProfileDocument = HydratedDocument<Profile>;

@Schema({ collection: 'perfiles', timestamps: true, versionKey: false, strict: true })
export class Profile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 80 })
  name: string;

  @Prop({ trim: true, maxlength: 80, default: '' })
  paternalSurname?: string;

  @Prop({ trim: true, maxlength: 80, default: '' })
  maternalSurname?: string;

  @Prop({ min: 1, max: 120 }) age?: number;
  @Prop({ enum: ['male', 'female'] }) sex?: string;
  @Prop({ min: 2, max: 500 }) weightKg?: number;
  @Prop({ min: 30, max: 250 }) heightCm?: number;
  @Prop({ min: 20, max: 1000 }) fastingGlucose?: number;
  @Prop({ min: 2, max: 20 }) a1c?: number;
  @Prop({ min: 0, max: 1000 }) insulin?: number;
  @Prop({ min: 1, max: 10000 }) triglycerides?: number;
  @Prop({ min: 1, max: 300 }) hdl?: number;
  @Prop({ min: 1, max: 1000 }) ldl?: number;
  @Prop({ min: 0, max: 30 }) uricAcid?: number;

  @Prop() hypertensionHigh?: boolean;
  @Prop() walkingDifficulty?: boolean;
  @Prop() physicalActivity30d?: boolean;
  @Prop() smokeCurrentOrPast?: boolean;
  @Prop() eatsFruitDaily?: boolean;
  @Prop() eatsVegetablesDaily?: boolean;
  @Prop() frequentAlcohol?: boolean;
  @Prop({ min: 0, max: 30 }) poorMentalHealthDays?: number;
  @Prop() hasHealthInsurance?: boolean;
  @Prop() deferredCareDueToCost?: boolean;

  @Prop({ enum: ['none_pre', 'primary', 'secondary', 'high_school_technical', 'undergraduate', 'graduate'] })
  education?: string;

  @Prop({ enum: ['under_15000', '15000_22500', '22500_30000', '30000_37500', '37500_52500', '52500_75000', '75000_112500', 'over_112500'] })
  incomeMonthlyMxn?: string;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
ProfileSchema.index({ ownerId: 1, createdAt: -1 });
