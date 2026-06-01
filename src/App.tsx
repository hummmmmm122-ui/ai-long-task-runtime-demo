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

type WorkspaceView = 'task' | 'queue';

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

        {workspaceView === 'queue' ? (
          <QueueView
            currentNodeTitle={selectedNode.title}
            progress={progress}
            nodeDecision={nodeDecision}
            branchOpened={branchOpened}
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
  const [selectedQueueId, setSelectedQueueId] = useState(queueItems[0].id);
  const selectedQueueItem = queueItems.find((item) => item.id === selectedQueueId) ?? queueItems[0];

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
          {queueItems.map((item) => (
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
            <button type="button">标记稍后处理</button>
          )}
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
