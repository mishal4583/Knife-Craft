import { createContext, useContext } from "react";

/**
 * What any screen needs from Paige without threading props through the router: is she hired, are her tips on, and the things the
 * "Ask Paige" button and her Staff card do. Provided once by App; a screen outside the provider gets null and shows nothing of her.
 */
export type AssistantApi = {
  hired: boolean;
  tipsOff: boolean;
  openNotebook: () => void;
  setTips: (on: boolean) => void;
  /** Hires her (free). */
  hire: () => void;
};

const Ctx = createContext<AssistantApi | null>(null);
export const AssistantProvider = Ctx.Provider;
export const useAssistant = (): AssistantApi | null => useContext(Ctx);
