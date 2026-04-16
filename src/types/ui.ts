export type ActivePanel = "detail" | "version" | "note" | null;
export type ViewMode = "graph" | "people" | "history" | "settings";
export type ThemeMode = "dark" | "light";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}
