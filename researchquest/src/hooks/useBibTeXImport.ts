import { useState, useCallback } from "react";
import { parseBibTeX, type BibTeXEntry } from "../utils/bibtexParser";
import { validateFileSize } from "../utils/security";
import { logger } from "../utils/logger";
import { buildPaperPayloadFromBibTeX } from "../utils/paperUtils";
import type { Paper, PaperDraft } from "../types/database";

export function useBibTeXImport(
  onAdd: (data: PaperDraft) => Promise<Paper | null>,
  onAddBatch?: (data: PaperDraft[]) => Promise<Paper[]>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsedEntries, setParsedEntries] = useState<BibTeXEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null);

  const handleFileChange = useCallback(async (file: File) => {
    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      setError(sizeValidation.message || "File too large");
      return;
    }

    setLoading(true);
    setError("");
    setImportStats(null);

    try {
      const text = await file.text();
      const entries = parseBibTeX(text);
      if (entries.length === 0) {
        // Retry-safe (item 72): keep the previous parsed entries on parse
        // failure so a bad file never wipes a good parse.
        setError("No valid BibTeX entries found in file.");
      } else {
        setParsedEntries(entries);
        setSelectedEntryIds(new Set(entries.map((e) => e.id)));
      }
    } catch (err) {
      logger.error("Failed to parse file", err);
      setError("Failed to parse BibTeX file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (selectedEntryIds.size === 0) return 0;

    setLoading(true);
    const entriesToImport = parsedEntries.filter((e) => selectedEntryIds.has(e.id));
    setImportProgress({ current: 0, total: entriesToImport.length });
    
    let successCount = 0;
    let failedCount = 0;

    if (onAddBatch) {
      try {
        const payload = entriesToImport.map(entry => buildPaperPayloadFromBibTeX(entry));
        const addedPapers = await onAddBatch(payload);
        successCount = addedPapers.length;
        failedCount = entriesToImport.length - successCount;
      } catch (err) {
        logger.error(`Failed to batch import papers`, err);
        failedCount = entriesToImport.length;
      }
      setImportProgress({ current: entriesToImport.length, total: entriesToImport.length });
    } else {
      for (let i = 0; i < entriesToImport.length; i++) {
        const entry = entriesToImport[i];
        if (!entry) continue;
        try {
          await onAdd(buildPaperPayloadFromBibTeX(entry));
          successCount++;
        } catch (err) {
          logger.error(`Failed to import paper ${entry.title}`, err);
          failedCount++;
        }
        setImportProgress({ current: i + 1, total: entriesToImport.length });
      }
    }

    setImportStats({ success: successCount, failed: failedCount });
    setLoading(false);
    setImportProgress(null);
    // Keep parsed entries + selection after import (item 72): the dialog
    // surfaces importStats so failed entries stay selectable for retry.

    return successCount;
  }, [onAdd, onAddBatch, parsedEntries, selectedEntryIds]);

  return {
    loading,
    error,
    setError,
    parsedEntries,
    selectedEntryIds,
    setSelectedEntryIds,
    importProgress,
    importStats,
    handleFileChange,
    handleImport,
  };
}
