import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => {
      try {
        return new URL(origin.trim()).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  app.enableCors({ origin: configuredOrigins, credentials: true });

  const port = process.env.PORT ?? 3000;
  const env = process.env.NODE_ENV ?? 'dev';

  await app.listen(port, '0.0.0.0');

  console.log(`🟢 Servidor corriendo en el puerto: ${port} 🟢`);
  console.log(`⚡ Entorno activo: ${env} ⚡`);
  console.log(`🔗 URL local: http://localhost:${port} 🔗`);
}
bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar Swira:', error);
  process.exit(1);
});
