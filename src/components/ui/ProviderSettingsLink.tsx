import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
import { ProviderNavigationContext } from "../../hooks/providerNavigation";
import { Button } from "./button";

export function ProviderSettingsLink() {
  const { t } = useTranslation();
  const openProvider = useContext(ProviderNavigationContext);
  if (!openProvider) return null;

  return (
    <Button type="button" size="sm" variant="outline" onClick={openProvider} className="gap-1.5">
      {t("providers.openProvider")}
      <ArrowUpRight size={13} aria-hidden="true" />
    </Button>
  );
}
