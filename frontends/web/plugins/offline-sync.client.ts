export default defineNuxtPlugin(() => {
  const queue = useOfflineQueue();
  void queue.refresh();

  window.addEventListener('online', () => {
    void queue.flush();
  });
  window.addEventListener('offline', () => {
    queue.online.value = false;
  });

  const timer = window.setInterval(() => {
    if (navigator.onLine && queue.pendingCount.value > 0) void queue.flush();
  }, 30_000);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => window.clearInterval(timer));
  }
});
