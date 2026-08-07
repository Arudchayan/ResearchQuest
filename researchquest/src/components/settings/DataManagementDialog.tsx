import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { z } from "zod";
import { AlertTriangle, Check, Database, Download, FileJson, Loader2, Trash2, Upload, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/appStore";
import { resetTopicsCache } from "../../hooks/useTopics";
import { exportData } from "../../utils/export";
import { importData } from "../../utils/import";
import { validateFileSize } from "../../utils/security";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ErrorFallback } from "../ui/ErrorFallback";

const ENTITY_KEYS = ["notes", "papers", "ideas", "tasks", "topics"] as const;
type EntityKey = (typeof ENTITY_KEYS)[number];
type Selection = Record<EntityKey, boolean>;
type Counts = Record<EntityKey, number>;

const backupSchema = z.object({
  metadata: z.object({ appName: z.literal("ResearchQuest"), timestamp: z.string().optional() }),
  notes: z.array(z.unknown()),
  papers: z.array(z.unknown()),
  ideas: z.array(z.unknown()),
  tasks: z.array(z.unknown()),
  topics: z.array(z.unknown()),
  topicNotes: z.array(z.unknown()).optional(),
  topicPapers: z.array(z.unknown()).optional(),
  topicIdeas: z.array(z.unknown()).optional(),
}).passthrough();
type BackupData = z.infer<typeof backupSchema>;

const EMPTY_COUNTS: Counts = { notes: 0, papers: 0, ideas: 0, tasks: 0, topics: 0 };
const labels: Record<EntityKey, string> = { notes: "Notes", papers: "Papers", ideas: "Ideas", tasks: "Tasks", topics: "Topics" };
const tables: Record<EntityKey, string> = { notes: "notes", papers: "papers", ideas: "ideas", tasks: "tasks", topics: "topics" };

