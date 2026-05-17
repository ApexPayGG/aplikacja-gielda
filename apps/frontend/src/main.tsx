import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";
import "./i18n";
import { registerServiceWorker } from "./utils/pwa";
import { enableGlobalImageLazyLoading } from "./utils/imageOptimization";
import { getTheme, setTheme } from "./utils/theme";

setTheme(getTheme());
enableGlobalImageLazyLoading();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

registerServiceWorker();
