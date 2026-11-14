import React, { useState } from "react";
import { Blocks, Gift, UserPlus, X, Search } from "lucide-react";
import logoIcon from "../assets/icon.png";
import homeIcon from "../assets/icons/sidebar/home.png";
import grammarIcon from "../assets/icons/sidebar/grammar.png";
import dictationIcon from "../assets/icons/sidebar/dictation.png";
import chatIcon from "../assets/icons/sidebar/chat.png";
import notesIcon from "../assets/icons/sidebar/notes.png";
import dictionaryIcon from "../assets/icons/sidebar/dictionary.png";
import settingsIcon from "../assets/icons/sidebar/settings.png";
import supportIcon from "../assets/icons/sidebar/support.png";
import providerIcon from "../assets/icons/sidebar/provider.png";
import { useTranslation } from "react-i18next";
import { cn } from "./lib/utils";
import { createExternalLinkHandler } from "../utils/externalLinks";
import { getCachedPlatform } from "../utils/platform";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import InviteTeammateDialog from "./InviteTeammateDialog";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import { useWorkspace } from "../hooks/useWorkspace";
import { WORKSPACES_ENABLED, AUTH_DISABLED } from "../lib/features";

const platform = getCachedPlatform();

const rowIconClass =
  "shrink-0 text-foreground/60 group-hover:text-foreground/75 dark:text-foreground/50 dark:group-hover:text-foreground/65 transition-colors duration-150";
const rowLabelClass = "sr-only";
const rowButtonClass =
  "group flex items-center gap-2.5 w-full h-9 justify-center px-0 rounded-xl text-left outline-none hover:bg-foreground/4 dark:hover:bg-white/4 focus-visible:ring-1 focus-visible:ring-ring transition-colors duration-150";

export type ControlPanelView =
  | "home"
  | "dictation"
  | "grammar"
  | "chat"
  | "personal-notes"
  | "dictionary"
  | "upload"
  | "providers"
  | "integrations";

interface ControlPanelSidebarProps {
  activeView: ControlPanelView;
  onViewChange: (view: ControlPanelView) => void;
  onOpenSettings: () => void;
  onOpenSearch?: () => void;
  onOpenReferrals?: () => void;
  onUpgrade?: () => void;
  isOverLimit?: boolean;
  userName?: string | null;
  isSignedIn?: boolean;
  authLoaded?: boolean;
  isProUser?: boolean;
  usageLoaded?: boolean;
  updateAction?: React.ReactNode;
}

