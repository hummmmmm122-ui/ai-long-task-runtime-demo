import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const presentationOnlyCopy = ['推进' + '演示', '半屏' + '演示', '录' + '屏', 'Pit' + 'ch'];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderApp() {
  act(() => {
    root.render(<App />);
  });
}

function clickButton(name: string) {
  const button = Array.from(container.querySelectorAll('button')).find((element) => element.textContent?.includes(name));

  if (!button) {
    throw new Error(`Missing button: ${name}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function applyTemplate(title: string) {
  const card = Array.from(container.querySelectorAll('.template-card')).find((element) => element.textContent?.includes(title));
  const button = card?.querySelector('button');

  if (!button) {
    throw new Error(`Missing template button: ${title}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function typeInInput(value: string) {
  const input = container.querySelector('input');

  if (!input) {
    throw new Error('Missing input');
  }

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function fillIntervention(value: string) {
  const textarea = container.querySelector('textarea');

  if (!textarea) {
    throw new Error('Missing intervention textarea');
  }

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('App runtime interactions', () => {
  it('renders the product runtime without presentation-only copy', () => {
    renderApp();

    expect(container.textContent).toContain('黑板思考');
    expect(container.textContent).toContain('工作台');
    expect(container.textContent).toContain('二楼分支');
    expect(container.textContent).toContain('第一节点确认');
    expect(container.textContent).toContain('第二节点处理方式');
    expect(container.textContent).toContain('Step 1');
    expect(container.textContent).toContain('Step 2');
    expect(container.textContent).toContain('Step 3');
    expect(container.textContent).toContain('继续执行');
    for (const copy of presentationOnlyCopy) {
      expect(container.textContent).not.toContain(copy);
    }
  });

  it('supports node review, branch comparison, and stateful handoff summary', () => {
    renderApp();

    clickButton('标记需复核');
    expect(container.textContent).toContain('需人工复核');

    fillIntervention('risk check first');
    clickButton('让 AI 给处理建议');
    expect(container.textContent).toContain('risk check first');
    expect(container.textContent).toContain('待处理的修改意见');
    expect(container.textContent).toContain('先只记录为约束');

    clickButton('保留并开分支');
    expect(container.textContent).toContain('V2 正在试跑新意见');
    expect(container.textContent).toContain('V1 / V2 对比');
    expect(container.textContent).toContain('V1 / V2 checkpoint');
    expect(container.textContent).toContain('已选择保留当前版并开分支');

    clickButton('继续执行');
    clickButton('继续执行');
    expect(container.textContent).toContain('准备交付');
    clickButton('准备交付');
    clickButton('完成后的下一步');
    clickButton('生成阶段摘要');

    expect(container.textContent).toContain('当前节点决策：需人工复核');
    expect(container.textContent).toContain('用户介入：已收到临时约束');
    expect(container.textContent).toContain('分支状态：V2 分支运行中');
  });

  it('switches between task center and run queue', () => {
    renderApp();

    clickButton('◴');
    expect(container.textContent).toContain('运行队列');
    expect(container.textContent).toContain('AI 长任务运行台产品原型');
    expect(container.textContent).toContain('等待介入');

    clickButton('查看客服知识库重组');
    expect(container.textContent).toContain('缺少产品边界说明');
    expect(container.textContent).toContain('引用缺口清单.csv');
    expect(container.textContent).toContain('标记稍后处理');
    clickButton('标记稍后处理');
    expect(container.textContent).toContain('已加入稍后处理');
    expect(container.textContent).toContain('恢复处理');

    clickButton('恢复处理');
    expect(container.textContent).toContain('标记稍后处理');

    clickButton('查看AI 长任务运行台产品原型');
    clickButton('进入运行台');
    expect(container.textContent).toContain('分支式主动聊天');
  });

  it('opens template and resource workspaces from the rail', () => {
    renderApp();

    clickButton('▤');
    expect(container.textContent).toContain('模板库');
    expect(container.textContent).toContain('长文档分析任务');
    expect(container.textContent).toContain('节点预设');
    expect(container.textContent).toContain('套用模板');

    clickButton('◇');
    expect(container.textContent).toContain('资源库');
    expect(container.textContent).toContain('方案草稿.md');
    expect(container.textContent).toContain('引用缺口清单.csv');

    clickButton('引用缺口清单.csv');
    expect(container.textContent).toContain('等待补充');
    expect(container.textContent).toContain('来自队列中等待介入的任务');
    expect(container.textContent).toContain('在队列中查看来源任务');
    clickButton('在队列中查看来源任务');
    expect(container.textContent).toContain('运行队列');
    expect(container.textContent).toContain('客服知识库重组');
    expect(container.textContent).toContain('缺少产品边界说明');
  });

  it('applies a template and updates runtime settings', () => {
    renderApp();

    clickButton('▤');
    applyTemplate('调研摘要工作流');
    expect(container.textContent).toContain('已套用');
    expect(container.textContent).toContain('平衡推进 · 收起插话 · 直接写入');

    clickButton('⚙');
    expect(container.textContent).toContain('运行设置');
    expect(container.textContent).toContain('用户插话入口会被收起');
    expect(container.textContent).toContain('采纳修改时直接覆盖当前草稿');

    clickButton('稳妥确认');
    clickButton('修改默认保留分支');
    clickButton('允许用户随时插话');
    clickButton('回到运行台');
    expect(container.textContent).toContain('当前模板：调研摘要工作流 · 稳妥确认');
    expect(container.textContent).toContain('自由输入');
    expect(container.textContent).toContain('让 AI 给处理建议');

    clickButton('▤');
    applyTemplate('多轮方案生成');
    clickButton('回到当前任务');
    expect(container.textContent).toContain('当前模板：多轮方案生成 · 快速推进');
  });

  it('allows manual runtime settings after applying a template', () => {
    renderApp();

    clickButton('▤');
    clickButton('套用模板');
    expect(container.textContent).toContain('已套用');

    clickButton('⚙');
    expect(container.textContent).toContain('运行设置');
    clickButton('稳妥确认');
    clickButton('修改默认保留分支');
    expect(container.textContent).toContain('采纳修改时直接覆盖当前草稿');

    clickButton('回到运行台');
    expect(container.textContent).toContain('当前模板：多轮方案生成 · 稳妥确认');
  });

  it('uses runtime settings as behavior guardrails in the task workspace', () => {
    renderApp();

    clickButton('⚙');
    clickButton('允许用户随时插话');
    clickButton('修改默认保留分支');
    clickButton('交接时生成阶段摘要');
    clickButton('回到运行台');

    expect(container.textContent).toContain('插话入口已收起');
    expect(container.textContent).toContain('当前策略：直接写入主任务，不自动开启分支');
    clickButton('完成后的下一步');
    expect(container.textContent).toContain('阶段摘要已关闭');
    expect(container.textContent).not.toContain('自由输入');
    expect(container.textContent).not.toContain('保留并开分支');
    expect(container.textContent).not.toContain('生成阶段摘要');

    clickButton('继续执行');
    clickButton('继续执行');
    clickButton('准备交付');
    expect(container.textContent).toContain('后续会话已排队');
  });

  it('supports rewind or branching when revising completed nodes', () => {
    renderApp();

    clickButton('回退到上一节点重做');
    expect(container.textContent).toContain('已选择回退重做');
    expect(container.textContent).toContain('生成节点图');

    clickButton('保留当前版并开分支');
    expect(container.textContent).toContain('已选择保留当前版并开分支');
    expect(container.textContent).toContain('V2 正在试跑新意见');
  });

  it('uses top search and notifications as working command surfaces', () => {
    renderApp();

    clickButton('⌕');
    expect(container.textContent).toContain('快速定位');
    typeInInput('资源');
    clickButton('资源库');
    expect(container.textContent).toContain('资源库');
    expect(container.textContent).toContain('方案草稿.md');

    clickButton('⚙');
    clickButton('允许用户随时插话');
    clickButton('回到运行台');
    clickButton('◌');
    expect(container.textContent).toContain('运行提醒');
    expect(container.textContent).toContain('用户插话入口收起');
    expect(container.textContent).toContain('当前节点等待确认');
  });
});
