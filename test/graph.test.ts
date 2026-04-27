import { describe, it, expect } from 'vitest';
import { hasCycle } from 'graphology-dag';
import {
  createTaskGraph,
  linearChainTasks,
  linearChain,
  diamondTasks,
  diamond,
  mixedCategoryTasks,
  mixedCategory,
  cyclicTasks,
  cyclic,
  largeGraphTasks,
  largeGraph,
  allGraphs,
  allTasks,
} from './fixtures/graphs.js';

describe('TaskGraph', () => {
  it('placeholder — construction and queries', () => {
    expect(true).toBe(true);
  });
});

describe('Test Fixtures', () => {
  describe('linearChain', () => {
    it('has 4 nodes', () => {
      expect(linearChain.order).toBe(4);
    });

    it('has 3 edges (A→B, B→C, C→D)', () => {
      expect(linearChain.size).toBe(3);
    });

    it('has correct task IDs', () => {
      expect(linearChainTasks.map(t => t.id)).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('diamond', () => {
    it('has 4 nodes', () => {
      expect(diamond.order).toBe(4);
    });

    it('has 4 edges (A→B, A→C, B→D, C→D)', () => {
      expect(diamond.size).toBe(4);
    });

    it('A has two dependents (B, C)', () => {
      expect(diamond.outNeighbors('A')).toHaveLength(2);
    });

    it('D has two prerequisites (B, C)', () => {
      expect(diamond.inNeighbors('D')).toHaveLength(2);
    });
  });

  describe('mixedCategory', () => {
    it('has 5 nodes', () => {
      expect(mixedCategory.order).toBe(5);
    });

    it('stores assessed categorical fields', () => {
      const authAttrs = mixedCategory.getNodeAttributes('auth');
      expect(authAttrs.risk).toBe('high');
      expect(authAttrs.scope).toBe('broad');
    });

    it('strips null categorical fields (absent = not assessed)', () => {
      const apiAttrs = mixedCategory.getNodeAttributes('api');
      expect(apiAttrs.risk).toBeUndefined();
      expect(apiAttrs.scope).toBeUndefined();
    });

    it('preserves non-null optional fields', () => {
      const apiAttrs = mixedCategory.getNodeAttributes('api');
      expect(apiAttrs.impact).toBe('component');
    });
  });

  describe('cyclic', () => {
    it('has 4 nodes', () => {
      expect(cyclic.order).toBe(4);
    });

    it('has 4 edges (C→A, A→B, B→C, A→D)', () => {
      expect(cyclic.size).toBe(4);
    });

    it('contains a cycle', () => {
      // graphology-dag hasCycle check
      expect(hasCycle(cyclic)).toBe(true);
    });
  });

  describe('largeGraph', () => {
    it('has 23 nodes (20+ for performance testing)', () => {
      expect(largeGraph.order).toBe(23);
    });

    it('has more than 20 edges', () => {
      expect(largeGraph.size).toBeGreaterThan(20);
    });

    it('release node has 8 prerequisites', () => {
      expect(largeGraph.inNeighbors('release')).toHaveLength(8);
    });
  });

  describe('createTaskGraph helper', () => {
    it('builds a graph from TaskInput[]', () => {
      const tasks = [
        { id: 'x', name: 'Task X', dependsOn: [] },
        { id: 'y', name: 'Task Y', dependsOn: ['x'] },
      ];
      const graph = createTaskGraph(tasks);
      expect(graph.order).toBe(2);
      expect(graph.size).toBe(1);
    });

    it('handles empty task array', () => {
      const graph = createTaskGraph([]);
      expect(graph.order).toBe(0);
      expect(graph.size).toBe(0);
    });

    it('uses deterministic edge keys', () => {
      const graph = createTaskGraph([
        { id: 'a', name: 'A', dependsOn: [] },
        { id: 'b', name: 'B', dependsOn: ['a'] },
      ]);
      expect(graph.hasEdge('a->b')).toBe(true);
    });

    it('sets default qualityRetention 0.9 on edges', () => {
      const graph = createTaskGraph([
        { id: 'a', name: 'A', dependsOn: [] },
        { id: 'b', name: 'B', dependsOn: ['a'] },
      ]);
      const edgeAttrs = graph.getEdgeAttributes('a->b');
      expect(edgeAttrs.qualityRetention).toBe(0.9);
    });

    it('deduplicates edges when same dependency appears twice', () => {
      const tasks = [
        { id: 'a', name: 'A', dependsOn: [] },
        { id: 'b', name: 'B', dependsOn: ['a', 'a'] },
      ];
      const graph = createTaskGraph(tasks);
      expect(graph.size).toBe(1);
    });
  });

  describe('allGraphs / allTasks convenience exports', () => {
    it('allGraphs contains 5 fixtures', () => {
      expect(Object.keys(allGraphs)).toHaveLength(5);
    });

    it('allTasks contains 5 task arrays', () => {
      expect(Object.keys(allTasks)).toHaveLength(5);
    });

    it('each graph has matching task array', () => {
      expect(allGraphs.linearChain.order).toBe(linearChainTasks.length);
      expect(allGraphs.diamond.order).toBe(diamondTasks.length);
      expect(allGraphs.mixedCategory.order).toBe(mixedCategoryTasks.length);
      expect(allGraphs.cyclic.order).toBe(cyclicTasks.length);
      expect(allGraphs.large.order).toBe(largeGraphTasks.length);
    });
  });
});