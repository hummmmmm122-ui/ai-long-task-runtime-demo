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

    expect(container.textContent).toContain('当前执行链路');
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
    clickButton('发送到当前节点');
    expect(container.textContent).toContain('risk check first');

    clickButton('保留并开分支');
    expect(container.textContent).toContain('V1 / V2 对比');
    expect(container.textContent).toContain('V1 / V2 checkpoint');

    clickButton('继续执行');
    clickButton('继续执行');
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

    clickButton('进入运行台');
    expect(container.textContent).toContain('当前执行链路');
    expect(container.textContent).toContain('分支式主动聊天');
  });
});
