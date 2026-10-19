import { LEVEL_DEFINITIONS } from './level.definitions';
import { LevelsService } from './levels.service';

describe('LevelsService', () => {
  const service = new LevelsService();

  it('does not expose answer keys to Flutter', () => {
    const levels = service.listPublic();
    expect(levels).toHaveLength(5);
    expect(levels.every((level) => !('answerKey' in level))).toBe(true);
  });

  it('keeps the first concept challenge untimed and scores all phases', () => {
    const level = service.find('level-1-concept');
    expect(level.timeLimitSeconds).toBe(0);
    expect((level.answerKey.itemClassification as Record<string, string>).opened_solution).toBe('sterile_storage');
    const result = service.validate(level, {
      sentences: level.answerKey.correctSentences,
      toolsUsed: level.answerKey.toolSequence,
      openedItemAnswers: level.answerKey.openedItemAnswers,
      itemClassification: level.answerKey.itemClassification,
      expirationValidation: true,
      storageEnvironment: {temperature: 22, humidity: 50, airChanges: 6},
      storageKnowledgeAnswers: [14,7,30,180,180,180,180],
    });
    expect(result).toMatchObject({ passed: true, score: 100, stars: 3 });
    const base = {sentences: level.answerKey.correctSentences, toolsUsed: level.answerKey.toolSequence,
      openedItemAnswers: level.answerKey.openedItemAnswers, expirationValidation: true,
      storageEnvironment: {temperature:22, humidity:50, airChanges:6}, storageKnowledgeAnswers:[14,7,30,180,180,180,180]};
    expect(service.validate(level, base).passed).toBe(false);
    expect(service.validate(level, {...base, itemClassification: {
      ...(level.answerKey.itemClassification as object), gloves: 'sterile_storage',
    }}).passed).toBe(false);

  });

  it('requires all eight opened-item labels, including the first-use container limit', () => {
    const level = service.find('level-1-concept');
    const answers = level.answerKey.openedItemAnswers as Record<string, string>;
    const phases = level.publicConfig.phases as Array<Record<string, unknown>>;
    expect(phases.find(p => p.name === 'item_management')?.items).toEqual(Object.keys(level.answerKey.itemClassification as object));
    expect(Object.values(answers)).toEqual(['24h', '24h', '7d', '4h', '4h', '24h', 'max24h', '4h']);
    for (const id of Object.keys(answers)) {
      const partial = {...answers};
      delete partial[id];
      const run = {sentences: level.answerKey.correctSentences,
        toolsUsed: level.answerKey.toolSequence, openedItemAnswers: partial,
        itemClassification: level.answerKey.itemClassification,
        expirationValidation: true, storageEnvironment: {temperature:22, humidity:50, airChanges:6},
        storageKnowledgeAnswers: [14,7,30,180,180,180,180]};
      expect(service.validate(level, run).passed).toBe(false);
      expect(service.validate(level, {...run, openedItemAnswers: {...answers, [id]: 'wrong'}}).passed).toBe(false);
    }
  });

  function fullHuntSubmission(): Record<string, unknown> {
    const level = service.find('level-2-glove-forceps-hunt');
    const stages = level.publicConfig.stages as Array<{ id: string }>;
    return Object.fromEntries(stages.map(stage => [stage.id, {
      selections: level.answerKey[`${stage.id}_errors`],
    }]));
  }

  it('deducts image misses from the error-hunt score', () => {
    const level = service.find('level-2-glove-forceps-hunt');
    const result = service.validate(level, { ...fullHuntSubmission(), wrongTaps: 2 });
    expect(result.score).toBe(90);
  });

  it('deducts invalid selections as well as reported image misses', () => {
    const level = service.find('level-2-glove-forceps-hunt');
    const submission = fullHuntSubmission();
    submission.forceps_operation = { selections: [
      ...(level.answerKey.forceps_operation_errors as string[]), 'wrong_hemostat',
    ] };
    expect(service.validate(level, { ...submission, wrongTaps: 1 }).score).toBe(90);
  });

  it('keeps every training level untimed', () => {
    expect(service.listPublic().every(level => level.timeLimitSeconds === 0)).toBe(true);
  });

  it('scores all four image-hunt stages with matching answer keys', () => {
    const level = service.find('level-2-glove-forceps-hunt');
    expect(service.validate(level, fullHuntSubmission()))
      .toMatchObject({ passed: true, score: 100, stars: 3 });
    expect(level.answerKey.forceps_operation_errors).not.toContain('inverted_lid');
    expect(level.answerKey.instrument_storage_errors).toContain('contaminated_swabs');
  });

  it('requires the contaminated swabs even when every other target was found', () => {
    const level = service.find('level-2-glove-forceps-hunt');
    const submission = fullHuntSubmission();
    submission.instrument_storage = { selections:
      (level.answerKey.instrument_storage_errors as string[]).filter(id => id !== 'contaminated_swabs'),
    };
    expect(service.validate(level, submission).passed).toBe(false);
  });

  it('requires incomplete wet immersion instead of the removed incorrect-instrument target', () => {
    const level = service.find('level-2-glove-forceps-hunt');
    const submission = fullHuntSubmission();
    const selections = [
      'wrong_hemostat', 'incorrect_grip', 'tip_touches_rim', 'missing_indicator',
    ];
    submission.forceps_operation = { selections };
    expect(service.validate(level, submission).passed).toBe(false);
    selections[0] = 'insufficient_immersion';
    expect(service.validate(level, submission).passed).toBe(true);
  });
  it('requires seven verified maze fragments before opening the exit', () => {
    const level = service.find('level-3-container-maze');
    const answers = Object.fromEntries(Object.entries(level.answerKey.answers as Record<string,string[]>)
      .map(([id, accepted]) => [id, accepted[0]]));

    const perfect = service.validate(level, {
      answers,
      fragmentsCollected: 7,
      collisions: 0,
      contaminationHits: 0,
      bonusQuestionsAnswered: 0,
      reachedExit: true,
    });
    expect(perfect).toMatchObject({ passed: true, score: 100, stars: 3 });
    expect(perfect.details).toMatchObject({
      fragments: 7,
      exited: true,
      maxFragments: 7,
    });

    const collided = service.validate(level, {
      answers,
      fragmentsCollected: 7,
      collisions: 1,
      contaminationHits: 0,
      reachedExit: true,
    });
    expect(collided).toMatchObject({ score: 100, stars: 3 });

    const forgedExit = service.validate(level, {
      answers: { ...answers, q7: '向上' },
      fragmentsCollected: 7,
      reachedExit: true,
    });
    expect(forgedExit.passed).toBe(false);
    expect(forgedExit.details).toMatchObject({
      fragments: 6,
      exited: false,
    });
  });

  it('does not turn a completed maze into zero after repeated wall contact', () => {
    const base = service.find('level-3-container-maze');
    const level = service.sessionLevel(base, service.createChallenge(base));
    const answers = Object.fromEntries(Object.entries(level.answerKey.answers as Record<string, string[]>)
      .map(([id, accepted]) => [id, accepted[0]]));
    for (const collisions of [0, 1, 7, 1000]) {
      expect(service.validate(level, {answers, fragmentsCollected:7, reachedExit:true, collisions}))
        .toMatchObject({score:100, stars:3, passed:true, details:{correctAnswers:7, collisionPenalty:0}});
    }
    expect(service.validate(level, {answers, fragmentsCollected:7, reachedExit:true, contaminationHits:1}))
      .toMatchObject({score:85, passed:true});
    expect(service.validate(level, {answers, fragmentsCollected:7, reachedExit:true, contaminationHits:30}))
      .toMatchObject({score:60, passed:true});
    expect(service.validate(level, {answers, fragmentsCollected:7, reachedExit:false, bonusQuestionsAnswered:100}))
      .toMatchObject({score:59, passed:false});
    expect(service.validate(level, {answers:{...answers,q7:'invalid'}, fragmentsCollected:7, reachedExit:true, bonusQuestionsAnswered:100}).passed)
      .toBe(false);
  });

  it('deducts five points per hunt mistake without a passing score floor', () => {
    const level = service.find('level-2-glove-forceps-hunt');
    const stages = level.publicConfig.stages as Array<{id:string}>;
    const result = Object.fromEntries(stages.map(s => [s.id, {selections:level.answerKey[`${s.id}_errors`]}]));
    for (const [wrongTaps, score, passed] of [[0,100,true],[8,60,true],[9,55,false],[20,0,false]] as const) {
      expect(service.validate(level, {...result, wrongTaps})).toMatchObject({score, passed});
    }
    expect(service.validate(level, {...result, [stages[0].id]:{selections:[]}}).passed).toBe(false);
  });

  it('requires both completed operation zones and enough sterility to pass level 5', () => {
    const level = service.find('level-5-space-guardian');
    const completedRun = {
      phase1: {
        bacteriaEliminated: 6,
        totalBacteria: 6,
        completedMethods: ['single_drape', 'double_drape'],
        correctProcedureSteps: 18,
      },
      phase2: {
        obstaclesRemoved: 3,
        totalObstacles: 3,
        correctMethods: 3,
        sterileItemsOpened: 3,
      },
      sterility: 90,
      mistakes: 1,
      sterileZoneEstablished: true,
      badgeEarned: true,
    };

    const success = service.validate(level, completedRun);
    expect(success).toMatchObject({ passed: true });
    expect(success.details).toMatchObject({
      sterileZoneEstablished: true,
      badgeEarned: true,
    });

    const contaminated = service.validate(level, {
      ...completedRun,
      sterility: 70,
      mistakes: 3,
    });
    expect(contaminated).toMatchObject({ passed: false, score: 59 });
    expect(contaminated.details).toMatchObject({
      sterileZoneEstablished: false,
      badgeEarned: false,
    });

    const skippedObstacle = service.validate(level, {
      ...completedRun,
      phase2: {
        obstaclesRemoved: 2,
        totalObstacles: 3,
        correctMethods: 2,
        sterileItemsOpened: 2,
      },
    });
    expect(skippedObstacle.passed).toBe(false);
  });

  it('uses the fourth-level basic conditions as the hard pass gate', () => {
    const level = service.find('level-4-solution-stacking');
    const basicVictory = service.validate(level, {
      perfectOperations: {
        verification_zone: 2,
        liquid_pouring_zone: 2,
      },
      contaminationBlocks: 3,
      mergesCompleted: 4,
      toolsUsed: 0,
      ultimateSterileCodex: false,
    });
    expect(basicVictory.passed).toBe(true);
    expect(basicVictory.score).toBeGreaterThanOrEqual(level.passScore);
    expect(basicVictory.details).toMatchObject({ basicVictory: true });

    const bonusWithoutControl = service.validate(level, {
      perfectOperations: {
        verification_zone: 8,
        liquid_pouring_zone: 8,
      },
      contaminationBlocks: 5,
      mergesCompleted: 20,
      toolsUsed: 10,
      ultimateSterileCodex: true,
    });
    expect(bonusWithoutControl.passed).toBe(false);
    expect(bonusWithoutControl.score).toBeLessThan(level.passScore);
    expect(bonusWithoutControl.details).toMatchObject({ basicVictory: false });
  });
});


describe('first level marked sentence bank', () => {
  it('keeps prefixes in prompts and complete endings in matching templates and grading', () => {
    const level = LEVEL_DEFINITIONS.find((entry) => entry.id === 'level-1-concept')!;
    const expected = [
      ['在医疗、护理操作过程中', '防止一切微生物侵入人体和', '防止无菌物品、无菌区域被污染的技术'],
      ['经灭菌处理', '且未被污染的区域'],
      ['未经灭菌处理', '或虽经灭菌处理', '但又被污染的区域'],
      ['通过灭菌处理后', '保持无菌状态的物品'],
      ['未经灭菌处理', '或虽经灭菌处理后', '又被污染的物品'],
    ];
    expect(level.answerKey.correctSentences).toEqual(expected);
    const phases = level.publicConfig.phases as {sentenceTemplates?: {words: string[]}[]}[];
    expect(phases[0].sentenceTemplates!.map((entry) => entry.words)).toEqual(expected);
  });
});
