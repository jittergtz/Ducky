import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ExternalLink, Plug } from "lucide-react";
import { useChatgptSubscription } from "../hooks/useChatgptSubscription";
import { getProviderDisplayName, getTranscriptionProvider } from "../models/ModelRegistry";
import {
  CHATGPT_PROVIDER,
  getLanguageTasks,
  getProviderStatuses,
  getSpeechTasks,
  type ProviderTask,
} from "../models/providerOverview";
import { useSettingsStore } from "../stores/settingsStore";
import { useStreamingProvidersStore } from "../stores/streamingProvidersStore";
import { createExternalLinkHandler } from "../utils/externalLinks";
import { getCachedPlatform } from "../utils/platform";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ProviderIcon } from "./ui/ProviderIcon";

const CHATGPT_USAGE = "https://chatgpt.com/settings/usage";
const PANEL = "rounded-xl border border-border/60 bg-card/55 dark:bg-surface-2/50";
const TASK_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_1.75rem]";

function useProviderName() {
  const { t } = useTranslation();
  return (id: string) => {
    switch (id) {
      case CHATGPT_PROVIDER:
        return t("providers.chatgpt.name");
      case "spoken":
        return t("settingsPage.transcription.modes.spoken");
      case "self-hosted":
        return t("settingsPage.transcription.modes.selfHosted");
      case "local":
        return t("common.local");
      case "custom":
        return t("reasoning.custom.providerName");
      default:
        return getTranscriptionProvider(id)?.name || getProviderDisplayName(id);
    }
  };
}

