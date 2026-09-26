import { useState, useCallback } from "react";
import { parseBibTeXWithWarnings, type BibTeXEntry, type BibTeXWarnings } from "../utils/bibtexParser";
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
  const [parseWarnings, setParseWarnings] = useState<BibTeXWarnings | null>(null);

  const handleFileChange = useCallback(async (file: File) => {
    // OR-accept file gate FIRST: accept when either the .bib extension
    // or a bibtex-like MIME type matches. Never reject a valid .bib
    // with an empty file.type (Windows).
    const fileName = (file?.name ?? "").trim();
    const fileType = (file?.type ?? "");
    const hasBibExtension = /\.bib$/i.test(fileName);
    const hasBibtexType = /bibtex/i.test(fileType);
    if (!hasBibExtension && !hasBibtexType) {
      setError("Please upload a .bib file.");
      return;
    }

    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      setError(sizeValidation.message || "File too large");
      return;
    }

    setLoading(true);
    setError("");
    setParsedEntries([]);
    setSelectedEntryIds(new Set());
    setImportStats(null);
    setParseWarnings(null);

    try {
      const text = await file.text();
      const { entries, warnings } = parseBibTeXWithWarnings(text);
      setParseWarnings(
        warnings.duplicateKeys.length > 0 || warnings.stringYears.length > 0 ? warnings : null
      );
      if (entries.length === 0) {
        setError("No valid BibTeX entries found in file.");
      } else {
        setParsedEntries(entries);
        // Untitled entries are hard-excluded from default selection.
        setSelectedEntryIds(
          new Set(entries.filter((e) => e.title?.trim()).map((e) => e.id))
        );
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

    // Hard-exclude untitled entries from import (no silent "Untitled" persist).
    const entriesToImport = parsedEntries.filter(
      (e) => selectedEntryIds.has(e.id) && e.title?.trim()
    );
    if (entriesToImport.length === 0) return 0;

    setLoading(true);
    setImportProgress({ current: 0, total: entriesToImport.length });

    let successCount = 0;
    let failedCount = 0;
    const usedBatch = Boolean(onAddBatch);

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

    // Retain-on-partial: clear only on full success; otherwise keep all
    // selected (batch path cannot know failed ids — retain all, do not guess).
    if (failedCount === 0) {
      setParsedEntries([]);
      setSelectedEntryIds(new Set());
    } else {
      const total = entriesToImport.length;
      if (usedBatch) {
        setError(
          `Imported ${successCount} of ${total}; ${failedCount} failed \u2014 failed entries kept in the list.`
        );
      } else {
        setError(
          `Imported ${successCount} of ${total}; ${failedCount} failed \u2014 failed entries kept selected.`
        );
      }
    }

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
    parseWarnings,
    handleFileChange,
    handleImport,
  };
}
