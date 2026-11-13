import { createContext } from "react";

export const ProviderNavigationContext = createContext<(() => void) | null>(null);
