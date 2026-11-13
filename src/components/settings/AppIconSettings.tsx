import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppIconId, AppIconState } from "../../types/electron";
import { getPlatform } from "../../utils/platform";
import classicIcon from "../../assets/icon.png";
import glacierIcon from "../../assets/app-icons/DuckyR2G.png";
import roseIcon from "../../assets/app-icons/DuckyR1G.png";

const icons = [
  { id: "classic", image: classicIcon },
  { id: "glacier", image: glacierIcon },
  { id: "rose", image: roseIcon },
] as const;

export default function AppIconSettings() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppIconState | null>(null);
  const [pending, setPending] = useState<AppIconId | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    if (!window.electronAPI?.getAppIcon) {
      setState({ selectedIcon: "classic", supported: false });
      return;
    }
    const unsubscribe = window.electronAPI.onAppIconChanged((next) => {
      if (active) setState(next);
    });
    window.electronAPI.getAppIcon().then(
      (next) => {
        if (active) setState(next);
      },
      () => {
        if (active) setError(true);
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [reload]);

  const selectIcon = async (iconId: AppIconId) => {
    if (pending || !state?.supported || state.selectedIcon === iconId) return;
    setPending(iconId);
    setError(false);
    try {
      const result = await window.electronAPI.setAppIcon(iconId);
      setState(result);
      if (!result.success) setError(true);
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p id="app-icon-label" className="text-xs font-medium text-foreground">
          {t("appIcon.title")}
        </p>
        <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed">
          {t(getPlatform() === "darwin" ? "appIcon.macDescription" : "appIcon.windowDescription")}
        </p>
      </div>
      <div
        role="group"
        aria-labelledby="app-icon-label"
        aria-busy={!!pending || (!state && !error)}
        className="flex flex-wrap gap-2"
      >
        {icons.map((icon) => {
          const selected = state?.selectedIcon === icon.id;
          return (
            <button
              key={icon.id}
              type="button"
              aria-pressed={selected}
              disabled={!state?.supported || !!pending}
              onClick={() => void selectIcon(icon.id)}
              className={`relative flex w-24 flex-col items-center gap-2 rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-primary bg-primary/10 dark:border-border-active dark:bg-white/5" : "border-border/60 hover:bg-muted/60"}`}
            >
              <img src={icon.image} alt="" className="h-14 w-14 object-contain" draggable={false} />
              <span className="text-xs font-medium text-foreground">{t(`appIcon.${icon.id}`)}</span>
              {pending === icon.id ? (
                <Loader2
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-3.5 w-3.5 animate-spin text-active-icon"
                />
              ) : selected ? (
                <Check
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-active-icon"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground/80 leading-relaxed">
        {state?.supported === false ? t("appIcon.unsupported") : t("appIcon.installedNote")}
      </p>
      {error && (
        <div role="alert" className="text-xs text-destructive">
          {t("appIcon.error")}
          {!state && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setReload((value) => value + 1)}
            >
              {t("appIcon.retry")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
