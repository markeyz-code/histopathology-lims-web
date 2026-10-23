import type { Capability, Role } from '@lims/shared';
import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  const auth = useAuthStore();
  await auth.restore();

  const publicPrefixes = ['/login', '/verify', '/offline'];
  const isPublic = publicPrefixes.some(
    (prefix) => to.path === prefix || to.path.startsWith(`${prefix}/`),
  );

  if (!auth.isAuthenticated && !isPublic) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }

  if (auth.isAuthenticated && to.path === '/login') {
    return navigateTo(auth.homePath);
  }

  if (!auth.isAuthenticated) return;

  if (auth.role === 'REFERRER' && !isPublic && to.path !== '/referrer' && to.path !== '/403') {
    return navigateTo('/referrer');
  }

  const requiredRoles = to.meta.roles as Role[] | undefined;
  if (
    requiredRoles &&
    requiredRoles.length > 0 &&
    auth.role !== 'SUPER_ADMIN' &&
    auth.role &&
    !requiredRoles.includes(auth.role)
  ) {
    return navigateTo('/403');
  }

  const requiredCapabilities = to.meta.capabilities as Capability[] | undefined;
  if (
    requiredCapabilities &&
    requiredCapabilities.length > 0 &&
    !requiredCapabilities.some((capability) => auth.can(capability))
  ) {
    return navigateTo('/403');
  }
});
