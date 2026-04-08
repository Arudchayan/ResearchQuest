import { bench, describe } from 'vitest';
import { parseDateInput } from '../../utils/time';

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const generateTasks = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    completed: Math.random() > 0.5,
    priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low',
    due_date: Math.random() > 0.2 ? new Date(Date.now() + (Math.random() - 0.5) * 10000000000).toISOString() : undefined,
    created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  }));
};

const tasks = generateTasks(10000);

describe('Task Sorting Performance', () => {
  bench('current implementation with parseDateInput', () => {
    const tasksCopy = [...tasks];
    tasksCopy.sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const aDue = parseDateInput(a.due_date)?.getTime() ?? Infinity;
      const bDue = parseDateInput(b.due_date)?.getTime() ?? Infinity;
      if (aDue !== bDue) {
        return aDue - bDue;
      }
      return b.created_at > a.created_at ? 1 : -1;
    });
  });

  bench('optimized implementation with string comparison', () => {
    const tasksCopy = [...tasks];
    tasksCopy.sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const aDue = a.due_date || "9999-12-31";
      const bDue = b.due_date || "9999-12-31";
      if (aDue !== bDue) {
        return aDue > bDue ? 1 : -1;
      }
      return b.created_at > a.created_at ? 1 : -1;
    });
  });
});
