export type LevelKind =
  | 'concept_challenge'
  | 'error_hunt'
  | 'maze_quiz'
  | 'block_stacking_defense'
  | 'space_guardian';

export interface LevelDefinition {
  id: string;
  order: number;
  version: number;
  title: string;
  subtitle: string;
  kind: LevelKind;
  description: string;
  timeLimitSeconds: number;
  passScore: number;
  starThresholds: [number, number, number];
  assetKeys: string[];
  instructions: string[];
  publicConfig: Record<string, unknown>;
  answerKey: Record<string, unknown>;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  stars: number;
  feedback: string[];
  details: Record<string, unknown>;
}
