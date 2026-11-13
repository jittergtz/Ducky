import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatgptSubscription } from "../../hooks/useChatgptSubscription";
import { HotkeyListInput } from "../ui/HotkeyListInput";
import { ProviderSettingsLink } from "../ui/ProviderSettingsLink";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SectionHeader, SettingsPanel, SettingsPanelRow, SettingsRow } from "../ui/SettingsSection";

type Settings = Awaited<ReturnType<Window["electronAPI"]["getGrammarCorrectionSettings"]>>;

export default function GrammarCorrectionSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings>();
  const { account, models, loading, error: catalogError } = useChatgptSubscription();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const api = window.electronAPI;

  useEffect(() => {
    let active = true;
    void api.getGrammarCorrectionSettings().then(
      (value) => {
        if (active) setSettings(value);
      },
      () => {
        if (active) setError(t("grammarCorrection.loadFailed"));
      }
    );
    return () => {
      active = false;
    };
  }, [api, t]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("grammarCorrection.saveFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const updateHotkey = (hotkey: string) =>
    run(async () => {
      const result = await api.setGrammarCorrectionHotkey(hotkey);
      if (!result.success) throw new Error(result.message || t("grammarCorrection.saveFailed"));
      setSettings((current) => current && { ...current, hotkey, registrationError: "" });
    });

  const updateModel = (model: string) =>
    run(async () => {
      const result = await api.setGrammarCorrectionModel(model);
      if (!result.success) throw new Error(result.message || t("grammarCorrection.saveFailed"));
      setSettings((current) => current && { ...current, model });
    });

  const selected = models.find((model) => model.value === settings?.model);

  return (
    <div className="space-y-3">
      <SectionHeader
        title={t("grammarCorrection.title")}
        description={t("grammarCorrection.description")}
      />
      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("grammarCorrection.shortcut")}
            description={t("grammarCorrection.shortcutHint")}
          >
            <HotkeyListInput
              value={settings?.hotkey || ""}
              onChange={updateHotkey}
              onClear={() => updateHotkey("")}
              disabled={busy || !settings}
              maxHotkeys={1}
            />
          </SettingsRow>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <SettingsRow
            label={t("grammarCorrection.account")}
            description={t(
              catalogError
                ? "providers.chatgpt.loadFailed"
                : loading
                  ? "providers.chatgpt.loading"
                  : account?.connected
                    ? "providers.chatgpt.connectedHint"
                    : "providers.chatgpt.connectHint"
            )}
          >
            <ProviderSettingsLink />
          </SettingsRow>
        </SettingsPanelRow>
        <SettingsPanelRow>
          <SettingsRow
            label={t("grammarCorrection.model")}
            description={t(
              settings?.model && models.length && !selected
                ? "grammarCorrection.modelUnavailable"
                : "grammarCorrection.modelHint"
            )}
          >
            <Select
              value={selected?.value || ""}
              onValueChange={updateModel}
              disabled={busy || !settings || !models.length}
            >
              <SelectTrigger className="min-w-44" aria-label={t("grammarCorrection.model")}>
                <SelectValue placeholder={t("grammarCorrection.selectModel")} />
              </SelectTrigger>
              <SelectContent>
                {models.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsPanelRow>
      </SettingsPanel>
      {(error || settings?.registrationError) && (
        <p role="alert" className="text-sm text-destructive">
          {error || settings?.registrationError}
        </p>
      )}
    </div>
  );
}
