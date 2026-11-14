/** Keep an in-progress wizard on the same existing step after adding two introductions. */
export function migrateOnboardingStep(storage: Storage, maxStep: number): void {
  try {
    const versionKey = "onboardingFeatureIntroVersion";
    if (storage.getItem(versionKey) === "2") return;
    const oldStep = Number.parseInt(storage.getItem("onboardingCurrentStep") || "0", 10);
    if (
      Number.isFinite(oldStep) &&
      oldStep > 0 &&
      storage.getItem("onboardingCompleted") !== "true"
    ) {
      storage.setItem("onboardingCurrentStep", String(Math.min(oldStep + 2, maxStep)));
    }
    storage.setItem(versionKey, "2");
  } catch {
    // Follow useLocalStorage's fallback when storage is unavailable.
  }
}
