import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../mocks/supabase';

// Mock supabase module - MUST be before imports that use it
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }
}));

import { importData } from '../../utils/import';
import { toast } from 'sonner';

describe('importData', () => {
  const userId = 'test-user-id';

  function createMockFile(content: any, name: string = 'backup.json') {
    const json = JSON.stringify(content);
    const file = new File([json], name, { type: 'application/json' });
    // Mock text method
    file.text = vi.fn().mockResolvedValue(json);
    return file;
  }

  const validData = {
    metadata: { appName: 'ResearchQuest', version: '1.0', timestamp: '' },
    notes: [{ id: 'n1', title: 'Note 1' }],
    papers: [{ id: 'p1', title: 'Paper 1' }],
    ideas: [{ id: 'i1', title: 'Idea 1' }],
    topics: [{ id: 't1', name: 'Topic 1' }]
  };

  const mockFile = createMockFile(validData);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import data correctly', async () => {
    // Setup mock responses
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    // We need to setup the chain: from(table).upsert(data)
    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock
    } as any);

    await importData(mockFile, userId);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('notes');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('papers');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('ideas');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('topics');

    // Check if user_id was injected
    expect(upsertMock).toHaveBeenCalledTimes(4);

    expect(toast.success).toHaveBeenCalled();
  });

  it('should handle invalid JSON', async () => {
    const invalidFile = new File(['invalid json'], 'bad.json', { type: 'application/json' });
    invalidFile.text = vi.fn().mockRejectedValue(new Error('Invalid JSON')); // Or mocked to return bad json
    // But importData calls JSON.parse(await file.text()).
    // If text() returns invalid json string, JSON.parse throws.
    invalidFile.text = vi.fn().mockResolvedValue('invalid json');

    await importData(invalidFile, userId);
    expect(toast.error).toHaveBeenCalledWith('Invalid JSON file');
  });

  it('should handle invalid metadata', async () => {
    const badMetaFile = createMockFile({
      metadata: { appName: 'WrongApp' },
      notes: []
    });

    await importData(badMetaFile, userId);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid backup file'));
  });

  it('should handle supabase error', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: { message: 'DB Error' } });
    mockSupabaseClient.from.mockReturnValue({
      upsert: upsertMock
    } as any);

    await importData(mockFile, userId);

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to import data'));
  });
});
