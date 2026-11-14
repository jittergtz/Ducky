const test = require("node:test");
const assert = require("node:assert/strict");
const { migrateOnboardingStep } = require("../../src/utils/onboardingStepMigration.ts");

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("in-progress onboarding resumes at its original step after introduction pages are added", () => {
  const saved = storage({ onboardingCurrentStep: "3" });
  migrateOnboardingStep(saved, 9);
  assert.equal(saved.getItem("onboardingCurrentStep"), "5");
  migrateOnboardingStep(saved, 9);
  assert.equal(saved.getItem("onboardingCurrentStep"), "5");
});

test("fresh, completed and restarted onboarding are not moved forward", () => {
  for (const initial of [
    {},
    { onboardingCurrentStep: "0" },
    { onboardingCompleted: "true", onboardingCurrentStep: "3" },
  ]) {
    const saved = storage(initial);
    migrateOnboardingStep(saved, 9);
    assert.equal(saved.getItem("onboardingCurrentStep"), initial.onboardingCurrentStep ?? null);
  }
  const restarted = storage({ onboardingCurrentStep: "0", onboardingFeatureIntroVersion: "2" });
  migrateOnboardingStep(restarted, 9);
  assert.equal(restarted.getItem("onboardingCurrentStep"), "0");
});

test("unavailable storage does not prevent onboarding from opening", () => {
  assert.doesNotThrow(() =>
    migrateOnboardingStep(
      {
        getItem: () => {
          throw new Error("denied");
        },
      },
      9
    )
  );
});
