import { useCallback, useEffect, useState } from "react";

type Account = Awaited<ReturnType<Window["electronAPI"]["chatgptSubscriptionStatus"]>>;
type Models = Awaited<ReturnType<Window["electronAPI"]["chatgptSubscriptionModels"]>>;

export function useChatgptSubscription(enabled = true) {
  const [account, setAccount] = useState<Account>();
  const [models, setModels] = useState<Models>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(false);

    async function load() {
      try {
        const status = await window.electronAPI.chatgptSubscriptionStatus();
        if (!active) return;
        setAccount(status);
        setModels([]);
        if (!status.connected) return;
        const catalog = await window.electronAPI.chatgptSubscriptionModels();
        if (active) setModels(catalog);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [enabled, revision]);

  return { account, models, loading, error, reload };
}
