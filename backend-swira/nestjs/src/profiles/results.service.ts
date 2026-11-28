import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Prediction } from './prediction.schema.js';
import { ProfilesService } from './profiles.service.js';

type ModelInputs = { clinico: Record<string, number | null>; conductual: Record<string, number | null> };
type PredictionInputs = { expert: ModelInputs };
type GuideRecord = Pick<Prediction,
  'clinicalProbability' | 'behavioralProbability' | 'summary' | 'explanations' |
  'recommendations' | 'chartData' | 'generatedAt' | 'refreshedAt'> & { _id: unknown };

@Injectable()
export class ResultsService {
  private readonly aiUrl: string;

  constructor(
    private readonly profiles: ProfilesService,
    private readonly config: ConfigService,
    @InjectModel(Prediction.name) private readonly predictions: Model<Prediction>,
  ) {
    this.aiUrl = (config.get<string>('AI_SERVICE_URL') ?? '').replace(/\/$/, '');
  }

  async history(ownerId: string, profileId: string) {
    await this.profiles.getForOwner(ownerId, profileId);
    const history = await this.predictions.find({
      ownerId: new Types.ObjectId(ownerId), profileId: this.parseId(profileId),
    }).sort({ generatedAt: -1 }).lean();
    return history.map((guide) => this.publicGuide(guide));
  }

  async createOrReuse(ownerId: string, profileId: string, jwt: string) {
    const profile = await this.profiles.getForOwner(ownerId, profileId);
    const inputs = this.toPredictionInputs(profile as unknown as Record<string, unknown>);
    const inputHash = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
    const owner = new Types.ObjectId(ownerId);
    const profileObjectId = this.parseId(profileId);
    const query = { ownerId: owner, profileId: profileObjectId };
    const history = () => this.predictions.find(query).sort({ generatedAt: -1 }).lean();

    const latest = await this.predictions.findOne(query).sort({ generatedAt: -1 }).lean();
    if (latest && latest.inputHash === inputHash) {
      const refreshed = await this.predictions.findByIdAndUpdate(
        latest._id, { $set: { refreshedAt: new Date() } }, { new: true },
      ).lean();
      return {
        profile,
        guide: refreshed ? this.publicGuide(refreshed) : this.publicGuide(latest),
        history: (await history()).map((item) => this.publicGuide(item)),
        reused: true,
      };
    }

    if (!this.aiUrl) throw new ServiceUnavailableException('La guía no está disponible por el momento. Inténtalo más tarde.');
    const expert = await this.callAI('/api/sistemaExperto/obtenerGuiaCompleta', inputs.expert, jwt);
    const clinicalProbability = this.percentage(expert.prediccionClinica);
    const behavioralProbability = this.percentage(expert.prediccionConductual);
    const expertResult = expert as Record<string, unknown>;
    const guide = await this.predictions.create({
      ...query,
      inputHash,
      clinicalProbability,
      behavioralProbability,
      summary: this.text(expertResult.resumen),
      explanations: this.textList(expertResult.explicaciones),
      recommendations: this.textList(expertResult.recomendaciones),
      chartData: expertResult.datosGraficas && typeof expertResult.datosGraficas === 'object'
        ? expertResult.datosGraficas as Record<string, unknown> : {},
      generatedAt: new Date(),
      refreshedAt: new Date(),
    });
    return {
      profile,
      guide: this.publicGuide(guide.toObject()),
      history: (await history()).map((item) => this.publicGuide(item)),
      reused: false,
    };
  }

