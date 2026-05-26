import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'iam',
  entities: [path.resolve(__dirname, '../../**/*.entity{.ts,.js}')],
  synchronize: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('🌱 Iniciando seed...');

  const users = [
    {
      name: 'Matheus Silveira',
      email: 'matheus@qualitysmi.com.br',
      role: 'SUPER_ADMIN',
    },
    {
      name: 'Claudia Silveira',
      email: 'claudia@qualitysmi.com.br',
      role: 'DIRECTOR',
    },
    {
      name: 'Bruna Silveira',
      email: 'bruna@qualitysmi.com.br',
      role: 'DIRECTOR',
    },
    {
      name: 'Maicon Willi',
      email: 'maicon@qualitysmi.com.br',
      role: 'MANAGER',
    },
    { name: 'Luciana', email: 'luciana@qualitysmi.com.br', role: 'FINANCIAL' },
    { name: 'Daniel', email: 'daniel@qualitysmi.com.br', role: 'MANAGER' },
  ];

  const defaultPassword = await bcrypt.hash('Mudar@123', 12);

  for (const u of users) {
    await dataSource.query(
      `INSERT INTO iam.users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4::iam.user_role)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, defaultPassword, u.role],
    );
    console.log(`  ✓ ${u.name} (${u.role})`);
  }

  console.log('\n✅ Seed concluído!');
  console.log('📧 Senha padrão de todos os usuários: Mudar@123');
  console.log('⚠️  Troque as senhas no primeiro login!');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Erro no seed:', err);
  process.exit(1);
});
