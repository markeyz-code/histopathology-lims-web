<template>
  <div class="min-h-screen bg-canvas">
    <div class="grid min-h-screen lg:grid-cols-[minmax(380px,43%)_1fr]">
      <aside
        class="relative hidden flex-col justify-between overflow-hidden border-r border-rail-line bg-rail px-10 py-9 text-rail-ink lg:flex"
      >
        <div class="flex items-center justify-between">
          <AppWordmark variant="rail" />
          <span class="font-mono text-[9px] uppercase tracking-[0.2em] text-rail-muted"
            >NG · 01</span
          >
        </div>

        <div class="relative z-10 max-w-lg py-12">
          <p
            class="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent"
          >
            <span class="h-1.5 w-1.5 bg-accent" aria-hidden="true" />
            Histopathology operations
          </p>
          <h1 class="display text-[3.6rem] leading-[0.98] tracking-tight text-rail-ink">
            Every block.<br />
            Every slide.<br />
            <span class="text-accent">Accounted for.</span>
          </h1>
          <p class="mt-6 max-w-sm text-sm leading-relaxed text-rail-muted">
            From accession to archive, the specimen writes its own history. Immutable custody,
            synoptic reporting, and turnaround control built for the way laboratories actually work.
          </p>

          <div class="mt-10 grid max-w-sm grid-cols-3 gap-px bg-rail-line text-[10px]">
            <div class="bg-rail p-3">
              <span class="block font-mono uppercase tracking-[0.16em] text-rail-muted"
                >Specimen</span
              >
              <span class="mt-1 block font-display text-2xl">A</span>
            </div>
            <div class="bg-rail p-3">
              <span class="block font-mono uppercase tracking-[0.16em] text-rail-muted">Block</span>
              <span class="mt-1 block font-display text-2xl">A1</span>
            </div>
            <div class="bg-rail p-3">
              <span class="block font-mono uppercase tracking-[0.16em] text-rail-muted">Slide</span>
              <span class="mt-1 block font-display text-2xl">A1-1</span>
            </div>
          </div>
        </div>

        <div class="border-t border-rail-line pt-5">
          <div
            class="flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.16em] text-rail-muted"
          >
            <span>Phase 1 · Core tracking &amp; reporting</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>

      <main class="flex min-h-screen flex-col">
        <header class="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <div class="lg:hidden">
            <AppWordmark compact />
          </div>
          <p class="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-muted lg:block">
            Lagos first · built for low-bandwidth laboratories
          </p>
          <div class="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <div
          class="flex flex-1 items-start justify-center px-5 pb-10 pt-4 sm:px-8 lg:items-center lg:px-12"
        >
          <div class="w-full max-w-md">
            <slot />
          </div>
        </div>

        <footer class="border-t border-line px-5 py-4 sm:px-8 lg:px-12">
          <div
            class="flex flex-col justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:flex-row"
          >
            <span>Histopathology LIMS · Clinical system</span>
            <span>Access is monitored and audited</span>
          </div>
        </footer>
      </main>
    </div>
  </div>
</template>
