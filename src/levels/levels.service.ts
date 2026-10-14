import { randomInt } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { LEVEL_DEFINITIONS } from './level.definitions';
import { matchesMazeAnswer } from './maze.questions';
import {
  LevelDefinition,
  ValidationResult,
} from './level.types';

@Injectable()
export class LevelsService {
  private readonly levels = LEVEL_DEFINITIONS;

  get firstLevelId() {
    return this.levels[0].id;
  }

  listPublic() {
    return this.levels.map((level) => this.toPublic(level));
  }

  find(levelId: string) {
    const level = this.levels.find((item) => item.id === levelId);
    if (!level) {
      throw new NotFoundException('关卡不存在');
    }
    return level;
  }

  next(levelId: string) {
    const current = this.find(levelId);
    return this.levels.find((item) => item.order === current.order + 1);
  }

  toPublic(level: LevelDefinition) {
    const { answerKey: _answerKey, ...publicLevel } = level;
    return publicLevel;
  }

  sessionLevel(level: LevelDefinition, challenge: Record<string, unknown>): LevelDefinition {
    if (level.kind !== 'maze_quiz' || !Array.isArray(challenge.questions)) return level;
    const questions = challenge.questions as Array<{id:string; acceptedAnswers:string[]}>;
    return {...level, publicConfig:{...level.publicConfig, questions},
      answerKey:{...level.answerKey, answers:Object.fromEntries(questions.map(q => [q.id,q.acceptedAnswers]))}};
  }

  createChallenge(level: LevelDefinition) {
    const questions = level.kind === 'maze_quiz'
      ? [...level.publicConfig.questions as Array<Record<string, unknown>>] : null;
    if (questions) {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }
    return {
      ...(questions ? {questions:questions.map((q,i) => ({...q, id:`q${i+1}`}))} : {}),
      nonce: crypto.randomUUID(),
      levelVersion: level.version,
      issuedAt: new Date().toISOString(),
    };
  }

  validate(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ): ValidationResult {
    switch (level.kind) {
      case 'concept_challenge':
        return this.validateConceptChallenge(level, submission);
      case 'error_hunt':
        return this.validateErrorHunt(level, submission);
      case 'maze_quiz':
        return this.validateMaze(level, submission);
      case 'block_stacking_defense':
        return this.validateBlockStacking(level, submission);
      case 'space_guardian':
        return this.validateGuardian(level, submission);
    }
  }

