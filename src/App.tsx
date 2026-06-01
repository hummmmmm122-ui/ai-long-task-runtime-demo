import { useMemo, useState, type FormEvent } from 'react';
import './styles.css';

type NodeStatus = 'done' | 'running' | 'waiting' | 'review' | 'branched';
type RuntimeStep = 'observe' | 'interrupt' | 'branch' | 'handoff';
type HandoffAction = 'summary' | 'continue' | null;
type MessageSpeaker = 'AI' | 'User';
type RuntimeEventState = 'done' | 'running' | 'branch';
type NodeDecision = 'pending' | 'confirmed' | 'needs-review';
type ArtifactKey = 'draft' | 'checkpoint';

interface WorkflowNode {
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

interface Cue {
  step: RuntimeStep;
  title: string;
  body: string;
}

interface ChatMessage {
  speaker: MessageSpeaker;
  text: string;
}

interface RuntimeEvent {
  id: string;
  time: string;
  state: RuntimeEventState;
  title: string;
  body: string;
  detail: string;
  evidence: string;
}

const initialStage = 2;
const initialSelectedId = 'draft';
const initialEventId = 'draft';

const baseNodes: WorkflowNode[] = [
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

const sideMessages: ChatMessage[] = [
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

const runtimeCues: Record<RuntimeStep, Cue> = {
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

const cueOrder: RuntimeStep[] = ['observe', 'interrupt', 'branch', 'handoff'];

function App() {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [stage, setStage] = useState(initialStage);
  const [branchOpened, setBranchOpened] = useState(false);
  const [noteAccepted, setNoteAccepted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cueStep, setCueStep] = useState<RuntimeStep>('observe');
  const [handoffAction, setHandoffAction] = useState<HandoffAction>(null);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [interventionText, setInterventionText] = useState('');
  const [extraMessages, setExtraMessages] = useState<ChatMessage[]>([]);
  const [nodeDecision, setNodeDecision] = useState<NodeDecision>('pending');
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactKey>('draft');

  const nodes = useMemo<WorkflowNode[]>(
    () =>
      baseNodes.map((node, index) => {
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
      }),
    [branchOpened, noteAccepted, stage]
  );

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? nodes[stage] ?? nodes[0];
  const completed = nodes.filter((node) => node.status === 'done').length;
  const progress = Math.min(((stage + 0.45) / nodes.length) * 100, 100);
  const activeCue = runtimeCues[cueStep];
  const cueNumber = cueOrder.indexOf(cueStep) + 1;
  const isComplete = stage >= nodes.length - 1;
  const visibleMessages = [...sideMessages, ...extraMessages];
  const decisionLabel: Record<NodeDecision, string> = {
    pending: '等待确认',
    confirmed: '节点已确认',
    'needs-review': '需人工复核'
  };
  const artifacts: Record<ArtifactKey, { title: string; label: string; summary: string; preview: string[] }> = {
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
  const currentArtifact = artifacts[selectedArtifact];
  const handoffSummary = [
    `当前节点决策：${decisionLabel[nodeDecision]}`,
    `用户介入：${extraMessages.some((message) => message.speaker === 'User') ? '已收到临时约束' : '暂无新增约束'}`,
    `分支状态：${branchOpened ? 'V2 分支运行中，可与 V1 对比' : '尚未开启分支'}`,
    `下一步：${isComplete ? '可交付阶段摘要或开启继续会话' : '继续执行后续节点'}`
  ];
  const runtimeEvents: RuntimeEvent[] = [
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
    runtimeEvents.push({
      id: 'branch',
      time: '10:44:36',
      state: 'branch',
      title: '创建 V2 分支',
      body: '保留 V1，验证新的确认节奏。',
      detail: '系统没有覆盖已有方案，而是把用户的新意见放入 V2 分支，允许之后比较两个版本。',
      evidence: '分支任务状态：V2 运行，checkpoint 已切换为 V1 / V2 可比较。'
    });
  }

  const selectedEvent = runtimeEvents.find((event) => event.id === selectedEventId) ?? runtimeEvents[0];

  const resetTask = () => {
    setStage(initialStage);
    setSelectedId(initialSelectedId);
    setBranchOpened(false);
    setNoteAccepted(false);
    setFullscreen(false);
    setCueStep('observe');
    setHandoffAction(null);
    setSelectedEventId(initialEventId);
    setInterventionText('');
    setExtraMessages([]);
    setNodeDecision('pending');
    setSelectedArtifact('draft');
  };

  const acceptNote = () => {
    setNoteAccepted(true);
    setNodeDecision('confirmed');
    setCueStep('interrupt');
    setSelectedId('draft');
    setSelectedEventId('draft');
  };

  const openBranch = () => {
    setBranchOpened(true);
    setCueStep('branch');
    setSelectedId('branch');
    setSelectedEventId('branch');
    setSelectedArtifact('checkpoint');
  };

  const advance = () => {
    setStage((current) => {
      const next = Math.min(current + 1, baseNodes.length - 1);
      setSelectedId(baseNodes[next]?.id ?? selectedId);
      if (next >= baseNodes.length - 1) {
        setCueStep('handoff');
        setHandoffAction(null);
      }
      return next;
    });
  };

  const submitIntervention = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = interventionText.trim();

    if (!trimmed) {
      return;
    }

    setExtraMessages((messages) => [
      ...messages,
      { speaker: 'User', text: trimmed },
      { speaker: 'AI', text: '收到，我会把这条介入意见挂到当前节点，不暂停主任务。你可以选择采纳或开分支。' }
    ]);
    setNodeDecision('needs-review');
    setInterventionText('');
    setCueStep('interrupt');
  };

  return (
    <main className={`workbench ${fullscreen ? 'is-focus' : ''}`}>
      <aside className="rail" aria-label="主导航">
        <div className="brand-mark">W</div>
        <button className="rail-item active" title="任务中心" aria-label="任务中心">▣</button>
        <button className="rail-item" title="运行队列" aria-label="运行队列">◴</button>
        <button className="rail-item" title="模板" aria-label="模板">▤</button>
        <button className="rail-item" title="资源" aria-label="资源">◇</button>
        <button className="rail-item bottom" title="设置" aria-label="设置">⚙</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="title-pack">
            <h1>Workflow Workbench</h1>
            <span>AI-LONG-RUN / TASK-A94B</span>
          </div>
          <div className="progress-line" aria-label="节点进度">
            <i style={{ width: `${progress}%` }} />
            {nodes.map((node) => (
              <button
                key={node.id}
                className={`progress-dot ${node.status} ${node.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(node.id)}
                title={node.title}
                aria-label={node.title}
              />
            ))}
          </div>
          <div className="top-actions">
            <button className="icon-button" title="搜索" aria-label="搜索">⌕</button>
            <button className="icon-button" title="通知" aria-label="通知">◌</button>
            <button className="execute-button" onClick={advance}>▶ 继续执行</button>
          </div>
        </header>

        <section className="stage">
          <section className="main-panel">
            <div className="status-header">
              <div>
                <span className="eyebrow">ACTIVE TASK</span>
                <h2>{selectedNode.title}</h2>
                <strong className="value-anchor">把静默等待变成可观察、可介入、可分支的 AI 工作过程</strong>
                <p>{selectedNode.detail}</p>
              </div>
              <div className="clock-card">
                <span>{isComplete ? '交付状态' : '预计剩余'}</span>
                <strong>{isComplete ? 'READY' : selectedNode.minutes}</strong>
              </div>
            </div>

            <section className={`director-cue director-cue-${activeCue.step}`} aria-label="运行阶段提示">
              <span>{activeCue.title}</span>
              <p>{activeCue.body}</p>
              <b>{cueNumber}/4</b>
            </section>

            <div className="scene-grid">
              <section className="runtime-panel" aria-label="运行事件流">
                <header>
                  <div>
                    <span>runtime trace</span>
                    <strong>当前执行链路</strong>
                  </div>
                  <em>{noteAccepted ? '用户偏好已写入' : '等待用户确认策略'}</em>
                </header>

                <div className="runtime-timeline">
                  {runtimeEvents.map((event) => (
                    <button
                      key={event.id}
                      className={`${event.state} ${event.id === selectedEvent.id ? 'selected' : ''}`}
                      onClick={() => setSelectedEventId(event.id)}
                    >
                      <b>{event.time}</b>
                      <span>
                        <strong>{event.title}</strong>
                        <em>{event.body}</em>
                      </span>
                    </button>
                  ))}
                </div>

                <article className="event-inspector">
                  <span>{selectedEvent.evidence}</span>
                  <p>{selectedEvent.detail}</p>
                </article>

                <div className="runtime-artifacts">
                  <button
                    className={selectedArtifact === 'draft' ? 'selected' : ''}
                    onClick={() => setSelectedArtifact('draft')}
                    aria-label="查看方案草稿"
                  >
                    <span>artifact</span>
                    <strong>方案草稿.md</strong>
                  </button>
                  <button
                    className={selectedArtifact === 'checkpoint' ? 'selected' : ''}
                    onClick={() => setSelectedArtifact('checkpoint')}
                    aria-label="查看检查点"
                  >
                    <span>checkpoint</span>
                    <strong>{branchOpened ? 'V1 / V2 可比较' : '等待确认'}</strong>
                  </button>
                </div>
              </section>

              <section className="node-detail">
                <div className="detail-toolbar">
                  <span>{selectedNode.kicker}</span>
                  <button onClick={() => setFullscreen((value) => !value)}>
                    {fullscreen ? '退出聚焦' : '聚焦视图'}
                  </button>
                </div>
                <h3>已有成果</h3>
                <p>{selectedNode.output}</p>
                <h3>预期成果</h3>
                <div className="chips">
                  {selectedNode.expected.map((item) => <span key={item}>{item}</span>)}
                </div>
                <h3>风险提示</h3>
                <p className="risk-copy">{selectedNode.risk}</p>
                <section className={`node-decision node-decision-${nodeDecision}`} aria-label="节点决策">
                  <span>节点决策</span>
                  <strong>{decisionLabel[nodeDecision]}</strong>
                  <p>
                    {nodeDecision === 'confirmed'
                      ? '当前节点已被用户确认，主任务可以继续进入后续节点。'
                      : nodeDecision === 'needs-review'
                        ? '用户新增了临时介入意见，建议复核后再写入主方案或开新分支。'
                        : '当前节点仍在等待用户确认，可直接确认，也可以标记为需复核。'}
                  </p>
                  <div>
                    <button onClick={() => setNodeDecision('confirmed')}>确认当前节点</button>
                    <button onClick={() => setNodeDecision('needs-review')}>标记需复核</button>
                  </div>
                </section>
                <section className="artifact-preview" aria-label="产物详情">
                  <span>{currentArtifact.label}</span>
                  <h3>{currentArtifact.title}</h3>
                  <p>{currentArtifact.summary}</p>
                  <ul>
                    {currentArtifact.preview.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
                {branchOpened && (
                  <section className="version-compare" aria-label="分支版本对比">
                    <h3>V1 / V2 对比</h3>
                    <div>
                      <article>
                        <span>V1 当前版本</span>
                        <p>保留原确认节奏：第二节点需要用户再次确认后继续。</p>
                      </article>
                      <article>
                        <span>V2 新分支</span>
                        <p>采用用户偏好：已确认节点自动继续，稍后允许回看。</p>
                      </article>
                    </div>
                  </section>
                )}
              </section>
            </div>

            <section className="artifact-strip" aria-label="产物预览">
              <article>
                <span>已完成</span>
                <strong>{completed}/5</strong>
              </article>
              <article className={noteAccepted ? 'is-hot' : ''}>
                <span>用户介入</span>
                <strong>{decisionLabel[nodeDecision]}</strong>
              </article>
              <article className={branchOpened ? 'is-hot is-branch' : ''}>
                <span>分支任务</span>
                <strong>{branchOpened ? 'V2 运行' : '未开启'}</strong>
              </article>
              <article>
                <span>任务状态</span>
                <strong>{isComplete ? '可交付' : '进行中'}</strong>
              </article>
            </section>
          </section>

          <aside className="node-list" aria-label="实时节点图">
            <header>
              <span>实时节点图</span>
              <button onClick={resetTask}>重置任务</button>
            </header>
            {nodes.map((node, index) => (
              <button
                key={node.id}
                className={`node-row ${node.status} ${node.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(node.id)}
              >
                <b>{String(index + 1).padStart(2, '0')}</b>
                <span>
                  <strong>{node.title}</strong>
                  <em>{statusLabel(node.status)}</em>
                </span>
              </button>
            ))}
          </aside>

          <aside className="chat-panel" aria-label="分支式主动聊天">
            <header>
              <div>
                <span>分支式主动聊天</span>
                <strong>不暂停主任务</strong>
              </div>
              <i />
            </header>
            <div className="message-list">
              {visibleMessages.map((message, index) => (
                <article className={`message ${message.speaker === 'User' ? 'user' : 'ai'}`} key={`${message.speaker}-${index}`}>
                  <span>{message.speaker}</span>
                  <p>{message.text}</p>
                </article>
              ))}
              {noteAccepted && (
                <article className="message ai message-feedback">
                  <span>AI</span>
                  <p>偏好已并入“生成方案”节点：第二节点不再阻塞确认，主任务继续运行。</p>
                </article>
              )}
              {branchOpened && (
                <article className="message ai message-feedback">
                  <span>AI</span>
                  <p>已保留当前版本 V1，并开启 V2 分支尝试用户的新意见。</p>
                </article>
              )}
            </div>
            <section className="branch-card">
              <span>用户修改意见</span>
              <p>“第二节点不要再次阻塞确认，用户可以稍后查看；如果已经确认就自动接着跑。”</p>
              <div className="branch-actions">
                <button onClick={acceptNote}>采纳到当前节点</button>
                <button onClick={openBranch}>保留并开分支</button>
              </div>
            </section>
            <form className="intervention-form" onSubmit={submitIntervention}>
              <label htmlFor="intervention">临时介入</label>
              <textarea
                id="intervention"
                value={interventionText}
                onChange={(event) => setInterventionText(event.target.value)}
                placeholder="补充一个约束，或要求从当前节点开分支..."
                rows={3}
              />
              <button type="submit">发送到当前节点</button>
            </form>
            <section className="next-actions">
              <span>完成后的下一步</span>
              <button
                className={handoffAction === 'summary' ? 'selected' : ''}
                onClick={() => setHandoffAction('summary')}
              >
                生成阶段摘要
              </button>
              <button
                className={handoffAction === 'continue' ? 'selected' : ''}
                onClick={() => setHandoffAction('continue')}
              >
                开新会话继续
              </button>
              {handoffAction && (
                <article className="handoff-confirmation" aria-live="polite">
                  <strong>{handoffAction === 'summary' ? '阶段摘要已准备' : '后续会话已排队'}</strong>
                  <p>
                    {handoffAction === 'summary'
                      ? '已把节点图、用户插话、分支选择和完成态整理成可交付摘要。'
                      : '已保留本次运行上下文，下一轮会直接接续当前任务。'}
                  </p>
                  {handoffAction === 'summary' && (
                    <ul>
                      {handoffSummary.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </article>
              )}
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

function statusLabel(status: NodeStatus) {
  const labels: Record<NodeStatus, string> = {
    done: '已完成',
    running: '运行中',
    waiting: '等待',
    review: '待确认',
    branched: '分支中'
  };
  return labels[status];
}

export default App;
