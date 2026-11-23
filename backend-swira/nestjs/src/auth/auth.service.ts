import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { User, UserDocument } from './user.schema.js';

const scrypt = promisify(nodeScrypt);
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'user';
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET debe configurarse con al menos 32 caracteres.');
    }
    this.jwtSecret = secret;
  }

  async register(input: { name?: unknown; email?: unknown; password?: unknown }) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const email = this.normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';
    if (!name || name.length < 2 || name.length > 80) {
      throw new BadRequestException('Escribe un nombre de entre 2 y 80 caracteres.');
    }
    if (!this.validEmail(email)) throw new BadRequestException('Escribe un correo válido.');
    if (password.length < 10 || password.length > 128) {
      throw new BadRequestException('La contraseña debe tener entre 10 y 128 caracteres.');
    }

    const salt = randomBytes(16);
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    try {
      const user = await this.users.create({
        name,
        email,
        passwordHash: `${salt.toString('hex')}:${derivedKey.toString('hex')}`,
        role: 'user',
      });
      return this.createSession(user);
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      throw error;
    }
  }

  async login(input: { email?: unknown; password?: unknown }) {
    const email = this.normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';
    if (!this.validEmail(email) || password.length === 0 || password.length > 128) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    const user = await this.users.findOne({ email }).select('+passwordHash');
    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    return this.createSession(user);
  }

  async authenticate(token?: string): Promise<PublicUser | null> {
    if (!token) return null;
    const payload = this.verifyToken(token);
    if (!payload) return null;
    const user = await this.users.findById(payload.sub);
    return user ? this.publicUser(user) : null;
  }

  createToken(user: UserDocument) {
    const now = Math.floor(Date.now() / 1000);
    const header = this.base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = this.base64url(
      JSON.stringify({ sub: user.id, email: user.email, iat: now, exp: now + TOKEN_LIFETIME_SECONDS }),
    );
    const body = `${header}.${payload}`;
    const signature = createHmac('sha256', this.jwtSecret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  get tokenLifetimeSeconds() {
    return TOKEN_LIFETIME_SECONDS;
  }

  private createSession(user: UserDocument) {
    return { user: this.publicUser(user), token: this.createToken(user) };
  }

  private publicUser(user: UserDocument): PublicUser {
    return { id: user.id, name: user.name, email: user.email, role: 'user' };
  }

  private async verifyPassword(password: string, storedHash?: string) {
    if (!storedHash) return false;
    const [saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex || !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(hashHex)) {
      return false;
    }
    const expected = Buffer.from(hashHex, 'hex');
    const actual = (await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)) as Buffer;
    return timingSafeEqual(expected, actual);
  }

  private verifyToken(token: string): { sub: string } | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    try {
      const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
      const parsedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        sub?: string;
        exp?: number;
      };
      if (parsedHeader.alg !== 'HS256' || !parsedPayload.sub || !parsedPayload.exp) return null;
      const expected = createHmac('sha256', this.jwtSecret)
        .update(`${header}.${payload}`)
        .digest();
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
      if (parsedPayload.exp <= Math.floor(Date.now() / 1000)) return null;
      return { sub: parsedPayload.sub };
    } catch {
      return null;
    }
  }

  private normalizeEmail(email?: unknown) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  }

  private validEmail(email: string) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private base64url(value: string) {
    return Buffer.from(value).toString('base64url');
  }

  private isDuplicateKey(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }
}
