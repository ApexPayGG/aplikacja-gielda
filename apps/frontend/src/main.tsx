import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";
import { i18nReady } from "./i18n";
import { registerServiceWorker } from "./utils/pwa";
import { enableGlobalImageLazyLoading } from "./utils/imageOptimization";
import { getTheme, setTheme } from "./utils/theme";

setTheme(getTheme());
enableGlobalImageLazyLoading();

function mountApp(): void {
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
}

void i18nReady.then(mountApp).catch((error) => {
  console.error("i18n failed to initialize", error);
  mountApp();
});
