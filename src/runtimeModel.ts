export type NodeStatus = 'done' | 'running' | 'waiting' | 'review' | 'branched';
export type RuntimeStep = 'observe' | 'interrupt' | 'branch' | 'handoff';
export type HandoffAction = 'summary' | 'continue' | null;
export type MessageSpeaker = 'AI' | 'User';
export type RuntimeEventState = 'done' | 'running' | 'branch';
export type NodeDecision = 'pending' | 'confirmed' | 'needs-review';
export type ArtifactKey = 'draft' | 'checkpoint';

export interface WorkflowNode {
  id: string;
  title: string;
  kicker: string;
  status: NodeStatus;
  minutes: string;
  detail: string;
  output: string;
  expected: string[];
  risk: string;
}

export interface Cue {
  step: RuntimeStep;
  title: string;
  body: string;
}

export interface ChatMessage {
  speaker: MessageSpeaker;
  text: string;
}

export interface RuntimeEvent {
  id: string;
  time: string;
  state: RuntimeEventState;
  title: string;
  body: string;
  detail: string;
  evidence: string;
}

export interface Artifact {
  title: string;
  label: string;
  summary: string;
  preview: string[];
}

export interface QueueItem {
  id: string;
  title: string;
  status: '运行中' | '分支运行中' | '等待介入' | '已暂停';
  node: string;
  progress: number;
  attention: string;
  updatedAt: string;
}

export const initialStage = 2;
export const initialSelectedId = 'draft';
export const initialEventId = 'draft';

export const baseNodes: WorkflowNode[] = [
  {
    id: 'intent',
    title: '理解目标',
    kicker: '需求解析',
    status: 'done',
    minutes: '00:18',
    detail: '确认用户提交的是一个需要持续产出的复杂任务，而不是一次性问答。',
    output: '已识别关键诉求：降低等待焦虑、让用户看到 AI 正在理解目标、允许中途介入。',
    expected: ['任务边界', '执行策略', '用户心理状态'],
    risk: '如果任务边界不清晰，后续节点容易生成无效产物。'
  },
  {
    id: 'plan',
    title: '生成节点图',
    kicker: '第一节点确认',
    status: 'review',
    minutes: '00:42',
    detail: '把长任务拆成可点击、可修改、可确认的节点，并把第一步交给用户快速确认。',
    output: '节点已生成：理解目标、检索资料、生成方案、校验风险、交付总结。',
    expected: ['节点详情', '确认节奏', '预计产物'],
    risk: '节点信息太密会让用户重新陷入阅读负担。'
  },
  {
    id: 'draft',
    title: '生成方案',
    kicker: '执行中',
    status: 'running',
    minutes: '01:36',
    detail: '在主任务继续执行时，右侧主动开一个分支对话询问用户偏好。',
    output: '正在形成任务方案：顶部进度、当前节点、右侧分支聊天、底部成果预览保持同步。',
    expected: ['主方案草稿', '已有成果', '下一步建议'],
    risk: '用户不知道能不能打断，所以需要把“可采纳修改”做成明显动作。'
  },
  {
    id: 'branch',
    title: '采纳修改',
    kicker: '分支任务',
    status: 'waiting',
    minutes: '02:10',
    detail: '当用户修改已完成节点时，提供保留当前版本并新开任务的路径。',
    output: '等待用户选择：回退重做，或保留当前版本并在二楼分支继续试一版。',
    expected: ['采纳反馈', '分支楼层', '版本说明'],
    risk: '如果回退成本不透明，用户会不敢插话。'
  },
  {
    id: 'handoff',
    title: '交付建议',
    kicker: '完成后续聊',
    status: 'waiting',
    minutes: '03:00',
    detail: '任务完成后，AI 主动总结用户可能的下一步，并给出可一键开启的新会话。',
    output: '将输出阶段摘要、关键决策、下一步可执行任务。',
    expected: ['阶段摘要', '下一步任务', '可交付清单'],
    risk: '完成页不能像日志，要像一个可以接着工作的工作台。'
  }
];

export const sideMessages: ChatMessage[] = [
  {
    speaker: 'AI',
    text: '我会先把长任务拆成可确认的节点，主任务继续运行，过程中可以随时补充偏好。'
  },
  {
    speaker: 'AI',
    text: '我注意到用户更关心等待过程的可控感，所以我会把“正在做什么”和“接下来会产出什么”放在主视觉。'
  },
  {
    speaker: 'User',
    text: '节点不要太多，重点是我能插话、能修改、能开一个新分支。'
  },
  {
    speaker: 'AI',
    text: '已采纳。当前节点会简化成 5 个，修改会进入右侧分支，不打断主任务节奏。'
  }
];

