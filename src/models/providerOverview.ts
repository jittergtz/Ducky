import { INFERENCE_SCOPES, type InferenceScope } from "../config/inferenceScopes";
import {
  selectResolvedLLMConfig,
  selectResolvedMeetingTranscription,
  selectResolvedUploadTranscription,
  type SettingsState,
} from "../stores/settingsStore";
import type { NoteRecordingProvider } from "../stores/streamingProvidersStore";
import {
  getBatchTranscriptionModel,
  getDefaultTranscriptionModel,
  getParakeetModelInfo,
  getTranscriptionModels,
  getWhisperModelInfo,
  modelRegistry,
  REASONING_PROVIDERS,
  resolveInferenceProvider,
} from "./ModelRegistry";
import qwenModels from "./qwenModels.json";

export const CHATGPT_PROVIDER = "chatgpt-subscription";

export interface ProviderTask {
  label: string;
  settings: string;
  provider: string;
  model?: string;
  modelLabel?: string;
  off?: boolean;
}

export function getLanguageTasks(state: SettingsState): ProviderTask[] {
  const disabled: Partial<Record<InferenceScope, boolean>> = {
    dictationCleanup: !state.useCleanupModel,
    dictationAgent: !state.useDictationAgent,
    dictationTranslation: !state.useDictationTranslation,
  };

  return (Object.keys(INFERENCE_SCOPES) as InferenceScope[]).map((scope) => {
    const { mode, provider, model } = selectResolvedLLMConfig(state, scope);
    const task = {
      label: `settingsPage.llms.tabs.${scope}`,
      settings: scope,
      off: disabled[scope],
    };
    if (mode === "openwhispr" || mode === "spoken") return { ...task, provider: "spoken" };
    if (mode === "self-hosted") return { ...task, provider: mode, model };
    if (mode === "local") {
      return {
        ...task,
        provider: "local",
        model,
        modelLabel: modelRegistry.getModel(model)?.model.name,
      };
    }
    const id = provider || (model ? resolveInferenceProvider(undefined, model) : "");
    return {
      ...task,
      provider: id,
      model,
      modelLabel: REASONING_PROVIDERS[id]?.models.find((entry) => entry.value === model)?.label,
    };
  });
}

function localSpeech({
  localTranscriptionProvider,
  qwenModel,
  parakeetModel,
  whisperModel,
}: Pick<
  SettingsState,
  "localTranscriptionProvider" | "qwenModel" | "parakeetModel" | "whisperModel"
>) {
  if (localTranscriptionProvider === "qwen") {
    return qwenModels[qwenModel as keyof typeof qwenModels]?.name ?? qwenModel;
  }
  if (localTranscriptionProvider === "nvidia") {
    return getParakeetModelInfo(parakeetModel)?.name ?? parakeetModel;
  }
  return `Whisper ${getWhisperModelInfo(whisperModel)?.name ?? whisperModel}`;
}

function cloudSpeech(provider: string, model: string) {
  return {
    provider,
    model,
    modelLabel: getTranscriptionModels(provider).find((entry) => entry.id === model)?.name,
  };
}

export function getSpeechTasks(
  state: SettingsState,
  catalog: NoteRecordingProvider[] | null
): ProviderTask[] {
  const recording = selectResolvedMeetingTranscription(state);
  const upload = selectResolvedUploadTranscription(state);
  const selectedRecordingProvider =
    state.meetingCloudTranscriptionProvider || state.cloudTranscriptionProvider;
  const streamingProvider = catalog?.find(
    (provider) => provider.id === recording.cloudTranscriptionProvider
  );
  const streamingModel =
    streamingProvider?.models.find((model) => model.id === recording.cloudTranscriptionModel) ??
    streamingProvider?.models.find((model) => model.default) ??
    streamingProvider?.models[0];
  const speech = [
    { config: state, tab: "dictation", settings: "transcription" },
    { config: recording, tab: "noteRecording", settings: "noteRecording" },
    { config: upload, tab: "upload", settings: "uploadTranscription" },
  ];

  return speech.map(({ config, tab, settings }) => {
    const task = { label: `settingsPage.speechToText.tabs.${tab}`, settings };
    const {
      transcriptionMode: mode,
      cloudTranscriptionProvider: provider,
      cloudTranscriptionModel: model,
    } = config;
    if (mode === "local") return { ...task, provider: "local", model: localSpeech(config) };
    if (mode === "self-hosted")
      return {
        ...task,
        provider: mode,
        model: tab === "noteRecording" ? undefined : state.remoteTranscriptionModel,
      };
    if (mode === "openwhispr" || mode === "spoken") return { ...task, provider: "spoken" };
    if (tab === "noteRecording") {
      return selectedRecordingProvider === "corti"
        ? { ...task, ...cloudSpeech("corti", "corti-transcribe") }
        : {
            ...task,
            ...cloudSpeech(provider || "openai", streamingModel?.id ?? "gpt-4o-mini-transcribe"),
            ...(streamingModel && { modelLabel: streamingModel.name }),
          };
    }
    const batchModel =
      tab === "upload" || provider === "tinfoil" ? getBatchTranscriptionModel(provider) : undefined;
    return {
      ...task,
      ...cloudSpeech(provider, batchModel || model || getDefaultTranscriptionModel(provider)),
    };
  });
}

export function getProviderStatuses(state: SettingsState) {
  const keys = {
    openai: state.openaiApiKey,
    anthropic: state.anthropicApiKey,
    gemini: state.geminiApiKey,
    groq: state.groqApiKey,
    openrouter: state.openrouterApiKey,
    tinfoil: state.tinfoilApiKey,
    mistral: state.mistralApiKey,
    xai: state.xaiApiKey,
  };
  const statuses: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(keys).map(([provider, key]) => [
      provider,
      key ? "providers.keySaved" : undefined,
    ])
  );
  statuses.corti =
    state.cortiApiKey || (state.cortiClientId && state.cortiClientSecret)
      ? "providers.credentialsSaved"
      : undefined;
  statuses.azure =
    state.azureEndpoint && state.azureApiKey ? "providers.credentialsSaved" : undefined;
  statuses.bedrock =
    state.bedrockProfile || (state.bedrockAccessKeyId && state.bedrockSecretAccessKey)
      ? "providers.credentialsSaved"
      : undefined;
  statuses.vertex = state.vertexProject ? "providers.configured" : undefined;
  statuses.spoken = state.isSignedIn ? "providers.connected" : undefined;
  return statuses;
}
