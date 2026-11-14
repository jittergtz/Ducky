import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, PencilLine } from "lucide-react";
import { HotkeyListInput } from "../ui/HotkeyListInput";
import { formatHotkeyLabel } from "../../utils/hotkeys";
import { getPlatform } from "../../utils/platform";

export default function FeatureIntroStep({
  kind,
  dictationHotkey,
}: {
  kind: "dictation" | "grammar";
  dictationHotkey: string;
}) {
  const { t } = useTranslation();
  const [hotkey, setHotkey] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isMac = getPlatform() === "darwin";

  useEffect(() => {
    if (kind !== "grammar" || !isMac) return;
    let active = true;
    window.electronAPI.getGrammarCorrectionSettings().then(
      (settings) => {
        if (active) {
          setHotkey(settings.hotkey);
          setReady(true);
        }
      },
      () => {
        if (active) setError(t("grammarCorrection.loadFailed"));
      }
    );
    return () => {
      active = false;
    };
  }, [kind, isMac, t]);

  async function saveHotkey(value: string) {
    setBusy(true);
    setError("");
    try {
      const result = await window.electronAPI.setGrammarCorrectionHotkey(value);
      if (!result.success) throw new Error(result.message || t("grammarCorrection.saveFailed"));
      setHotkey(value);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("grammarCorrection.saveFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[350px] flex flex-col">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
          {kind === "dictation" ? <AudioLines size={20} /> : <PencilLine size={20} />}
        </span>
        <h2 className="!text-[22px] !font-medium tracking-tight text-foreground">
          {t(`onboarding.featureIntro.${kind}Title`)}
        </h2>
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 py-9">
        {kind === "dictation" ? (
          <>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t("onboarding.featureIntro.dictationDescription")}
            </p>
            <div className="rounded-[18px] bg-neutral-100 px-5 py-4 text-sm leading-relaxed text-foreground dark:bg-white/[0.07]">
              {t("onboarding.featureIntro.dictationExample")}
            </div>
            <div className="space-y-2">
              <span className="text-sm text-foreground">
                {t("onboarding.featureIntro.dictationShortcut")}
              </span>
              <div className="rounded-[16px] bg-neutral-100 px-4 py-3 text-center text-sm font-medium text-foreground dark:bg-white/[0.07]">
                {formatHotkeyLabel(dictationHotkey)}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t("onboarding.featureIntro.grammarDescription")}
            </p>
            <textarea
              key={t("onboarding.featureIntro.grammarExample")}
              defaultValue={t("onboarding.featureIntro.grammarExample")}
              aria-label={t("onboarding.featureIntro.exampleLabel")}
              className="min-h-[92px] w-full resize-y rounded-[18px] border border-transparent bg-neutral-100 p-4 text-sm leading-relaxed text-foreground outline-none focus-visible:border-neutral-400 dark:bg-white/[0.07] selection:bg-blue-600/60"
            />
            {isMac ? (
              <div className="space-y-2">
                <span className="text-sm text-foreground">
                  {t("onboarding.featureIntro.grammarShortcut")}
                </span>
                <HotkeyListInput
                  value={hotkey}
                  onChange={saveHotkey}
                  onClear={() => saveHotkey("")}
                  disabled={busy || !ready}
                  maxHotkeys={1}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("onboarding.featureIntro.grammarSetupHint")}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("onboarding.featureIntro.grammarMacOnly")}
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
