import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { ClientEmail } from './entities/client-email.entity';
import { ClientPhone } from './entities/client-phone.entity';
import { ClientTag } from './entities/client-tag.entity';
import { ClientService } from './entities/client-service.entity';
import { Tag } from '../lookup/entities/tag.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientEmail,
      ClientPhone,
      ClientTag,
      ClientService,
      Tag,
    ]),
    ApiKeysModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
