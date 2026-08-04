import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { describe, expect, it } from 'vitest';
import {
  classifyMigrationListGraphTopology,
  type MigrationEdgeKind,
  type MigrationListGraphTopology,
} from '../../../src/utils/formatters/migration-list-graph-topology';
import type { MigrationListEntry } from '../../../src/utils/formatters/migration-list-types';

let hashCounter = 0;

function entry(
  dirName: string,
  from: string | null,
  to: string,
  migrationHash?: string,
): MigrationListEntry {
  return {
    name: dirName,
    hash: migrationHash ?? `mig-${hashCounter++}`,
    fromContract: from,
    toContract: to,
    operationCount: 1,
    createdAt: '2026-02-25T14:00:00.000Z',
    refs: [],
    providedInvariants: [],
  };
}

function classify(entries: readonly MigrationListEntry[]): MigrationListGraphTopology {
  return classifyMigrationListGraphTopology(entries);
}

function kind(topology: MigrationListGraphTopology, migrationHash: string): MigrationEdgeKind {
  const k = topology.kindByMigrationHash.get(migrationHash);
  if (k === undefined) {
    throw new Error(`missing kind for ${migrationHash}`);
  }
  return k;
}

function forwardIn(topology: MigrationListGraphTopology, contractHash: string): number {
  return topology.forwardInDegree.get(contractHash) ?? 0;
}

function forwardOut(topology: MigrationListGraphTopology, contractHash: string): number {
  return topology.forwardOutDegree.get(contractHash) ?? 0;
}

