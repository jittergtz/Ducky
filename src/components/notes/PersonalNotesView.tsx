import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  SquarePen,
  Search,
  Sparkles,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { useDialogs } from "../../hooks/useDialogs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "../ui/select";
import { Input } from "../ui/input";
import { useToast } from "../ui/useToast";
import NoteListItem from "./NoteListItem";
import NoteEditor from "./NoteEditor";
import ActionPicker from "./ActionPicker";
import ActionManagerDialog from "./ActionManagerDialog";
import AddNotesToFolderDialog from "./AddNotesToFolderDialog";
import { useActionProcessing } from "../../hooks/useActionProcessing";
import {
  useSettingsStore,
  selectIsCloudNoteFormattingMode,
  selectResolvedNoteFormatting,
} from "../../stores/settingsStore";
import { useFolderManagement } from "../../hooks/useFolderManagement";
import { useNoteDragAndDrop } from "../../hooks/useNoteDragAndDrop";
import { cn } from "../lib/utils";
import { MEETINGS_FOLDER_NAME, findDefaultFolder } from "./shared";
import logger from "../../utils/logger";
import { parseTranscriptSegments } from "../../utils/parseTranscriptSegments";
import { serializeTranscriptSegments } from "../../utils/transcriptSpeakerState";
import { resolveExpectedSpeakerCount } from "../../utils/participants";
import {
  useNotes,
  useActiveNoteId,
  useActiveFolderId,
  initializeNotes,
  setActiveNoteId,
  setActiveFolderId,
  removeNote,
} from "../../stores/noteStore";
import {
  useMeetingRecordingStore,
  useIsNarrowWindow,
  startRecording as storeStartRecording,
  stopRecording as storeStopRecording,
  lockSpeaker,
  setSessionDiarizationEnabled,
  setSessionExpectedCount,
} from "../../stores/meetingRecordingStore";
import { useNotesOnboarding } from "../../hooks/useNotesOnboarding";
import NotesOnboarding from "./NotesOnboarding";
import { isRegenerableNoteTitle } from "../../helpers/regenerableNoteTitle";

const FOLDER_INPUT_CLASS =
  "w-full h-10 bg-foreground/5 dark:bg-white/5 rounded-xl px-3 text-sm text-foreground outline-none border border-primary/30 focus:border-primary/50";

function makeContentHash(content: string): string {
  return String(content.length) + "-" + content.slice(0, 50);
}

interface PersonalNotesViewProps {
  onOpenSettings?: (section: string) => void;
  onOpenSearch?: () => void;
  meetingRecordingRequest?: {
    noteId: number;
    folderId: number;
    event: any;
  } | null;
  onMeetingRecordingRequestHandled?: () => void;
}

