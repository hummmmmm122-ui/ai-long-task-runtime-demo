import { useMemo, useState, type FormEvent } from 'react';
import './styles.css';
import {
  baseNodes,
  cueOrder,
  decisionLabel,
  deriveNodes,
  getArtifacts,
  getHandoffSummary,
  getRuntimeEvents,
  initialEventId,
  initialSelectedId,
  initialStage,
  runtimeCues,
  sideMessages,
  type ArtifactKey,
  type ChatMessage,
  type HandoffAction,
  type NodeDecision,
  type NodeStatus,
  type QueueItem,
  type RuntimeStep
} from './runtimeModel';

type WorkspaceView = 'task' | 'queue' | 'templates' | 'resources' | 'settings';

type RuntimeConfig = {
  rhythm: 'balanced' | 'safe' | 'fast';
  userInterrupt: boolean;
  autoBranch: boolean;
  handoffSummary: boolean;
};

type TemplatePreset = {
  id: string;
  title: string;
  fit: string;
  nodes: string;
  intervention: string;
  branch: string;
  config: RuntimeConfig;
};

type TopPanel = 'search' | 'notifications' | null;

function App() {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('task');
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
  const [appliedTemplate, setAppliedTemplate] = useState('长文档分析任务');
  const [topPanel, setTopPanel] = useState<TopPanel>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({
    rhythm: 'balanced',
    userInterrupt: true,
    autoBranch: true,
    handoffSummary: true
  });

  const nodes = useMemo(() => deriveNodes(stage, noteAccepted, branchOpened), [branchOpened, noteAccepted, stage]);

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? nodes[stage] ?? nodes[0];
  const completed = nodes.filter((node) => node.status === 'done').length;
  const progress = Math.min(((stage + 0.45) / nodes.length) * 100, 100);
  const activeCue = runtimeCues[cueStep];
  const cueNumber = cueOrder.indexOf(cueStep) + 1;
  const isComplete = stage >= nodes.length - 1;
  const visibleMessages = [...sideMessages, ...extraMessages];
  const runtimeEvents = useMemo(() => getRuntimeEvents(noteAccepted, branchOpened), [branchOpened, noteAccepted]);
  const artifacts = useMemo(() => getArtifacts(branchOpened), [branchOpened]);
  const currentArtifact = artifacts[selectedArtifact];
  const handoffSummary = getHandoffSummary(nodeDecision, extraMessages.some((message) => message.speaker === 'User'), branchOpened, isComplete);

  const selectedEvent = runtimeEvents.find((event) => event.id === selectedEventId) ?? runtimeEvents[0];
  const rhythmLabel = runtimeConfig.rhythm === 'safe' ? '稳妥确认' : runtimeConfig.rhythm === 'fast' ? '快速推进' : '平衡推进';
  const searchItems = [
    ...nodes.map((node) => ({
      id: `node-${node.id}`,
      title: node.title,
      meta: `节点 · ${statusLabel(node.status)}`,
      action: () => {
        setWorkspaceView('task');
        setSelectedId(node.id);
      }
    })),
    {
      id: 'queue',
      title: '运行队列',
      meta: '队列 · 多任务状态',
      action: () => setWorkspaceView('queue')
    },
    {
      id: 'templates',
      title: '模板库',
      meta: `模板 · 当前 ${appliedTemplate}`,
      action: () => setWorkspaceView('templates')
    },
    {
      id: 'resources',
      title: '资源库',
      meta: '产物 · artifact / checkpoint',
      action: () => setWorkspaceView('resources')
    },
    {
      id: 'settings',
      title: '运行设置',
      meta: `护栏 · ${rhythmLabel}`,
      action: () => setWorkspaceView('settings')
    }
  ];
  const filteredSearchItems = searchItems.filter((item) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return `${item.title} ${item.meta}`.toLowerCase().includes(query);
  });
  const notifications = [
    {
      title: nodeDecision === 'needs-review' ? '当前节点需要复核' : '当前节点等待确认',
      body: `${selectedNode.title} · ${decisionLabel[nodeDecision]}`
    },
    {
      title: branchOpened ? 'V2 分支正在运行' : runtimeConfig.autoBranch ? '分支护栏已开启' : '分支护栏已关闭',
      body: branchOpened ? '已保留 V1，并开启 V2 路径。' : runtimeConfig.autoBranch ? '用户修改会优先保留版本分支。' : '修改会直接写入主任务。'
    },
    {
      title: runtimeConfig.userInterrupt ? '用户插话入口开放' : '用户插话入口收起',
      body: runtimeConfig.userInterrupt ? '临时意见可以挂到当前节点。' : '任务将按确认节奏继续推进。'
    }
  ];

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

  const applyTemplatePreset = (template: TemplatePreset) => {
    setAppliedTemplate(template.title);
    setRuntimeConfig(template.config);
    setTopPanel(null);
  };

  return (
    <main className={`workbench ${fullscreen ? 'is-focus' : ''}`}>
      <aside className="rail" aria-label="主导航">
        <div className="brand-mark">W</div>
        <button
          className={`rail-item ${workspaceView === 'task' ? 'active' : ''}`}
          title="任务中心"
          aria-label="任务中心"
          onClick={() => setWorkspaceView('task')}
        >
          ▣
        </button>
        <button
          className={`rail-item ${workspaceView === 'queue' ? 'active' : ''}`}
          title="运行队列"
          aria-label="运行队列"
          onClick={() => setWorkspaceView('queue')}
        >
          ◴
        </button>
        <button
          className={`rail-item ${workspaceView === 'templates' ? 'active' : ''}`}
          title="模板"
          aria-label="模板"
          onClick={() => setWorkspaceView('templates')}
        >
          ▤
        </button>
        <button
          className={`rail-item ${workspaceView === 'resources' ? 'active' : ''}`}
          title="资源"
          aria-label="资源"
          onClick={() => setWorkspaceView('resources')}
        >
          ◇
        </button>
        <button
          className={`rail-item bottom ${workspaceView === 'settings' ? 'active' : ''}`}
          title="设置"
          aria-label="设置"
          onClick={() => setWorkspaceView('settings')}
        >
          ⚙
        </button>
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
            <button
              className={`icon-button ${topPanel === 'search' ? 'active' : ''}`}
              title="搜索"
              aria-label="搜索"
              onClick={() => setTopPanel((panel) => (panel === 'search' ? null : 'search'))}
            >
              ⌕
            </button>
            <button
              className={`icon-button ${topPanel === 'notifications' ? 'active' : ''}`}
              title="通知"
              aria-label="通知"
              onClick={() => setTopPanel((panel) => (panel === 'notifications' ? null : 'notifications'))}
            >
              ◌
            </button>
            <button className="execute-button" onClick={advance}>▶ 继续执行</button>
          </div>
        </header>

        {topPanel && (
          <TopCommandPanel
            filteredSearchItems={filteredSearchItems}
            notifications={notifications}
            onClose={() => setTopPanel(null)}
            onSelectSearchItem={(action) => {
              action();
              setTopPanel(null);
            }}
            panel={topPanel}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}

        {workspaceView === 'queue' ? (
          <QueueView
            currentNodeTitle={selectedNode.title}
            progress={progress}
            nodeDecision={nodeDecision}
            branchOpened={branchOpened}
            onOpenTask={() => setWorkspaceView('task')}
          />
        ) : workspaceView === 'templates' ? (
          <TemplateView
            appliedTemplate={appliedTemplate}
            onApplyTemplate={applyTemplatePreset}
            onOpenTask={() => setWorkspaceView('task')}
          />
        ) : workspaceView === 'resources' ? (
          <ResourceView branchOpened={branchOpened} onOpenTask={() => setWorkspaceView('task')} />
        ) : workspaceView === 'settings' ? (
          <SettingsView
            config={runtimeConfig}
            onChangeConfig={setRuntimeConfig}
            onOpenTask={() => setWorkspaceView('task')}
          />
        ) : (
        <section className="stage">
          <section className="main-panel">
            <div className="status-header">
              <div>
                <span className="eyebrow">ACTIVE TASK</span>
                <h2>{selectedNode.title}</h2>
                <strong className="value-anchor">把静默等待变成可观察、可介入、可分支的 AI 工作过程</strong>
                <span className="template-anchor">当前模板：{appliedTemplate} · {runtimeConfig.rhythm === 'safe' ? '稳妥确认' : runtimeConfig.rhythm === 'fast' ? '快速推进' : '平衡推进'}</span>
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
                {runtimeConfig.autoBranch ? (
                  <button onClick={openBranch}>保留并开分支</button>
                ) : (
                  <em>当前策略：直接写入主任务，不自动开启分支</em>
                )}
              </div>
            </section>
            {runtimeConfig.userInterrupt ? (
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
            ) : (
              <section className="policy-note">
                <span>插话入口已收起</span>
                <p>当前运行设置关闭了用户随时插话，任务会按节点确认节奏继续推进。</p>
              </section>
            )}
            <section className="next-actions">
              <span>完成后的下一步</span>
              {runtimeConfig.handoffSummary ? (
                <button
                  className={handoffAction === 'summary' ? 'selected' : ''}
                  onClick={() => setHandoffAction('summary')}
                >
                  生成阶段摘要
                </button>
              ) : (
                <article className="policy-note compact">
                  <span>阶段摘要已关闭</span>
                  <p>完成时只保留事件记录，不生成单独交接摘要。</p>
                </article>
              )}
              <button
                className={handoffAction === 'continue' ? 'selected' : ''}
                onClick={() => setHandoffAction('continue')}
              >
                开新会话继续
              </button>
              {handoffAction && (handoffAction !== 'summary' || runtimeConfig.handoffSummary) && (
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
        )}
      </section>
    </main>
  );
}

function QueueView({
  currentNodeTitle,
  progress,
  nodeDecision,
  branchOpened,
  onOpenTask
}: {
  currentNodeTitle: string;
  progress: number;
  nodeDecision: NodeDecision;
  branchOpened: boolean;
  onOpenTask: () => void;
}) {
  const queueItems: QueueItem[] = [
    {
      id: 'TASK-A94B',
      title: 'AI 长任务运行台产品原型',
      status: branchOpened ? '分支运行中' : '运行中',
      node: currentNodeTitle,
      progress: Math.round(progress),
      attention: nodeDecision === 'needs-review' ? '需要人工复核' : '等待确认策略',
      updatedAt: '刚刚',
      artifact: branchOpened ? 'V1 / V2 checkpoint' : '方案草稿.md',
      nextAction: '进入运行台处理当前节点',
      detail: '当前任务正在验证可观察、可介入、可分支的长任务 runtime 体验。'
    },
    {
      id: 'TASK-B18C',
      title: '客服知识库重组',
      status: '等待介入',
      node: '校验引用',
      progress: 62,
      attention: '缺少产品边界说明',
      updatedAt: '4 分钟前',
      artifact: '引用缺口清单.csv',
      nextAction: '补充产品边界后继续生成',
      detail: 'AI 已完成知识库聚类，但在引用校验阶段发现部分问答缺少来源，需要用户确认产品边界。'
    },
    {
      id: 'TASK-C77D',
      title: '竞品调研摘要',
      status: '已暂停',
      node: '等待资料补充',
      progress: 38,
      attention: '用户稍后补充链接',
      updatedAt: '12 分钟前',
      artifact: '竞品观察草稿.md',
      nextAction: '等待新增竞品链接',
      detail: '任务已保留当前调研草稿，等待用户补充竞品链接后继续生成对比摘要。'
    }
  ];
  const [deferredTaskIds, setDeferredTaskIds] = useState<string[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState(queueItems[0].id);
  const displayQueueItems = queueItems.map((item) => {
    if (item.id === 'TASK-A94B' || !deferredTaskIds.includes(item.id)) {
      return item;
    }

    return {
      ...item,
      status: '已暂停' as QueueItem['status'],
      attention: '已加入稍后处理',
      updatedAt: '刚刚',
      nextAction: '恢复处理后继续当前队列动作',
      detail: `${item.detail} 当前已标记为稍后处理，运行队列会保留上下文但不主动推进。`
    };
  });
  const selectedQueueItem = displayQueueItems.find((item) => item.id === selectedQueueId) ?? displayQueueItems[0];
  const isSelectedDeferred = deferredTaskIds.includes(selectedQueueItem.id);

  const toggleDeferredTask = (taskId: string) => {
    setDeferredTaskIds((current) => (
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    ));
  };

  return (
    <section className="queue-workspace" aria-label="运行队列">
      <header className="queue-hero">
        <div>
          <span className="eyebrow">RUN QUEUE</span>
          <h2>运行队列</h2>
          <p>集中查看长任务状态、当前节点、介入需求和最近更新时间，避免任务在后台静默运行。</p>
        </div>
        <button onClick={onOpenTask}>打开当前任务</button>
      </header>

      <section className="queue-layout">
        <div className="queue-grid">
          {displayQueueItems.map((item) => (
          <article className={`queue-card queue-card-${item.status} ${item.id === selectedQueueItem.id ? 'selected' : ''}`} key={item.id}>
            <header>
              <span>{item.id}</span>
              <strong>{item.status}</strong>
            </header>
            <h3>{item.title}</h3>
            <p>当前节点：{item.node}</p>
            <div className="queue-progress" aria-label={`${item.title} 进度 ${item.progress}%`}>
              <i style={{ width: `${item.progress}%` }} />
            </div>
            <footer>
              <span>{item.attention}</span>
              <em>{item.updatedAt}</em>
            </footer>
            <button onClick={() => setSelectedQueueId(item.id)}>查看{item.title}</button>
          </article>
          ))}
        </div>

        <aside className="queue-detail" aria-label="队列任务详情">
          <span>{selectedQueueItem.id}</span>
          <h3>{selectedQueueItem.title}</h3>
          <p>{selectedQueueItem.detail}</p>
          <dl>
            <div>
              <dt>当前节点</dt>
              <dd>{selectedQueueItem.node}</dd>
            </div>
            <div>
              <dt>介入需求</dt>
              <dd>{selectedQueueItem.attention}</dd>
            </div>
            <div>
              <dt>当前产物</dt>
              <dd>{selectedQueueItem.artifact}</dd>
            </div>
            <div>
              <dt>下一步</dt>
              <dd>{selectedQueueItem.nextAction}</dd>
            </div>
          </dl>
          {selectedQueueItem.id === 'TASK-A94B' ? (
            <button onClick={onOpenTask}>进入运行台</button>
          ) : (
            <button type="button" onClick={() => toggleDeferredTask(selectedQueueItem.id)}>
              {isSelectedDeferred ? '恢复处理' : '标记稍后处理'}
            </button>
          )}
          {isSelectedDeferred && (
            <article className="queue-action-note" aria-live="polite">
              <strong>{selectedQueueItem.title} 已加入稍后处理</strong>
              <p>上下文和当前产物会留在队列里，恢复处理后可以继续从当前节点推进。</p>
            </article>
          )}
        </aside>
      </section>
    </section>
  );
}

function TopCommandPanel({
  filteredSearchItems,
  notifications,
  onClose,
  onSelectSearchItem,
  panel,
  searchQuery,
  setSearchQuery
}: {
  filteredSearchItems: Array<{ id: string; title: string; meta: string; action: () => void }>;
  notifications: Array<{ title: string; body: string }>;
  onClose: () => void;
  onSelectSearchItem: (action: () => void) => void;
  panel: Exclude<TopPanel, null>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  return (
    <section className="top-command-panel" aria-label={panel === 'search' ? '搜索面板' : '通知面板'}>
      <header>
        <div>
          <span>{panel === 'search' ? 'COMMAND SEARCH' : 'RUNTIME NOTICES'}</span>
          <strong>{panel === 'search' ? '快速定位' : '运行提醒'}</strong>
        </div>
        <button type="button" onClick={onClose}>关闭</button>
      </header>

      {panel === 'search' ? (
        <>
          <input
            autoFocus
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索节点、队列、模板、资源或设置"
            value={searchQuery}
          />
          <div className="command-results">
            {filteredSearchItems.map((item) => (
              <button key={item.id} onClick={() => onSelectSearchItem(item.action)} type="button">
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </button>
            ))}
            {filteredSearchItems.length === 0 && (
              <article>
                <strong>没有匹配结果</strong>
                <span>换一个关键词试试，比如“节点”“队列”或“设置”。</span>
              </article>
            )}
          </div>
        </>
      ) : (
        <div className="notice-list">
          {notifications.map((notice) => (
            <article key={notice.title}>
              <strong>{notice.title}</strong>
              <p>{notice.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TemplateView({
  appliedTemplate,
  onApplyTemplate,
  onOpenTask
}: {
  appliedTemplate: string;
  onApplyTemplate: (template: TemplatePreset) => void;
  onOpenTask: () => void;
}) {
  const templates: TemplatePreset[] = [
    {
      id: 'TPL-LONGDOC',
      title: '长文档分析任务',
      fit: '适合 PRD、合同、研究报告这类需要多轮阅读和阶段确认的任务。',
      nodes: '读取资料 / 提取结构 / 生成草稿 / 用户复核 / 交付建议',
      intervention: '每个关键节点都保留用户插话入口',
      branch: '复核意见默认进入 V2 分支，不覆盖当前版本',
      config: {
        rhythm: 'safe',
        userInterrupt: true,
        autoBranch: true,
        handoffSummary: true
      }
    },
    {
      id: 'TPL-CREATIVE',
      title: '多轮方案生成',
      fit: '适合品牌方案、页面文案、产品命名等需要保留多个方向的任务。',
      nodes: '理解目标 / 生成方向 / 对比方案 / 采纳修改 / 整理输出',
      intervention: 'AI 主动询问偏好，不强制等待',
      branch: '被保留的方向会变成可继续运行的分支',
      config: {
        rhythm: 'fast',
        userInterrupt: true,
        autoBranch: true,
        handoffSummary: true
      }
    },
    {
      id: 'TPL-RESEARCH',
      title: '调研摘要工作流',
      fit: '适合竞品调研、资料汇总、引用校验和结论提炼。',
      nodes: '收集来源 / 聚类信息 / 校验引用 / 形成摘要 / 列出缺口',
      intervention: '缺少来源时进入等待介入状态',
      branch: '可以把补充资料开启为新的子任务',
      config: {
        rhythm: 'balanced',
        userInterrupt: false,
        autoBranch: false,
        handoffSummary: true
      }
    }
  ];

  return (
    <section className="library-workspace" aria-label="模板库">
      <header className="queue-hero">
        <div>
          <span className="eyebrow">TEMPLATE LIBRARY</span>
          <h2>模板库</h2>
          <p>把常见的长任务拆成可复用的节点预设，让新任务从一开始就具备可观察、可介入、可分支的运行规则。</p>
        </div>
        <button onClick={onOpenTask}>回到当前任务</button>
      </header>

      <section className="template-grid">
        {templates.map((template) => (
          <article className="template-card" key={template.id}>
            <span>{template.id}</span>
            <h3>{template.title}</h3>
            <p>{template.fit}</p>
            <dl>
              <div>
                <dt>节点预设</dt>
                <dd>{template.nodes}</dd>
              </div>
              <div>
                <dt>介入策略</dt>
                <dd>{template.intervention}</dd>
              </div>
              <div>
                <dt>分支策略</dt>
                <dd>{template.branch}</dd>
              </div>
              <div>
                <dt>运行策略</dt>
                <dd>
                  {template.config.rhythm === 'safe' ? '稳妥确认' : template.config.rhythm === 'fast' ? '快速推进' : '平衡推进'} ·
                  {template.config.userInterrupt ? ' 保留插话' : ' 收起插话'} ·
                  {template.config.autoBranch ? ' 自动分支' : ' 直接写入'}
                </dd>
              </div>
            </dl>
            <button
              className={appliedTemplate === template.title ? 'selected' : ''}
              type="button"
              onClick={() => onApplyTemplate(template)}
            >
              {appliedTemplate === template.title ? '已套用' : '套用模板'}
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}

function SettingsView({
  config,
  onChangeConfig,
  onOpenTask
}: {
  config: RuntimeConfig;
  onChangeConfig: (config: RuntimeConfig) => void;
  onOpenTask: () => void;
}) {
  const rhythmCopy = {
    balanced: '平衡推进',
    safe: '稳妥确认',
    fast: '快速推进'
  };

  const updateFlag = (key: keyof Omit<RuntimeConfig, 'rhythm'>) => {
    onChangeConfig({ ...config, [key]: !config[key] });
  };

  return (
    <section className="library-workspace" aria-label="运行设置">
      <header className="queue-hero">
        <div>
          <span className="eyebrow">RUNTIME SETTINGS</span>
          <h2>运行设置</h2>
          <p>把 AI 长任务的确认节奏、插话入口、分支策略和交接摘要显式化，让用户知道系统会怎样继续做事。</p>
        </div>
        <button onClick={onOpenTask}>回到运行台</button>
      </header>

      <section className="settings-layout">
        <article className="settings-card">
          <span>CONFIRMATION RHYTHM</span>
          <h3>确认节奏</h3>
          <p>控制 AI 在长任务里是更快推进，还是更多停下来等待确认。</p>
          <div className="segmented-control" role="group" aria-label="确认节奏">
            {(['balanced', 'safe', 'fast'] as RuntimeConfig['rhythm'][]).map((rhythm) => (
              <button
                className={config.rhythm === rhythm ? 'selected' : ''}
                key={rhythm}
                onClick={() => onChangeConfig({ ...config, rhythm })}
                type="button"
              >
                {rhythmCopy[rhythm]}
              </button>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <span>GUARDRAILS</span>
          <h3>运行护栏</h3>
          <p>这些开关决定用户能否随时插话，以及 AI 是否自动保留分支和阶段摘要。</p>
          <div className="toggle-list">
            <button className={config.userInterrupt ? 'selected' : ''} onClick={() => updateFlag('userInterrupt')} type="button">
              <strong>允许用户随时插话</strong>
              <em>{config.userInterrupt ? '已开启' : '已关闭'}</em>
            </button>
            <button className={config.autoBranch ? 'selected' : ''} onClick={() => updateFlag('autoBranch')} type="button">
              <strong>修改默认保留分支</strong>
              <em>{config.autoBranch ? '已开启' : '已关闭'}</em>
            </button>
            <button className={config.handoffSummary ? 'selected' : ''} onClick={() => updateFlag('handoffSummary')} type="button">
              <strong>交接时生成阶段摘要</strong>
              <em>{config.handoffSummary ? '已开启' : '已关闭'}</em>
            </button>
          </div>
        </article>

        <aside className="settings-summary">
          <span>当前策略</span>
          <h3>{rhythmCopy[config.rhythm]}</h3>
          <ul>
            <li>{config.userInterrupt ? '用户可以随时把意见挂到当前节点' : '用户插话入口会被收起'}</li>
            <li>{config.autoBranch ? '采纳修改时优先保留 V1 / V2 分支' : '采纳修改时直接覆盖当前草稿'}</li>
            <li>{config.handoffSummary ? '结束阶段时生成可交接摘要' : '结束阶段时只保留事件记录'}</li>
          </ul>
        </aside>
      </section>
    </section>
  );
}

function ResourceView({ branchOpened, onOpenTask }: { branchOpened: boolean; onOpenTask: () => void }) {
  const resources = [
    {
      name: '方案草稿.md',
      type: 'artifact',
      owner: 'TASK-A94B',
      status: '可继续编辑',
      detail: '沉淀当前任务的目标理解、节点图和生成方案，是交付前的主文档。'
    },
    {
      name: branchOpened ? 'V1 / V2 checkpoint' : 'checkpoint 待生成',
      type: 'checkpoint',
      owner: 'TASK-A94B',
      status: branchOpened ? '已有分支对比' : '等待用户确认',
      detail: branchOpened ? '保留原版本和用户修改后的分支，方便继续比较或回滚。' : '当前任务还没有开启分支，确认节点后会生成可追踪检查点。'
    },
    {
      name: '引用缺口清单.csv',
      type: 'external',
      owner: 'TASK-B18C',
      status: '等待补充',
      detail: '来自队列中等待介入的任务，用于提示用户补齐产品边界和来源。'
    },
    {
      name: '竞品观察草稿.md',
      type: 'draft',
      owner: 'TASK-C77D',
      status: '已暂停',
      detail: '保留上一次调研的中间结论，后续可以继续接入新的竞品链接。'
    }
  ];
  const [selectedResourceName, setSelectedResourceName] = useState(resources[0].name);
  const selectedResource = resources.find((resource) => resource.name === selectedResourceName) ?? resources[0];

  return (
    <section className="library-workspace" aria-label="资源库">
      <header className="queue-hero">
        <div>
          <span className="eyebrow">RESOURCE VAULT</span>
          <h2>资源库</h2>
          <p>把长任务运行过程中产生的草稿、检查点、缺口清单统一收纳，避免产物散落在聊天记录里。</p>
        </div>
        <button onClick={onOpenTask}>打开当前任务</button>
      </header>

      <section className="resource-layout">
        <div className="resource-list">
          {resources.map((resource) => (
            <button
              className={resource.name === selectedResource.name ? 'selected' : ''}
              key={resource.name}
              onClick={() => setSelectedResourceName(resource.name)}
            >
              <span>{resource.type}</span>
              <strong>{resource.name}</strong>
              <em>{resource.owner} · {resource.status}</em>
            </button>
          ))}
        </div>

        <aside className="resource-detail" aria-label="资源详情">
          <span>{selectedResource.type}</span>
          <h3>{selectedResource.name}</h3>
          <p>{selectedResource.detail}</p>
          <dl>
            <div>
              <dt>所属任务</dt>
              <dd>{selectedResource.owner}</dd>
            </div>
            <div>
              <dt>当前状态</dt>
              <dd>{selectedResource.status}</dd>
            </div>
            <div>
              <dt>下一步</dt>
              <dd>{selectedResource.owner === 'TASK-A94B' ? '回到运行台继续确认节点' : '等待对应队列任务恢复'}</dd>
            </div>
          </dl>
          <button type="button" onClick={onOpenTask}>在运行台查看</button>
        </aside>
      </section>
    </section>
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
