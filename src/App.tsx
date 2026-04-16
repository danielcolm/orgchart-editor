import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useStore } from "@/store";
import { PinScreen } from "@/components/Layout/PinScreen";
import { WorkspaceManager } from "@/components/Workspace/WorkspaceManager";
import { EditorPage } from "@/components/Layout/EditorPage";
import { useEffect } from "react";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return <>{children}</>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const authenticated = useStore((s) => s.authenticated);
  if (!authenticated) return <PinScreen />;
  return <>{children}</>;
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route path="/" element={<WorkspaceManager />} />
            <Route path="/editor/:projectId" element={<EditorPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </ThemeProvider>
  );
}
