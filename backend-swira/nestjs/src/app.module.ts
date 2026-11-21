import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('MongoDB');
        return {
          uri: configService.get<string>('MONGODB_URI'),
          onConnectionCreate: (connection: Connection) => {
            connection.on('connected', () => {
              logger.log('Conectado exitosamente al clúster de MongoDB');
              console.log('🍃 Conectado exitosamente al clúster de MongoDB 🍃');
            });
            connection.on('error', (err) => {
              logger.error(`Error de conexión a MongoDB: ${err}`);
              console.error(`🚨 Error de conexión a MongoDB: ${err} 🚨`);
            });
            connection.on('disconnected', () => {
              logger.warn('Desconectado de MongoDB');
              console.warn('🌿 Desconectado de MongoDB 🌿');
            });

            if (connection.readyState === 1) {
              logger.log('Conectado exitosamente al clúster de MongoDB');
              console.log('Conectado exitosamente al clúster de MongoDB 🍃');
            }

            return connection;
          },
        };
      },
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