export default function ControlPanelSidebar({
  activeView,
  onViewChange,
  onOpenSettings,
  onOpenSearch,
  onOpenReferrals,
  onUpgrade,
  isOverLimit,
  userName,
  isSignedIn,
  authLoaded,
  isProUser,
  usageLoaded,
  updateAction,
}: ControlPanelSidebarProps) {
  const { t } = useTranslation();
  const [upgradeDismissed, setUpgradeDismissed] = useState(
    () => localStorage.getItem("upgradeProDismissed") === "true"
  );
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const { active: activeWorkspace } = useWorkspace();

  const showLimitBanner = !AUTH_DISABLED && authLoaded && isSignedIn && !isProUser && isOverLimit;
  const showUpgradeBanner =
    !AUTH_DISABLED &&
    !showLimitBanner &&
    authLoaded &&
    (!isSignedIn || usageLoaded !== false) &&
    !isProUser &&
    !upgradeDismissed;

  const navItems: {
    id: ControlPanelView;
    label: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    image?: string;
  }[] = [
    { id: "home", label: t("sidebar.home"), image: homeIcon },
    { id: "dictation", label: t("dictationHistory.title"), image: dictationIcon },
    { id: "grammar", label: t("sidebar.grammar"), image: grammarIcon },
    { id: "chat", label: t("sidebar.chat"), image: chatIcon },
    { id: "personal-notes", label: t("sidebar.notes"), image: notesIcon },
    { id: "dictionary", label: t("sidebar.dictionary"), image: dictionaryIcon },
    { id: "providers", label: t("sidebar.provider"), image: providerIcon },
    { id: "integrations", label: t("sidebar.integrations"), icon: Blocks },
  ];

  return (
    <div className="control-panel-sidebar relative w-full h-full min-h-0 flex flex-col rounded-[18px] bg-neutral-100 dark:bg-[#080808]">
      <div
        className="w-full h-12 shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {WORKSPACES_ENABLED && isSignedIn && (
        <div className="relative px-2 pb-1">
          <button
            type="button"
            onClick={() => setWorkspaceOpen((open) => !open)}
            aria-label={activeWorkspace?.name || t("sidebar.createWorkspace")}
            title={activeWorkspace?.name || t("sidebar.createWorkspace")}
            aria-expanded={workspaceOpen}
            className={rowButtonClass}
          >
            <Blocks size={15} className={rowIconClass} />
          </button>
          {workspaceOpen && (
            <div className="absolute left-full top-0 z-50 ml-2 w-52 rounded-2xl bg-popover p-2 shadow-xl border border-border">
              <WorkspaceSwitcher userName={userName} />
            </div>
          )}
        </div>
      )}

      {onOpenSearch && (
        <div className="px-2 pt-2 pb-1">
          <button
            onClick={onOpenSearch}
            aria-label={t("commandSearch.title")}
            title={t("commandSearch.shortPlaceholder")}
            className="group flex items-center justify-center w-full h-9 rounded-xl hover:bg-foreground/5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Search size={14} className="text-muted-foreground shrink-0" />
            <span className="sr-only">{t("commandSearch.shortPlaceholder")}</span>
            <div className="hidden">
              <kbd className="text-[10px] px-1 py-px rounded border border-border/30 dark:border-white/8 bg-muted/40 text-muted-foreground/40 font-mono leading-tight">
                {platform === "darwin" ? "⌘" : "Ctrl"}
              </kbd>
              <kbd className="text-[10px] px-1 py-px rounded border border-border/30 dark:border-white/8 bg-muted/40 text-muted-foreground/40 font-mono leading-tight">
                K
              </kbd>
            </div>
          </button>
        </div>
      )}

      <nav
        aria-label={t("common.navigation", "Navigation")}
        className="flex flex-col gap-1 px-2 pt-2 pb-2 overflow-y-auto"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "group relative flex shrink-0 items-center justify-center w-full h-9 rounded-xl outline-none transition-colors duration-150 text-left",
                "focus-visible:ring-1 focus-visible:ring-primary/30",
                isActive
                  ? "bg-black/10 dark:bg-white/10"
                  : "hover:bg-foreground/4 dark:hover:bg-white/4 active:bg-foreground/6"
              )}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {item.image ? (
                  <img src={item.image} alt="" className="size-5" />
                ) : Icon ? (
                  <Icon
                    size={15}
                    className={cn(
                      "shrink-0 transition-colors duration-150",
                      isActive
                        ? "text-active-icon"
                        : "text-foreground/60 group-hover:text-foreground/75 dark:text-foreground/55 dark:group-hover:text-foreground/70"
                    )}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "sr-only text-xs transition-colors duration-150",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-foreground/80 group-hover:text-foreground dark:text-foreground/75 dark:group-hover:text-foreground/90"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {(showLimitBanner || showUpgradeBanner) && onUpgrade && (
        <div className="group/upgrade relative px-2 pb-1">
          <button
            onClick={onUpgrade}
            className={rowButtonClass}
            aria-label={t(showLimitBanner ? "sidebar.viewPlans" : "sidebar.upgradeTitle")}
            title={t(showLimitBanner ? "sidebar.viewPlans" : "sidebar.upgradeTitle")}
          >
            <img src={logoIcon} alt="" className="size-5 shrink-0 rounded-md" />
          </button>
          {showUpgradeBanner && (
            <button
              type="button"
              aria-label={t("common.dismiss")}
              title={t("common.dismiss")}
              onClick={() => {
                setUpgradeDismissed(true);
                localStorage.setItem("upgradeProDismissed", "true");
              }}
              className="absolute right-1 top-0 rounded-full bg-surface-3 p-0.5 text-muted-foreground opacity-0 group-hover/upgrade:opacity-100 focus-visible:opacity-100"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}

      <div className="px-2 pb-2 space-y-0.5">
        {updateAction && (
          <div
            className="sidebar-update px-1 pb-1"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {updateAction}
          </div>
        )}

        {isSignedIn && onOpenReferrals && (
          <button
            onClick={onOpenReferrals}
            aria-label={t("sidebar.referral")}
            className={rowButtonClass}
          >
            <Gift size={15} className={rowIconClass} />
            <span className={rowLabelClass}>{t("sidebar.referral")}</span>
          </button>
        )}

        {WORKSPACES_ENABLED && isSignedIn && (
          <button
            onClick={() => (activeWorkspace ? setInviteOpen(true) : setCreateWorkspaceOpen(true))}
            aria-label={
              activeWorkspace ? t("sidebar.inviteTeammate") : t("sidebar.createWorkspace")
            }
            className={rowButtonClass}
          >
            <UserPlus size={15} className={rowIconClass} />
            <span className={rowLabelClass}>
              {activeWorkspace ? t("sidebar.inviteTeammate") : t("sidebar.createWorkspace")}
            </span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          aria-label={t("sidebar.settings")}
          title={t("sidebar.settings")}
          className={rowButtonClass}
        >
          <img src={settingsIcon} alt="" className="size-5 shrink-0" />
          <span className={rowLabelClass}>{t("sidebar.settings")}</span>
        </button>

        <a
          href="https://github.com/jittergtz/spoken"
          target="_blank"
          rel="noopener noreferrer"
          onClick={createExternalLinkHandler("https://github.com/jittergtz/spoken")}
          aria-label={t("sidebar.support")}
          title={t("sidebar.support")}
          className={rowButtonClass}
        >
          <img src={supportIcon} alt="" className="size-5 shrink-0" />
          <span className={rowLabelClass}>{t("sidebar.support")}</span>
        </a>
      </div>

      {WORKSPACES_ENABLED && activeWorkspace && (
        <InviteTeammateDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
        />
      )}
      {WORKSPACES_ENABLED && (
        <CreateWorkspaceDialog open={createWorkspaceOpen} onOpenChange={setCreateWorkspaceOpen} />
      )}
    </div>
  );
}
