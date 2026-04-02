import { useState, useCallback } from "react";
import type { CrossrefPaper } from "../types/database";
import type { PaperSearchOptions } from "./usePapers";
import { logger } from "../utils/logger";

interface UsePaperSearchProps {
  searchByDOI: (doi: string) => Promise<CrossrefPaper | null>;
  searchByQuery: (query: string, options?: PaperSearchOptions) => Promise<CrossrefPaper[]>;
}

export function usePaperSearch({ searchByDOI, searchByQuery }: UsePaperSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState<CrossrefPaper[]>([]);
  const [doiResult, setDoiResult] = useState<CrossrefPaper | null>(null);
  const [selectedResult, setSelectedResult] = useState<CrossrefPaper | null>(null);

  const performDOISearch = useCallback(async (doi: string) => {
    if (!doi.trim()) return;
    setLoading(true);
    setError("");
    setDoiResult(null);
    try {
      const result = await searchByDOI(doi.trim());
      if (result) {
        setDoiResult(result);
      } else {
        setError("Paper not found. Try manual entry or search by keywords.");
      }
    } catch (err) {
      logger.error("DOI search failed", err);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchByDOI]);

  const performQuerySearch = useCallback(async (query: string, options: PaperSearchOptions) => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const results = await searchByQuery(query.trim(), options);
      setSearchResults(results);
      setSelectedResult(results[0] ?? null);
      if (results.length === 0) {
        setError("No papers found. Try different keywords or use manual entry.");
      }
    } catch (err) {
      logger.error("Query search failed", err);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchByQuery]);

  return {
    loading,
    error,
    setError,
    searchResults,
    setSearchResults,
    doiResult,
    setDoiResult,
    selectedResult,
    setSelectedResult,
    performDOISearch,
    performQuerySearch,
  };
}
