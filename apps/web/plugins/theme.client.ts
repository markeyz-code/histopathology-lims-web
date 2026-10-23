export default defineNuxtPlugin(() => {
  const { isDark, setDark } = useTheme();
  if (!import.meta.client) return;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('lims-theme');
  } catch {
    stored = null;
  }
  const dark =
    stored === 'dark' ||
    (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
  isDark.value = dark;
  setDark(dark);
});
