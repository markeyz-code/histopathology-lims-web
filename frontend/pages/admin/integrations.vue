<script setup lang="ts">
definePageMeta({ title: 'Integrations', capabilities: ['interop'] });
useHead({ title: 'Integrations' });

const config = useRuntimeConfig();
const apiBase = String(config.public.apiBase).replace(/\/$/, '');
const resources = ref<string[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const response = await $fetch<{ rest?: Array<{ resource?: Array<{ type: string }> }> }>(
      `${apiBase}/fhir/r4/metadata`,
    );
    resources.value = response.rest?.[0]?.resource?.map((item) => item.type) ?? [];
  } catch {
    resources.value = [];
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Interoperability"
      title="Connected systems."
      description="FHIR R4, HL7 v2, whole-slide imaging and licensed terminology — the boundary between this laboratory and the hospital."
    />
    <AdminNav />

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="panel p-5">
        <p class="label-caps text-accent">FHIR R4</p>
        <h2 class="mt-2 text-xl">Clinical resources for the EMR</h2>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          Bearer-authenticated REST resources using application/fhir+json. The metadata endpoint is
          public; patient data is lab-scoped.
        </p>
        <div class="mt-4 border border-line bg-canvas p-3 font-mono text-[10px] text-muted">
          <p class="break-all">{{ apiBase }}/fhir/r4</p>
          <p class="mt-1">
            {{
              resources.length
                ? resources.join(' · ')
                : loading
                  ? 'Loading CapabilityStatement…'
                  : 'Metadata unavailable'
            }}
          </p>
        </div>
        <ul class="mt-4 space-y-1.5 text-xs text-muted">
          <li><span class="mono text-ink">GET /Patient/:id</span> — demographics and MRN</li>
          <li><span class="mono text-ink">GET /ServiceRequest/:id</span> — the pathology order</li>
          <li><span class="mono text-ink">GET /Specimen/:id</span> — barcode and collection</li>
          <li>
            <span class="mono text-ink">GET /DiagnosticReport/:id</span> — signed report, SNOMED,
            ICD-O-3
          </li>
        </ul>
      </section>

      <section class="panel p-5">
        <p class="label-caps text-accent">HL7 v2</p>
        <h2 class="mt-2 text-xl">Order intake over MLLP</h2>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          ORM^O01 and OML^O21 orders are accessioned into a configured laboratory and acknowledged
          with AA/AE. Text ORU^R01 results are generated from signed reports.
        </p>
        <div class="mt-4 grid gap-2">
          <div class="border border-line bg-canvas p-3">
            <p class="label-caps">MLLP listener</p>
            <p class="mono mt-1 text-xs">0.0.0.0:2575</p>
          </div>
          <div class="border border-line bg-canvas p-3">
            <p class="label-caps">HTTP test endpoint</p>
            <p class="mono mt-1 break-all text-xs">POST {{ apiBase }}/interop/hl7/messages</p>
          </div>
          <div class="border border-line bg-canvas p-3">
            <p class="label-caps">ORU renderer</p>
            <p class="mono mt-1 break-all text-xs">GET {{ apiBase }}/interop/hl7/oru/:caseId</p>
          </div>
        </div>
      </section>

      <section class="panel p-5">
        <p class="label-caps text-accent">Whole-slide imaging</p>
        <h2 class="mt-2 text-xl">Slide barcode → viewer</h2>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          Attach an image or viewer URL directly to a slide, or let a scanner webhook link by
          barcode with an HMAC-SHA256 signature.
        </p>
        <div class="mt-4 border border-line bg-canvas p-3 font-mono text-[10px] text-muted">
          <p>POST /wsi/webhook</p>
          <p class="mt-1">x-wsi-signature: HMAC-SHA256(JSON body)</p>
          <p class="mt-1">X-Lab-Code / body.labCode: HISTO</p>
        </div>
        <p class="mt-3 text-xs text-muted">
          The slide row in a case file shows a “WSI” action once the image is linked.
        </p>
      </section>

      <section class="panel p-5">
        <p class="label-caps text-accent">Terminology</p>
        <h2 class="mt-2 text-xl">SNOMED CT &amp; ICD-O-3</h2>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          A laboratory-licensed subset is stored locally. Report coding is validated against it
          before sign-out; FHIR DiagnosticReport carries the coded diagnosis and
          morphology/topography extensions.
        </p>
        <div class="mt-4 border border-line bg-canvas p-3 font-mono text-[10px] text-muted">
          <p class="break-all">
            GET {{ apiBase }}/terminology/search?system=SNOMED_CT&amp;q=breast
          </p>
          <p class="mt-1 break-all">POST {{ apiBase }}/terminology/import</p>
        </div>
        <p class="mt-3 text-xs text-muted">
          Import a licensed subset; do not redistribute proprietary code systems.
        </p>
      </section>
    </div>
  </div>
</template>
