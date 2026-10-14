import { MAZE_QUESTIONS, MAZE_BONUS_QUESTION, matchesMazeAnswer } from './maze.questions';

describe('Maze fill-in answers', () => {
  it('accepts canonical answers for seven rooms and the bonus', () => {
    expect(MAZE_QUESTIONS).toHaveLength(7);
    for (const question of [...MAZE_QUESTIONS, MAZE_BONUS_QUESTION]) {
      expect(question.type).toBe('fill_blank');
      expect(question.text).toContain('____');
      expect(matchesMazeAnswer(question.acceptedAnswers[0], question.acceptedAnswers)).toBe(true);
    }
  });

  it('accepts aliases and full-width digits but rejects negations and old option indices', () => {
    const time = MAZE_QUESTIONS[4].acceptedAnswers;
    for (const answer of ['24', '二十四', '２４', ' ２４ 小时。 ', '24H']) {
      expect(matchesMazeAnswer(answer, time)).toBe(true);
    }
    for (const answer of [1, null, '', '48', '不是24']) {
      expect(matchesMazeAnswer(answer, time)).toBe(false);
    }
    expect(matchesMazeAnswer('非污染', MAZE_QUESTIONS[0].acceptedAnswers)).toBe(false);
    expect(matchesMazeAnswer('向上', MAZE_QUESTIONS[6].acceptedAnswers)).toBe(false);
    expect(matchesMazeAnswer('朝下', MAZE_QUESTIONS[6].acceptedAnswers)).toBe(true);
  });
});
