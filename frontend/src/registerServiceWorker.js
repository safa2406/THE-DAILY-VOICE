// Service worker registration helper for The Daily Voice PWA
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Check for periodic background updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.info('[DailyVoice PWA] New edition or version available.');
                  } else {
                    console.info('[DailyVoice PWA] App shell cached for offline access.');
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[DailyVoice PWA] Service worker registration failed:', error);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
  }
}
