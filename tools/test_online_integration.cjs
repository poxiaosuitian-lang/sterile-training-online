// Isolate integration tests in a fresh PostgreSQL schema; never use game tables.
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {randomBytes}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const schema='online_test_'+randomBytes(8).toString('hex');
const url=new URL(process.env.DATABASE_URL);
url.searchParams.set('schema',schema);
const database=new PrismaClient({datasourceUrl:url.toString()});
async function main(){
  let status=1;
  try {
    await database.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const env={...process.env,DATABASE_URL:url.toString(),RUN_ONLINE_INTEGRATION:'true',
      JWT_SECRET:randomBytes(32).toString('hex'),ADMIN_USERNAME:'admin',
      ADMIN_PASSWORD:randomBytes(24).toString('hex'),ALLOW_GUEST_LOGIN:'false',
      RUN_ADMIN_UI:process.argv.includes('--ui')?'true':'false',
      RELEASE_DIR:require('node:path').join(process.cwd(),'tmp/nonexistent-test-releases')};
    const migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:'pipe'});
    if(migration.status!==0) throw new Error('Isolated test migration failed');
    const result=spawnSync(process.execPath,['node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','test/online.integration.spec.ts'],{env,stdio:'inherit'});
    status=result.status??1;
  } finally {
    if(!/^online_test_[a-f0-9]{16}$/.test(schema)) throw new Error('Invalid test schema');
    await database.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await database.$disconnect();
  }
  process.exitCode=status;
}
main().catch(e=>{console.error('Integration test failed:',e.message);process.exitCode=1;});
