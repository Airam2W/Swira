import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Profile } from './profile.schema.js';
import { Prediction } from './prediction.schema.js';

const textFields = ['name', 'paternalSurname', 'maternalSurname'] as const;
const numberRanges: Record<string, [number, number]> = {
  age: [1, 120],
  weightKg: [2, 350],
  heightCm: [50, 250],
  fastingGlucose: [20, 800],
  a1c: [2, 20],
  insulin: [0, 1000],
  triglycerides: [1, 10000],
  hdl: [1, 300],
  ldl: [1, 1000],
  uricAcid: [0, 30],
  poorMentalHealthDays: [0, 30],
};
const booleanFields = [
  'hypertensionHigh', 'walkingDifficulty', 'physicalActivity30d', 'smokeCurrentOrPast',
  'eatsFruitDaily', 'eatsVegetablesDaily', 'frequentAlcohol', 'hasHealthInsurance',
  'deferredCareDueToCost',
] as const;
const choices: Record<string, readonly string[]> = {
  sex: ['male', 'female'],
  education: ['none_pre', 'primary', 'secondary', 'high_school_technical', 'undergraduate', 'graduate'],
  incomeMonthlyMxn: ['under_15000', '15000_22500', '22500_30000', '30000_37500', '37500_52500', '52500_75000', '75000_112500', 'over_112500'],
};
const createFields = new Set<string>([
  ...textFields, ...Object.keys(numberRanges), ...booleanFields, ...Object.keys(choices),
]);
const editFields = new Set<string>(textFields);
const healthFields = new Set<string>([...Object.keys(numberRanges), ...booleanFields, ...Object.keys(choices)]);

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(Profile.name) private readonly profiles: Model<Profile>,
    @InjectModel(Prediction.name) private readonly predictions: Model<Prediction>,
  ) {}

  async list(ownerId: string) {
    return this.profiles.find({ ownerId: new Types.ObjectId(ownerId) })
      .select('-ownerId').sort({ createdAt: -1 }).lean();
  }

  async create(ownerId: string, input: unknown) {
    const data = this.validate(input, createFields, true);
    const profile = await this.profiles.create({ ...data, ownerId: new Types.ObjectId(ownerId) });
    return this.profiles.findById(profile.id).select('-ownerId').lean();
  }

  async update(ownerId: string, profileId: string, input: unknown) {
    const id = this.parseId(profileId);
    const data = this.validate(input, editFields, false);
    const profile = await this.profiles.findOneAndUpdate(
      { _id: id, ownerId: new Types.ObjectId(ownerId) },
      { $set: data },
      { new: true, runValidators: true },
    ).select('-ownerId').lean();
    if (!profile) throw new NotFoundException('No encontramos ese perfil.');
    return profile;
  }

  async remove(ownerId: string, profileId: string) {
    const id = this.parseId(profileId);
    const profile = await this.profiles.findOne({ _id: id, ownerId: new Types.ObjectId(ownerId) }).select('_id').lean();
    if (!profile) throw new NotFoundException('No encontramos ese perfil.');
    await this.predictions.deleteMany({ profileId: id, ownerId: new Types.ObjectId(ownerId) });
    const result = await this.profiles.deleteOne({ _id: id, ownerId: new Types.ObjectId(ownerId) });
    if (result.deletedCount === 0) throw new NotFoundException('No encontramos ese perfil.');
    return { success: true };
  }

  async getForOwner(ownerId: string, profileId: string) {
    const profile = await this.profiles.findOne({
      _id: this.parseId(profileId), ownerId: new Types.ObjectId(ownerId),
    }).select('-ownerId').lean();
    if (!profile) throw new NotFoundException('No encontramos ese perfil.');
    return profile;
  }

  async updateHealthData(ownerId: string, profileId: string, input: unknown) {
    const id = this.parseId(profileId);
    const data = this.validate(input, healthFields, false, true);
    const body = input as Record<string, unknown>;
    const clearFields = Object.keys(body).filter((field) =>
      healthFields.has(field) && (body[field] === null || body[field] === ''),
    );
    if (Object.keys(data).length === 0 && clearFields.length === 0) this.invalid('profile', 'empty');
    const update: Record<string, unknown> = {};
    if (Object.keys(data).length) update.$set = data;
    if (clearFields.length) update.$unset = Object.fromEntries(clearFields.map((field) => [field, 1]));
    const profile = await this.profiles.findOneAndUpdate(
      { _id: id, ownerId: new Types.ObjectId(ownerId) }, update,
      { new: true, runValidators: true },
    ).select('-ownerId').lean();
    if (!profile) throw new NotFoundException('No encontramos ese perfil.');
    return profile;
  }

  private validate(input: unknown, allowedFields: Set<string>, creating: boolean, allowEmpty = false) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      this.invalid('profile', 'profile');
    }
    const body = input as Record<string, unknown>;
    const unknownField = Object.keys(body).find((key) => !allowedFields.has(key));
    if (unknownField) this.invalid(unknownField, 'unknown');
    const result: Record<string, string | number | boolean> = {};

    for (const field of textFields) {
      if (!(field in body)) continue;
      const value = body[field];
      if (typeof value !== 'string') this.invalid(field, 'text');
      const trimmed = value.trim();
      if (field === 'name' && trimmed.length === 0) this.invalid(field, 'required');
      const hasControlCharacter = Array.from(trimmed).some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint < 32 || codePoint === 127;
      });
      if (trimmed.length > 80 || hasControlCharacter) {
        this.invalid(field, 'text');
      }
      if (trimmed || field === 'name' || !creating) result[field] = trimmed;
    }

    for (const [field, [min, max]] of Object.entries(numberRanges)) {
      if (!(field in body) || body[field] === null || body[field] === '') continue;
      const value = body[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) this.invalid(field, 'number');
      if (value < min || value > max) this.invalid(field, 'range', { min, max });
      if ((field === 'age' || field === 'poorMentalHealthDays') && !Number.isInteger(value)) {
        this.invalid(field, 'number');
      }
      result[field] = value;
    }

    for (const field of booleanFields) {
      if (!(field in body) || body[field] === null || body[field] === '') continue;
      if (typeof body[field] !== 'boolean') this.invalid(field, 'choice');
      result[field] = body[field];
    }

    for (const [field, values] of Object.entries(choices)) {
      if (!(field in body) || body[field] === null || body[field] === '') continue;
      if (typeof body[field] !== 'string' || !values.includes(body[field])) {
        this.invalid(field, 'choice');
      }
      result[field] = body[field];
    }

    if (creating && (!('name' in result) || result.name === '')) {
      this.invalid('name', 'required');
    }
    if (!creating && !allowEmpty && Object.keys(result).length === 0) {
      this.invalid('profile', 'empty');
    }
    return result;
  }

  private parseId(value: string) {
    if (!isValidObjectId(value)) this.invalid('profile', 'profile');
    return new Types.ObjectId(value);
  }

  private invalid(field: string, reason: string, details: Record<string, number> = {}): never {
    const labels: Record<string, string> = {
      name: 'el nombre',
      paternalSurname: 'el apellido paterno',
      maternalSurname: 'el apellido materno',
      fastingGlucose: 'la glucosa en ayunas',
      a1c: 'la hemoglobina A1C',
      hypertensionHigh: 'la presión arterial',
      walkingDifficulty: 'la dificultad para caminar',
      age: 'la edad',
      sex: 'el sexo',
      weightKg: 'el peso',
      heightCm: 'la estatura',
      insulin: 'el nivel de insulina',
      triglycerides: 'los triglicéridos',
      hdl: 'el colesterol HDL',
      ldl: 'el colesterol LDL',
      uricAcid: 'el ácido úrico',
      physicalActivity30d: 'la actividad física',
      smokeCurrentOrPast: 'la respuesta sobre tabaquismo',
      eatsFruitDaily: 'la respuesta sobre consumo de fruta',
      eatsVegetablesDaily: 'la respuesta sobre consumo de verduras',
      frequentAlcohol: 'la respuesta sobre consumo de alcohol',
      poorMentalHealthDays: 'los días de salud mental',
      hasHealthInsurance: 'el servicio de salud o seguro médico',
      deferredCareDueToCost: 'la respuesta sobre el costo de atención',
      education: 'el nivel de educación',
      incomeMonthlyMxn: 'los ingresos mensuales',
    };
    const units: Record<string, string> = {
      fastingGlucose: ' mg/dL',
      a1c: '%',
      weightKg: ' kg',
      heightCm: ' cm',
      insulin: ' μU/mL',
      triglycerides: ' mg/dL',
      hdl: ' mg/dL',
      ldl: ' mg/dL',
      uricAcid: ' mg/dL',
    };
    const label = labels[field] ?? 'este dato';
    const messages: Record<string, string> = {
      required: 'Escribe el nombre del perfil para continuar.',
      text: `Revisa ${label}; puede tener hasta 80 caracteres.`,
      number: `Escribe un número válido para ${label}.`,
      range: `Revisa ${label}; debe estar entre ${details.min} y ${details.max}${units[field] ?? ''}.`,
      choice: `Elige una opción disponible para ${label}.`,
      unknown: 'Hay un dato que no pudimos reconocer. Revisa el formulario e inténtalo de nuevo.',
      empty: 'Indica al menos un cambio antes de guardar.',
      profile: 'Revisa la información del perfil e inténtalo de nuevo.',
    };
    throw new BadRequestException({
      code: 'PROFILE_VALIDATION',
      field,
      reason,
      ...details,
      message: messages[reason] ?? messages.profile,
    });
  }
}
