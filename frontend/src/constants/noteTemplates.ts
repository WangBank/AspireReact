export interface NoteTemplate {
  key: string;
  label: string;
  description: string;
  content: string;
}

export const GLOBAL_NOTE_TEMPLATES: NoteTemplate[] = [
  {
    key: 'daily-review',
    label: '日常复盘',
    description: '计划、执行、得失、改进四段式',
    content: [
      '今日计划',
      '- ',
      '',
      '实际执行',
      '- ',
      '',
      '做对了什么',
      '- ',
      '',
      '做错了什么',
      '- ',
      '',
      '明日改进',
      '- ',
    ].join('\n'),
  },
  {
    key: 'emotion-review',
    label: '情绪复盘',
    description: '记录心魔触发点和纠偏动作',
    content: [
      '今日情绪状态',
      '- ',
      '',
      '触发心魔的场景',
      '- ',
      '',
      '当时做了什么',
      '- ',
      '',
      '如果重来一次',
      '- ',
      '',
      '明天的防守动作',
      '- ',
    ].join('\n'),
  },
];

export const STOCK_NOTE_TEMPLATES: NoteTemplate[] = [
  {
    key: 'stock-review',
    label: '个股复盘',
    description: '买卖逻辑、错误点、下次预案',
    content: [
      '买入理由',
      '- ',
      '',
      '卖出理由',
      '- ',
      '',
      '盘中错误',
      '- ',
      '',
      '下次预案',
      '- ',
    ].join('\n'),
  },
  {
    key: 'close-summary',
    label: '清仓总结',
    description: '适合一轮交易结束后复盘',
    content: [
      '这轮交易赚亏了什么',
      '- ',
      '',
      '核心决策是否正确',
      '- ',
      '',
      '最该保留的动作',
      '- ',
      '',
      '最该修正的动作',
      '- ',
    ].join('\n'),
  },
];

export const mergeTemplateContent = (currentContent: string, nextTemplate: string): string => {
  const current = currentContent.trim();
  return current ? `${current}\n\n---\n\n${nextTemplate}` : nextTemplate;
};
