import { describe, expect, it } from 'vitest';
import { deriveNodes, getArtifacts, getHandoffSummary, getRuntimeEvents } from './runtimeModel';

describe('runtime model', () => {
  it('derives accepted and branched node states', () => {
    const nodes = deriveNodes(2, true, true);

    expect(nodes.find((node) => node.id === 'intent')?.status).toBe('done');
    expect(nodes.find((node) => node.id === 'draft')?.status).toBe('review');
    expect(nodes.find((node) => node.id === 'draft')?.kicker).toBe('已采纳偏好');
    expect(nodes.find((node) => node.id === 'branch')?.status).toBe('branched');
  });

  it('adds a branch event only after a branch is opened', () => {
    expect(getRuntimeEvents(false, false).some((event) => event.id === 'branch')).toBe(false);

    const branchEvent = getRuntimeEvents(true, true).find((event) => event.id === 'branch');
    expect(branchEvent?.title).toBe('创建 V2 分支');
    expect(branchEvent?.evidence).toContain('V2 运行');
  });

  it('switches checkpoint artifact copy when a branch exists', () => {
    expect(getArtifacts(false).checkpoint.title).toBe('确认策略 checkpoint');

    const branchedCheckpoint = getArtifacts(true).checkpoint;
    expect(branchedCheckpoint.title).toBe('V1 / V2 checkpoint');
    expect(branchedCheckpoint.preview).toContain('差异：等待成本下降，回看责任上升');
  });

  it('summarizes handoff state from user decisions', () => {
    const summary = getHandoffSummary('needs-review', true, true, true);

    expect(summary).toContain('当前节点决策：需人工复核');
    expect(summary).toContain('用户介入：已收到临时约束');
    expect(summary).toContain('分支状态：V2 分支运行中，可与 V1 对比');
    expect(summary).toContain('下一步：可交付阶段摘要或开启继续会话');
  });
});
