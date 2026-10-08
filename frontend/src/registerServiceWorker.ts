export function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Service worker registration failed:', error);
        }
      }
    });
  }
}
