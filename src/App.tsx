import { useMemo, useState } from 'react';
import './styles.css';

type NodeStatus = 'done' | 'running' | 'waiting' | 'review' | 'branched';

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

const baseNodes: WorkflowNode[] = [
  {
    id: 'intent',
    title: '理解目标',
    kicker: '需求解析',
    status: 'done',
    minutes: '00:18',
    detail: '确认用户想要一个能视频演示的轻量 Demo，而不是完整产品重构。',
    output: '已识别关键诉求：降低等待焦虑、让用户看到 AI 正在理解目标、允许中途介入。',
    expected: ['任务边界', '演示主线', '用户心理状态'],
    risk: '如果范围继续膨胀，会拖慢演示交付。'
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
    output: '正在形成 Demo 结构：顶部进度、中央舞台、右侧分支聊天、底部成果预览。',
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
    output: '将输出视频演示脚本、功能亮点、下一步可扩展方向。',
    expected: ['演示话术', '下一步任务', '可交付清单'],
    risk: '完成页不能像日志，要像一个可以接着工作的工作台。'
  }
];

const sideMessages = [
  {
    speaker: 'AI',
    text: '我先按“视频演示优先”处理：完整能力会被压缩成一条 3 分钟内能看懂的路径。'
  },
  {
    speaker: 'AI',
    text: '我注意到用户更关心等待过程的可控感，所以我会把“正在做什么”和“接下来会产出什么”放在主视觉。'
  },
  {
    speaker: 'User',
    text: '节点不要太多，重点演示我能插话、能修改、能开一个新分支。'
  },
  {
    speaker: 'AI',
    text: '已采纳。当前节点会简化成 5 个，修改会进入右侧分支，不打断主任务节奏。'
  }
];

function App() {
  const [selectedId, setSelectedId] = useState('draft');
  const [stage, setStage] = useState(2);
  const [branchOpened, setBranchOpened] = useState(false);
  const [noteAccepted, setNoteAccepted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const nodes = useMemo<WorkflowNode[]>(
    () =>
      baseNodes.map((node, index) => {
        if (branchOpened && node.id === 'branch') return { ...node, status: 'branched' as const };
        if (noteAccepted && node.id === 'draft') return { ...node, status: 'review' as const, kicker: '已采纳偏好' };
        if (index < stage) return { ...node, status: 'done' as const };
        if (index === stage) return { ...node, status: 'running' as const };
        return { ...node, status: node.status === 'review' ? 'review' : ('waiting' as const) };
      }),
    [branchOpened, noteAccepted, stage]
  );
  const selectedNode = nodes.find((node) => node.id === selectedId) ?? nodes[stage] ?? nodes[0];
  const completed = nodes.filter((node) => node.status === 'done').length;
  const progress = Math.min(((stage + 0.45) / nodes.length) * 100, 100);

  const advance = () => {
    setStage((current) => {
      const next = Math.min(current + 1, nodes.length - 1);
      setSelectedId(nodes[next]?.id ?? selectedId);
      return next;
    });
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
            <span>AI-LONG-RUN / DEMO</span>
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
            <button className="execute-button" onClick={advance}>▶ 推进演示</button>
          </div>
        </header>

        <section className="stage">
          <section className="main-panel">
            <div className="status-header">
              <div>
                <span className="eyebrow">RUNNING TASK</span>
                <h2>{selectedNode.title}</h2>
                <p>{selectedNode.detail}</p>
              </div>
              <div className="clock-card">
                <span>预计剩余</span>
                <strong>{selectedNode.minutes}</strong>
              </div>
            </div>

            <div className="scene-grid">
              <section className="robot-scene" aria-label="二维运行态">
                <div className="blackboard">
                  <span>goal</span>
                  <strong>减少等待焦虑</strong>
                  <em>节点可见 / 可插话 / 可分支</em>
                </div>
                <div className="agent agent-main">
                  <i />
                  <b />
                </div>
                <div className="agent agent-small one"><i /><b /></div>
                <div className="agent agent-small two"><i /><b /></div>
                <div className="thought one">正在权衡用户打断成本...</div>
                <div className="thought two">已生成可确认节点</div>
                <div className="thought three">右侧分支继续收集偏好</div>
                {branchOpened && <div className="second-floor">二楼分支任务已开启</div>}
              </section>

              <section className="node-detail">
                <div className="detail-toolbar">
                  <span>{selectedNode.kicker}</span>
                  <button onClick={() => setFullscreen((value) => !value)}>
                    {fullscreen ? '退出半屏' : '半屏演示'}
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
              </section>
            </div>

            <section className="artifact-strip" aria-label="产物预览">
              <article>
                <span>已完成</span>
                <strong>{completed}/5</strong>
              </article>
              <article>
                <span>用户介入</span>
                <strong>{noteAccepted ? '已采纳' : '等待确认'}</strong>
              </article>
              <article>
                <span>分支任务</span>
                <strong>{branchOpened ? '二楼运行' : '未开启'}</strong>
              </article>
              <article>
                <span>演示状态</span>
                <strong>{stage >= 4 ? '可交付' : '进行中'}</strong>
              </article>
            </section>
          </section>

          <aside className="node-list" aria-label="实时节点图">
            <header>
              <span>实时节点图</span>
              <button onClick={() => setStage(0)}>重置</button>
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
              {sideMessages.map((message, index) => (
                <article className={`message ${message.speaker === 'User' ? 'user' : 'ai'}`} key={`${message.speaker}-${index}`}>
                  <span>{message.speaker}</span>
                  <p>{message.text}</p>
                </article>
              ))}
            </div>
            <section className="branch-card">
              <span>用户修改意见</span>
              <p>“第二节点不要再次阻塞确认，用户可以稍后查看；如果已经确认就自动接着跑。”</p>
              <div className="branch-actions">
                <button onClick={() => setNoteAccepted(true)}>采纳到当前节点</button>
                <button onClick={() => setBranchOpened(true)}>保留并开分支</button>
              </div>
            </section>
            <section className="next-actions">
              <span>完成后的下一步</span>
              <button>生成 3 分钟演示脚本</button>
              <button>开新会话做 Pitch 版</button>
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
