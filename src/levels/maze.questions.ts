// Fill-in questions mirrored by frontend/lib/models/maze_question.dart.
export const MAZE_QUESTIONS = [
  {
    "id": "q1",
    "type": "fill_blank",
    "text": "无菌物品疑似被污染时，应视为____，并立即更换。",
    "acceptedAnswers": [
      "污染",
      "已污染",
      "被污染"
    ],
    "learningContent": "无菌物品的无菌状态存疑时，应视为污染并及时更换，不能擦拭后继续使用。"
  },
  {
    "id": "q2",
    "type": "fill_blank",
    "text": "已打开无菌包的边缘部分，应视为____部位。",
    "acceptedAnswers": [
      "污染",
      "污染区",
      "污染区域"
    ],
    "learningContent": "已打开无菌包的边缘部分视为污染部位，取物时应避免触碰。"
  },
  {
    "id": "q3",
    "type": "fill_blank",
    "text": "取用无菌物品时，双手应保持在视线范围内、腰部____。",
    "acceptedAnswers": [
      "以上",
      "上方",
      "上"
    ],
    "learningContent": "操作时，双手保持在视线范围内和腰部以上，避免无菌物品受到污染。"
  },
  {
    "id": "q4",
    "type": "fill_blank",
    "text": "使用无菌包前，应检查包装完整性和灭菌____。",
    "acceptedAnswers": [
      "有效期",
      "有效期限",
      "有效时间",
      "灭菌有效期"
    ],
    "learningContent": "使用前核对无菌包的灭菌有效期，并检查包装是否完整、干燥。"
  },
  {
    "id": "q5",
    "type": "fill_blank",
    "text": "已打开的无菌包，剩余物品未被污染、按原折痕包好并注明开包时间后，应在____小时内使用。",
    "acceptedAnswers": [
      "24",
      "二十四",
      "24小时",
      "二十四小时",
      "24h"
    ],
    "learningContent": "无菌包开包后，未污染的剩余物品应按原折痕包好、注明开包时间，并在24小时内使用。"
  },
  {
    "id": "q6",
    "type": "fill_blank",
    "text": "无菌物品的存放环境应保持清洁、____。",
    "acceptedAnswers": [
      "干燥",
      "通风干燥",
      "干燥通风"
    ],
    "learningContent": "无菌物品应存放在清洁、干燥的固定位置，与非无菌物品分开放置。"
  },
  {
    "id": "q7",
    "type": "fill_blank",
    "text": "使用无菌持物钳夹取物品时，应保持钳端____。",
    "acceptedAnswers": [
      "向下",
      "朝下",
      "下"
    ],
    "learningContent": "使用无菌持物钳时应保持钳端向下，不能倒举向上，以防污染。"
  }
];

export const MAZE_BONUS_QUESTION = {
  "id": "bonus_1",
  "type": "fill_blank",
  "text": "操作时发现无菌手套破损，应立即____手套，并按要求进行手卫生。",
  "acceptedAnswers": [
    "更换",
    "更换无菌",
    "更换新的无菌",
    "换",
    "换新"
  ],
  "learningContent": "手套破损应及时更换，并进行手卫生。"
};

export function normalizeMazeAnswer(value: string): string {
  return value.replace(/[\uFF01-\uFF5E]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0),
  ).toLowerCase().replace(/[\s\u3000，。！？、；：,.!?;:]/g, '');
}

export function matchesMazeAnswer(value: unknown, accepted: string[]): boolean {
  if (typeof value !== 'string') return false;
  const normalized = normalizeMazeAnswer(value);
  return normalized.length > 0 && accepted.some((answer) =>
    normalizeMazeAnswer(answer) === normalized,
  );
}
