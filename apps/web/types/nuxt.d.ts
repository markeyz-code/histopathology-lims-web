import type { Capability, Role } from '@lims/shared';

declare module '#app' {
  interface PageMeta {
    title?: string;
    description?: string;
    roles?: Role[];
    capabilities?: Capability[];
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    description?: string;
    roles?: Role[];
    capabilities?: Capability[];
  }
}

export {};