function hasStringId(value: unknown): value is { readonly id: string } {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

function selectedCount(counts: Counts, selection: Selection): number {
  return ENTITY_KEYS.reduce((total, key) => total + (selection[key] ? counts[key] : 0), 0);
}

interface DataManagementDialogProps { open: boolean; onClose: () => void; }

export function DataManagementDialog({ open, onClose }: DataManagementDialogProps) {
  const { user, notes, papers, ideas, topics, tasks } = useAppStore(useShallow((state) => ({
    user: state.user, notes: state.notes, papers: state.papers, ideas: state.ideas, topics: state.topics, tasks: state.tasks || [],
  })));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("export");
  const [exportSelection, setExportSelection] = useState({ user: true, ...Object.fromEntries(ENTITY_KEYS.map((key) => [key, true])) } as Selection & { user: boolean });
  const [backup, setBackup] = useState<BackupData | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSelection, setImportSelection] = useState<Selection>({ ...EMPTY_COUNTS, notes: true, papers: true, ideas: true, tasks: true, topics: true });
  const [conflicts, setConflicts] = useState<Counts>(EMPTY_COUNTS);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importResult, setImportResult] = useState<{ readonly imported: number; readonly skipped: number } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const exportCounts: Counts = { notes: notes.length, papers: papers.length, ideas: ideas.length, tasks: tasks.length, topics: Object.keys(topics).length };
  const importCounts: Counts = backup ? Object.fromEntries(ENTITY_KEYS.map((key) => [key, backup[key].length])) as Counts : EMPTY_COUNTS;
  const resetImport = () => { setBackup(null); setImportFile(null); setConflicts(EMPTY_COUNTS); setImportResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const handleExport = async () => {
    if (!user?.id) { setError(new Error("Unauthorized export attempt")); return; }
    try {
      await exportData({ userId: user.id, user: exportSelection.user ? user : null, notes: exportSelection.notes ? notes : [], papers: exportSelection.papers ? papers : [], ideas: exportSelection.ideas ? ideas : [], tasks: exportSelection.tasks ? tasks : [], topics: exportSelection.topics ? Object.values(topics).map(({ id, user_id, name, description, created_at, updated_at }) => ({ id, user_id, name, ...(description === undefined ? {} : { description }), created_at, updated_at })) : [] });
      toast.success("Backup download started");
    } catch (caught) { setError(caught instanceof Error ? caught : new Error("Backup export failed")); }
  };

  const previewConflicts = async (data: BackupData, selection: Selection) => {
    const results = await Promise.all(ENTITY_KEYS.map(async (key) => {
      const ids = selection[key] ? data[key].filter(hasStringId).map(({ id }) => id) : [];
      if (ids.length === 0) return [key, 0] as const;
      const { count, error: queryError } = await supabase.from(tables[key]).select("id", { count: "exact", head: true }).in("id", ids);
      if (queryError) throw queryError;
      return [key, count ?? 0] as const;
    }));
    setConflicts(Object.fromEntries(results) as Counts);
  };

  const processFile = async (file: File) => {
    const size = validateFileSize(file);
    if (!size.valid) { setError(new Error(size.message || "Backup file is too large")); return; }
    try {
      const parsed = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error("This is not a valid ResearchQuest backup.");
      const selection = Object.fromEntries(ENTITY_KEYS.map((key) => [key, parsed.data[key].length > 0])) as Selection;
      setImportFile(file); setBackup(parsed.data); setImportSelection(selection); setImportResult(null);
      await previewConflicts(parsed.data, selection);
    } catch (caught) { resetImport(); setError(caught instanceof Error ? caught : new Error("Could not read the backup file.")); }
  };

  const handleImport = async () => {
    if (!backup || !user?.id) return;
    setIsImporting(true);
    try {
      const payload = { ...backup, ...Object.fromEntries(ENTITY_KEYS.map((key) => [key, importSelection[key] ? backup[key] : []])), topicNotes: importSelection.topics ? backup.topicNotes ?? [] : [], topicPapers: importSelection.topics ? backup.topicPapers ?? [] : [], topicIdeas: importSelection.topics ? backup.topicIdeas ?? [] : [] };
      const result = await importData(new File([JSON.stringify(payload)], "import.json", { type: "application/json" }), user.id);
      if (!result.success) throw new Error(result.error);
      resetTopicsCache(); setImportResult(result); toast.success(`Imported ${result.imported} rows${result.skipped ? `; ${result.skipped} preserved` : ""}`);
    } catch (caught) { setError(caught instanceof Error ? caught : new Error("Backup import failed.")); } finally { setIsImporting(false); }
  };

  const clearAllData = async () => {
    if (!user?.id) return;
    setIsClearing(true);
    try {
      for (const table of ["topic_notes", "topic_papers", "topic_ideas", "topic_quests", "notes", "papers", "ideas", "tasks", "topics"]) {
        const { error: deleteError } = await supabase.from(table).delete().eq("user_id", user.id);
        if (deleteError) throw deleteError;
      }
      useAppStore.setState({ notes: [], papers: [], ideas: [], tasks: [], topics: {} }); resetTopicsCache(); setShowClearConfirm(false); toast.success("Research data cleared");
    } catch (caught) { setError(caught instanceof Error ? caught : new Error("Could not clear research data.")); } finally { setIsClearing(false); }
  };

  const panelError = error ? <ErrorFallback error={error} resetError={() => setError(null)} title="Data management needs attention" showHomeButton={false} /> : null;
  const checkboxes = (counts: Counts, selection: Selection, onChange: (key: EntityKey, checked: boolean) => void, suffix: string) => <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{ENTITY_KEYS.map((key) => <label key={key} className="flex min-h-12 items-center gap-3 rounded-control border border-border-subtle bg-bg-base p-3 text-small has-[:checked]:border-border-strong has-[:checked]:bg-bg-elevated"><input type="checkbox" checked={selection[key]} disabled={counts[key] === 0} onChange={(event) => onChange(key, event.target.checked)} className="h-4 w-4 accent-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" /><span className="min-w-0 flex-1 text-text-primary">{labels[key]}<span className="ml-2 text-caption text-text-tertiary">{counts[key]} {suffix}</span></span></label>)}</div>;

  return <><Dialog.Root open={open} modal={!showClearConfirm} onOpenChange={(isOpen) => !isOpen && onClose()}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[60] bg-overlay backdrop-blur-sm animate-in fade-in duration-fast" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-surface border border-border-subtle bg-bg-surface shadow-lg outline-none animate-in zoom-in-95 duration-fast">
      <header className="flex items-start justify-between gap-4 border-b border-border-subtle bg-bg-elevated px-4 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-info-bg text-info"><Database className="h-5 w-5" aria-hidden="true" /></div><div><Dialog.Title className="font-serif text-subtitle text-text-primary">Data Management</Dialog.Title><Dialog.Description className="text-small text-text-secondary">Create a complete backup, preview a restore, or clear this account’s research data.</Dialog.Description></div></div><Dialog.Close asChild><button className="rounded-control p-2 text-text-secondary transition-colors hover:bg-bg-base hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" aria-label="Close data management"><X className="h-5 w-5" aria-hidden="true" /></button></Dialog.Close></header>
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col"><Tabs.List aria-label="Data management actions" className="flex shrink-0 gap-4 overflow-x-auto border-b border-border-subtle px-4 pt-3 sm:px-6">{[["export", "Export Data"], ["import", "Import Data"], ["clear", "Clear data"]].map(([value, label]) => <Tabs.Trigger key={value} value={value} className="border-b-2 border-transparent px-1 pb-3 text-small font-medium text-text-secondary outline-none transition-colors data-[state=active]:border-primary-500 data-[state=active]:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{label}</Tabs.Trigger>)}</Tabs.List>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{panelError || <>
          <Tabs.Content value="export" className="space-y-5 outline-none"><section className="rounded-surface border border-border-subtle bg-bg-elevated p-4"><p className="text-small font-medium text-text-primary">Backup contents</p><p className="mt-1 text-small text-text-secondary">Your download contains the selected records below{exportSelection.user ? ", your profile and progress" : ""}, plus all topic connections stored for this account.</p><p className="mt-3 font-mono text-small tabular-nums text-text-primary">{selectedCount(exportCounts, exportSelection)} selected research records</p></section>{checkboxes(exportCounts, exportSelection, (key, checked) => setExportSelection((current) => ({ ...current, [key]: checked })), "included")}<label className="flex min-h-12 items-center gap-3 rounded-control border border-border-subtle bg-bg-base p-3 text-small has-[:checked]:border-border-strong has-[:checked]:bg-bg-elevated"><input type="checkbox" checked={exportSelection.user} onChange={(event) => setExportSelection((current) => ({ ...current, user: event.target.checked }))} className="h-4 w-4 accent-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" /><span className="text-text-primary">Profile and progress <span className="ml-2 text-caption text-text-tertiary">included</span></span></label><div className="flex justify-end"><button onClick={handleExport} className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary-500 px-4 py-2 text-small font-medium text-bg-surface transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"><Download className="h-4 w-4" aria-hidden="true" />Download Backup <span className="font-mono tabular-nums">({selectedCount(exportCounts, exportSelection)} records)</span></button></div></Tabs.Content>
          <Tabs.Content value="import" className="space-y-5 outline-none">{!backup ? <div role="button" tabIndex={0} onClick={(event) => { if (event.target === event.currentTarget) fileInputRef.current?.click(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const [file] = event.dataTransfer.files; if (file) void processFile(file); }} aria-describedby="backup-upload-help" className={`flex min-h-72 flex-col items-center justify-center rounded-surface border-2 border-dashed p-6 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${isDragging ? "border-border-strong bg-bg-elevated" : "border-border-moderate bg-bg-base"}`}><Upload className="mb-4 h-8 w-8 text-text-secondary" aria-hidden="true" /><h3 className="font-serif text-subtitle text-text-primary">Upload Backup File</h3><p id="backup-upload-help" className="mt-2 max-w-md text-small text-text-secondary">Drag a ResearchQuest JSON backup here, or use the button below. Press Enter or Space when this area is focused to select a file.</p><button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 min-h-10 rounded-control border border-border-moderate bg-bg-surface px-4 py-2 text-small font-medium text-text-primary transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Select backup file</button><input ref={fileInputRef} type="file" accept="application/json,.json" onChange={(event) => { const [file] = Array.from(event.target.files ?? []); if (file) void processFile(file); }} className="sr-only" aria-label="Select a ResearchQuest JSON backup" /></div> : <div className="space-y-5"><section className="rounded-surface border border-border-subtle bg-bg-elevated p-4"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><FileJson className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" /><div><h3 className="text-small font-medium text-text-primary">{importFile?.name}</h3><p className="mt-1 text-caption text-text-secondary">Backup from {backup.metadata.timestamp ? new Date(backup.metadata.timestamp).toLocaleDateString() : "an unknown date"}</p></div></div><button onClick={resetImport} className="text-caption font-medium text-text-secondary underline hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Remove</button></div></section>{importResult ? <section className="rounded-surface border border-success bg-success-bg p-4"><p className="text-small font-medium text-success">Import complete</p><p className="mt-1 text-small text-text-secondary">Added {importResult.imported} records. Preserved {importResult.skipped} matching existing records.</p><div className="mt-4 flex justify-end"><button onClick={onClose} className="min-h-10 rounded-control bg-primary-500 px-4 py-2 text-small font-medium text-bg-surface hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Done</button></div></section> : <><section><h3 className="text-small font-medium text-text-primary">Import preview</h3><p className="mt-1 text-small text-text-secondary">Choose exactly what to add. {selectedCount(importCounts, importSelection)} records are selected.</p><div className="mt-3">{checkboxes(importCounts, importSelection, (key, checked) => setImportSelection((current) => ({ ...current, [key]: checked })), "found")}</div></section><section className="rounded-surface border border-warning bg-warning-bg p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" /><div><p className="text-small font-medium text-warning">Conflict policy: preserve existing on conflict</p><p className="mt-1 text-small text-text-secondary">{selectedCount(conflicts, importSelection)} matching-ID records are already in this library and will be skipped. Existing data is never replaced.</p></div></div></section><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button onClick={resetImport} disabled={isImporting} className="min-h-10 rounded-control border border-border-moderate px-4 py-2 text-small font-medium text-text-primary hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50">Cancel without importing</button><button onClick={handleImport} disabled={isImporting || selectedCount(importCounts, importSelection) === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-primary-500 px-4 py-2 text-small font-medium text-bg-surface hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50">{isImporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}{isImporting ? "Importing" : `Import ${selectedCount(importCounts, importSelection)} records`}</button></div></>}</div>}</Tabs.Content>
          <Tabs.Content value="clear" className="space-y-5 outline-none"><section className="rounded-surface border border-destructive bg-destructive-bg p-4"><div className="flex gap-3"><Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" /><div><h3 className="text-small font-medium text-destructive">Permanently clear research data</h3><p className="mt-1 text-small text-text-secondary">This deletes {notes.length} notes, {papers.length} papers, {ideas.length} ideas, {tasks.length} tasks, {Object.keys(topics).length} topics, and all topic connections from this account. This cannot be undone.</p></div></div></section><div className="flex justify-end"><button onClick={() => setShowClearConfirm(true)} disabled={!user?.id} className="inline-flex min-h-10 items-center gap-2 rounded-control bg-destructive px-4 py-2 text-small font-medium text-destructive-foreground hover:bg-destructive-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" />Clear all data</button></div></Tabs.Content>
        </>}</div></Tabs.Root>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <ConfirmDialog isOpen={showClearConfirm} onClose={() => setShowClearConfirm(false)} onConfirm={clearAllData} title="Clear all research data" message="This will permanently delete all your notes, papers, ideas, tasks, topics, and their connections. It cannot be undone." confirmText="Delete everything" cancelText="Keep my data" variant="danger" isLoading={isClearing} />
  </>;
}
