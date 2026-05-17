export const registerServiceWorker = (): void => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const globalWindow = window as Window & {
    __stockaiSwRegistered?: boolean;
    __stockaiSwRegistrationStarted?: boolean;
  };
  if (globalWindow.__stockaiSwRegistered || globalWindow.__stockaiSwRegistrationStarted) {
    return;
  }

  window.addEventListener("load", () => {
    if (globalWindow.__stockaiSwRegistered || globalWindow.__stockaiSwRegistrationStarted) {
      return;
    }

    globalWindow.__stockaiSwRegistrationStarted = true;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        globalWindow.__stockaiSwRegistered = true;
      })
      .catch((error) => {
        globalWindow.__stockaiSwRegistrationStarted = false;
        console.error("Service worker registration failed:", error);
      });
  });
};
