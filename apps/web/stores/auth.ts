import type {
  AuthResponse,
  Discipline,
  Lab,
  LoginInput,
  Role,
  User,
  Capability,
} from '@lims/shared';
import { ROLE_CAPABILITIES, isClinicalRole } from '@lims/shared';

interface MeResponse {
  user: User;
  lab: Lab;
}

export const useAuthStore = defineStore('auth', () => {
  const config = useRuntimeConfig();
  const apiBase = String(config.public.apiBase).replace(/\/$/, '');

  const user = ref<User | null>(null);
  const lab = ref<Lab | null>(null);
  const initialised = ref(false);
  const accessToken = useCookie<string | null>('lims_at', {
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 15,
  });
  const refreshToken = useCookie<string | null>('lims_rt', {
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  let refreshing: Promise<boolean> | null = null;

  const isAuthenticated = computed(() => Boolean(accessToken.value && user.value));
  const role = computed<Role | null>(() => user.value?.role ?? null);
  const capabilities = computed<readonly Capability[]>(() =>
    role.value ? ROLE_CAPABILITIES[role.value] : [],
  );
  const homePath = computed(() =>
    role.value === 'REFERRER'
      ? '/referrer'
      : role.value === 'SUPER_ADMIN'
        ? '/super-admin'
        : '/dashboard',
  );
  const enabledDisciplines = computed<Discipline[]>(
    () => lab.value?.enabledDisciplines ?? ['HISTOPATHOLOGY'],
  );
  const disciplines = computed<Discipline[]>(() => user.value?.disciplines ?? []);
  const displayName = computed(() => user.value?.name ?? '');
  const initials = computed(() => {
    const parts = displayName.value.replace(/^Dr\s+/i, '').split(/\s+/);
    return (
      `${parts[0]?.charAt(0) ?? ''}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase() || '—'
    );
  });

  function can(capability: Capability): boolean {
    return capabilities.value.includes(capability);
  }

  function canDiscipline(discipline: Discipline): boolean {
    if (!enabledDisciplines.value.includes(discipline)) return false;
    if (!role.value || !isClinicalRole(role.value)) return true;
    return (disciplines.value.length > 0 ? disciplines.value : ['HISTOPATHOLOGY']).includes(
      discipline,
    );
  }

  function setSession(payload: AuthResponse): void {
    accessToken.value = payload.accessToken;
    refreshToken.value = payload.refreshToken;
    user.value = payload.user;
    lab.value = payload.lab;
    initialised.value = true;
  }

  function clearSession(): void {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    lab.value = null;
    initialised.value = true;
  }

  async function login(input: LoginInput): Promise<AuthResponse> {
    const payload = await $fetch<AuthResponse>(`${apiBase}/auth/login`, {
      method: 'POST',
      body: input,
    });
    setSession(payload);
    return payload;
  }

  async function refreshSession(): Promise<boolean> {
    if (refreshing) return refreshing;
    const token = refreshToken.value;
    if (!token) {
      clearSession();
      return false;
    }
    refreshing = (async () => {
      try {
        const payload = await $fetch<AuthResponse>(`${apiBase}/auth/refresh`, {
          method: 'POST',
          body: { refreshToken: token },
        });
        setSession(payload);
        return true;
      } catch {
        clearSession();
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function restore(): Promise<void> {
    if (initialised.value) return;
    initialised.value = true;
    if (!accessToken.value) return;
    try {
      const me = await $fetch<MeResponse>(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken.value}` },
      });
      user.value = me.user;
      lab.value = me.lab;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 401 && refreshToken.value) {
        const refreshed = await refreshSession();
        if (refreshed) return;
      }
      clearSession();
    }
  }

  async function logout(): Promise<void> {
    const token = accessToken.value;
    if (token) {
      try {
        await $fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Local sign-out still proceeds if the API is unreachable.
      }
    }
    clearSession();
  }

  return {
    user,
    lab,
    accessToken,
    refreshToken,
    initialised,
    isAuthenticated,
    role,
    capabilities,
    homePath,
    enabledDisciplines,
    disciplines,
    displayName,
    initials,
    can,
    canDiscipline,
    login,
    logout,
    restore,
    refreshSession,
    setSession,
    clearSession,
  };
});
