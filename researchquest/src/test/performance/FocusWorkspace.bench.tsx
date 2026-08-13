import { describe, bench, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemo, useState } from 'react';

const MOCK_NOTES = Array.from({ length: 50000 }, (_, i) => ({
  id: `note-${i}`,
  title: `Note ${i}`,
  markdown_body: 'body',
  user_id: 'user-1',
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  tags: [],
  linked_entity_ids: [],
}));

function useUnoptimized(notes: any[], targetId: string) {
  return useMemo(() => {
    return notes.find((note) => note.id === targetId) || null;
  }, [notes, targetId]);
}

function useOptimized(notes: any[], targetId: string) {
  const map = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes]);
  return useMemo(() => {
    return map.get(targetId) || null;
  }, [map, targetId]);
}

describe('selectedItem performance', () => {
  bench('unoptimized array find', () => {
    // finding last item
    MOCK_NOTES.find(n => n.id === 'note-49999');
  });

  const map = new Map(MOCK_NOTES.map(n => [n.id, n]));
  bench('optimized map get', () => {
    map.get('note-49999');
  });
});