export const runtimeCues: Record<RuntimeStep, Cue> = {
  observe: {
    step: 'observe',
    title: '01 运行可见',
    body: '先展示 AI 不是静默加载，而是在持续解释当前节点、已有成果和下一步产物。'
  },
  interrupt: {
    step: 'interrupt',
    title: '02 用户介入',
    body: '用户偏好已经并入当前方案，主任务继续运行，不需要等最终回答才反馈。'
  },
  branch: {
    step: 'branch',
    title: '03 保留分支',
    body: '当前版本 V1 被保留，新意见进入 V2 分支，用户不用担心打断会浪费已有结果。'
  },
  handoff: {
    step: 'handoff',
    title: '04 交付后续',
    body: '任务收束后直接给出阶段摘要、下一步任务和可继续协作的会话入口。'
  }
};

export const cueOrder: RuntimeStep[] = ['observe', 'interrupt', 'branch', 'handoff'];

export const decisionLabel: Record<NodeDecision, string> = {
  pending: '等待确认',
  confirmed: '节点已确认',
  'needs-review': '需人工复核'
};

export function deriveNodes(stage: number, noteAccepted: boolean, branchOpened: boolean): WorkflowNode[] {
  return baseNodes.map((node, index) => {
    let status: NodeStatus = 'waiting';

    if (index < stage) {
      status = 'done';
    } else if (index === stage) {
      status = 'running';
    } else if (node.status === 'review') {
      status = 'review';
    }

    if (noteAccepted && node.id === 'draft' && index >= stage) {
      status = 'review';
    }

    if (branchOpened && node.id === 'branch' && index >= stage) {
      status = 'branched';
    }

    return {
      ...node,
      status,
      kicker: noteAccepted && node.id === 'draft' ? '已采纳偏好' : node.kicker
    };
  });
}

export function getRuntimeEvents(noteAccepted: boolean, branchOpened: boolean): RuntimeEvent[] {
  const events: RuntimeEvent[] = [
    {
      id: 'intent',
      time: '10:42:18',
      state: 'done',
      title: '解析任务边界',
      body: '生成 5 个可观察节点。',
      detail: '系统把用户的一次性复杂请求拆成可确认的节点，并为每个节点记录状态、预计产物和风险。',
      evidence: '已生成节点：理解目标、生成节点图、生成方案、采纳修改、交付建议。'
    },
    {
      id: 'context',
      time: '10:43:02',
      state: 'done',
      title: '检索上下文',
      body: '提取用户目标、约束和风险提示。',
      detail: '上下文被压缩成任务边界、用户心理状态和可介入时机，后续节点会引用这些约束。',
      evidence: '风险提示已写入当前节点，右侧聊天已主动询问确认策略。'
    },
    {
      id: 'draft',
      time: '10:44:11',
      state: 'running',
      title: '生成主方案草稿',
      body: noteAccepted ? '已合并用户偏好，继续生成主方案草稿。' : '等待确认是否跳过二次阻塞。',
      detail: noteAccepted
        ? '用户偏好已并入当前节点，主任务不会暂停，只会把确认策略写入后续节点。'
        : '当前节点需要判断是否继续阻塞用户确认，避免用户在等待中失去控制感。',
      evidence: noteAccepted ? '用户介入状态：已采纳。' : '用户介入状态：等待确认。'
    }
  ];

  if (branchOpened) {
    events.push({
      id: 'branch',
      time: '10:44:36',
      state: 'branch',
      title: '创建 V2 分支',
      body: '保留 V1，验证新的确认节奏。',
      detail: '系统没有覆盖已有方案，而是把用户的新意见放入 V2 分支，允许之后比较两个版本。',
      evidence: '分支任务状态：V2 运行，checkpoint 已切换为 V1 / V2 可比较。'
    });
  }

  return events;
}

export function getArtifacts(branchOpened: boolean): Record<ArtifactKey, Artifact> {
  return {
    draft: {
      title: '方案草稿.md',
      label: '主方案草稿',
      summary: '当前节点正在生成的阶段性方案，不必等最终输出即可预览方向。',
      preview: ['保留主任务继续执行', '把用户偏好写入确认策略', '下一步进入风险校验和交付建议']
    },
    checkpoint: {
      title: branchOpened ? 'V1 / V2 checkpoint' : '确认策略 checkpoint',
      label: branchOpened ? '版本检查点' : '确认检查点',
      summary: branchOpened ? '系统已保留 V1，并把新意见写入 V2 分支。' : '当前检查点等待用户决定是否跳过二次阻塞。',
      preview: branchOpened
        ? ['V1：维持再次确认', 'V2：已确认节点自动继续', '差异：等待成本下降，回看责任上升']
        : ['待确认：是否继续阻塞用户', '可选动作：采纳偏好或创建分支', '影响：后续节点执行节奏']
    }
  };
}

export function getHandoffSummary(nodeDecision: NodeDecision, hasUserIntervention: boolean, branchOpened: boolean, isComplete: boolean) {
  return [
    `当前节点决策：${decisionLabel[nodeDecision]}`,
    `用户介入：${hasUserIntervention ? '已收到临时约束' : '暂无新增约束'}`,
    `分支状态：${branchOpened ? 'V2 分支运行中，可与 V1 对比' : '尚未开启分支'}`,
    `下一步：${isComplete ? '可交付阶段摘要或开启继续会话' : '继续执行后续节点'}`
  ];
}
