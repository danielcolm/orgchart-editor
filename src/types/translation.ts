export type TranslationStatus = "ok" | "missing" | "outdated";
export interface DisplayText {
  text: string;
  isFallback: boolean;
  status: TranslationStatus;
}