export default function PersonalNotesView({
  onOpenSettings,
  onOpenSearch,
  meetingRecordingRequest,
  onMeetingRecordingRequestHandled,
}: PersonalNotesViewProps) {
  const isNarrowWindow = useIsNarrowWindow();
  const { t } = useTranslation();
  const notes = useNotes();
  const activeNoteId = useActiveNoteId();
  const isSidePanelLayout = isNarrowWindow && activeNoteId != null;
  const activeFolderId = useActiveFolderId();
  const [isSaving, setIsSaving] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localEnhancedContent, setLocalEnhancedContent] = useState<string | null>(null);
  const [showActionManager, setShowActionManager] = useState(false);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [newNoteFolderId, setNewNoteFolderId] = useState<string>("");
  const [isCreatingNewNoteFolder, setIsCreatingNewNoteFolder] = useState(false);
  const [newNoteFolderName, setNewNoteFolderName] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enhancedSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeNoteRef = useRef<number | null>(null);
  const [syncedNoteId, setSyncedNoteIdState] = useState<number | null>(null);
  const localContentRef = useRef(localContent);
  const localTitleRef = useRef(localTitle);
  const localEnhancedContentRef = useRef(localEnhancedContent);
  useEffect(() => {
    localContentRef.current = localContent;
    localTitleRef.current = localTitle;
  }, [localContent, localTitle]);
  useEffect(() => {
    localEnhancedContentRef.current = localEnhancedContent;
  }, [localEnhancedContent]);
  const markNoteAsSynced = (id: number | null) => {
    activeNoteRef.current = id;
    setSyncedNoteIdState(id);
  };
  const { toast } = useToast();
  const isCloudMode = useSettingsStore(selectIsCloudNoteFormattingMode);
  const effectiveModelId = useSettingsStore((s) => selectResolvedNoteFormatting(s).model);
  const noteFilesEnabled = useSettingsStore((s) => s.noteFilesEnabled);
  const fileManagerName = navigator.platform.startsWith("Mac")
    ? "Finder"
    : navigator.platform.startsWith("Win")
      ? "Explorer"
      : "Files";
  const { isComplete: isOnboardingComplete, complete: completeOnboarding } = useNotesOnboarding();

  const isTranscribing = useMeetingRecordingStore((s) => s.isRecording);
  const diarizationSessionId = useMeetingRecordingStore((s) => s.diarizationSessionId);
  const recordingNoteId = useMeetingRecordingStore((s) => s.recordingNoteId);
  const sessionDiarizationEnabled = useMeetingRecordingStore((s) => s.sessionDiarizationEnabled);
  const sessionExpectedCount = useMeetingRecordingStore((s) => s.sessionExpectedCount);
  const userTouchedStepper = useMeetingRecordingStore((s) => s.userTouchedStepper);

  const {
    folders,
    folderCounts,
    isLoading,
    isCreatingFolder,
    newFolderName,
    renamingFolderId,
    renameValue,
    showAddNotesDialog,
    newFolderInputRef,
    renameInputRef,
    setIsCreatingFolder,
    setNewFolderName,
    setRenamingFolderId,
    setRenameValue,
    setShowAddNotesDialog,
    loadFolders,
    handleCreateFolder,
    handleConfirmRename,
    handleDeleteFolder,
  } = useFolderManagement();

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();

  const requestDeleteFolder = useCallback(
    (folder: { id: number; name: string }) => {
      const count = folderCounts[folder.id] ?? 0;
      showConfirmDialog({
        title: t("notes.folders.deleteTitle"),
        description:
          count > 0
            ? t("notes.folders.deleteDescription", { name: folder.name, count })
            : t("notes.folders.deleteDescriptionEmpty", { name: folder.name }),
        confirmText: t("notes.folders.deleteConfirm"),
        variant: "destructive",
        onConfirm: () => handleDeleteFolder(folder.id),
      });
    },
    [folderCounts, handleDeleteFolder, showConfirmDialog, t]
  );

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  // Derive folder name and calendar event name for the metadata chips
  const activeFolderName = useMemo(() => {
    if (!activeNote?.folder_id) return null;
    return folders.find((f) => f.id === activeNote.folder_id)?.name ?? null;
  }, [activeNote?.folder_id, folders]);

  const [calendarEventName, setCalendarEventName] = useState<string | null>(null);
  useEffect(() => {
    if (!activeNote?.calendar_event_id) {
      setCalendarEventName(null);
      return;
    }
    window.electronAPI.gcalGetEvent?.(activeNote.calendar_event_id).then((result) => {
      setCalendarEventName(result?.success && result.event?.summary ? result.event.summary : null);
    });
  }, [activeNote?.calendar_event_id]);

  const startRecording = useCallback(async () => {
    const noteId = activeNoteRef.current;
    const note = notes.find((n) => n.id === noteId);
    const seedSegments = note?.transcript ? parseTranscriptSegments(note.transcript) : [];
    await storeStartRecording({
      noteId,
      noteTitle: note?.title ?? null,
      folderId: note?.folder_id ?? null,
      seedSegments,
      diarizationEnabled: note?.diarization_enabled == null ? null : note.diarization_enabled === 1,
      expectedCount: resolveExpectedSpeakerCount(note),
    });
  }, [notes]);

  const stopRecording = useCallback(async () => {
    await storeStopRecording();
  }, []);

  // Navigation must flush the debounce before the editor is reset or unmounted.
  const flushPendingSave = useCallback(() => {
    const noteId = activeNoteRef.current;
    const updates: { title?: string; content?: string; enhanced_content?: string | null } = {};
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      updates.title = localTitleRef.current;
      updates.content = localContentRef.current;
    }
    if (enhancedSaveTimeoutRef.current) {
      clearTimeout(enhancedSaveTimeoutRef.current);
      enhancedSaveTimeoutRef.current = null;
      updates.enhanced_content = localEnhancedContentRef.current;
    }
    if (noteId && Object.keys(updates).length) {
      void window.electronAPI.updateNote(noteId, updates).catch((err: unknown) => {
        logger.warn(
          "Failed to save note on navigation",
          { error: (err as Error).message },
          "notes"
        );
      });
    }
  }, []);

  useEffect(() => {
    if (activeNote && activeNote.id !== activeNoteRef.current) {
      flushPendingSave();
      markNoteAsSynced(activeNote.id);
      setLocalTitle(activeNote.title);
      setLocalContent(activeNote.content);
      setLocalEnhancedContent(activeNote.enhanced_content ?? null);
      // Also update refs directly so callbacks are correct before next render
      localTitleRef.current = activeNote.title;
      localContentRef.current = activeNote.content;
      localEnhancedContentRef.current = activeNote.enhanced_content ?? null;
    } else if (activeNote && activeNote.id === activeNoteRef.current && !saveTimeoutRef.current) {
      // External update (e.g. AI chat tool) — resync only when no user save is pending
      if (activeNote.title !== localTitleRef.current) setLocalTitle(activeNote.title);
      if (activeNote.content !== localContentRef.current) setLocalContent(activeNote.content);
      if (
        !enhancedSaveTimeoutRef.current &&
        (activeNote.enhanced_content ?? null) !== localEnhancedContentRef.current
      ) {
        setLocalEnhancedContent(activeNote.enhanced_content ?? null);
      }
    } else if (!activeNote) {
      flushPendingSave();
      markNoteAsSynced(null);
      setLocalTitle("");
      setLocalContent("");
      setLocalEnhancedContent(null);
    }
  }, [activeNote, flushPendingSave]);

  const debouncedSave = useCallback((noteId: number, title: string, content: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null;
      setIsSaving(true);
      try {
        await window.electronAPI.updateNote(noteId, { title, content });
      } catch (err) {
        logger.warn("Failed to save note", { error: (err as Error).message }, "notes");
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", flushPendingSave);
    return () => {
      window.removeEventListener("beforeunload", flushPendingSave);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const handleTitleChange = useCallback(
    (title: string) => {
      localTitleRef.current = title;
      setLocalTitle(title);
      if (activeNoteRef.current)
        debouncedSave(activeNoteRef.current, title, localContentRef.current);
    },
    [debouncedSave]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      localContentRef.current = content;
      setLocalContent(content);
      if (activeNoteRef.current)
        debouncedSave(activeNoteRef.current, localTitleRef.current, content);
    },
    [debouncedSave]
  );

  const handleEnhancedContentChange = useCallback((content: string) => {
    localEnhancedContentRef.current = content;
    setLocalEnhancedContent(content);
    if (!activeNoteRef.current) return;
    const noteId = activeNoteRef.current;
    if (enhancedSaveTimeoutRef.current) clearTimeout(enhancedSaveTimeoutRef.current);
    enhancedSaveTimeoutRef.current = setTimeout(async () => {
      enhancedSaveTimeoutRef.current = null;
      setIsSaving(true);
      try {
        await window.electronAPI.updateNote(noteId, { enhanced_content: content });
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, []);

  const handleNewNote = useCallback(async () => {
    if (!activeFolderId) return;
    const result = await window.electronAPI.saveNote(
      t("notes.list.untitledNote"),
      "",
      "personal",
      null,
      null,
      activeFolderId
    );
    if (result.success && result.note) {
      setActiveNoteId(result.note.id);
      loadFolders();
    }
  }, [activeFolderId, loadFolders, t]);

  const handleOpenNewNoteDialog = useCallback(() => {
    const personal = findDefaultFolder(folders);
    setNewNoteFolderId(personal ? String(personal.id) : folders[0] ? String(folders[0].id) : "");
    setShowNewNoteDialog(true);
  }, [folders]);

  const handleNewNoteFolderChange = useCallback((val: string) => {
    if (val === "__create_new__") {
      setIsCreatingNewNoteFolder(true);
      return;
    }
    setNewNoteFolderId(val);
  }, []);

  const handleCreateNewNoteFolder = useCallback(async () => {
    const trimmed = newNoteFolderName.trim();
    if (!trimmed) return;
    const res = await window.electronAPI.createFolder(trimmed);
    if (res.success && res.folder) {
      await loadFolders();
      setNewNoteFolderId(String(res.folder.id));
    }
    setNewNoteFolderName("");
    setIsCreatingNewNoteFolder(false);
  }, [newNoteFolderName, loadFolders]);

  const handleConfirmNewNote = useCallback(async () => {
    const folderId = Number(newNoteFolderId);
    if (!folderId) return;
    const result = await window.electronAPI.saveNote(
      t("notes.list.untitledNote"),
      "",
      "personal",
      null,
      null,
      folderId
    );
    if (result.success && result.note) {
      setActiveFolderId(folderId);
      setActiveNoteId(result.note.id);
      loadFolders();
    }
    setShowNewNoteDialog(false);
  }, [newNoteFolderId, loadFolders, t]);

  const handleNotesAdded = useCallback(async () => {
    if (activeFolderId) {
      await initializeNotes(null, 50, activeFolderId);
    }
    loadFolders();
  }, [activeFolderId, loadFolders]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      await window.electronAPI.deleteNote(id);
      loadFolders();
    },
    [loadFolders]
  );

  const handleMoveToFolder = useCallback(
    async (noteId: number, folderId: number) => {
      await window.electronAPI.updateNote(noteId, { folder_id: folderId });
      if (noteId === activeNoteId) {
        setActiveFolderId(folderId);
      } else {
        removeNote(noteId);
      }
      loadFolders();
    },
    [activeNoteId, loadFolders]
  );

  const { dragState, noteDragHandlers, folderDropHandlers } = useNoteDragAndDrop({
    onMoveToFolder: handleMoveToFolder,
    currentFolderId: activeFolderId,
  });

  const handleCreateFolderAndMove = useCallback(
    async (noteId: number, folderName: string) => {
      const result = await window.electronAPI.createFolder(folderName);
      if (result.success && result.folder) {
        await window.electronAPI.updateNote(noteId, { folder_id: result.folder.id });
        await loadFolders();
      } else if (result.error) {
        toast({
          title: t("notes.folders.couldNotCreate"),
          description: result.error,
          variant: "destructive",
        });
      }
    },
    [loadFolders, toast, t]
  );

  const {
    state: actionProcessingState,
    actionName,
    runAction,
  } = useActionProcessing(activeNoteId ?? null);

  // Boolean flag so actions enable during recording without re-rendering on every transcript update.
  const hasLiveTranscript = useMeetingRecordingStore(
    (s) => s.recordingNoteId === activeNote?.id && !!s.transcript
  );
  const activeNoteRawTranscript = activeNote?.transcript || "";

  const isEnhancementStale = useMemo(() => {
    if (!activeNote?.enhanced_content || !activeNote?.enhanced_at_content_hash) return false;
    const currentHash = makeContentHash(`${localContent}\n${activeNoteRawTranscript}`);
    return currentHash !== activeNote.enhanced_at_content_hash;
  }, [
    activeNote?.enhanced_content,
    activeNote?.enhanced_at_content_hash,
    localContent,
    activeNoteRawTranscript,
  ]);

  const handleExportNote = useCallback(
    async (format: "md" | "txt") => {
      if (!activeNoteId) return;
      await window.electronAPI.exportNote(activeNoteId, format);
    },
    [activeNoteId]
  );

  const handleExportTranscript = useCallback(
    async (format: "txt" | "srt" | "json" | "md") => {
      if (!activeNoteId) return;
      await window.electronAPI.exportTranscript(activeNoteId, format);
    },
    [activeNoteId]
  );

  useEffect(() => {
    if (!meetingRecordingRequest || activeNoteId !== meetingRecordingRequest.noteId) return;
    const note = notes.find((n) => n.id === meetingRecordingRequest.noteId);
    const seedSegments = note?.transcript ? parseTranscriptSegments(note.transcript) : [];
    storeStartRecording({
      noteId: meetingRecordingRequest.noteId,
      noteTitle: note?.title ?? null,
      folderId: note?.folder_id ?? meetingRecordingRequest.folderId ?? null,
      seedSegments,
      diarizationEnabled: note?.diarization_enabled == null ? null : note.diarization_enabled === 1,
      expectedCount: resolveExpectedSpeakerCount(note),
    });
    onMeetingRecordingRequestHandled?.();
  }, [meetingRecordingRequest, activeNoteId, notes, onMeetingRecordingRequestHandled]);

  const prevTranscribingRef = useRef(false);

  useEffect(() => {
    if (prevTranscribingRef.current && !isTranscribing) {
      const { transcript: realtimeTranscript, segments: realtimeSegments } =
        useMeetingRecordingStore.getState();
      const transcript =
        realtimeSegments.length > 0
          ? serializeTranscriptSegments(realtimeSegments)
          : realtimeTranscript;

      if (recordingNoteId && transcript) {
        window.electronAPI.updateNote(recordingNoteId, { transcript });
      }
    }
    prevTranscribingRef.current = isTranscribing;
  }, [isTranscribing, recordingNoteId]);

  useEffect(() => {
    if (!isTranscribing) return;

    const interval = setInterval(() => {
      const { recordingNoteId: currentRecordingNoteId, segments: realtimeSegments } =
        useMeetingRecordingStore.getState();
      if (!currentRecordingNoteId || realtimeSegments.length === 0) return;
      window.electronAPI.updateNote(currentRecordingNoteId, {
        transcript: serializeTranscriptSegments(realtimeSegments),
      });
    }, 30_000);

    return () => clearInterval(interval);
  }, [isTranscribing]);

  const isLocalSynced = syncedNoteId === activeNote?.id;
  const isActiveNoteRecording = isTranscribing && recordingNoteId === activeNote?.id;
  const editorNote = activeNote
    ? {
        ...activeNote,
        title: isLocalSynced ? localTitle : activeNote.title,
        content: isLocalSynced ? localContent : activeNote.content,
      }
    : null;

  if (!isOnboardingComplete) {
    return <NotesOnboarding onComplete={completeOnboarding} />;
  }

  return (
    <div className="notes-workspace flex h-full min-h-0 min-w-0 bg-background text-foreground">
      <div
        inert={isSidePanelLayout}
        aria-hidden={isSidePanelLayout}
        className="h-full shrink-0 min-h-0 overflow-x-hidden overflow-y-auto transition-[width] duration-200 ease-out"
        style={{ width: isSidePanelLayout ? 0 : isNarrowWindow ? "100%" : "17rem" }}
      >
        <div
          className={cn(
            "mx-auto flex min-h-full w-full min-w-52 flex-col bg-background",
            isNarrowWindow ? "max-w-xl" : "border-r border-border-subtle"
          )}
        >
          <div className="flex shrink-0 flex-wrap gap-1 px-3 pt-3 pb-2">
            <button
              onClick={handleOpenNewNoteDialog}
              className={cn(
                "flex min-w-fit flex-1 items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium",
                "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
                "transition-colors duration-150",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
              )}
            >
              <SquarePen size={17} className="shrink-0" />
              {t("notes.sidebar.newNote")}
            </button>
            {onOpenSearch && (
              <button
                onClick={onOpenSearch}
                className={cn(
                  "flex min-w-fit flex-1 items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium",
                  "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
                  "transition-colors duration-150",
                  "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
                )}
              >
                <Search size={17} className="shrink-0" />
                {t("notes.sidebar.searchNotes")}
              </button>
            )}
            <button
              onClick={() => setShowActionManager(true)}
              className={cn(
                "flex min-w-fit flex-1 items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium",
                "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
                "transition-colors duration-150",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
              )}
            >
              <Sparkles size={17} className="shrink-0" />
              {t("notes.sidebar.actions")}
            </button>
          </div>

          {/* Folders */}
          <div className="flex items-center justify-between px-5 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("notes.folders.title")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCreatingFolder(true)}
              aria-label={t("notes.context.newFolder")}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            >
              <Plus size={17} />
            </Button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-1 px-3">
            {folders.map((folder) => {
              const isActive = folder.id === activeFolderId;
              const isMeetings = folder.name === MEETINGS_FOLDER_NAME;
              const count = folderCounts[folder.id] || 0;
              const isRenaming = renamingFolderId === folder.id;

              if (isRenaming) {
                return (
                  <div key={folder.id} className="px-2">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmRename();
                        if (e.key === "Escape") {
                          setRenamingFolderId(null);
                          setRenameValue("");
                        }
                      }}
                      onBlur={handleConfirmRename}
                      className={FOLDER_INPUT_CLASS}
                    />
                  </div>
                );
              }

              const isDragOver = dragState.dragOverFolderId === folder.id;
              const isDropSuccess = dragState.dropSuccessFolderId === folder.id;

              return (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolderId(folder.id)}
                  {...folderDropHandlers(folder.id, folder.name)}
                  className={cn(
                    "group relative flex items-center gap-3 w-full h-10 px-3 rounded-xl cursor-pointer text-left transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                    isActive
                      ? "bg-foreground/8 dark:bg-white/8"
                      : "hover:bg-foreground/4 dark:hover:bg-white/4",
                    isDragOver &&
                      !isMeetings &&
                      "bg-primary/12 dark:bg-primary/15 ring-1 ring-primary/25 scale-[1.02]",
                    isDropSuccess &&
                      "bg-neutral-500/10 dark:bg-neutral-400/10 ring-1 ring-neutral-500/20"
                  )}
                >
                  <FolderOpen
                    size={17}
                    className={cn(
                      "shrink-0 transition-colors duration-150",
                      isDragOver || isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm truncate flex-1 transition-colors duration-150",
                      isDragOver || isActive
                        ? "text-foreground font-medium"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {folder.name}
                  </span>

                  {isDropSuccess ? (
                    <Check
                      size={10}
                      className="text-neutral-500 dark:text-neutral-400 shrink-0 animate-[scale-in_200ms_ease-out]"
                    />
                  ) : (
                    <span
                      className={cn(
                        "text-xs tabular-nums shrink-0 transition-colors group-hover:opacity-0",
                        isActive ? "text-muted-foreground" : "text-muted-foreground"
                      )}
                    >
                      {count > 0 ? count : ""}
                    </span>
                  )}
                  {(!folder.is_default || noteFilesEnabled) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <MoreHorizontal size={16} />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4} className="min-w-32">
                        {noteFilesEnabled && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.electronAPI?.showFolderInExplorer?.(folder.name);
                            }}
                            className="text-xs gap-2 rounded-md px-2 py-1"
                          >
                            <ExternalLink size={11} className="text-muted-foreground/60" />
                            {t("notes.context.showInFileManager", { manager: fileManagerName })}
                          </DropdownMenuItem>
                        )}
                        {!folder.is_default && (
                          <>
                            {noteFilesEnabled && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingFolderId(folder.id);
                                setRenameValue(folder.name);
                              }}
                              className="text-xs gap-2 rounded-md px-2 py-1"
                            >
                              <Pencil size={11} className="text-muted-foreground/60" />
                              {t("notes.context.rename")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteFolder(folder);
                              }}
                              className="text-xs gap-2 rounded-md px-2 py-1 text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 size={11} />
                              {t("notes.context.delete")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </button>
              );
            })}

            {isCreatingFolder && (
              <div className="px-2">
                <input
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") {
                      setIsCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  onBlur={handleCreateFolder}
                  placeholder={t("notes.folders.folderName")}
                  className={cn(FOLDER_INPUT_CLASS, "placeholder:text-foreground/20")}
                />
              </div>
            )}
          </div>

          <div className="mx-5 my-2 h-px bg-border/30 dark:bg-white/8" />

          {/* Notes list */}
          <div className="flex items-center justify-between px-5 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("notes.list.title")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewNote}
              aria-label={t("notes.list.newNote")}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            >
              <Plus size={17} />
            </Button>
          </div>

          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={12} className="animate-spin text-foreground/15" />
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-4 text-center">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
                  <FileText size={20} strokeWidth={1.5} />
                </div>
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  {t("notes.empty.emptyFolder")}
                </p>
                <div className="flex w-full max-w-sm flex-wrap justify-center gap-2">
                  <button
                    onClick={handleNewNote}
                    className="flex h-10 min-w-fit flex-1 items-center justify-center gap-2 rounded-full bg-[#2449db] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1e3fc2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus size={16} />
                    {t("notes.empty.createNote")}
                  </button>
                  <button
                    onClick={() => setShowAddNotesDialog(true)}
                    className="flex h-10 min-w-fit flex-1 items-center justify-center rounded-full bg-foreground/5 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("notes.addToFolder.addExisting")}
                  </button>
                </div>
              </div>
            ) : (
              notes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  isActive={note.id === activeNoteId}
                  onClick={() => setActiveNoteId(note.id)}
                  onDelete={handleDelete}
                  folders={folders}
                  currentFolderId={activeFolderId}
                  onMoveToFolder={handleMoveToFolder}
                  onCreateFolderAndMove={handleCreateFolderAndMove}
                  dragHandlers={noteDragHandlers(note.id, note.title)}
                  isDragging={dragState.draggingNoteId === note.id}
                  noteFilesEnabled={noteFilesEnabled}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 min-h-0",
          isNarrowWindow && !activeNote && "hidden"
        )}
      >
        {editorNote ? (
          <>
            <NoteEditor
              key={editorNote.id}
              note={editorNote}
              onTitleChange={handleTitleChange}
              onContentChange={handleContentChange}
              isSaving={isSaving}
              isRecording={isActiveNoteRecording}
              isProcessing={false}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onExportNote={handleExportNote}
              onExportTranscript={handleExportTranscript}
              enhancement={
                localEnhancedContent
                  ? {
                      content: localEnhancedContent,
                      isStale: isEnhancementStale,
                      onChange: handleEnhancedContentChange,
                    }
                  : undefined
              }
              diarizationSessionId={diarizationSessionId}
              onLiveSpeakerLock={lockSpeaker}
              sessionDiarizationEnabled={sessionDiarizationEnabled}
              sessionExpectedCount={sessionExpectedCount}
              userTouchedStepper={userTouchedStepper}
              onSetSessionDiarizationEnabled={setSessionDiarizationEnabled}
              onSetSessionExpectedCount={setSessionExpectedCount}
              folderName={activeFolderName}
              calendarEventName={calendarEventName}
              folders={folders}
              onMoveToFolder={handleMoveToFolder}
              onCreateFolderAndMove={handleCreateFolderAndMove}
              actionProcessingState={actionProcessingState}
              actionName={actionName}
              actionPicker={
                <ActionPicker
                  onRunAction={(action) => {
                    if (!editorNote) return;
                    const { recordingNoteId: liveNoteId, transcript: liveTranscript } =
                      useMeetingRecordingStore.getState();
                    const rawTranscript =
                      (liveNoteId === activeNote?.id ? liveTranscript : "") ||
                      activeNoteRawTranscript;
                    const noteContent = editorNote.content;
                    const hasNotes = !!noteContent.trim();
                    if (!hasNotes && !rawTranscript) return;

                    let formattedTranscript = "";
                    let isMeetingNote = false;
                    if (rawTranscript) {
                      const segments = parseTranscriptSegments(rawTranscript);
                      if (segments.length > 0) {
                        isMeetingNote = true;
                        formattedTranscript = segments
                          .map(
                            (s) =>
                              `${s.source === "mic" ? t("notes.speaker.you") : t("notes.speaker.them")}: ${s.text}`
                          )
                          .join("\n");
                      }
                      if (!formattedTranscript) {
                        formattedTranscript = rawTranscript;
                      }
                    }

                    const parts = [
                      hasNotes ? noteContent : "",
                      formattedTranscript ? `## Meeting Transcript\n${formattedTranscript}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n\n");
                    runAction(action, parts, makeContentHash(`${noteContent}\n${rawTranscript}`), {
                      isCloudMode,
                      modelId: effectiveModelId,
                      isMeetingNote,
                      allowTitleGeneration: isRegenerableNoteTitle(
                        editorNote.title,
                        [
                          t("notes.list.untitledNote"),
                          t("notes.list.newNote"),
                          t("notes.sidebar.newNote"),
                        ],
                        calendarEventName
                      ),
                    });
                  }}
                  onManageActions={() => setShowActionManager(true)}
                  disabled={
                    (!editorNote?.content?.trim() &&
                      !hasLiveTranscript &&
                      !activeNoteRawTranscript) ||
                    actionProcessingState === "processing"
                  }
                />
              }
            />
            <ActionManagerDialog open={showActionManager} onOpenChange={setShowActionManager} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center -mt-6">
            <svg
              className="text-foreground dark:text-white mb-5"
              width="72"
              height="64"
              viewBox="0 0 72 64"
              fill="none"
            >
              <rect
                x="22"
                y="2"
                width="32"
                height="42"
                rx="3"
                transform="rotate(6 38 23)"
                fill="currentColor"
                fillOpacity={0.025}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <rect
                x="18"
                y="5"
                width="32"
                height="42"
                rx="3"
                transform="rotate(3 34 26)"
                fill="currentColor"
                fillOpacity={0.04}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <rect
                x="14"
                y="8"
                width="32"
                height="42"
                rx="3"
                fill="currentColor"
                fillOpacity={0.05}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <rect
                x="20"
                y="16"
                width="16"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.08}
              />
              <rect
                x="20"
                y="21"
                width="20"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.06}
              />
              <rect
                x="20"
                y="26"
                width="12"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.05}
              />
              <rect
                x="20"
                y="31"
                width="18"
                height="2"
                rx="1"
                fill="currentColor"
                fillOpacity={0.04}
              />
              <circle
                cx="54"
                cy="50"
                r="5"
                fill="currentColor"
                fillOpacity={0.03}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <path
                d="M51.5 50L53 51.5L56.5 48"
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {notes.length === 0 ? (
              <>
                <h3 className="text-xs font-semibold text-foreground/60 mb-1">
                  {t("notes.empty.title")}
                </h3>
                <p className="text-xs text-muted-foreground text-center max-w-55 mb-4">
                  {t("notes.empty.description")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNewNote}
                    className="flex items-center gap-1.5 px-4 h-7 rounded-full bg-primary/8 dark:bg-primary/10 border border-primary/12 dark:border-primary/15 text-xs font-medium text-primary/70 hover:bg-primary/12 hover:text-primary hover:border-primary/20 transition-colors"
                  >
                    <Plus size={11} />
                    {t("notes.empty.createNote")}
                  </button>
                  <button
                    onClick={() => setShowAddNotesDialog(true)}
                    className="flex items-center gap-1.5 px-4 h-7 rounded-full border border-foreground/8 dark:border-white/8 text-xs text-foreground/40 hover:text-foreground/60 hover:border-foreground/15 hover:bg-foreground/3 dark:hover:bg-white/3 transition-colors"
                  >
                    {t("notes.addToFolder.addExisting")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xs font-semibold text-foreground/60 mb-1">
                  {t("notes.empty.selectTitle")}
                </h3>
                <p className="text-xs text-muted-foreground text-center max-w-50">
                  {t("notes.empty.selectDescription")}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {activeFolderId && (
        <AddNotesToFolderDialog
          open={showAddNotesDialog}
          onOpenChange={setShowAddNotesDialog}
          targetFolderId={activeFolderId}
          onNotesAdded={handleNotesAdded}
        />
      )}

      <Dialog
        open={showNewNoteDialog}
        onOpenChange={(open) => {
          setShowNewNoteDialog(open);
          if (!open) {
            setIsCreatingNewNoteFolder(false);
            setNewNoteFolderName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-95 p-6 gap-5">
          <DialogHeader>
            <DialogTitle>
              {isCreatingNewNoteFolder ? t("notes.upload.newFolder") : t("notes.sidebar.newNote")}
            </DialogTitle>
          </DialogHeader>

          {isCreatingNewNoteFolder ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/50">
                {t("notes.upload.folderName")}
              </label>
              <Input
                value={newNoteFolderName}
                onChange={(e) => setNewNoteFolderName(e.target.value)}
                placeholder={t("notes.folders.folderName")}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateNewNoteFolder();
                }}
              />
            </div>
          ) : (
            folders.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/50">
                  {t("notes.folders.title")}
                </label>
                <Select value={newNoteFolderId} onValueChange={handleNewNoteFolderChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("notes.upload.selectFolder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value="__create_new__">
                      <span className="flex items-center gap-1.5 text-primary/60">
                        <Plus size={13} />
                        {t("notes.upload.newFolder")}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )
          )}

          <DialogFooter>
            {isCreatingNewNoteFolder ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingNewNoteFolder(false);
                    setNewNoteFolderName("");
                  }}
                >
                  {t("common.back")}
                </Button>
                <Button onClick={handleCreateNewNoteFolder} disabled={!newNoteFolderName.trim()}>
                  {t("notes.upload.create")}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowNewNoteDialog(false)}>
                  {t("notes.upload.cancel")}
                </Button>
                <Button onClick={handleConfirmNewNote} disabled={!newNoteFolderId}>
                  {t("notes.upload.create")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
