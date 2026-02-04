import { describe, it, expect } from 'vitest';
import { generateBibTeX } from '../../utils/citation';
import type { Paper } from '../../types/database';

describe('generateBibTeX', () => {
  it('generates correct BibTeX for a full paper', () => {
    const paper: Paper = {
      id: '1',
      user_id: 'user1',
      title: 'Quantum Computing Advances',
      authors: ['John Doe', 'Jane Smith'],
      publication_date: '2023-01-01',
      doi: '10.1234/5678',
      source_url: 'https://example.com/paper',
      abstract: 'This is an abstract.\nIt has multiple lines.',
      status: 'To Read',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    };

    const bibtex = generateBibTeX(paper);

    expect(bibtex).toContain('@article{Doe2023Quantum,');
    expect(bibtex).toContain('title = {Quantum Computing Advances}');
    expect(bibtex).toContain('author = {John Doe and Jane Smith}');
    expect(bibtex).toContain('year = {2023}');
    expect(bibtex).toContain('doi = {10.1234/5678}');
    expect(bibtex).toContain('url = {https://example.com/paper}');
    expect(bibtex).toContain('abstract = {This is an abstract. It has multiple lines.}');
  });

  it('handles minimal paper', () => {
    const paper: Paper = {
      id: '2',
      user_id: 'user1',
      title: 'Minimal Paper',
      authors: [],
      status: 'To Read',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    };

    const bibtex = generateBibTeX(paper);

    expect(bibtex).toContain('@article{AnonymousndMinimal,');
    expect(bibtex).toContain('title = {Minimal Paper}');
    expect(bibtex).not.toContain('author =');
    expect(bibtex).not.toContain('year =');
  });

  it('handles irregular date format', () => {
    const paper: Paper = {
      id: '3',
      user_id: 'user1',
      title: 'Old Paper',
      authors: ['Alice'],
      publication_date: 'Winter 1999',
      status: 'Read',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    };

    const bibtex = generateBibTeX(paper);
    expect(bibtex).toContain('year = {1999}');
  });
});