function TaskGroup({
  title,
  tasks,
  onEdit,
}: {
  title: string;
  tasks: ProviderTask[];
  onEdit: (section: string) => void;
}) {
  const { t } = useTranslation();
  const providerName = useProviderName();

  return (
    <div className={`${PANEL} @container overflow-hidden`}>
      <div className="border-b border-border/50 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div
        className={`${TASK_COLUMNS} hidden @lg:grid bg-muted/35 text-xs text-muted-foreground`}
        aria-hidden="true"
      >
        <span>{t("providers.task")}</span>
        <span>{t("sidebar.provider")}</span>
        <span>{t("common.model")}</span>
      </div>
      <ul className="divide-y divide-border/45">
        {tasks.map(({ label, settings, provider, model, modelLabel, off }) => (
          <li key={label} className={`grid ${TASK_COLUMNS}`}>
            <div className="col-start-1 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium">{t(label)}</span>
              {off && <Badge variant="outline">{t("providers.off")}</Badge>}
            </div>
            <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground @lg:col-start-2 @lg:row-start-1">
              {provider && (
                <span className="shrink-0" aria-hidden="true">
                  <ProviderIcon provider={provider} className="size-3.5" />
                </span>
              )}
              <span className="min-w-0 break-words">
                {provider ? providerName(provider) : t("providers.noProvider")}
              </span>
            </div>
            <span className="col-start-1 row-start-3 min-w-0 break-words text-xs text-foreground/80 @lg:col-start-3 @lg:row-start-1">
              {modelLabel ||
                model ||
                t(
                  provider === "spoken" || provider === "self-hosted"
                    ? "providers.providerDefault"
                    : "providers.noModel"
                )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="col-start-2 row-start-1 size-7 @lg:col-start-4"
              title={t("providers.editTask", { task: t(label) })}
              aria-label={t("providers.editTask", { task: t(label) })}
              onClick={() => onEdit(settings)}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type GrammarSettings = Awaited<ReturnType<Window["electronAPI"]["getGrammarCorrectionSettings"]>>;

export default function ProviderView({
  onOpenSettings,
  settingsOpen,
  cloudEmail,
}: {
  onOpenSettings: (section: string) => void;
  settingsOpen: boolean;
  cloudEmail?: string | null;
}) {
  const { t } = useTranslation();
  const providerName = useProviderName();
  const settings = useSettingsStore();
  const catalog = useStreamingProvidersStore((s) => s.providers);
  const { account, models, loading, error, reload } = useChatgptSubscription();
  const [action, setAction] = useState<"connect" | "disconnect">();
  const [notice, setNotice] = useState("");
  const [grammar, setGrammar] = useState<GrammarSettings>();
  const [grammarError, setGrammarError] = useState(false);
  const hasGrammar = getCachedPlatform() === "darwin";

  useEffect(() => {
    if (action) return;
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [action, reload]);

  useEffect(() => {
    if (!hasGrammar || settingsOpen) return;
    let active = true;
    const load = () => {
      void window.electronAPI.getGrammarCorrectionSettings().then(
        (value) => {
          if (active) {
            setGrammar(value);
            setGrammarError(false);
          }
        },
        () => {
          if (active) setGrammarError(true);
        }
      );
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [hasGrammar, settingsOpen]);

  const connected = account?.connected;
  const changeConnection = async () => {
    setAction(connected ? "disconnect" : "connect");
    setNotice("");
    try {
      if (connected) {
        const result = await window.electronAPI.chatgptSubscriptionDisconnect();
        if (!result.success) throw new Error(t("providers.chatgpt.connectionFailed"));
        if (result.revoked === false) setNotice(t("providers.chatgpt.revocationUnknown"));
      } else {
        await window.electronAPI.chatgptSubscriptionSignIn();
      }
      reload();
    } catch (cause) {
      const fallback = t("providers.chatgpt.connectionFailed");
      setNotice(
        cause instanceof Error
          ? cause.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "") ||
              fallback
          : fallback
      );
    } finally {
      setAction(undefined);
    }
  };

  const languageTasks = getLanguageTasks(settings);
  if (hasGrammar) {
    languageTasks.splice(1, 0, {
      label: "grammarCorrection.title",
      settings: "hotkeys",
      provider: CHATGPT_PROVIDER,
      model: grammar?.model,
      modelLabel: !grammar ? t(grammarError ? "common.unknown" : "common.loading") : undefined,
      off: grammar && !grammar.hotkey,
    });
  }
  for (const task of languageTasks) {
    if (task.provider !== CHATGPT_PROVIDER || !task.model) continue;
    task.modelLabel = models.find((model) => model.value === task.model)?.label || task.modelLabel;
  }
  const speechTasks = getSpeechTasks(settings, catalog);
  const statuses = getProviderStatuses(settings);
  const allTasks = [...languageTasks, ...speechTasks];
  const otherProviders = [
    ...new Set([
      ...allTasks.filter((task) => !task.off).map((task) => task.provider),
      ...Object.keys(statuses).filter((provider) => statuses[provider]),
    ]),
  ].filter((id) => id && id !== CHATGPT_PROVIDER && id !== "local");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7 px-5 pb-10 pt-5 sm:px-8">
      <header className="flex items-start gap-3.5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground/75"
          aria-hidden="true"
        >
          <Plug size={20} />
        </span>
        <div>
          <h1 className="text-3xl! font-semibold! tracking-tight">{t("sidebar.provider")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("providers.description")}</p>
        </div>
      </header>

      <section aria-labelledby="provider-connections" className="space-y-3">
        <h2 id="provider-connections" className="text-sm font-semibold">
          {t("providers.connections")}
        </h2>
        <div className={`${PANEL} overflow-hidden`}>
          <div className="flex items-start gap-3.5 px-4 py-4 sm:px-5">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"
              aria-hidden="true"
            >
              <ProviderIcon provider={CHATGPT_PROVIDER} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{providerName(CHATGPT_PROVIDER)}</h3>
                <Badge variant={connected ? "success" : "outline"} role="status">
                  {t(
                    connected
                      ? "providers.connected"
                      : account
                        ? "providers.notConnected"
                        : error
                          ? "common.unknown"
                          : "common.loading"
                  )}
                </Badge>
              </div>
              {connected && account.email && (
                <p className="mt-1 break-words text-sm text-foreground/85">{account.email}</p>
              )}
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("providers.chatgpt.description")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-4 py-3 sm:px-5">
            <Button
              type="button"
              size="sm"
              variant={connected ? "outline-flat" : "default"}
              className={
                connected
                  ? "rounded-full px-3.5 text-foreground/85 hover:text-foreground"
                  : undefined
              }
              disabled={!!action || (!account && loading)}
              onClick={changeConnection}
            >
              {t(
                action === "connect"
                  ? "providers.chatgpt.connecting"
                  : action === "disconnect"
                    ? "providers.chatgpt.disconnecting"
                    : connected
                      ? "providers.chatgpt.disconnect"
                      : "grammarCorrection.signIn"
              )}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a
                href={CHATGPT_USAGE}
                onClick={createExternalLinkHandler(CHATGPT_USAGE)}
                target="_blank"
                rel="noreferrer"
              >
                {t("grammarCorrection.manageUsage")}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
            {error && (
              <Button type="button" size="sm" variant="ghost" onClick={reload}>
                {t("common.retry")}
              </Button>
            )}
            {action === "connect" && (
              <p className="basis-full text-xs text-muted-foreground" role="status">
                {t("providers.chatgpt.browserHint")}
              </p>
            )}
            {(notice || error) && (
              <p role="alert" className="basis-full text-xs text-destructive">
                {notice || t("providers.chatgpt.loadFailed")}
              </p>
            )}
          </div>
        </div>

        {otherProviders.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {otherProviders.map((id) => {
              const status =
                statuses[id] ||
                {
                  "self-hosted": "providers.selfHosted",
                  custom: "providers.customEndpoint",
                  spoken: "providers.notConnected",
                }[id] ||
                "providers.setupNeeded";
              return (
                <li key={id} className={`${PANEL} flex min-w-0 items-center gap-3 px-3.5 py-3`}>
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/70"
                    aria-hidden="true"
                  >
                    <ProviderIcon provider={id} className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{providerName(id)}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {id === "spoken" && settings.isSignedIn && cloudEmail
                        ? cloudEmail
                        : t(status)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="provider-models" className="space-y-3">
        <div>
          <h2 id="provider-models" className="text-sm font-semibold">
            {t("providers.modelsByTask")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("providers.modelsByTaskDescription")}
          </p>
        </div>
        <TaskGroup
          title={t("settingsPage.llms.title")}
          tasks={languageTasks}
          onEdit={onOpenSettings}
        />
        <TaskGroup
          title={t("settingsPage.speechToText.title")}
          tasks={speechTasks}
          onEdit={onOpenSettings}
        />
      </section>
    </div>
  );
}