  private async callAI(path: string, body: unknown, jwt: string) {
    try {
      const response = await fetch(`${this.aiUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof (data.error as { message?: unknown } | undefined)?.message === 'string'
          ? (data.error as { message: string }).message : 'AI service response error');
      }
      return data;
    } catch {
      // Do not expose tokens, model details, profile data, or upstream diagnostics to the client.
      throw new ServiceUnavailableException('No pudimos preparar la guía en este momento. Inténtalo de nuevo más tarde.');
    }
  }

  private toPredictionInputs(profile: Record<string, unknown>): PredictionInputs {
    const age = this.numberOrNull(profile.age);
    const weight = this.numberOrNull(profile.weightKg);
    const heightCm = this.numberOrNull(profile.heightCm);
    const bmi = weight !== null && heightCm !== null
      ? Number((weight / ((heightCm / 100) ** 2)).toFixed(2)) : null;
    const clinicalBmi = bmi !== null && bmi >= 8 && bmi <= 100 ? bmi : null;
    const behavioralBmi = bmi !== null && bmi >= 12 && bmi <= 98 ? bmi : null;
    const yesNo = (value: unknown) => typeof value === 'boolean' ? Number(value) : null;
    const sex = profile.sex === 'male' ? 1 : profile.sex === 'female' ? 0 : null;
    const education: Record<string, number> = {
      none_pre: 1, primary: 2, secondary: 3, high_school_technical: 4, undergraduate: 5, graduate: 6,
    };
    const income: Record<string, number> = {
      under_15000: 1, '15000_22500': 2, '22500_30000': 3, '30000_37500': 4,
      '37500_52500': 5, '52500_75000': 6, '75000_112500': 7, over_112500: 8,
    };
    const clinic = {
      edad: age, Peso: weight, Estatura: heightCm === null ? null : Number((heightCm / 100).toFixed(3)),
      imc: clinicalBmi, glu_suero: this.numberOrNull(profile.fastingGlucose),
      hb1ac: this.numberOrNull(profile.a1c), insulina: this.numberOrNull(profile.insulin),
      trig: this.numberOrNull(profile.triglycerides), col_hdl: this.numberOrNull(profile.hdl),
      col_ldl: this.numberOrNull(profile.ldl), ac_urico: this.numberOrNull(profile.uricAcid),
      sexo_Hombre: sex === null ? null : sex, sexo_Mujer: sex === null ? null : 1 - sex,
    };
    const behavior = {
      PhysActivity: yesNo(profile.physicalActivity30d), Smoker: yesNo(profile.smokeCurrentOrPast),
      HighBP: yesNo(profile.hypertensionHigh), Fruits: yesNo(profile.eatsFruitDaily), BMI: behavioralBmi,
      Sex: sex, Age: age,
      Veggies: yesNo(profile.eatsVegetablesDaily),
      HvyAlcoholConsump: yesNo(profile.frequentAlcohol),
      DiffWalk: yesNo(profile.walkingDifficulty), MentHlth: this.numberOrNull(profile.poorMentalHealthDays),
      AnyHealthcare: yesNo(profile.hasHealthInsurance), NoDocbcCost: yesNo(profile.deferredCareDueToCost),
      Education: typeof profile.education === 'string' ? education[profile.education] ?? null : null,
      Income: typeof profile.incomeMonthlyMxn === 'string' ? income[profile.incomeMonthlyMxn] ?? null : null,
    };
    const expertClinic = {
      edad: clinic.edad, imc: clinic.imc, glu_suero: clinic.glu_suero, hb1ac: clinic.hb1ac,
      insulina: clinic.insulina, trig: clinic.trig, col_hdl: clinic.col_hdl, col_ldl: clinic.col_ldl,
      ac_urico: clinic.ac_urico, HighBP: behavior.HighBP, Sex: sex,
      Peso: clinic.Peso, Estatura: clinic.Estatura, sexo_Hombre: clinic.sexo_Hombre,
      sexo_Mujer: clinic.sexo_Mujer,
    };
    return {
      expert: {
        clinico: expertClinic,
        conductual: {
          PhysActivity: behavior.PhysActivity, Smoker: behavior.Smoker, Fruits: behavior.Fruits,
          BMI: behavior.BMI, Age: age, Veggies: behavior.Veggies,
          HvyAlcoholConsump: behavior.HvyAlcoholConsump, DiffWalk: behavior.DiffWalk,
          MentHlth: behavior.MentHlth, AnyHealthcare: behavior.AnyHealthcare,
          NoDocbcCost: behavior.NoDocbcCost, Education: behavior.Education, Income: behavior.Income,
        },
      },
    };
  }

  private numberOrNull(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private percentage(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new ServiceUnavailableException('La guía recibida no tenía un resultado válido. Inténtalo más tarde.');
    }
    return value;
  }

  private text(value: unknown) {
    return typeof value === 'string' ? value.slice(0, 5000) : '';
  }

  private textList(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 50) : [];
  }

  private publicGuide(value: GuideRecord) {
    return {
      id: String(value._id),
      clinicalProbability: value.clinicalProbability,
      behavioralProbability: value.behavioralProbability,
      summary: value.summary,
      explanations: value.explanations,
      recommendations: value.recommendations,
      chartData: value.chartData,
      generatedAt: value.generatedAt,
      refreshedAt: value.refreshedAt,
    };
  }

  private parseId(profileId: string) {
    if (!isValidObjectId(profileId)) throw new BadRequestException('Revisa el perfil seleccionado.');
    return new Types.ObjectId(profileId);
  }
}
