import { useTranslation } from "react-i18next";
import { Archive, Loader2, Trash2 } from "lucide-react";
import type { TranscriptionItem as TranscriptionItemType } from "../types/electron";
import { useSettingsStore } from "../stores/settingsStore";
import { formatHotkeyListLabel } from "../utils/hotkeys";
import dictationIcon from "../assets/icons/sidebar/dictation.png";
import HistoryList from "./HistoryList";
import TranscriptionItem from "./ui/TranscriptionItem";

interface DictationHistoryViewProps {
  items: TranscriptionItemType[];
  loading: boolean;
  hotkey: string;
  showDiscarded: boolean;
  onToggleDiscarded: () => void;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
  onClear: () => void;
  onShowAudioInFolder: (id: number) => void;
  onRetry: (id: number, options?: { isRecover?: boolean }) => Promise<void>;
  onOpenSettings: () => void;
}

export default function DictationHistoryView({
  items,
  loading,
  hotkey,
  showDiscarded,
  onToggleDiscarded,
  onCopy,
  onDelete,
  onClear,
  onShowAudioInFolder,
  onRetry,
  onOpenSettings,
}: DictationHistoryViewProps) {
  const { t } = useTranslation();
  const retentionEnabled = useSettingsStore((s) => s.dataRetentionEnabled);
  const discardedToggle = (
    <button
      onClick={onToggleDiscarded}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground/60 hover:!text-foreground hover:!bg-black/5 dark:hover:!bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 transition-colors"
    >
      <Archive size={11} />
      {t(
        showDiscarded
          ? "controlPanel.history.discarded.hide"
          : "controlPanel.history.discarded.show"
      )}
    </button>
  );
  return (
    <div className="px-4 pt-4 pb-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2.5 mb-4">
          <img src={dictationIcon} alt="" className="size-7" />
          <div>
            <h1 className="text-sm font-semibold text-foreground">{t("dictationHistory.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("dictationHistory.description")}</p>
          </div>
        </div>
        {!retentionEnabled && (
          <p className="mb-3 rounded-lg bg-card/50 px-3.5 py-2.5 text-xs text-muted-foreground">
            {t("controlPanel.history.dataRetentionDisabled")}
          </p>
        )}
        {loading && items.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 dark:border-white/10 dark:bg-white/[0.08] flex items-center justify-center gap-2 py-8">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t("controlPanel.loading")}</span>
          </div>
        ) : items.length === 0 ? (
          <>
            <div className="mb-2 flex justify-end">{discardedToggle}</div>
            <div className="rounded-lg border border-border bg-card/50 dark:border-white/10 dark:bg-white/[0.08] flex flex-col items-center justify-center py-16 px-4">
              <img src={dictationIcon} alt="" className="size-16 mb-5" />
              <h3 className="text-xs font-semibold text-foreground/70 dark:text-foreground/80 mb-2">
                {t("dictationHistory.empty")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("dictationHistory.emptyHint")}
                {hotkey && (
                  <kbd className="ml-2 inline-flex items-center h-5 px-1.5 rounded-sm bg-surface-1 dark:bg-white/10 border border-border/50 font-mono">
                    {formatHotkeyListLabel(hotkey)}
                  </kbd>
                )}
              </p>
            </div>
          </>
        ) : (
          <HistoryList
            items={items}
            actions={
              <>
                {discardedToggle}
                <button
                  onClick={onClear}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground/60 hover:!text-destructive hover:!bg-destructive/8 dark:hover:!bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 transition-colors"
                >
                  <Trash2 size={11} />
                  {t("controlPanel.history.clearAll")}
                </button>
              </>
            }
            renderItem={(item) => (
              <TranscriptionItem
                item={item}
                onCopy={onCopy}
                onDelete={onDelete}
                onShowAudioInFolder={onShowAudioInFolder}
                onRetryTranscription={onRetry}
                onOpenSettings={onOpenSettings}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
