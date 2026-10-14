import * as contract from './standalone-contract.json';
import { LevelDefinition } from './level.types';
import { MAZE_QUESTIONS, MAZE_BONUS_QUESTION } from './maze.questions';

export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  {
    id: 'level-1-concept',
    order: 1,
    version: 17,
    title: '第一关：概念原则大闯关',
    subtitle: '通过气泡消除掌握无菌知识',
    kind: 'concept_challenge',
    description:
      '连接知识词块，跟随带教护士完成环境与个人准备，再根据八类物品开封后的有效期贴标签。',
    timeLimitSeconds: 0,
    passScore: 60,
    starThresholds: [60, 80, 95],
    assetKeys: [
      'bacteria_bubbles',
      'broom',
      'uv_lamp',
      'disinfectant_cloth',
      'disinfectant_bottle',
      'sterile_storage',
      'non_sterile_storage',
      'sterile_package',
      'sterile_syringe_pack',
      'sterile_swab_pack',
      'sterile_scalpel_pack',
      'sterile_catheter_kit',
      'medical_mask',
      'medical_waste_bag',
    ],
    instructions: [
      '点击细菌气泡进行连词成句消除',
      '跟随护士对话，在手术前半小时结束清扫，操作室定期消毒',
      '保持操作台清洁、干燥、平坦，合理布局物品',
      '修剪指甲、戴好口罩并清洁双手',
      '设置存放环境，核对不同包装的未开封保质期',
      '按物品开封或初次使用后的状态，选择有效期并贴标签',
      '将全部物品拖入对应区域，并完成八项开封后有效期贴标',
    ],
    publicConfig: {
      interaction: 'bubble_elimination_and_management',
      phases: [
        {
          name: 'bubble_sentence',
          type: 'word_matching',
          bacteriaCount: 10,
          sentenceTemplates: [
  {
    "mode": "sterile",
    "words": [
      "在医疗、护理操作过程中",
      "防止一切微生物侵入人体和",
      "防止无菌物品、无菌区域被污染的技术"
    ],
    "correct": true
  },
  {
    "mode": "sterile",
    "words": [
      "经灭菌处理", "且未被污染的区域"
    ],
    "correct": true
  },
  {
    "mode": "contaminated",
    "words": [
      "未经灭菌处理",
      "或虽经灭菌处理",
      "但又被污染的区域"
    ],
    "correct": true
  },
  {
    "mode": "sterile",
    "words": [
      "通过灭菌处理后",
      "保持无菌状态的物品"
    ],
    "correct": true
  },
  {
    "mode": "contaminated",
    "words": [
      "未经灭菌处理",
      "或虽经灭菌处理后",
      "又被污染的物品"
    ],
    "correct": true
  }
],
        },
        {
          name: 'preparation_dialogue',
          type: 'npc_dialogue_interaction',
          tasks: ['preparation_timing', 'environment_sweeping', 'scheduled_disinfection', 'table_preparation', 'trim_nails', 'hand_hygiene', 'wear_uniform', 'wear_cap', 'wear_mask', 'supplies_layout'],
          timeConstraints: { environment_sweeping: 'finish_30min_before_surgery' },
        },
        {
          name: 'item_management',
          type: 'drag_classify_and_label',
          storageEnvironment: { temperatureBelow: 24, humidityBelow: 70, airChanges: [4, 10] },
          packagingValidityDays: { textileSuitable: 14, textileUnsuitable: 7, medicalPaper: 30, crepePaper: 180, paperPlastic: 180, nonwoven: 180, rigidContainer: 180 },
          items: ['opened_gauze', 'gloves', 'dry_forceps', 'bandage', 'opened_pack', 'medical_mask', 'sterile_syringe', 'opened_disinfectants', 'opened_swabs', 'cleaning_broom', 'sterile_catheter_kit', 'opened_solution', 'prepared_tray', 'used_container', 'crepe_instrument_pack', 'medical_waste_bag'],
          labelFields: ['itemName', 'condition', 'validity', 'startedAt', 'validUntil'],
        },
      ],
      allowRetry: true,
    },
    answerKey: {
      correctSentences: [
  [
    "在医疗、护理操作过程中",
    "防止一切微生物侵入人体和",
    "防止无菌物品、无菌区域被污染的技术"
  ],
  [
    "经灭菌处理", "且未被污染的区域"
  ],
  [
    "未经灭菌处理",
    "或虽经灭菌处理",
    "但又被污染的区域"
  ],
  [
    "通过灭菌处理后",
    "保持无菌状态的物品"
  ],
  [
    "未经灭菌处理",
    "或虽经灭菌处理后",
    "又被污染的物品"
  ]
],
      toolSequence: ['preparation_timing', 'environment_sweeping', 'scheduled_disinfection', 'table_preparation', 'trim_nails', 'hand_hygiene', 'wear_uniform', 'wear_cap', 'wear_mask', 'supplies_layout'],
      itemClassification: {
        opened_gauze: 'sterile_storage', gloves: 'non_sterile_storage',
        dry_forceps: 'sterile_storage', bandage: 'non_sterile_storage',
        opened_pack: 'sterile_storage', medical_mask: 'non_sterile_storage',
        sterile_syringe: 'sterile_storage', opened_disinfectants: 'non_sterile_storage',
        opened_swabs: 'sterile_storage', cleaning_broom: 'non_sterile_storage',
        sterile_catheter_kit: 'sterile_storage', opened_solution: 'sterile_storage',
        prepared_tray: 'sterile_storage', used_container: 'sterile_storage',
        crepe_instrument_pack: 'sterile_storage', medical_waste_bag: 'non_sterile_storage',
      },
      openedItemAnswers: {
        opened_swabs: '24h',
        opened_solution: '24h',
        opened_disinfectants: '7d',
        dry_forceps: '4h',
        prepared_tray: '4h',
        opened_pack: '24h',
        used_container: 'max24h',
        opened_gauze: '4h',
      },
      expirationValidation: true,
      storageKnowledgeAnswers: [14, 7, 30, 180, 180, 180, 180],
    },
  },
  {
    id: 'level-2-glove-forceps-hunt',
    order: 2,
    version: 6,
    title: '第二关：手套钳具找茬赛',
    subtitle: '根据无菌操作注意事项找出错误',
    kind: 'error_hunt',
    description: '在规定时间内找出无菌持物钳和无菌手套操作中的错误。',
    timeLimitSeconds: 0,
    passScore: 60,
    starThresholds: [60, 80, 95],
    assetKeys: [
      'forceps_use_image',
      'instrument_storage_image',
      'glove_procedure_image',
      'error_marker',
      'countdown',
      'star_rating',
    ],
    instructions: ['依次完成种类辨认、存放排查、操作排查、手套戴脱四个场景', '存放与操作场景各四处问题、各40秒', '全部找出才能进入下一场景'],
    publicConfig: {
      "interaction": "multi_stage_error_hunt",
      "stages": [
            {
                  "id": "forceps_types",
                  "name": "持物钳种类辨认",
                  "timeLimitSeconds": 30,
                  "targetCount": 4,
                  "starThresholds": {
                        "oneStar": 1,
                        "twoStar": 2,
                        "threeStar": 4
                  },
                  "countdown": 3
            },
            {
                  "id": "instrument_storage",
                  "name": "持物钳存放排查",
                  "timeLimitSeconds": 40,
                  "targetCount": 4,
                  "starThresholds": {
                        "oneStar": 1,
                        "twoStar": 2,
                        "threeStar": 4
                  },
                  "countdown": 0
            },
            {
                  "id": "forceps_operation",
                  "name": "持物钳操作排查",
                  "timeLimitSeconds": 40,
                  "targetCount": 4,
                  "starThresholds": {
                        "oneStar": 1,
                        "twoStar": 2,
                        "threeStar": 4
                  },
                  "countdown": 0
            },
            {
                  "id": "glove_procedure",
                  "name": "手套戴脱排查",
                  "timeLimitSeconds": 60,
                  "targetCount": 4,
                  "starThresholds": {
                        "oneStar": 1,
                        "twoStar": 2,
                        "threeStar": 4
                  },
                  "countdown": 0
            }
      ],
      "wrongTapPenalty": 5,
      "progressiveUnlock": true
},
    answerKey: {
      "forceps_types_errors": [
            "oval_forceps",
            "three_prong_forceps",
            "long_tweezers",
            "short_tweezers"
      ],
      "instrument_storage_errors": [
            "multiple_forceps",
            "inverted_lid",
            "small_unchanged_indicator",
            "contaminated_swabs"
      ],
      "forceps_operation_errors": [
            "insufficient_immersion",
            "incorrect_grip",
            "tip_touches_rim",
            "missing_indicator"
      ],
      "glove_procedure_errors": [
            "below_waist",
            "gloved_touches_bare_hand",
            "donning_touches_inside",
            "removing_touches_inside"
      ]
},
  },
  {
    id: 'level-3-container-maze',
    order: 3,
    version: 4,
    title: '第三关：无菌容器迷宫行',
    subtitle: '收集7个知识碎片并找到出口',
    kind: 'maze_quiz',
    description:
      '在医院住院部平面图迷宫中探索，通过正确完成填空题收集七个知识点碎片，避开污染房间，集齐碎片开启大门。',
    timeLimitSeconds: 0,
    passScore: 60,
    starThresholds: [60, 80, 95],
    assetKeys: [
      'hospital_floor_map',
      'knowledge_fragment',
      'quiz_panel',
      'exit_gate',
      'contaminated_room_warning',
      'learning_popup',
    ],
    instructions: [
      '在迷宫中移动，进入黄色星星标记的房间',
      '填写答案收集知识碎片（答对收集，答错查看学习资料）',
      '避开污染房间，触发污染将返回起点或回答附加问题',
      '收集满7个碎片后出口大门开启',
      '到达出口通关并获得无菌操作物品徽章',
    ],
    publicConfig: {
      interaction: 'maze_exploration_with_quiz',
      fragmentCount: 7,
      collisionPenalty: 15,
      contaminationPenalty: 'reset_to_start_or_bonus_question',
      pathHint: true,
      questions: MAZE_QUESTIONS,
    },
    answerKey: {
      answers: Object.fromEntries(MAZE_QUESTIONS.map((question) =>
        [question.id, question.acceptedAnswers],
      )),
      contaminatedRooms: ['room_3', 'room_7', 'room_12'],
      bonusQuestions: [MAZE_BONUS_QUESTION],
    },
  },
  {
    id: 'level-4-solution-stacking',
    order: 4,
    version: 2,
    title: '第四关：无菌溶液叠叠乐',
    subtitle: '拖动绿色无菌方块合成高阶方块净化污染',
    kind: 'block_stacking_defense',
    description:
      '拖动绿色无菌方块合成高阶方块净化污染，管理红色污染方块，使用黄色道具，60秒内达标则胜。',
    timeLimitSeconds: 0,
    passScore: 60,
    starThresholds: [60, 80, 95],
    assetKeys: [
      'block_dispenser',
      'green_sterile_block',
      'red_contamination_block',
      'yellow_tool_block',
      'verification_zone',
      'liquid_pouring_zone',
      'pollution_warning_line',
      'explosion_effect',
      'contamination_spread_effect',
    ],
    instructions: [
      '观看教程弹窗了解方块类型和合成规则',
      '拖动绿色无菌方块到对应区域（核对与持瓶区、倒液与盖塞区）',
      '相同类型方块碰撞消除，触发爆炸特效并清除周围1个污染方块',
      '使用黄色道具方块（消毒棉片、时间延长、清除污染）',
      '避免红色污染方块扩散，及时拖至角落或使用道具清除',
      '60秒内在两大区域各合成2个"完美操作"，且污染≤3个',
      '进阶目标：集齐6个高阶方块合成"终极无菌圣典"',
    ],
    publicConfig: {
      interaction: 'drag_and_merge_blocks',
      zones: [
        { id: 'verification_zone', name: '核对与持瓶区', x: 100, y: 200 },
        { id: 'liquid_pouring_zone', name: '倒液与盖塞区', x: 400, y: 200 },
      ],
      blockTypes: {
        sterile: {
          color: 'green',
          knowledgePoints: [
            '标签朝掌心',
            '消毒瓶塞',
            '检查有效期',
            '核对浓度',
            '倒液时瓶口不接触',
            '及时盖塞',
          ],
        },
        contamination: {
          color: 'red',
          errorExamples: [
            '瓶口接触容器',
            '过期溶液',
            '浓度错误',
            '未消毒瓶塞',
          ],
          spreadEffect: 'purple_smoke',
        },
        tool: {
          color: 'yellow',
          types: [
            { name: '消毒棉片', effect: 'remove_single_contamination' },
            { name: '时间延长', effect: 'add_10_seconds' },
            { name: '清除污染', effect: 'remove_all_contamination' },
          ],
        },
      },
      dropInterval: 2,
      pollutionWarningLine: 0.8,
      victoryConditions: {
        basic: {
          perfectOperationsPerZone: 2,
          maxContamination: 3,
        },
        advanced: {
          ultimateSterileCodex: 6,
          achievement: '细节大师',
        },
      },
      mergeEffect: {
        animation: 'glow_explosion',
        sound: 'ding',
        text: '完美操作',
        clearRadius: 1,
      },
    },
    answerKey: {
      correctSequence: [
        'check_label_palm_facing',
        'disinfect_bottle_cap',
        'verify_expiration_and_concentration',
        'pour_without_touching',
        'cap_immediately',
      ],
      mergeCombinations: [
        { blocks: ['标签朝掌心', '消毒瓶塞'], result: '持瓶准备完成' },
        { blocks: ['检查有效期', '核对浓度'], result: '核对完成' },
        { blocks: ['倒液时瓶口不接触', '及时盖塞'], result: '倒液完成' },
      ],
      contaminationTriggers: [
        'bottle_mouth_contact',
        'expired_solution',
        'wrong_concentration',
        'undisinfected_cap',
      ],
    },
  },
  {
    id: 'level-5-space-guardian',
    order: 5,
    version: 3,
    title: '第五关：无菌空间守护者',
    subtitle: '运用单双巾铺盘技巧守护无菌空间',
    kind: 'space_guardian',
    description:
      '运用"单双巾铺盘"操作技巧消除病毒，通过正确打开无菌物品移除障碍物，在规定时间内成功构建无菌区域。',
    timeLimitSeconds: 0,
    passScore: 60,
    starThresholds: [60, 80, 95],
    assetKeys: [
      'pixel_nurse_character',
      'contaminated_environment',
      'virus_large',
      'virus_small',
      'medical_instruments',
      'bacteria_progress_bar',
      'completion_progress_bar',
      'sterile_drape_single',
      'sterile_drape_double',
      'obstacle_blocks',
      'level5_bacteria_zone_v2',
      'level5_obstacle_zone_v2',
      'sterile_operation_badge',
    ],
    instructions: [
      '情景导入，学习"单双巾铺盘"基本技能',
      '进入细菌清除区，使用单双巾铺盘操作清除病毒',
      '清除大病毒和小病毒，观察红色血条（细菌）和黄色进度条（完成度）',
      '切换至障碍物消除区，正确打开无菌物品移除障碍',
      '完成两个区域操作后，系统判定是否成功构建无菌区域',
      '成功获得"无菌操作物品徽章"，失败则重新挑战',
    ],
    publicConfig: {
      interaction: 'two_phase_guardian',
      pixelArtStyle: true,
      phases: [
        {
          id: 'bacteria_elimination',
          name: '细菌清除区',
          type: 'guided_procedure_elimination',
          skills: [
            {
              name: '单巾铺盘',
              id: 'single_drape',
              description: '完成核对、双折铺盘和覆盖折边后清除小病毒',
            },
            {
              name: '双巾铺盘',
              id: 'double_drape',
              description: '完成第一巾铺底、放置物品和第二巾覆盖后清除大病毒',
            },
          ],
          enemies: [
            { type: 'small_virus', count: 4, method: 'single_drape' },
            { type: 'large_virus', count: 2, method: 'double_drape' },
          ],
          progressBars: {
            bacteria: { color: 'red', label: '细菌血条', position: 'top_right' },
            completion: { color: 'yellow', label: '完成进度', position: 'top_right' },
          },
          requiredProcedureSteps: 18,
        },
        {
          id: 'obstacle_removal',
          name: '障碍物消除区',
          type: 'item_interaction',
          obstacles: [
            { id: 'obstacle_1', unlockItem: 'sterile_forceps', correctMethod: 'open_from_corner' },
            { id: 'obstacle_2', unlockItem: 'sterile_gauze', correctMethod: 'check_expiration_first' },
            { id: 'obstacle_3', unlockItem: 'sterile_container', correctMethod: 'open_lid_correctly' },
          ],
          sterileItems: [
            { name: '无菌镊子', openMethod: '从角部打开，避免污染' },
            { name: '无菌纱布', openMethod: '先检查有效期和完整性' },
            { name: '无菌容器', openMethod: '正确开启容器盖，保持无菌' },
          ],
        },
      ],
      victoryConditions: {
        allBacteriaEliminated: true,
        allObstaclesRemoved: true,
        sterileZoneEstablished: true,
        minimumSterility: 80,
      },
      mistakePenalty: 10,
    },
    answerKey: {
      phase1_skills: {
        single_drape: {
          sequence: [
            'inspect_single_pack',
            'spread_single_towel',
            'cover_single_towel',
          ],
          targets: ['small_virus'],
        },
        double_drape: {
          sequence: [
            'lay_first_towel',
            'place_double_items',
            'cover_second_towel',
          ],
          targets: ['large_virus'],
        },
      },
      phase2_items: {
        sterile_forceps: {
          correctMethod: 'open_from_corner',
          avoidActions: ['touching_inner_surface', 'opening_from_center'],
        },
        sterile_gauze: {
          correctMethod: 'check_expiration_first',
          steps: ['check_expiration_date', 'check_package_integrity', 'open_carefully'],
        },
        sterile_container: {
          correctMethod: 'open_lid_correctly',
          steps: ['hold_container_steady', 'lift_lid_vertically', 'place_lid_inner_up'],
        },
      },
      overallRequirements: [
        'hand_hygiene',
        'wear_protection',
        'maintain_sterile_field',
        'correct_disposal',
      ],
    },
  },
];

// Standalone is the content baseline. Regenerate via frontend/tool/export_online_contract_test.dart.
for (const source of contract.levels) {
  const target = LEVEL_DEFINITIONS.find(level => level.id === source.id)!;
  const publicConfig = {...target.publicConfig, ...source.publicConfig};
  const keys = contract.answerKeys as Record<string, Record<string, unknown>>;
  Object.assign(target, source, {publicConfig, answerKey:{...target.answerKey, ...keys[source.id]}});
  if (target.kind === 'error_hunt') target.publicConfig.stages = contract.huntStages;
  if (target.kind === 'maze_quiz') {
    const questions = source.publicConfig.questions ?? [];
    target.answerKey.answers = Object.fromEntries(questions.map(q => [q.id, q.acceptedAnswers]));
  }
}