  private finish(
    level: LevelDefinition,
    rawScore: number,
    feedback: string[],
    details: Record<string, unknown>,
  ): ValidationResult {
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const stars = level.starThresholds.filter((threshold) => score >= threshold).length;
    return {
      passed: score >= level.passScore,
      score,
      stars,
      feedback,
      details,
    };
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private gate(level: LevelDefinition, score: number, complete: boolean) {
    return complete ? Math.max(level.passScore, score) : Math.min(level.passScore - 1, score);
  }

  private number(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  private validateProcedure(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ) {
    const expected = level.answerKey.steps as string[];
    const actual = this.stringArray(submission.steps);
    const correctPositions = expected.filter((step, index) => actual[index] === step).length;
    const score = (correctPositions / expected.length) * 100;
    return this.finish(
      level,
      score,
      correctPositions === expected.length
        ? ['操作顺序正确']
        : [`有 ${expected.length - correctPositions} 个步骤需要调整`],
      { correctSteps: correctPositions, totalSteps: expected.length },
    );
  }

  private validateConceptChallenge(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ) {
    const expectedSentences = level.answerKey.correctSentences as string[][];
    const actualSentences = Array.isArray(submission.sentences)
      ? submission.sentences as string[][]
      : [];

    const sentenceScore = expectedSentences.filter((expected, index) => {
      const actual = actualSentences[index] || [];
      return JSON.stringify(expected) === JSON.stringify(actual);
    }).length;

    const expectedLabels = level.answerKey.openedItemAnswers as Record<string, string>;
    const actualLabels =
      typeof submission.openedItemAnswers === 'object' && submission.openedItemAnswers
        ? (submission.openedItemAnswers as Record<string, string>)
        : {};

    const labelScore = Object.entries(expectedLabels).filter(
      ([itemId, category]) => actualLabels[itemId] === category,
    ).length;

    const expectedSorting = level.answerKey.itemClassification as Record<string, string>;
    const sorting = submission.itemClassification as Record<string, string> | undefined;
    const sortScore = Object.entries(expectedSorting).filter(([id, category]) => sorting?.[id] === category).length;
    const toolsUsed = this.stringArray(submission.toolsUsed);
    const expectedTools = level.answerKey.toolSequence as string[];
    const toolScore = expectedTools.filter(tool => toolsUsed.includes(tool)).length;

    const environment = submission.storageEnvironment as Record<string, unknown> | undefined;
    const t = environment?.temperature;
    const h = environment?.humidity;
    const a = environment?.airChanges;
    const storageChecked = typeof t === 'number' && Number.isFinite(t) && t >= 0 && t < 24 &&
      typeof h === 'number' && Number.isFinite(h) && h > 0 && h < 70 &&
      typeof a === 'number' && Number.isFinite(a) && a >= 4 && a <= 10 &&
      JSON.stringify(submission.storageKnowledgeAnswers) === JSON.stringify(level.answerKey.storageKnowledgeAnswers);
    const expirationChecked = submission.expirationValidation === true && storageChecked;

    const score =
      (sentenceScore / expectedSentences.length) * 30 +
      (labelScore / Object.keys(expectedLabels).length) * 15 +
      (sortScore / Object.keys(expectedSorting).length) * 15 +
      (toolScore / expectedTools.length) * 25 +
      (expirationChecked ? 15 : 0) - this.number(submission.mistakes) * 2;

    return this.finish(
      level,
      this.gate(level, score, storageChecked && expirationChecked && sortScore === Object.keys(expectedSorting).length && labelScore === Object.keys(expectedLabels).length &&
        sentenceScore === expectedSentences.length && toolScore === expectedTools.length),
      sentenceScore === expectedSentences.length
        ? ['连词成句全部正确']
        : [`${expectedSentences.length - sentenceScore} 个句子需要调整`],
      {
        sentenceScore,
        labelScore,
        sortScore,
        toolScore,
        expirationChecked,
        totalSentences: expectedSentences.length,
        totalItems: Object.keys(expectedLabels).length,
        totalTools: expectedTools.length,
      },
    );
  }

  private validateErrorHunt(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ) {
    const publicConfig = level.publicConfig as {
      stages?: Array<{ id: string; targetCount: number }>;
      wrongTapPenalty?: number;
    };

    if (publicConfig.stages && Array.isArray(publicConfig.stages)) {
      let totalCorrect = 0;
      let totalWrong = 0;
      let totalTargets = 0;
      const stageFeedback: string[] = [];

      for (const stage of publicConfig.stages) {
        const stageKey = `${stage.id}_errors`;
        const expectedErrors = new Set(level.answerKey[stageKey] as string[] || []);
        const actualErrors = new Set(this.stringArray(
          (submission[stage.id] as Record<string, unknown>)?.selections ||
            submission[`${stage.id}_selections`],
        ));

        if (expectedErrors.size === 0) {
          stageFeedback.push(`${stage.id}: 服务端未配置找错答案`);
          continue;
        }

        const correct = [...actualErrors].filter((item) => expectedErrors.has(item)).length;
        const wrong = [...actualErrors].filter((item) => !expectedErrors.has(item)).length;

        totalCorrect += correct;
        totalWrong += wrong;
        totalTargets += expectedErrors.size;

        stageFeedback.push(
          `${stage.id}: ${correct}/${expectedErrors.size} 正确${wrong > 0 ? `, 误点${wrong}处` : ''}`
        );
      }

      const telemetryWrongTaps = this.number(submission.wrongTaps);
      const avgScore =
        totalCorrect / totalTargets * 100 - (totalWrong + telemetryWrongTaps) * 5;
      totalWrong += telemetryWrongTaps;
      if (telemetryWrongTaps > 0) {
        stageFeedback.push(`图片误点${telemetryWrongTaps}次`);
      }

      return this.finish(
        level,
        totalCorrect === totalTargets ? avgScore : Math.min(avgScore, level.passScore - 1),
        totalWrong === 0 ? ['所有阶段识别准确'] : stageFeedback,
        { totalCorrect, totalWrong, totalTargets, stages: publicConfig.stages.length },
      );
    }

    const targets = new Set(level.answerKey.targets as string[]);
    const selections = new Set(this.stringArray(submission.selections));
    const correct = [...selections].filter((item) => targets.has(item)).length;
    const wrong = [...selections].filter((item) => !targets.has(item)).length;
    const score = (correct / targets.size) * 100 - wrong * 8;
    return this.finish(
      level,
      score,
      wrong === 0 ? ['器械异常识别准确'] : [`误点 ${wrong} 处`],
      { correct, wrong, totalTargets: targets.size },
    );
  }

  private validateMaze(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ) {
    const publicConfig = level.publicConfig as {
      fragmentCount?: number;
      collisionPenalty?: number;
    };
    const maxFragments = publicConfig.fragmentCount || 4;

    const expected = level.answerKey.answers as Record<string, string[]>;
    const answers =
      typeof submission.answers === 'object' && submission.answers
        ? (submission.answers as Record<string, unknown>)
        : {};
    const correctAnswers = Object.entries(expected).filter(
      ([questionId, accepted]) => matchesMazeAnswer(answers[questionId], accepted),
    ).length;
    const fragments = Math.min(
      maxFragments,
      correctAnswers,
      this.number(submission.fragmentsCollected),
    );
    const collisions = this.number(submission.collisions);
    const contaminationHits = this.number(submission.contaminationHits);
    const bonusAnswered = this.number(submission.bonusQuestionsAnswered);
    const exited =
      submission.reachedExit === true && fragments === maxFragments;

    const answerPoints = (correctAnswers / Object.keys(expected).length) * 40;
    const fragmentPoints = (fragments / maxFragments) * 30;
    const exitBonus = exited ? 30 : 0;
    const bonusPoints = bonusAnswered * 5;
    const collisionPenalty =
      collisions * (publicConfig.collisionPenalty ?? 10);
    const contaminationPenalty = contaminationHits * 15;

    const score = answerPoints + fragmentPoints + exitBonus + bonusPoints - collisionPenalty - contaminationPenalty;

    return this.finish(
      level,
      exited ? score : Math.min(score, level.passScore - 1),
      exited
        ? [`已到达迷宫出口，收集${fragments}/${maxFragments}个碎片`]
        : [`尚未到达出口，收集${fragments}/${maxFragments}个碎片`],
      { correctAnswers, fragments, collisions, contaminationHits, bonusAnswered, exited, maxFragments },
    );
  }

  private validateBlockStacking(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ) {
    const publicConfig = level.publicConfig as {
      zones?: Array<{ id: string }>;
      victoryConditions?: {
        basic?: { perfectOperationsPerZone?: number; maxContamination?: number };
        advanced?: { ultimateSterileCodex?: number };
      };
    };

    const zones = publicConfig.zones || [];
    const basicConditions = publicConfig.victoryConditions?.basic || {
      perfectOperationsPerZone: 2,
      maxContamination: 3,
    };

    const perfectOperations =
      typeof submission.perfectOperations === 'object' && submission.perfectOperations
        ? (submission.perfectOperations as Record<string, number>)
        : {};

    const totalPerfectOps = zones.reduce((sum, zone) => sum + Math.min(
      basicConditions.perfectOperationsPerZone ?? 2, this.number(perfectOperations[zone.id])), 0);
    const requiredPerfectOps = zones.length * (basicConditions.perfectOperationsPerZone || 2);

    const contaminationBlocks = this.number(submission.contaminationBlocks);
    const toolsUsed = this.number(submission.toolsUsed);
    const mergesCompleted = this.number(submission.mergesCompleted);
    const ultimateCodexCreated = submission.ultimateSterileCodex === true;

    const perfectOpsScore = (Math.min(totalPerfectOps, requiredPerfectOps) / requiredPerfectOps) * 40;
    const contaminationScore = Math.max(0, 30 - contaminationBlocks * 10);
    const mergeScore = Math.min(20, mergesCompleted * 2);
    const ultimateBonus = ultimateCodexCreated ? 15 : 0;
    const toolBonus = Math.min(10, toolsUsed * 2);

    const score = Math.min(100, perfectOpsScore + contaminationScore + mergeScore + ultimateBonus + toolBonus)
      - this.number(submission.wrongZonePlacements) * 2;

    // The design defines passing by the two explicit gameplay conditions, not
    // by bonus-score farming. Keep the displayed score meaningful while making
    // sure a valid basic victory passes and an invalid run cannot pass merely
    // because it accumulated merge/tool bonuses.
    const completedEveryZone = zones.every(
      (zone) =>
        this.number(perfectOperations[zone.id]) >=
        (basicConditions.perfectOperationsPerZone || 2),
    );
    const contaminationControlled =
      contaminationBlocks <= (basicConditions.maxContamination || 3);
    const basicVictory = completedEveryZone && contaminationControlled;
    const resultScore = basicVictory
      ? Math.max(score, level.passScore)
      : Math.min(score, level.passScore - 1);

    const feedback: string[] = [];
    if (totalPerfectOps >= requiredPerfectOps) {
      feedback.push('完美操作达标');
    } else {
      feedback.push(`完美操作 ${totalPerfectOps}/${requiredPerfectOps}`);
    }

    if (contaminationBlocks <= (basicConditions.maxContamination || 3)) {
      feedback.push('污染控制良好');
    } else {
      feedback.push(`污染超标: ${contaminationBlocks}个`);
    }

    if (ultimateCodexCreated) {
      feedback.push('解锁成就: 细节大师');
    }

    return this.finish(
      level,
      resultScore,
      feedback,
      {
        perfectOperations: totalPerfectOps,
        requiredPerfectOps,
        contaminationBlocks,
        mergesCompleted,
        toolsUsed,
        ultimateCodexCreated,
        basicVictory,
      },
    );
  }

  private validateDisinfection(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ) {
    const expectedSteps = level.answerKey.procedure as string[];
    const actualSteps = this.stringArray(submission.steps);
    const correctSteps = expectedSteps.filter(
      (step, index) => actualSteps[index] === step,
    ).length;
    const concentration = this.number(submission.concentrationPercent);
    const mixError = Math.abs(concentration - 0.5);
    const mixScore = Math.max(0, 25 - mixError * 250);
    const eliminated = Math.min(12, this.number(submission.pollutantsEliminated));
    const wrongZones = this.number(submission.wrongZoneActions);
    const score =
      (correctSteps / expectedSteps.length) * 35 +
      mixScore +
      (eliminated / 12) * 40 -
      wrongZones * 12;
    return this.finish(
      level,
      score,
      mixError <= 0.05 ? ['消毒液浓度合格'] : ['消毒液浓度偏差过大'],
      { correctSteps, concentration, eliminated, wrongZones },
    );
  }

  private validateGuardian(
    level: LevelDefinition,
    submission: Record<string, unknown>,
  ) {
    const publicConfig = level.publicConfig as {
      phases?: Array<{
        id: string;
        enemies?: Array<{ count?: number }>;
        obstacles?: Array<unknown>;
        requiredProcedureSteps?: number;
      }>;
      victoryConditions?: {
        allBacteriaEliminated?: boolean;
        allObstaclesRemoved?: boolean;
        sterileZoneEstablished?: boolean;
        minimumSterility?: number;
      };
    };

    const phases = publicConfig.phases || [];
    const bacteriaPhase = phases.find((phase) => phase.id === 'bacteria_elimination');
    const obstaclePhase = phases.find((phase) => phase.id === 'obstacle_removal');
    const minimumSterility =
      publicConfig.victoryConditions?.minimumSterility ?? 80;

    const phase1 = (submission.phase1 as Record<string, unknown>) || {};
    const phase2 = (submission.phase2 as Record<string, unknown>) || {};

    const expectedBacteria = Math.max(
      1,
      bacteriaPhase?.enemies?.reduce(
        (total, enemy) => total + Math.max(0, enemy.count ?? 0),
        0,
      ) ?? 6,
    );
    const bacteriaEliminated = Math.min(
      expectedBacteria,
      Math.max(0, this.number(phase1.bacteriaEliminated)),
    );
    const completedMethods = new Set(this.stringArray(phase1.completedMethods));
    const phase1Skills = level.answerKey.phase1_skills;
    const requiredMethods = new Set(
      phase1Skills && typeof phase1Skills === 'object'
        ? Object.keys(phase1Skills as Record<string, unknown>)
        : [],
    );
    const correctMethodsUsed = [...requiredMethods].filter((method) =>
      completedMethods.has(method),
    ).length;
    const requiredProcedureSteps = Math.max(
      1,
      bacteriaPhase?.requiredProcedureSteps ?? 18,
    );
    const correctProcedureSteps = Math.min(
      requiredProcedureSteps,
      Math.max(0, this.number(phase1.correctProcedureSteps)),
    );

    const phase2Items = level.answerKey.phase2_items;
    const expectedObstacles = Math.max(
      1,
      obstaclePhase?.obstacles?.length ||
        (phase2Items && typeof phase2Items === 'object'
          ? Object.keys(phase2Items as Record<string, unknown>).length
          : 3),
    );
    const obstaclesRemoved = Math.min(
      expectedObstacles,
      Math.max(0, this.number(phase2.obstaclesRemoved)),
    );
    const correctOpenMethods = Math.min(
      expectedObstacles,
      Math.max(0, this.number(phase2.correctMethods)),
    );
    const sterileItemsOpened = Math.min(
      expectedObstacles,
      Math.max(0, this.number(phase2.sterileItemsOpened)),
    );

    const sterility = Math.min(
      100,
      Math.max(0, this.number(submission.sterility)),
    );
    const mistakes = Math.max(0, this.number(submission.mistakes));
    const clientEstablishedZone = submission.sterileZoneEstablished === true;

    const bacteriaComplete = bacteriaEliminated >= expectedBacteria;
    const methodsComplete =
      requiredMethods.size > 0 && correctMethodsUsed >= requiredMethods.size;
    const procedureComplete = correctProcedureSteps >= requiredProcedureSteps;
    const obstaclesComplete =
      obstaclesRemoved >= expectedObstacles &&
      correctOpenMethods >= expectedObstacles &&
      sterileItemsOpened >= expectedObstacles;
    const sterileZoneEstablished =
      bacteriaComplete &&
      methodsComplete &&
      procedureComplete &&
      obstaclesComplete &&
      sterility >= minimumSterility &&
      clientEstablishedZone;

    const calculatedScore =
      (bacteriaEliminated / expectedBacteria) * 25 +
      (correctMethodsUsed / Math.max(1, requiredMethods.size)) * 10 +
      (correctProcedureSteps / requiredProcedureSteps) * 10 +
      (obstaclesRemoved / expectedObstacles) * 30 +
      (correctOpenMethods / expectedObstacles) * 10 +
      (sterileItemsOpened / expectedObstacles) * 5 +
      (sterility / 100) * 10 -
      mistakes * 2;
    const resultScore = sterileZoneEstablished
      ? Math.max(calculatedScore, level.passScore)
      : Math.min(calculatedScore, level.passScore - 1);

    const feedback: string[] = [];
    if (bacteriaComplete && methodsComplete && procedureComplete) {
      feedback.push('细菌清除完成');
    } else {
      feedback.push(`细菌清除 ${bacteriaEliminated}/${expectedBacteria}`);
    }

    if (obstaclesComplete) {
      feedback.push('障碍物全部移除');
    } else {
      feedback.push(`障碍物移除 ${obstaclesRemoved}/${expectedObstacles}`);
    }

    if (sterileZoneEstablished) {
      feedback.push('无菌区域构建成功，获得无菌操作物品徽章');
    } else {
      feedback.push(`无菌区域构建失败（无菌值需≥${minimumSterility}%）`);
    }

    return this.finish(
      level,
      resultScore,
      feedback,
      {
        phase1: {
          bacteriaEliminated,
          totalBacteria: expectedBacteria,
          completedMethods: correctMethodsUsed,
          requiredMethods: requiredMethods.size,
          correctProcedureSteps,
          requiredProcedureSteps,
        },
        phase2: {
          obstaclesRemoved,
          totalObstacles: expectedObstacles,
          correctMethods: correctOpenMethods,
          sterileItemsOpened,
        },
        sterility,
        mistakes,
        sterileZoneEstablished,
        badgeEarned: sterileZoneEstablished,
      },
    );
  }
}
