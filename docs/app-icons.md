# App icon selection

Settings → General → Appearance offers Classic (the default), Glacier
(`DuckyR2G.png`), and Rose (`DuckyR1G.png`). The two supplied PNGs are bundled
unchanged, including their transparency.

On macOS, the setting updates the running app's Dock icon using Electron's
[`dock.setIcon(image)`](https://www.electronjs.org/docs/latest/api/dock#dockseticonimage-macos).
On Windows and Linux, it updates existing and newly created windows using
[`win.setIcon(icon)`](https://www.electronjs.org/docs/latest/api/browser-window#winseticonicon-windows-linux).
Linux desktop environments and pinned taskbar entries may continue using the
installed application's icon. The setting does not replace Finder/Explorer,
installer, shortcut, or menu bar artwork. No restart is needed.

The main process stores the icon ID in `app-icon.json` inside the active user-data
profile and restores it before opening windows. It accepts only IDs from
`src/constants/appIcons.json`. Failed changes return an error and attempt to
restore the previous icon; malformed saved preferences fall back to Classic.
IPC broadcasts keep open settings views in sync. Dock visibility continues to
follow the control panel.

The existing `src/assets/**/*` packaging rule includes the PNGs; Vite also bundles
the settings previews. No extra dependencies or native helpers are required.

To add an icon, add its PNG under `src/assets/app-icons`, register its ID and path
in the catalog, extend `AppIconId`, and add its preview and localized label to
`AppIconSettings` and the translation files.

Validation: focused manager, identity, and Dock policy tests; TypeScript; renderer
build; and an isolated macOS Electron smoke test covering all three choices,
the real preload bridge, preference writes, and change broadcasts. Windows and
Linux use the documented APIs and mocked platform tests; they still need native
desktop QA before release.
