import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const port = process.env.PORT ?? 3000;
  const env = process.env.NODE_ENV ?? 'dev';

  await app.listen(port, '0.0.0.0');

  console.log(`🟢 Servidor corriendo en el puerto: ${port} 🟢`);
  console.log(`⚡ Entorno activo: ${env} ⚡`);
  console.log(`🔗 URL local: http://localhost:${port} 🔗`);
}
bootstrap();
