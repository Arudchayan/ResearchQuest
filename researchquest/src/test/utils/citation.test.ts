import { describe, it, expect } from 'vitest';
import { generateBibTeX, generateAPA, generateMLA, generateChicago, generateHarvard } from '../../utils/citation';
import type { Paper } from '../../types/database';

describe('Citation Generators', () => {
  const fullPaper: Paper = {
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

  const minimalPaper: Paper = {
    id: '2',
    user_id: 'user1',
    title: 'Minimal Paper',
    authors: [],
    status: 'To Read',
    created_at: '2023-01-01',
    updated_at: '2023-01-01'
  };

  const multiAuthorPaper: Paper = {
    ...fullPaper,
    authors: ['John Doe', 'Jane Smith', 'Alice Johnson']
  };

  describe('generateBibTeX', () => {
    it('generates correct BibTeX for a full paper', () => {
      const bibtex = generateBibTeX(fullPaper);

      expect(bibtex).toContain('@article{Doe2023Quantum,');
      expect(bibtex).toContain('title = {Quantum Computing Advances}');
      expect(bibtex).toContain('author = {John Doe and Jane Smith}');
      expect(bibtex).toContain('year = {2023}');
      expect(bibtex).toContain('doi = {10.1234/5678}');
      expect(bibtex).toContain('url = {https://example.com/paper}');
      expect(bibtex).toContain('abstract = {This is an abstract. It has multiple lines.}');
    });

    it('handles minimal paper', () => {
      const bibtex = generateBibTeX(minimalPaper);

      expect(bibtex).toContain('@article{AnonymousndMinimal,');
      expect(bibtex).toContain('title = {Minimal Paper}');
      expect(bibtex).not.toContain('author =');
      expect(bibtex).not.toContain('year =');
    });

    it('handles irregular date format', () => {
      const paper: Paper = {
        ...minimalPaper,
        title: 'Old Paper',
        authors: ['Alice'],
        publication_date: 'Winter 1999'
      };

      const bibtex = generateBibTeX(paper);
      expect(bibtex).toContain('year = {1999}');
    });
  });

  describe('generateAPA', () => {
    it('generates correct APA for full paper', () => {
      const citation = generateAPA(fullPaper);
      expect(citation).toBe('Doe, J. & Smith, J. (2023). Quantum Computing Advances. https://doi.org/10.1234/5678');
    });

    it('handles minimal paper', () => {
      const citation = generateAPA(minimalPaper);
      expect(citation).toBe('Anonymous (n.d.). Minimal Paper.');
    });

    it('handles multiple authors', () => {
      const citation = generateAPA(multiAuthorPaper);
      expect(citation).toBe('Doe, J., Smith, J., & Johnson, A. (2023). Quantum Computing Advances. https://doi.org/10.1234/5678');
    });
  });

  describe('generateMLA', () => {
    it('generates correct MLA for full paper', () => {
      const citation = generateMLA(fullPaper);
      // "Doe, John, and Jane Smith. "Quantum Computing Advances." 2023. doi:10.1234/5678."
      expect(citation).toBe('Doe, John, and Jane Smith "Quantum Computing Advances." 2023. doi:10.1234/5678.');
    });

    it('handles minimal paper', () => {
      const citation = generateMLA(minimalPaper);
      expect(citation).toBe('Anonymous "Minimal Paper."');
    });

    it('handles 3+ authors (et al.)', () => {
      const citation = generateMLA(multiAuthorPaper);
      expect(citation).toBe('Doe, John, et al. "Quantum Computing Advances." 2023. doi:10.1234/5678.');
    });
  });

  describe('generateChicago', () => {
    it('generates correct Chicago for full paper', () => {
      const citation = generateChicago(fullPaper);
      // "Doe, John, and Jane Smith. "Quantum Computing Advances." (2023). https://doi.org/10.1234/5678."
      expect(citation).toBe('Doe, John, and Jane Smith "Quantum Computing Advances." (2023). https://doi.org/10.1234/5678.');
    });

    it('handles minimal paper', () => {
      const citation = generateChicago(minimalPaper);
      expect(citation).toBe('Anonymous "Minimal Paper."');
    });

    it('handles 4+ authors (et al.)', () => {
      const manyAuthorsPaper = {
        ...fullPaper,
        authors: ['A', 'B', 'C', 'D']
      };
      const citation = generateChicago(manyAuthorsPaper);
      expect(citation).toBe('A, et al. "Quantum Computing Advances." (2023). https://doi.org/10.1234/5678.');
    });
  });

  describe('generateHarvard', () => {
    it('generates correct Harvard for full paper', () => {
      const citation = generateHarvard(fullPaper);
      // "Doe, J and Smith, J (2023) 'Quantum Computing Advances'. doi: 10.1234/5678"
      expect(citation).toBe("Doe, J and Smith, J (2023) 'Quantum Computing Advances'. doi: 10.1234/5678");
    });

    it('handles minimal paper', () => {
      const citation = generateHarvard(minimalPaper);
      expect(citation).toBe("Anonymous (n.d.) 'Minimal Paper'.");
    });

    it('handles > 3 authors (et al.)', () => {
       const manyAuthorsPaper = {
        ...fullPaper,
        authors: ['A', 'B', 'C', 'D']
      };
      const citation = generateHarvard(manyAuthorsPaper);
      expect(citation).toBe("A et al. (2023) 'Quantum Computing Advances'. doi: 10.1234/5678");
    });
  });
});
