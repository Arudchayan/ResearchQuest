import { describe, it, expect } from 'vitest';
import { convertPapersToCSV, convertPapersToJSON, convertPapersToBibTeX, convertNotesToCSV, convertNotesToJSON, convertNotesToMarkdown } from '../../utils/export';
import { Paper, Note } from '../../types/database';

const mockPapers: Paper[] = [
  {
    id: '1',
    user_id: 'user1',
    title: 'Test Paper "With Quotes"',
    authors: ['Author One', 'Author Two'],
    publication_date: '2023-01-01',
    doi: '10.1000/1',
    source_url: 'http://example.com',
    abstract: 'This is a test abstract, with commas.',
    status: 'To Read',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  },
  {
    id: '2',
    user_id: 'user1',
    title: 'Another Paper',
    authors: [],
    publication_date: undefined,
    doi: undefined,
    source_url: undefined,
    abstract: undefined,
    status: 'Reading',
    created_at: '2023-02-01T00:00:00Z',
    updated_at: '2023-02-01T00:00:00Z'
  }
];

const mockNotes: Note[] = [
  {
    id: 'n1',
    user_id: 'user1',
    title: 'My First Note',
    markdown_body: '# Heading\nThis is a body.',
    tags: ['research', 'important'],
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-01-01T10:00:00Z',
    linked_entity_ids: []
  },
  {
    id: 'n2',
    user_id: 'user1',
    title: '', // Untitled
    markdown_body: 'Just a quick thought with "quotes" and, commas.',
    tags: [],
    created_at: '2023-01-02T10:00:00Z',
    updated_at: '2023-01-02T10:00:00Z',
    linked_entity_ids: []
  }
];

describe('Export Utils', () => {
  describe('Papers', () => {
    it('converts papers to CSV correctly', () => {
      const csv = convertPapersToCSV(mockPapers);
      const lines = csv.split('\n');
      expect(lines.length).toBe(3); // Header + 2 rows

      // Check header
      expect(lines[0]).toBe('Title,Authors,Publication Year,DOI,Source URL,Abstract,Created At');

      // Check first row (escaping)
      const row1 = lines[1];
      expect(row1).toContain('"Test Paper ""With Quotes"""');
      // "Author One; Author Two" does not contain special chars, so it won't be quoted
      expect(row1).toContain('Author One; Author Two');
      expect(row1).toContain('"This is a test abstract, with commas."');
      expect(row1).toContain('2023'); // Year extracted

      // Check second row (empty fields)
      const row2 = lines[2];
      expect(row2).toContain('Another Paper');
      expect(row2).toMatch(/^Another Paper,,,,,,2023-02-01/);
    });

    it('converts papers to JSON correctly', () => {
      const json = convertPapersToJSON(mockPapers);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Test Paper "With Quotes"');
      expect(parsed[1].status).toBe('Reading');
    });

    it('converts papers to BibTeX correctly', () => {
      const bibtex = convertPapersToBibTeX(mockPapers);
      // Check first paper
      expect(bibtex).toContain('@article{One2023Test');

      expect(bibtex).toContain('title = {Test Paper "With Quotes"}');
      expect(bibtex).toContain('author = {Author One and Author Two}');
      expect(bibtex).toContain('year = {2023}');

      // Check second paper
      expect(bibtex).toContain('@article{AnonymousndAnother');
    });

    it('escapes CSV injection characters correctly', () => {
      const maliciousPapers: Paper[] = [
        {
          ...mockPapers[0],
          id: 'bad1',
          title: '=1+1', // Formula injection
          authors: ['@evil'], // Another trigger
          abstract: '-cmd /c calc', // Command execution trigger
          doi: '+1234567890' // Plus trigger
        }
      ];

      const csv = convertPapersToCSV(maliciousPapers);
      const lines = csv.split('\n');
      const row = lines[1];

      // Expect single quote prepended to prevent execution
      // Note: If quotes are added by escapeCSV due to other chars, the single quote should be INSIDE the double quotes?
      // Or outside? Usually inside. E.g. "'=1+1".

      // However, our implementation will prepend ' to the string BEFORE wrapping in quotes if needed.
      // Since these strings don't have commas/quotes, they might not be wrapped in double quotes unless we force it.
      // Let's see what the implementation does.
      // If input is "=1+1", output should be "'=1+1" (if not quoted) or "\"'=1+1\"" (if quoted).

      // We expect the raw cell value in CSV to start with '.
      // In CSV format:
      // =1+1  -> ,=1+1,  (vulnerable)
      // '=1+1 -> ,'=1+1, (safe, shows ' in cell)

      const parts = row.split(',');
      // Title is first column
      expect(parts[0]).toBe("'=1+1");
      // Authors is second column
      expect(parts[1]).toBe("'@evil");
      // DOI is 4th column (index 3). 3rd is Year.
      expect(parts[3]).toBe("'+1234567890");
      // Abstract is 6th column (index 5)
      expect(parts[5]).toBe("'-cmd /c calc");
    });

    it('escapes CSV injection characters correctly, even with leading whitespace', () => {
      const maliciousPapers: Paper[] = [
        {
          ...mockPapers[0],
          id: 'bad2',
          title: '   =1+1', // Leading spaces
          authors: ['\t@evil'], // Leading tab
          doi: '+cmd',
        }
      ];

      const csv = convertPapersToCSV(maliciousPapers);
      const lines = csv.split('\n');
      const row = lines[1];

      const parts = row.split(',');
      // Title is first column
      expect(parts[0]).toBe("'   =1+1");
      // Authors is second column
      expect(parts[1]).toBe("'\t@evil");
    });

    it('escapes DDE injection triggers like Tab and Carriage Return', () => {
      const maliciousPapers: Paper[] = [
        {
          ...mockPapers[0],
          id: 'bad-dde',
          title: '\tcmd /c calc', // Tab trigger
          authors: ['\rshutdown -s'], // CR trigger
        }
      ];

      const csv = convertPapersToCSV(maliciousPapers);
      const lines = csv.split('\n');
      const row = lines[1];

      const parts = row.split(',');

      // Title starts with \t, should be escaped
      expect(parts[0]).toBe("'\tcmd /c calc");

      // Authors starts with \r, should be escaped
      expect(parts[1]).toBe("'\rshutdown -s");
    });
  });

  describe('Notes', () => {
    it('converts notes to CSV correctly', () => {
      const csv = convertNotesToCSV(mockNotes);

      // Check header
      expect(csv).toContain('Title,Markdown Body,Tags,Created At,Updated At');

      // Check content presence
      expect(csv).toContain('My First Note');
      // The embedded newline means simple line splitting is insufficient, but the content should be there
      expect(csv).toContain('"# Heading\nThis is a body."');
      expect(csv).toContain('research; important');

      // Check second note
      expect(csv).toContain('Just a quick thought with ""quotes"" and'); // Quotes escaped
    });

    it('converts notes to JSON correctly', () => {
      const json = convertNotesToJSON(mockNotes);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('My First Note');
      expect(parsed[1].markdown_body).toContain('Just a quick thought');
    });

    it('converts notes to Markdown correctly', () => {
      const md = convertNotesToMarkdown(mockNotes);

      expect(md).toContain('# My First Note');
      expect(md).toContain('*Created:');
      expect(md).toContain('Tags: research, important');
      expect(md).toContain('# Heading\nThis is a body.');

      // Separator
      expect(md).toContain('\n\n---\n\n');

      // Second note
      expect(md).toContain('# Untitled Note'); // Fallback title
      expect(md).toContain('Just a quick thought');
    });
  });
});
