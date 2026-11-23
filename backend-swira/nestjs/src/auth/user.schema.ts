import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'usuarios', timestamps: true, versionKey: false, strict: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, unique: true, maxlength: 254 })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ default: 'user', immutable: true, enum: ['user'] })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
