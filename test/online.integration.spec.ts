import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';
import { PrismaService } from '../src/database/prisma.service';
import * as contract from '../src/levels/standalone-contract.json';
import { LevelsService } from '../src/levels/levels.service';
import { repairTrainingScores } from '../src/game/repair-training-scores';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const suite = process.env.RUN_ONLINE_INTEGRATION === 'true' ? describe : describe.skip;
suite('Online accounts, persistence and administration over HTTP', () => {
  let app: INestApplication;
  let base: string;
  let alice: string, bob: string, admin: string, aliceId: string;
  const request = async (path:string, method='GET', body?:unknown, token?:string) => {
    const r = await fetch(base+path,{method,headers:{'Content-Type':'application/json',
      ...(token ? {Authorization:`Bearer ${token}`} : {})},body:body ? JSON.stringify(body):undefined});
    const text = await r.text();
    let data: any; try {data=JSON.parse(text);} catch {data=text;}
    return {status:r.status,data};
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({imports:[AppModule]})
      .overrideProvider(RedisService).useValue({client:{
        multi: () => {throw new Error('integration test uses database fallback');},
        zRangeWithScores: async () => [], hGetAll:async () => ({}),
      }}).compile();
    app=module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.listen(0,'127.0.0.1');
    base=await app.getUrl()+'/api/v1';
  },30000);
  afterAll(async () => { if(app) await app.close(); });
  it('registers independent accounts and rejects duplicate or invalid credentials',async () => {
    const a=await request('/auth/register','POST',{username:'Alice',password:'test-password-123',nickname:'测试甲'});
    const b=await request('/auth/register','POST',{username:'bob',password:'test-password-456',nickname:'测试乙'});
    expect(a.status).toBe(201);expect(b.status).toBe(201);
    alice=a.data.accessToken;bob=b.data.accessToken;aliceId=a.data.player.id;
    expect(aliceId).not.toBe(b.data.player.id);
    expect(a.data.player.passwordHash).toBeUndefined();
    expect((await request('/auth/register','POST',{username:'alice',password:'test-password-123',nickname:'重复'})).status).toBe(409);
    expect((await request('/auth/login','POST',{username:'alice',password:'wrong-password'})).status).toBe(401);
    const login=await request('/auth/login','POST',{username:'ALICE',password:'test-password-123'});
    expect(login.status).toBe(201);expect(login.data.player.id).toBe(aliceId);
    expect((await request('/auth/guest','POST',{deviceId:'device-test-123',nickname:'游客'})).status).toBe(403);
  });
  it('requires auth, isolates users and rejects developer bypass',async () => {
    expect((await request('/game/progress')).status).toBe(401);
    expect((await request('/game/levels/level-2-glove-forceps-hunt/start','POST',{},alice)).status).toBe(403);
    expect((await request('/game/levels/level-2-glove-forceps-hunt/start','POST',{developerMode:true},alice)).status).toBe(403);
  });
  it('stores one result for simultaneous retries and keeps another player untouched',async () => {
    const start=await request('/game/levels/level-1-concept/start','POST',{},alice);
    expect(start.status).toBe(201);
    const input={challengeNonce:start.data.challenge.nonce,result:contract.gradingExamples[0].input};
    const path=`/game/sessions/${start.data.sessionId}/submit`;
    expect((await request(path,'POST',input,bob)).status).toBe(404);
    const results=await Promise.all([request(path,'POST',input,alice),request(path,'POST',input,alice)]);
    for(const result of results){expect(result.status).toBe(201);expect(result.data.score).toBe(100);}
    expect(results[0].data).toEqual(results[1].data);
    expect((await request(path,'POST',{...input,challengeNonce:'wrong'},alice)).status).toBe(400);
    const p=(await request('/game/progress','GET',undefined,alice)).data;
    expect(p[0].progress).toMatchObject({completed:true,attempts:1,bestScore:100});
    expect(p[1].progress.unlocked).toBe(true);
    const untouched=(await request('/game/progress','GET',undefined,bob)).data;
    expect(untouched[0].progress.completed).toBe(false);
    expect(untouched[1].progress.unlocked).toBe(false);
    expect(await app.get(PrismaService).scoreEvent.count({where:{playerId:aliceId}})).toBe(1);
  });
  it('protects administrative data and serves player totals, history and CSV',async () => {
    expect((await request('/admin/players','GET',undefined,alice)).status).toBe(401);
    const login=await request('/admin/login','POST',{username:process.env.ADMIN_USERNAME,password:process.env.ADMIN_PASSWORD});
    expect(login.status).toBe(201);admin=login.data.accessToken;
    expect((await request('/game/progress','GET',undefined,admin)).status).toBe(401);
    const players=(await request('/admin/players','GET',undefined,admin)).data;
    expect(players.total).toBe(2);
    const a=players.players.find((p:any)=>p.id===aliceId);
    expect(a).toMatchObject({completed:1,completionRate:20,totalScore:100});
    expect(a.passwordHash).toBeUndefined();
    const sessions=(await request(`/admin/players/${aliceId}/sessions`,'GET',undefined,admin)).data;
    expect(sessions.items[0]).toMatchObject({status:'COMPLETED',score:100});
    const csv=await request('/admin/export','GET',undefined,admin);
    expect(csv.status).toBe(200);expect(csv.data).toContain('测试甲');
    expect((await request('/admin')).data).toContain('测试管理');
    expect((await request('/app/release')).data.versionCode).toBe(0);
  });
  (process.env.RUN_ADMIN_UI === 'true' ? it : it.skip)('operates the admin dashboard in Chromium', async () => {
    await promisify(execFile)('python',['tools/test_admin_ui.py'],{
      env:{...process.env,ADMIN_URL:base+'/admin'},timeout:45000,
    });
  },60000);

  it('completes all five current lessons through authenticated HTTP submissions', async () => {
    for (const level of contract.levels.slice(1)) {
      const start = await request(`/game/levels/${level.id}/start`, 'POST', {}, alice);
      expect(start.status).toBe(201);
      const example = contract.gradingExamples.find(e => e.levelId === level.id && e.score === 100)!;
      const result: Record<string, unknown> = { ...example.input };
      if (level.kind === 'maze_quiz') {
        // Real touch navigation can accumulate many wall contacts. They must
        // not erase seven correct answers or prevent unlocking the next level.
        result.collisions = 100;
        result.answers = Object.fromEntries(start.data.level.publicConfig.questions.map(
          (q: { id: string; acceptedAnswers: string[] }) => [q.id, q.acceptedAnswers[0]],
        ));
      }
      const response = await request(`/game/sessions/${start.data.sessionId}/submit`, 'POST', {
        challengeNonce: start.data.challenge.nonce, result,
      }, alice);
      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({ passed: true, score: 100 });
    }
    const progress = (await request('/game/progress', 'GET', undefined, alice)).data;
    expect(progress).toHaveLength(5);
    expect(progress.every((l: { progress: { completed: boolean } }) => l.progress.completed)).toBe(true);
    expect(progress.reduce((sum:number,l:any)=>sum+l.progress.bestScore,0)).toBe(500);
    expect((await request('/leaderboards/overall')).status).toBe(404);
    expect((await request('/leaderboards/levels/level-1-concept')).status).toBe(404);
  });
  it('repairs historical zero scores without adding attempts and is safe to repeat', async () => {
    const prisma = app.get(PrismaService);
    const levels = app.get(LevelsService);
    const player = await prisma.player.create({data:{deviceId:'repair-test',nickname:'修复测试'}});
    const level = levels.find('level-3-container-maze');
    const challenge = levels.createChallenge(level);
    const questions = challenge.questions! as Array<{id:string;acceptedAnswers:string[]}>;
    const submission = {answers:Object.fromEntries(questions.map(q=>[q.id,q.acceptedAnswers[0]])),
      fragmentsCollected:7,reachedExit:true,collisions:7};
    const session = await prisma.gameSession.create({data:{
      playerId:player.id,levelId:level.id,levelVersion:6,challenge,
      submission,receipt:{score:0,stars:0,passed:false},score:0,stars:0,status:'FAILED',
      completedAt:new Date(),expiresAt:new Date('9999-12-31'),
    }});
    await prisma.levelProgress.create({data:{playerId:player.id,levelId:level.id,unlocked:true,attempts:1}});
    await prisma.scoreEvent.create({data:{playerId:player.id,levelId:level.id,score:0,stars:0}});
    const hunt = levels.find('level-2-glove-forceps-hunt');
    const huntChallenge = levels.createChallenge(hunt);
    const huntSubmission = Object.fromEntries((hunt.publicConfig.stages as Array<{id:string}>)
      .map(stage=>[stage.id,{selections:hunt.answerKey[`${stage.id}_errors`]}]));
    const huntSession = await prisma.gameSession.create({data:{
      playerId:player.id,levelId:hunt.id,levelVersion:6,challenge:huntChallenge,
      submission:{...huntSubmission,wrongTaps:20},
      receipt:{score:0,stars:0,passed:false},score:0,stars:0,status:'FAILED',
      completedAt:new Date(),expiresAt:new Date('9999-12-31'),
    }});
    await prisma.levelProgress.create({data:{playerId:player.id,levelId:hunt.id,unlocked:true,attempts:1}});
    expect(await repairTrainingScores(prisma,levels))
      .toMatchObject({eligible:1,updated:0});
    expect((await prisma.gameSession.findUniqueOrThrow({where:{id:session.id}})).score).toBe(0);
    expect(await repairTrainingScores(prisma,levels,true)).toMatchObject({updated:1});
    const repaired = await prisma.gameSession.findUniqueOrThrow({where:{id:session.id}});
    expect(repaired).toMatchObject({score:100,stars:3,status:'COMPLETED'});
    expect(repaired.receipt).toMatchObject({scoringCorrection:{previousReceipt:{score:0,passed:false}}});
    expect(await prisma.levelProgress.findUniqueOrThrow({where:{playerId_levelId:{playerId:player.id,levelId:level.id}}}))
      .toMatchObject({bestScore:100,completed:true,attempts:1});
    expect(await prisma.levelProgress.findUniqueOrThrow({where:{playerId_levelId:{playerId:player.id,levelId:levels.next(level.id)!.id}}}))
      .toMatchObject({unlocked:true});
    expect(await prisma.scoreEvent.count({where:{playerId:player.id}})).toBe(1);
    expect(await prisma.gameSession.findUniqueOrThrow({where:{id:huntSession.id}}))
      .toMatchObject({score:0,stars:0,status:'FAILED'});
    expect(await prisma.levelProgress.findUniqueOrThrow({where:{playerId_levelId:{playerId:player.id,levelId:hunt.id}}}))
      .toMatchObject({bestScore:0,completed:false,attempts:1});
    expect(await repairTrainingScores(prisma,levels,true)).toMatchObject({eligible:0,updated:0});
  });
  it('manages registration, manual accounts, idempotent imports and password changes', async () => {
    expect((await request('/admin/settings','POST',{registrationEnabled:false},alice)).status).toBe(401);
    expect((await request('/admin/settings','POST',{registrationEnabled:'false'},admin)).status).toBe(400);
    expect((await request('/admin/settings','POST',{registrationEnabled:false},admin)).status).toBe(201);
    expect((await request('/auth/options')).data.registrationEnabled).toBe(false);
    expect((await request('/auth/register','POST',{username:'closed',nickname:'禁止注册',password:'test-password-123'})).status).toBe(403);
    const input={username:'manual_student',nickname:'手动学生',initialPassword:'test-password-789'};
    expect((await request('/admin/players','POST',input,alice)).status).toBe(401);
    const created=await request('/admin/players','POST',input,admin);
    expect(created.status).toBe(201);expect(created.data.passwordHash).toBeUndefined();
    expect((await request('/admin/players','POST',input,admin)).status).toBe(409);
    const login=await request('/auth/login','POST',{username:input.username,password:input.initialPassword});
    expect(login.status).toBe(201);
    const token=login.data.accessToken;
    expect((await request('/auth/password','POST',{currentPassword:'wrong-password',newPassword:'new-password-123'},token)).status).toBe(400);
    const changed=await request('/auth/password','POST',{currentPassword:input.initialPassword,newPassword:'new-password-123'},token);
    expect(changed.status).toBe(201);
    expect((await request('/game/progress','GET',undefined,token)).status).toBe(401);
    expect((await request('/game/progress','GET',undefined,changed.data.accessToken)).status).toBe(200);
    expect((await request('/auth/login','POST',{username:input.username,password:input.initialPassword})).status).toBe(401);
    expect((await request('/auth/login','POST',{username:input.username,password:'new-password-123'})).status).toBe(201);
    const roster={players:[{username:input.username,nickname:input.nickname},
      ...Array.from({length:53},(_,i)=>({username:'roster_'+i,nickname:'导入学生'+i}))],initialPassword:'initial-test-123'};
    expect((await request('/admin/players/import','POST',roster,alice)).status).toBe(401);
    const imported=await request('/admin/players/import','POST',roster,admin);
    expect(imported.status).toBe(201);expect(imported.data).toMatchObject({created:53,existing:1});
    expect((await request('/admin/players/import','POST',roster,admin)).data).toMatchObject({created:0,existing:54});
    expect((await request('/auth/login','POST',{username:input.username,password:'new-password-123'})).status).toBe(201);
    expect((await request('/admin/players/import','POST',{...roster,players:[{username:input.username,nickname:'错误姓名'}]},admin)).status).toBe(400);
    const page1=(await request('/admin/players?search=roster_','GET',undefined,admin)).data;
    const page2=(await request('/admin/players?search=roster_&page=2','GET',undefined,admin)).data;
    expect(page1.total).toBe(53);expect(page1.players).toHaveLength(50);expect(page2.players).toHaveLength(3);
    const ids=(await request('/admin/players/ids?search=roster_','GET',undefined,admin)).data.playerIds;
    expect(new Set(ids).size).toBe(53);
    expect((await request('/admin/settings','POST',{registrationEnabled:true},admin)).status).toBe(201);
    expect((await request('/auth/options')).data.registrationEnabled).toBe(true);
  },30000);

  it('requires a current admin-defined code for developer access and records authorized progress',async()=>{
    const setting={code:'class-dev-2026'};
    expect((await request('/auth/developer/verify','POST',setting,bob)).status).toBe(403);
    expect((await request('/admin/developer-code','POST',setting,bob)).status).toBe(401);
    expect((await request('/admin/developer-code','POST',{code:'123'},admin)).status).toBe(400);
    expect((await request('/admin/developer-code','POST',setting,admin)).status).toBe(201);
    const settings=(await request('/admin/settings','GET',undefined,admin)).data;
    expect(settings.developerCodeConfigured).toBe(true);
    expect(JSON.stringify(settings)).not.toContain(setting.code);
    expect((await request('/auth/developer/verify','POST',{code:'wrong-code'},bob)).status).toBe(403);
    const access=await request('/auth/developer/verify','POST',setting,bob);
    expect(access.status).toBe(201);
    const developerToken=access.data.developerToken;
    const level=contract.levels[1];
    const body={developerMode:true,developerToken};
    expect((await request('/game/progress','GET',undefined,developerToken)).status).toBe(401);
    expect((await request(`/game/levels/${level.id}/start`,'POST',body,alice)).status).toBe(403);
    expect((await request(`/game/levels/${level.id}/start`,'POST',{...body,developerToken:bob},bob)).status).toBe(403);
    const start=await request(`/game/levels/${level.id}/start`,'POST',body,bob);
    expect(start.status).toBe(201);
    const example=contract.gradingExamples.find(e=>e.levelId===level.id&&e.score===100)!;
    const submitted=await request(`/game/sessions/${start.data.sessionId}/submit`,'POST',{
      challengeNonce:start.data.challenge.nonce,result:example.input},bob);
    expect(submitted.status).toBe(201);expect(submitted.data).toMatchObject({score:100,passed:true});
    const progress=(await request('/game/progress','GET',undefined,bob)).data;
    expect(progress[1].progress).toMatchObject({bestScore:100,completed:true});
    expect(progress[2].progress.unlocked).toBe(true);
    expect((await request('/admin/developer-code','POST',{code:'replaced-code'},admin)).status).toBe(201);
    expect((await request(`/game/levels/${level.id}/start`,'POST',body,bob)).status).toBe(403);
    expect((await request('/admin/developer-code','POST',{code:''},admin)).status).toBe(201);
    expect((await request('/admin/settings','GET',undefined,admin)).data.developerCodeConfigured).toBe(false);
  });

  it('resets only selected players, invalidates old sessions, and deletes accounts with their data',async()=>{
    const prisma=app.get(PrismaService);
    const bobPlayer=await prisma.player.findUniqueOrThrow({where:{username:'bob'}});
    const start=await request('/game/levels/level-1-concept/start','POST',{},bob);
    const submit={challengeNonce:start.data.challenge.nonce,result:contract.gradingExamples[0].input};
    expect((await request(`/game/sessions/${start.data.sessionId}/submit`,'POST',submit,bob)).status).toBe(201);
    const reset={playerIds:[aliceId]};
    expect((await request('/admin/players/reset','POST',reset,bob)).status).toBe(401);
    expect((await request('/admin/players/reset','POST',{playerIds:[]},admin)).status).toBe(400);
    const old=await request('/game/levels/level-1-concept/start','POST',{},alice);
    expect((await request('/admin/players/reset','POST',reset,admin)).data.resetCount).toBe(1);
    const progress=(await request('/game/progress','GET',undefined,alice)).data;
    expect(progress[0].progress).toMatchObject({unlocked:true,bestScore:0,completed:false,attempts:0});
    expect(progress.slice(1).every((l:any)=>!l.progress.unlocked)).toBe(true);
    expect(await prisma.gameSession.count({where:{playerId:aliceId}})).toBe(0);
    expect(await prisma.scoreEvent.count({where:{playerId:aliceId}})).toBe(0);
    expect((await request(`/game/sessions/${old.data.sessionId}/submit`,'POST',{
      ...submit,challengeNonce:old.data.challenge.nonce},alice)).status).toBe(404);
    expect((await request('/game/progress','GET',undefined,bob)).data[0].progress.bestScore).toBe(100);
    expect((await request(`/admin/players/${bobPlayer.id}`,'DELETE',undefined,alice)).status).toBe(401);
    expect((await request(`/admin/players/${bobPlayer.id}`,'DELETE',undefined,admin)).status).toBe(200);
    expect((await request('/game/progress','GET',undefined,bob)).status).toBe(401);
    expect(await prisma.gameSession.count({where:{playerId:bobPlayer.id}})).toBe(0);
    expect(await prisma.levelProgress.count({where:{playerId:bobPlayer.id}})).toBe(0);
    expect(await prisma.scoreEvent.count({where:{playerId:bobPlayer.id}})).toBe(0);
  });

  it('imports a private roster with the deployment CLI, previewing before writing',async()=>{
    const directory=join(process.cwd(),'tmp');await mkdir(directory,{recursive:true});
    const file=join(directory,`cli-roster-${randomUUID()}.json`);
    await writeFile(file,JSON.stringify({players:[{username:'cli_test_001',nickname:'CLI测试学生'}]}),{mode:0o600});
    const run=async(apply=false)=>{
      const result=await promisify(execFile)(process.execPath,['dist/maintenance/import-players.js','--file',file,...(apply?['--apply']:[])],
        {env:{...process.env,ROSTER_INITIAL_PASSWORD:'cli-test-password'},timeout:20000});
      return JSON.parse(result.stdout.trim());
    };
    try {
      expect(await run()).toMatchObject({mode:'dry-run',wouldCreate:1,created:0});
      expect(await app.get(PrismaService).player.count({where:{username:'cli_test_001'}})).toBe(0);
      expect(await run(true)).toMatchObject({mode:'apply',created:1});
      expect(await run(true)).toMatchObject({created:0,existing:1});
    } finally {await unlink(file);}
  },60000);

});
