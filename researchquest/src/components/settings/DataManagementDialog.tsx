import { logger } from "../../utils/logger";
import { useState, useRef } from "react";
import type { ExportData } from "../../utils/export";
import { exportData } from "../../utils/export";
import { importData } from "../../utils/import";
import { resetTopicsCache } from "../../hooks/useTopics";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Download,
  Upload,
  X,
  Database,
  Check,
  AlertTriangle,
  FileJson,
  Loader2,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { validateFileSize } from "../../utils/security";
import { toast } from "sonner";

type ExportPayload = Omit<ExportData, "metadata">;
type ImportedTopic = NonNullable<ExportData["topics"]>[number];
type ImportedTask = NonNullable<ExportData["tasks"]>[number];

interface DataManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

function buildImportPayload(
  parsed: ExportData,
  selection: {
    notes: boolean;
    papers: boolean;
    ideas: boolean;
    tasks: boolean;
    topics: boolean;
  },
): ExportData {
  const raw = parsed as unknown as Record<string, unknown>;
  function sliceArray<T>(key: keyof ExportData, selected: boolean): T[] {
    if (!selected) return [];
    const v = raw[key as string];
    return Array.isArray(v) ? (v as T[]) : [];
  }

  return {
    metadata: parsed.metadata,
    user: parsed.user ?? null,
    notes: sliceArray("notes", selection.notes),
    papers: sliceArray("papers", selection.papers),
    ideas: sliceArray("ideas", selection.ideas),
    tasks: sliceArray("tasks", selection.tasks),
    topics: sliceArray("topics", selection.topics),
    topicNotes: selection.topics
      ? sliceArray("topicNotes", true)
      : [],
    topicPapers: selection.topics
      ? sliceArray("topicPapers", true)
      : [],
    topicIdeas: selection.topics
      ? sliceArray("topicIdeas", true)
      : [],
  };
}

export function DataManagementDialog({
  open,
  onClose,
}: DataManagementDialogProps) {
  // ⚡ OPTIMIZATION: Use useShallow with an object selector to prevent DataManagementDialog from unnecessarily re-rendering on unrelated state changes in the global appStore.
  const { user, notes, papers, ideas, topics, tasks } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      notes: state.notes,
      papers: state.papers,
      ideas: state.ideas,
      topics: state.topics,
      tasks: state.tasks || [],
    })),
  );
  const [activeTab, setActiveTab] = useState("export");

  // Export State
  const [exportSelection, setExportSelection] = useState({
    user: true,
    notes: true,
    papers: true,
    ideas: true,
    tasks: true,
    topics: true,
  });

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ExportData | null>(null);
  const [importSelection, setImportSelection] = useState({
    notes: true,
    papers: true,
    ideas: true,
    tasks: true,
    topics: true,
  });
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

