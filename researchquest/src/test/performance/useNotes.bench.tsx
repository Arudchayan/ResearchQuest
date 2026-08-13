import { describe, bench, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotes } from '../../hooks/useNotes';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ error: new Error('mock error') }), // force error to trigger revert
  }
}));

describe('useNotes performance', () => {
  bench('updateNote revert', async () => {
    const store = useAppStore.getState();
    const mockNotes = Array.from({ length: 10000 }, (_, i) => ({
      id: `note-${i}`,
      title: `Note ${i}`,
      markdown_body: 'body',
      user_id: 'user-1',
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      tags: [],
      linked_entity_ids: [],
    }));
    store.setNotes(mockNotes);

    const { result } = renderHook(() => useNotes('user-1'));

    await act(async () => {
      await result.current.updateNote('note-9999', { title: 'Updated' });
    });
  });
});
