import { describe, it, expect } from 'vitest';
import { parseBibTeX, BibTeXEntry } from '../../utils/bibtexParser';

describe('parseBibTeX', () => {
  it('should parse a simple article entry', () => {
    const input = `
@article{key1,
  title = {Sample Title},
  author = {Smith, John and Doe, Jane},
  year = {2023},
  journal = {Journal of Testing},
  doi = {10.1234/5678}
}
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'key1',
      type: 'article',
      title: 'Sample Title',
      authors: ['Smith, John', 'Doe, Jane'],
      year: '2023',
      journal: 'Journal of Testing',
      doi: '10.1234/5678',
      raw: input.trim()
    });
  });

  it('should parse multiple entries', () => {
    const input = `
@article{key1,
  title = {Paper One},
  year = {2021}
}

@book{key2,
  title = {Book Two},
  year = {2022}
}
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('key1');
    expect(result[1].id).toBe('key2');
  });

  it('should handle unquoted values and numbers', () => {
    const input = `
@article{key1,
  year = 2023,
  volume = 10,
  title = "Quoted Title"
}
    `;
    const result = parseBibTeX(input);
    expect(result[0].year).toBe('2023');
    expect(result[0].title).toBe('Quoted Title');
  });

  it('should handle complex author names', () => {
    const input = `
@article{key1,
  author = {Van der Waal, J. and O'Neil, T. and {Corporate Author}}
}
    `;
    const result = parseBibTeX(input);
    expect(result[0].authors).toEqual(['Van der Waal, J.', "O'Neil, T.", 'Corporate Author']);
  });

  it('should handle malformed or empty input gracefully', () => {
    expect(parseBibTeX('')).toEqual([]);
    expect(parseBibTeX('   ')).toEqual([]);
    expect(parseBibTeX('not a bibtex file')).toEqual([]);
  });

  it('should extract abstract and url', () => {
    const input = `
@misc{key1,
  url = {https://example.com},
  abstract = {This is a very long abstract that spans multiple lines.}
}
    `;
    const result = parseBibTeX(input);
    expect(result[0].url).toBe('https://example.com');
    expect(result[0].abstract).toContain('This is a very long abstract');
  });

  it('should handle email addresses in abstract without splitting', () => {
    const input = `
@article{key1,
  title = {Paper with Email},
  abstract = {Contact author at test@example.com for more info.}
}
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(1);
    expect(result[0].abstract).toBe('Contact author at test@example.com for more info.');
  });

  it('should handle nested braces correctly', () => {
    const input = `
@article{key1,
  title = {{This Title Case Is Preserved}},
  note = {Some {Nested {Braces}} inside}
}
    `;
    const result = parseBibTeX(input);
    // The parser removes outer braces. {{Title}} -> {Title}
    expect(result[0].title).toBe('This Title Case Is Preserved');
    expect(result[0].note).toBe('Some {Nested {Braces}} inside');
  });

  it('should handle multiple entries with mixed spacing', () => {
    const input = `
@article{key1,title={Title 1}}
  @book{key2, title = {Title 2} }
    `;
    const result = parseBibTeX(input);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Title 1');
    expect(result[1].title).toBe('Title 2');
  });
});
