import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { LevelsService } from '../levels/levels.service';
import { repairTrainingScores } from '../game/repair-training-scores';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {logger:['error','warn']});
  try {
    console.log(JSON.stringify(await repairTrainingScores(app.get(PrismaService),
      app.get(LevelsService),process.argv.includes('--apply'))));
  } finally { await app.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
