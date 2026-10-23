export function useTheme() {
  const isDark = useState<boolean>('lims:dark', () => false);

  function apply(dark: boolean): void {
    if (!import.meta.client) return;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('lims-theme', dark ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable in private mode; the class still applies.
    }
  }

  function setDark(dark: boolean): void {
    isDark.value = dark;
    apply(dark);
  }

  function toggle(): void {
    setDark(!isDark.value);
  }

  return { isDark, toggle, setDark };
}
