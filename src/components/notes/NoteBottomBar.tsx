import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mic, ArrowUp, Square, Loader2 } from "lucide-react";
import { formatMmSs } from "../../utils/formatDuration";

interface NoteBottomBarProps {
  isRecording: boolean;
  isProcessing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onAskSubmit: (text: string) => void;
  askDisabled?: boolean;
  actionPicker?: React.ReactNode;
  hideInput?: boolean;
}

export default function NoteBottomBar({
  isRecording,
  isProcessing,
  onStartRecording,
  onStopRecording,
  onAskSubmit,
  askDisabled,
  actionPicker,
  hideInput,
}: NoteBottomBarProps) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording) return;
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  return (
    <div className="note-bottom-bar shrink-0 border-t border-border-subtle bg-background px-5 py-3">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isProcessing}
          aria-label={isRecording ? t("notes.editor.stop") : t("notes.editor.transcribe")}
          title={isRecording ? t("notes.editor.stop") : t("notes.editor.transcribe")}
          className="flex h-9 min-w-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-surface-1 px-2.5 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : isRecording ? (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
              <span className="text-xs tabular-nums">{formatMmSs(elapsed)}</span>
              <Square size={11} fill="currentColor" />
            </>
          ) : (
            <Mic size={15} />
          )}
        </button>
        {!hideInput && (
          <form
            className="flex h-9 min-w-32 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 focus-within:ring-2 focus-within:ring-ring/40"
            onSubmit={(event) => {
              event.preventDefault();
              const text = inputText.trim();
              if (!text || askDisabled) return;
              onAskSubmit(text);
              setInputText("");
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              disabled={askDisabled}
              aria-label={t("embeddedChat.askPlaceholder")}
              placeholder={t("embeddedChat.askPlaceholder")}
              className="input-inline min-w-0 flex-1 bg-transparent p-0 text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            {inputText.trim() && (
              <button
                type="submit"
                disabled={askDisabled}
                aria-label={t("embeddedChat.send")}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-background hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <ArrowUp size={13} />
              </button>
            )}
          </form>
        )}
        {actionPicker && <div className="ml-auto shrink-0">{actionPicker}</div>}
      </div>
    </div>
  );
}