describe('classifyMigrationListGraphTopology', () => {
  it('classifies a linear chain as all forward with chain degrees', () => {
    const eUsers = entry('20250115_add_users', null, 'abc1234');
    const ePosts = entry('20250203_add_posts', 'abc1234', 'def5678');
    const eComments = entry('20250310_add_comments', 'def5678', 'f03da82');
    const topology = classify([eComments, ePosts, eUsers]);

    expect(kind(topology, eUsers.hash)).toBe('forward');
    expect(kind(topology, ePosts.hash)).toBe('forward');
    expect(kind(topology, eComments.hash)).toBe('forward');

    expect(forwardIn(topology, EMPTY_CONTRACT_HASH)).toBe(0);
    expect(forwardOut(topology, EMPTY_CONTRACT_HASH)).toBe(1);
    expect(forwardIn(topology, 'abc1234')).toBe(1);
    expect(forwardOut(topology, 'abc1234')).toBe(1);
    expect(forwardIn(topology, 'def5678')).toBe(1);
    expect(forwardOut(topology, 'def5678')).toBe(1);
    expect(forwardIn(topology, 'f03da82')).toBe(1);
    expect(forwardOut(topology, 'f03da82')).toBe(0);
  });

  it('counts diamond convergence and divergence on the forward subgraph', () => {
    const eUsers = entry('20250115_add_users', null, 'abc1234');
    const ePosts = entry('20250203_add_posts', 'abc1234', '7e1b9a0');
    const eTags = entry('20250210_add_tags', 'abc1234', '9c4f1e7');
    const eMergePosts = entry('20250301_merge_posts', '7e1b9a0', 'd41a8c3');
    const eMergeTags = entry('20250302_merge_tags', '9c4f1e7', 'd41a8c3');
    const topology = classify([eMergeTags, eMergePosts, eTags, ePosts, eUsers]);

    for (const e of [eUsers, ePosts, eTags, eMergePosts, eMergeTags]) {
      expect(kind(topology, e.hash)).toBe('forward');
    }

    expect(forwardOut(topology, 'abc1234')).toBe(2);
    expect(forwardIn(topology, 'd41a8c3')).toBe(2);
    expect(forwardOut(topology, 'd41a8c3')).toBe(0);
  });

  it('counts N-way convergence on the forward subgraph', () => {
    const eBase = entry('20250115_add_base', null, '4cb4256');
    const eBranchC = entry('20250302_branch_c', '4cb4256', 'c1d2e3f');
    const eBranchB = entry('20250303_branch_b', '4cb4256', 'b1c2d3e');
    const eBranchA = entry('20250304_branch_a', '4cb4256', 'a1b2c3d');
    const eMergeC = entry('20250308_merge_c', 'c1d2e3f', 'd41a8c3');
    const eMergeB = entry('20250309_merge_b', 'b1c2d3e', 'd41a8c3');
    const eMergeA = entry('20250310_merge_a', 'a1b2c3d', 'd41a8c3');
    const topology = classify([eMergeA, eMergeB, eMergeC, eBranchA, eBranchB, eBranchC, eBase]);

    expect(forwardOut(topology, '4cb4256')).toBe(3);
    expect(forwardIn(topology, 'd41a8c3')).toBe(3);
  });

  it('counts parallel forward edges to the same contract', () => {
    const eUsers = entry('20250115_add_users', null, 'abc1234');
    const ePosts = entry('20250203_add_posts', 'abc1234', 'def5678');
    const ePostsV2 = entry('20250203_add_posts_v2', 'abc1234', 'def5678');
    const topology = classify([ePostsV2, ePosts, eUsers]);

    expect(kind(topology, ePosts.hash)).toBe('forward');
    expect(kind(topology, ePostsV2.hash)).toBe('forward');
    expect(forwardIn(topology, 'def5678')).toBe(2);
    expect(forwardOut(topology, 'abc1234')).toBe(2);
  });

  it('counts convergence and divergence on the same contract', () => {
    const eBase = entry('20250115_add_base', null, '4cb4256');
    const eBranchB = entry('20250303_branch_b', '4cb4256', 'b1c2d3e');
    const eBranchA = entry('20250304_branch_a', '4cb4256', 'a1b2c3d');
    const eMergeB = entry('20250309_merge_b', 'b1c2d3e', 'd41a8c3');
    const eMergeA = entry('20250310_merge_a', 'a1b2c3d', 'd41a8c3');
    const eAddY = entry('20250319_add_y', 'd41a8c3', 'c4d5e6f');
    const eAddX = entry('20250320_add_x', 'd41a8c3', 'e1f2a3b');
    const topology = classify([eAddX, eAddY, eMergeA, eMergeB, eBranchA, eBranchB, eBase]);

    expect(forwardIn(topology, 'd41a8c3')).toBe(2);
    expect(forwardOut(topology, 'd41a8c3')).toBe(2);
  });

  it('keeps forward degrees when producers are non-adjacent in dirName order', () => {
    const eUsers = entry('20250115_add_users', null, 'abc1234');
    const ePosts = entry('20250203_add_posts', 'abc1234', '7e1b9a0');
    const eUnrelated = entry('20250220_unrelated', 'feed0000', 'deadbeef');
    const eTags = entry('20250210_add_tags', 'abc1234', '9c4f1e7');
    const eMergePosts = entry('20250301_merge_posts', '7e1b9a0', 'd41a8c3');
    const eMergeTags = entry('20250302_merge_tags', '9c4f1e7', 'd41a8c3');
    const topology = classify([eMergeTags, eMergePosts, eUnrelated, eTags, ePosts, eUsers]);

    expect(forwardIn(topology, 'd41a8c3')).toBe(2);
    expect(kind(topology, eUnrelated.hash)).toBe('forward');
  });

  it('classifies multi-hop rollback as rollback without forward degree bumps', () => {
    const eUsers = entry('20250115_add_users', null, 'abc1234');
    const ePosts = entry('20250203_add_posts', 'abc1234', 'def5678');
    const eComments = entry('20250310_add_comments', 'def5678', 'ghi7890');
    const eRollback = entry('20250312_full_rollback', 'ghi7890', 'abc1234');
    const topology = classify([eRollback, eComments, ePosts, eUsers]);

    expect(kind(topology, eRollback.hash)).toBe('rollback');
    expect(kind(topology, eComments.hash)).toBe('forward');
    expect(forwardIn(topology, 'abc1234')).toBe(1);
    expect(forwardOut(topology, 'ghi7890')).toBe(0);
    expect(forwardIn(topology, 'ghi7890')).toBe(1);
  });

  it('classifies partial rollback then continue on the forward subgraph', () => {
    const eUsers = entry('20250115_add_users', null, 'abc1234');
    const ePosts = entry('20250203_add_posts', 'abc1234', 'def5678');
    const eComments = entry('20250310_add_comments', 'def5678', 'ghi7890');
    const eRollback = entry('20250312_rollback_comments', 'ghi7890', 'def5678');
    const eLikes = entry('20250320_add_likes', 'def5678', 'jkl1234');
    const topology = classify([eLikes, eRollback, eComments, ePosts, eUsers]);

    expect(kind(topology, eRollback.hash)).toBe('rollback');
    expect(kind(topology, eLikes.hash)).toBe('forward');
    expect(forwardOut(topology, 'def5678')).toBe(2);
    expect(forwardIn(topology, 'def5678')).toBe(1);
    expect(forwardOut(topology, 'ghi7890')).toBe(0);
    expect(forwardIn(topology, 'ghi7890')).toBe(1);
  });

  it('picks the B-C back-edge via dirName-desc neighbour order at A', () => {
    const eAtoB = entry('20250309_fan_b', 'hash_a', 'hash_b');
    const eAtoC = entry('20250310_fan_c', 'hash_a', 'hash_c');
    const eBtoC = entry('20250305_b_to_c', 'hash_b', 'hash_c');
    const eCtoB = entry('20250304_c_to_b', 'hash_c', 'hash_b');
    const topology = classify([eCtoB, eBtoC, eAtoB, eAtoC]);

    expect(kind(topology, eBtoC.hash)).toBe('rollback');
    expect(kind(topology, eCtoB.hash)).toBe('forward');
    expect(kind(topology, eAtoC.hash)).toBe('forward');
    expect(kind(topology, eAtoB.hash)).toBe('forward');
  });

  it('classifies both converging node-skipping rollbacks as rollback', () => {
    const init = entry('00_init', null, 'n0');
    const m1 = entry('01_m1', 'n0', 'n1');
    const m2 = entry('02_m2', 'n1', 'n2');
    const m3 = entry('03_m3', 'n2', 'n3');
    const m4 = entry('04_m4', 'n3', 'n4');
    const m5 = entry('05_m5', 'n4', 'n5');
    const m6 = entry('06_m6', 'n5', 'n6');
    const rbA = entry('07_rb_a', 'n3', 'n1');
    const rbB = entry('08_rb_b', 'n5', 'n1');
    const topology = classify([init, m1, m2, m3, m4, m5, m6, rbA, rbB]);

    for (const e of [init, m1, m2, m3, m4, m5, m6]) {
      expect(kind(topology, e.hash)).toBe('forward');
    }
    expect(kind(topology, rbA.hash)).toBe('rollback');
    expect(kind(topology, rbB.hash)).toBe('rollback');
    // The chain stays a single forward spine; the rollbacks do not bump degrees.
    expect(forwardIn(topology, 'n1')).toBe(1);
    expect(forwardOut(topology, 'n3')).toBe(1);
    expect(forwardOut(topology, 'n5')).toBe(1);
  });

  it('classifies three rollbacks converging on one target all as rollback', () => {
    const init = entry('00_init', null, 'n0');
    const m1 = entry('01_m1', 'n0', 'n1');
    const m2 = entry('02_m2', 'n1', 'n2');
    const m3 = entry('03_m3', 'n2', 'n3');
    const m4 = entry('04_m4', 'n3', 'n4');
    const m5 = entry('05_m5', 'n4', 'n5');
    const m6 = entry('06_m6', 'n5', 'n6');
    const rbA = entry('07_rb_a', 'n3', 'n1');
    const rbB = entry('08_rb_b', 'n5', 'n1');
    const rbC = entry('09_rb_c', 'n4', 'n1');
    const topology = classify([init, m1, m2, m3, m4, m5, m6, rbA, rbB, rbC]);

    for (const e of [init, m1, m2, m3, m4, m5, m6]) {
      expect(kind(topology, e.hash)).toBe('forward');
    }
    expect(kind(topology, rbA.hash)).toBe('rollback');
    expect(kind(topology, rbB.hash)).toBe('rollback');
    expect(kind(topology, rbC.hash)).toBe('rollback');
    expect(forwardIn(topology, 'n1')).toBe(1);
  });

  it('classifies the same converging rollbacks regardless of edge input order', () => {
    const init = entry('00_init', null, 'n0');
    const m1 = entry('01_m1', 'n0', 'n1');
    const m2 = entry('02_m2', 'n1', 'n2');
    const m3 = entry('03_m3', 'n2', 'n3');
    const m4 = entry('04_m4', 'n3', 'n4');
    const m5 = entry('05_m5', 'n4', 'n5');
    const m6 = entry('06_m6', 'n5', 'n6');
    const rbA = entry('07_rb_a', 'n3', 'n1');
    const rbB = entry('08_rb_b', 'n5', 'n1');
    const shuffled = classify([rbB, m4, init, rbA, m6, m1, m5, m2, m3]);

    for (const e of [init, m1, m2, m3, m4, m5, m6]) {
      expect(kind(shuffled, e.hash)).toBe('forward');
    }
    expect(kind(shuffled, rbA.hash)).toBe('rollback');
    expect(kind(shuffled, rbB.hash)).toBe('rollback');
  });

  it('seeds pure-cycle back-edge lexically when a rooted component is also present', () => {
    const eInit = entry('20250101_init', null, 'hash_root');
    const eNext = entry('20250201_next', 'hash_root', 'hash_tip');
    const eAtoB = entry('20250301_cycle_ab', 'hash_aaa', 'hash_bbb');
    const eBtoA = entry('20250302_cycle_ba', 'hash_bbb', 'hash_aaa');
    const topology = classify([eBtoA, eAtoB, eNext, eInit]);

    expect(kind(topology, eInit.hash)).toBe('forward');
    expect(kind(topology, eNext.hash)).toBe('forward');
    expect(kind(topology, eAtoB.hash)).toBe('forward');
    expect(kind(topology, eBtoA.hash)).toBe('rollback');
  });

  it('marks exactly one edge rollback in a two-node cycle', () => {
    const eBtoA = entry('20250302_edge_ba', 'hash_b', 'hash_a');
    const eAtoB = entry('20250301_edge_ab', 'hash_a', 'hash_b');
    const topology = classify([eBtoA, eAtoB]);

    const kinds = [kind(topology, eAtoB.hash), kind(topology, eBtoA.hash)];
    expect(kinds.filter((k) => k === 'rollback')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'forward')).toHaveLength(1);
    expect(kind(topology, eBtoA.hash)).toBe('rollback');
    expect(kind(topology, eAtoB.hash)).toBe('forward');
    expect(forwardIn(topology, 'hash_b')).toBe(1);
    expect(forwardOut(topology, 'hash_a')).toBe(1);
    expect(forwardIn(topology, 'hash_a')).toBe(0);
    expect(forwardOut(topology, 'hash_b')).toBe(0);
  });

  it('tolerates no-genesis space with multiple forward roots', () => {
    const eBranch = entry('20250302_branch', 'mid_hash', 'tip_hash');
    const eOther = entry('20250301_other', 'root_a', 'root_b');
    const topology = classify([eBranch, eOther]);

    expect(forwardIn(topology, 'mid_hash')).toBe(0);
    expect(forwardIn(topology, 'root_a')).toBe(0);
    expect(forwardOut(topology, EMPTY_CONTRACT_HASH)).toBe(0);
    expect(kind(topology, eBranch.hash)).toBe('forward');
    expect(kind(topology, eOther.hash)).toBe('forward');
  });

  it('tolerates duplicate migration hash without throwing', () => {
    const sharedHash = 'duplicate';
    const eFirst = entry('20250302_first', 'hash_a', 'hash_b', sharedHash);
    const eSecond = entry('20250301_second', 'hash_c', 'hash_d', sharedHash);
    expect(() => classify([eFirst, eSecond])).not.toThrow();
    const topology = classify([eFirst, eSecond]);
    expect(topology.kindByMigrationHash.get(sharedHash)).toBeDefined();
  });

  it('classifies self-edge as self without forward degree bumps', () => {
    const contract = 'self-target';
    const eSelf = entry('20250305_self', contract, contract);
    const eForward = entry('20250304_forward', null, contract);
    const topology = classify([eSelf, eForward]);

    expect(kind(topology, eSelf.hash)).toBe('self');
    expect(kind(topology, eForward.hash)).toBe('forward');
    expect(forwardIn(topology, contract)).toBe(1);
    expect(forwardOut(topology, contract)).toBe(0);
  });
});
