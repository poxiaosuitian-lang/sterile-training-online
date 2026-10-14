import * as contract from './standalone-contract.json';
import { LevelsService } from './levels.service';

describe('Current standalone content is the online baseline', () => {
  const service = new LevelsService();
  it.each(contract.gradingExamples.map((e,i) => ({...e, index:i})))('$levelId example $index', e => {
    const level = service.sessionLevel(service.find(e.levelId), {questions:e.questions});
    expect(service.validate(level,e.input)).toMatchObject({score:e.score,passed:e.passed});
  });
  it('assigns and grades the same seven randomized room questions', () => {
    const level = service.find('level-3-container-maze');
    const challenge = service.createChallenge(level);
    const assigned = service.sessionLevel(level,challenge);
    const questions = assigned.publicConfig.questions as Array<{id:string; sourceId:string; acceptedAnswers:string[]}>;
    expect(new Set(questions.map(q => q.sourceId)).size).toBe(7);
    expect(questions.map(q => q.id)).toEqual(['q1','q2','q3','q4','q5','q6','q7']);
    expect(service.validate(assigned, {answers:Object.fromEntries(questions.map(q => [q.id,q.acceptedAnswers[0]])),
      fragmentsCollected:7,reachedExit:true})).toMatchObject({passed:true,score:100});
  });
});