const handleExport = () => {
    if (!user?.id) {
      toast.error("You must be signed in to export");
      return;
    }

    const dataToExport = {
      userId: user.id,
      user: exportSelection.user && user ? user : null,
      notes: exportSelection.notes ? notes : [],
      papers: exportSelection.papers ? papers : [],
      ideas: exportSelection.ideas ? ideas : [],
      tasks: exportSelection.tasks ? tasks : [],
      topics: exportSelection.topics
        ? Object.values(topics).map((t) => ({
            id: t.id,
            user_id: t.user_id,
            name: t.name,
            description: t.description,
            created_at: t.created_at,
            updated_at: t.updated_at,
          }))
        : [],
    };

    exportData(dataToExport);
    toast.success("Export started");
    onClose();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {

    // 🛡️ Sentinel: Validate file size to prevent DoS
    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      toast.error(sizeValidation.message || "File too large");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImportFile(file);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Basic Validation
      if (!data.metadata || data.metadata.appName !== "ResearchQuest") {
        toast.error("Invalid file format: Not a ResearchQuest backup");
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setParsedData(data);
      // Reset selection based on what's available
      setImportSelection({
        notes: !!data.notes?.length,
        papers: !!data.papers?.length,
        ideas: !!data.ideas?.length,
        tasks: !!data.tasks?.length,
        topics: !!data.topics?.length,
      });
    } catch (err) {
      logger.error("Parse error", err);
      toast.error("Failed to parse JSON file");
      setImportFile(null);
    }
  };

  const handleImport = async () => {
    if (!parsedData || !user) return;

    setImporting(true);

    try {
      const payload = buildImportPayload(parsedData, importSelection);
      const json = JSON.stringify(payload);
      const file = new File([json], "import.json", {
        type: "application/json",
      });

      const result = await importData(file, user.id);

      if (result.success) {
        resetTopicsCache();
        setImportFile(null);
        setParsedData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.success(`Imported ${result.imported} items successfully`);
        onClose();
      }
    } catch (err) {
      logger.error("Import error", err);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface shadow-2xl border border-border-subtle overflow-hidden outline-none animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle bg-bg-elevated">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-bold text-text-primary">
                  Data Management
                </Dialog.Title>
                <Dialog.Description className="text-sm text-text-secondary">
                  Export your research data or restore from a backup
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <Tabs.Root
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col h-full"
          >
            <div className="px-6 pt-4 pb-0 border-b border-border-subtle">
              <Tabs.List className="flex gap-6">
                <Tabs.Trigger
                  value="export"
                  className="pb-3 text-sm font-medium text-text-secondary data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 transition-all outline-none"
                >
                  Export Data
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="import"
                  className="pb-3 text-sm font-medium text-text-secondary data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 transition-all outline-none"
                >
                  Import Data
                </Tabs.Trigger>
              </Tabs.List>
            </div>

            <div className="p-6 min-h-[300px]">
              <Tabs.Content
                value="export"
                className="space-y-6 outline-none animate-in fade-in duration-300"
              >
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>
                    Exporting creates a JSON backup of your selected data. You
                    can use this file to restore your data later or migrate to
                    another device.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-text-secondary">
                    Select data to export:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(exportSelection).map(([key, checked]) => (
                      <label
                        key={key}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" : "bg-bg-base border-border-subtle hover:border-border-moderate"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setExportSelection((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="block text-sm font-medium text-text-primary capitalize">
                            {key}
                          </span>
                          <span className="text-xs text-text-tertiary">
                            {key === "notes" && `${notes.length} items`}
                            {key === "papers" && `${papers.length} items`}
                            {key === "ideas" && `${ideas.length} items`}
                            {key === "tasks" && `${tasks.length} items`}
                            {key === "topics" && `${topics.length} items`}
                            {key === "user" && "Profile & Stats"}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download Backup
                  </button>
                </div>
              </Tabs.Content>

              <Tabs.Content
                value="import"
                className="space-y-6 outline-none animate-in fade-in duration-300"
              >
                {!parsedData ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl transition-colors ${
                      isDragging
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                        : "border-border-subtle bg-bg-base/50"
                    }`}
                  >
                    <div className="w-16 h-16 bg-bg-elevated rounded-full flex items-center justify-center mb-4">
                      <Upload className={`w-8 h-8 ${isDragging ? "text-blue-600 dark:text-blue-400" : "text-text-tertiary"}`} />
                    </div>
                    <h3 className="text-lg font-medium text-text-primary mb-2">
                      Upload Backup File
                    </h3>
                    <p className="text-sm text-text-secondary max-w-sm text-center mb-6">
                      {isDragging ? "Drop JSON file here" : "Select or drag and drop a ResearchQuest backup JSON file to restore your data."}
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-bg-elevated border border-border-subtle text-text-primary rounded-lg hover:bg-bg-surface transition-colors font-medium text-sm shadow-sm pointer-events-auto"
                    >
                      Select File
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-bg-elevated border border-border-subtle">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                          <FileJson className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">
                            {importFile?.name}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            Backup from{" "}
                            {parsedData.metadata?.timestamp
                              ? new Date(
                                  parsedData.metadata.timestamp,
                                ).toLocaleDateString()
                              : "Unknown date"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setParsedData(null);
                          setImportFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="text-xs text-text-secondary hover:text-red-500 underline"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-text-secondary">
                        Select data to import:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.keys(importSelection).map((key) => {
                          const count = (parsedData as any)[key]?.length || 0;
                          const isDisabled = count === 0;
                          const checked = (importSelection as any)[key];

                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isDisabled ? "opacity-50 cursor-not-allowed bg-bg-base border-border-subtle" : checked ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 cursor-pointer" : "bg-bg-base border-border-subtle hover:border-border-moderate cursor-pointer"}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isDisabled}
                                onChange={(e) =>
                                  setImportSelection((prev) => ({
                                    ...prev,
                                    [key]: e.target.checked,
                                  }))
                                }
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <span className="block text-sm font-medium text-text-primary capitalize">
                                  {key}
                                </span>
                                <span className="text-xs text-text-tertiary">
                                  {count} items found
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <p>
                        Importing will merge data with your existing library.
                        Existing items with the same ID will be updated. This
                        action cannot be undone.
                      </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setParsedData(null);
                          setImportFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="px-4 py-2 border border-border-subtle text-text-secondary rounded-lg hover:bg-bg-elevated transition-colors font-medium text-sm"
                        disabled={importing}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={
                          importing ||
                          !Object.values(importSelection).some(Boolean)
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {importing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {importing ? "Importing..." : "Confirm Import"}
                      </button>
                    </div>
                  </div>
                )}
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
