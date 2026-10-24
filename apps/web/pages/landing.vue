<script setup lang="ts">
definePageMeta({
  title: 'Hospital LIMS · Multi-Discipline Medical Laboratory System',
  layout: false,
});

useHead({
  title: 'Multi-Discipline Medical Laboratory LIMS · Hospital & Diagnostic Center Grade',
  meta: [
    {
      name: 'description',
      content:
        'A unified Laboratory Information Management System engineered for all medical laboratory departments: Histopathology, Chemical Pathology, Haematology, Medical Microbiology, and Pre-Analytics Logistics. ISO 15189:2022 aligned with offline-first resilience.',
    },
    {
      name: 'keywords',
      content:
        'Multi-discipline LIMS, Medical Laboratory Science, Histopathology Software, Chemical Pathology, Haematology LIMS, Medical Microbiology, Westgard QC, ISO 15189, Specimen Chain of Custody, Nigeria Laboratory Software',
    },
  ],
});

const auth = useAuthStore();
const api = useApi();
const toast = useToast();

// Mobile navigation drawer state
const isMobileNavOpen = ref(false);

// Portals navigation dropdown state
const isPortalsMenuOpen = ref(false);
const portalsDropdownRef = ref<HTMLElement | null>(null);

function handleClickOutside(event: MouseEvent) {
  if (portalsDropdownRef.value && !portalsDropdownRef.value.contains(event.target as Node)) {
    isPortalsMenuOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside);
});

// Active Department Explorer Tab
const activeDepartment = ref<
  'histopathology' | 'chemistry' | 'haematology' | 'microbiology' | 'preanalytics'
>('histopathology');

const departments = [
  {
    id: 'histopathology',
    name: 'Histopathology & Cytology',
    shortName: 'Histology',
    icon: 'microscope',
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    title: 'Anatomical Pathology & Cancer Synoptic Staging',
    summary:
      'The most complete histopathology module: specimen grossing, cassette blocks, microtome ribbons, CAP synoptic protocols, and locked reports.',
    features: [
      'Specimen → Block (A1, A2) → Slide (A1-1, A1-2) physical hierarchy',
      '7 benchtop scan stations with loud audio-visual wedge confirmation',
      'CAP & RCPath synoptic reporting with automatic diagnostic narrative',
      'Whole Slide Imaging (WSI) viewer integration & digital pathology',
      'Automated 15% random QA peer-review with coded discrepancies',
    ],
    image: '/screens/report-editor.webp',
    stat: '0% Swapped Biopsies',
    statDesc: 'Enforced by physical barcode state machine',
  },
  {
    id: 'chemistry',
    name: 'Clinical Chemistry',
    shortName: 'Chemistry',
    icon: 'beaker',
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    title: 'Chemical Pathology & High-Volume Autoverification',
    summary:
      'High-throughput analyte testing, age and sex-stratified reference ranges, delta checks against previous patient results, and critical limit notifications.',
    features: [
      'Tenant-configurable test catalogues: Liver, Renal, Cardiac, Electrolytes, Endocrine',
      'Safe JSON rules engine for automated verification and reflex testing',
      'Delta checks: flags sudden deviations from prior patient encounters',
      'Mandatory critical alert acknowledgement before result release',
      'Seamless multi-channel SMS / WhatsApp notification on panic values',
    ],
    image: '/screens/results.jpg',
    stat: '< 45 Min TAT',
    statDesc: 'From analyzer batch result to verified release',
  },
  {
    id: 'haematology',
    name: 'Haematology & Blood Transfusion',
    shortName: 'Haematology',
    icon: 'flask',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    title: 'Complete Blood Counts, Coagulation & Morphology',
    summary:
      'Full blood count (FBC / CBC) panel configuration, differential counts, coagulation profiles (PT/INR, APTT), blood grouping, and Levey-Jennings QC.',
    features: [
      'Calculated parameters & automated flagging for abnormal RBC/WBC indices',
      'Peripheral blood film morphology descriptions with digital sign-off',
      'Coagulation tracking with automated international normalized ratio (INR)',
      'Levey-Jennings charts with automated Westgard rule evaluation',
      'Blood group confirmation & crossmatch compatibility logging',
    ],
    image: '/screens/qc.jpg',
    stat: '6 Westgard Rules',
    statDesc: '1₃s, 2₂s, R₄s, 4₁s, 10x automated QC evaluation',
  },
  {
    id: 'microbiology',
    name: 'Medical Microbiology',
    shortName: 'Microbiology',
    icon: 'shield',
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    title: 'Cultures, Organism ID & Antimicrobial Susceptibility (AST)',
    summary:
      'Culture lifecycle tracking from specimen plating, incubation chamber monitoring, to organism identification and automated antibiotic susceptibility testing (AST).',
    features: [
      'Culture state machine: PLATED → INCUBATING → READ → ID_DONE → AST_DONE',
      'Standardized pathogen taxonomy & colony morphology observations',
      'Kirby-Bauer disc diffusion & MIC breakpoint interpretation (CLSI / EUCAST)',
      'Multi-drug resistant (MDR) organism alerts and hospital infection control flags',
      'Periodic antibiogram reporting for clinical pharmacology stewardship',
    ],
    image: '/screens/disciplines.jpg',
    stat: '100% Traceability',
    statDesc: 'From agar plate inoculation to AST sensitivity report',
  },
  {
    id: 'preanalytics',
    name: 'Pre-Analytics & Logistics',
    shortName: 'Pre-Analytics',
    icon: 'scan',
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    title: 'Satellite Collection Centres & Rider Consignment Chain',
    summary:
      'Manage multi-branch sample collection, phlebotomy tube accessioning, temperature-monitored consignments, dispatch rider tracking, and reception verification.',
    features: [
      'Satellite clinic collection & home phlebotomy dispatch manifests',
      'Sealed consignment bag barcoding with dispatch rider custody sign-off',
      'One-scan laboratory reception verification and automated specimen check-in',
      'Standardized rejection codes: haemolysis, lipaemia, clotting, fixation delay',
      'Instant SMS/Email alerts to referring clinics when specimens are rejected',
    ],
    image: '/screens/preanalytics.jpg',
    stat: 'Zero Transit Loss',
    statDesc: 'Complete custody chain between branch and central lab',
  },
];

// AI Voice Assistant & Laboratory Audio Composable
const labAudio = useLabAudio();

// Multi-Discipline Custody Simulator State
type CustodyUnitKey =
  'histopathology' | 'chemistry' | 'haematology' | 'microbiology' | 'preanalytics';
const activeCustodyUnitKey = ref<CustodyUnitKey>('histopathology');
const activeStationIndex = ref(0);
const isScanningSimulated = ref(false);
const isAutoSimulating = ref(false);
const simulatedScansCount = ref(0);
let autoSimulationTimer: ReturnType<typeof setTimeout> | null = null;

interface CustodyStation {
  id: string;
  name: string;
  dept: string;
  barcode: string;
  status: string;
  color: string;
  details: string;
  highlight: string;
  image: string;
  speech: string;
  actionLabel: string;
}

interface CustodyUnit {
  id: CustodyUnitKey;
  name: string;
  shortName: string;
  icon: 'microscope' | 'beaker' | 'flask' | 'shield' | 'scan';
  badge: string;
  badgeColor: string;
  specimenType: string;
  sampleBarcode: string;
  tatTarget: string;
  description: string;
  stations: CustodyStation[];
}

const custodyUnits: Record<CustodyUnitKey, CustodyUnit> = {
  histopathology: {
    id: 'histopathology',
    name: 'Histopathology & Cytology',
    shortName: 'Histology',
    icon: 'microscope',
    badge: '7 Physical Stages',
    badgeColor: 'border-rose-500/30 text-rose-500 bg-rose-500/10',
    specimenType: 'Tissue Biopsy / Surgical Excision Specimen',
    sampleBarcode: 'HP-2026-000123',
    tatTarget: '72 - 96 Hours (CAP Aligned)',
    description:
      'The gold standard anatomical pathology state machine: gross examination, cassette blocks, microtome ribbons, IHC lot validation, and CAP synoptic reporting.',
    stations: [
      {
        id: 'accession',
        name: '1. Accession & Barcoding',
        dept: 'Shared Core / Reception',
        barcode: 'HP-2026-000123 / CH-2026-00452',
        status: 'ACCESSIONED',
        color: 'border-sky-500 text-sky-500 bg-sky-500/10',
        details:
          'Atomic patient and specimen intake with auto-MRN generation and dual 2D DataMatrix printing. Directs specimens to Chemistry, Haematology, Microbiology, or Histology worklists.',
        highlight:
          'Starts the immutable countdown TAT clock and creates the initial custody audit event.',
        image: '/screens/case-detail.webp',
        speech:
          'Station 1: Histopathology accession and container verification. Specimen registered with patient Temitope Ajayi. Unique 2D DataMatrix generated. TAT countdown timer initiated.',
        actionLabel: 'Scan Biopsy Container & Confirm Fixative',
      },
      {
        id: 'grossing',
        name: '2. Histology Grossing & Cassettes',
        dept: 'Histopathology Desk',
        barcode: 'BL-HP-2026-000123-A1',
        status: 'GROSSED',
        color: 'border-amber-500 text-amber-500 bg-amber-500/10',
        details:
          'Hands-free barcode scan verifies container. Officer records macroscopic tissue observations and cuts cassette blocks (A1, A2, B1...). State machine guarantees a block cannot exist without grossing.',
        highlight:
          'Sound + visual flash confirmation. Rejection codes if specimen arrived dry or mislabelled.',
        image: '/screens/scan-station.webp',
        speech:
          'Station 2: Grossing bench scan. Container verified. Macroscopic findings logged and cassette block A1 cut. Block state locked.',
        actionLabel: 'Laser-Wedge Cut Cassette Block A1',
      },
      {
        id: 'processing',
        name: '3. Processing & Embedding',
        dept: 'Histology Laboratory',
        barcode: 'BL-HP-2026-000123-A1',
        status: 'EMBEDDED',
        color: 'border-indigo-500 text-indigo-500 bg-indigo-500/10',
        details:
          'Cassettes scanned into processing batches. Following vacuum infiltration, scientist embeds tissue into paraffin wax molds. Scanned at embedding station to lock orientation before microtomy.',
        highlight:
          'Batch scan capability enables entire processing racks (100+ cassettes) in seconds.',
        image: '/screens/disciplines.jpg',
        speech:
          'Station 3: Vacuum infiltration and paraffin wax embedding. Cassette orientation locked for microtome cutting.',
        actionLabel: 'Scan Cassette to Paraffin Embedding Mold',
      },
      {
        id: 'microtomy',
        name: '4. Microtomy Ribbon Cutting',
        dept: 'Microtomy Bench',
        barcode: 'SL-HP-2026-000123-A1-1',
        status: 'CUT',
        color: 'border-teal-500 text-teal-500 bg-teal-500/10',
        details:
          'Scanning block automatically populates cut queue. Technologist slices ribbons and generates unique slide labels (A1-1, A1-2). Immediate recut and deep-cut workflows supported if tissue is exhausted.',
        highlight:
          'One-click recut/serial request directly advances slide state while preserving lineage.',
        image: '/screens/worklist.webp',
        speech:
          'Station 4: Microtomy cutting queue. 4-micron ribbons floated and transferred to slide A1-1 with barcoded thermal label.',
        actionLabel: 'Generate Glass Slide Barcode A1-1',
      },
      {
        id: 'staining',
        name: '5. Staining & Reagent Lot QC',
        dept: 'Staining & IHC Lab',
        barcode: 'SL-HP-2026-000123-A1-1',
        status: 'STAINED',
        color: 'border-purple-500 text-purple-500 bg-purple-500/10',
        details:
          'Slide scanned into stain run linked directly to active reagent lots. System enforces lot validation: expired or unquarantined antibodies (ER, PR, HER2, Ki-67) are software-blocked from consumption.',
        highlight:
          'QC pass marks slide STAINED and delivers it to the assigned pathologist worklist.',
        image: '/screens/inventory.jpg',
        speech:
          'Station 5: Automated H&E and immunohistochemistry run. Antibody lot ER, PR, and HER2 validated against active quality controls.',
        actionLabel: 'Validate Reagent Lot & Complete Stain Run',
      },
      {
        id: 'pathologist',
        name: '6. Review & Synoptic Sign-Out',
        dept: 'Pathologist & MLS Desk',
        barcode: 'HP-2026-000123',
        status: 'REPORTED',
        color: 'border-emerald-500 text-emerald-500 bg-emerald-500/10',
        details:
          'Pathologist views prioritised queue with live TAT countdowns. Synoptic checklist ensures mandatory cancer fields (histological type, Nottingham grade, margin clearance, lymph nodes) are complete before locking.',
        highlight:
          'Report locks permanently upon sign-out with cryptographic verification code and QR seal.',
        image: '/screens/report-editor.webp',
        speech:
          'Station 6: Consultant review. CAP synoptic staging completed for invasive ductal carcinoma. Report cryptographically locked.',
        actionLabel: 'Cryptographically Sign & Lock Synoptic Report',
      },
      {
        id: 'delivery',
        name: '7. Omnichannel Delivery & Archival',
        dept: 'Delivery & Archive Rail',
        barcode: 'VERIFY-QR-7821',
        status: 'RELEASED & ARCHIVED',
        color: 'border-accent text-accent bg-accent/10',
        details:
          'Release action exposes signed multi-discipline PDF to referring doctors via OTP portal. SMS/WhatsApp outbox delivers instant notification. Physical blocks and slides are scanned into permanent drawer/shelf archives.',
        highlight:
          'Public QR verification allows any hospital, patient, or oncologist to verify report authenticity.',
        image: '/screens/referral-portal.jpg',
        speech:
          'Station 7: Omnichannel delivery. Signed PDF published to referring surgeon portal. Slide and block scanned into permanent drawer 14B.',
        actionLabel: 'Publish Multi-Channel PDF & Archive to Shelf 14B',
      },
    ],
  },
  chemistry: {
    id: 'chemistry',
    name: 'Clinical Chemistry (Chemical Pathology)',
    shortName: 'Chemistry',
    icon: 'beaker',
    badge: '6 Autoverified Stages',
    badgeColor: 'border-sky-500/30 text-sky-500 bg-sky-500/10',
    specimenType: 'Serum Clot SST / Lithium Heparin Tube',
    sampleBarcode: 'CHM-2026-000452',
    tatTarget: '< 45 Minutes (Stat / Routine)',
    description:
      'High-throughput serum testing, automated hemolysis/lipemia index, Westgard Levey-Jennings QC, delta checks, and sandboxed autoverification.',
    stations: [
      {
        id: 'centrifugation',
        name: '1. Phlebotomy Intake & Centrifugation',
        dept: 'Core Sample Reception',
        barcode: 'CHM-2026-000452',
        status: 'COLLECTED & CENTRIFUGED',
        color: 'border-sky-500 text-sky-500 bg-sky-500/10',
        details:
          'Vacuum serum separator tube scanned into centrifuge batch. Integrated pre-analytical optical sensors check for hemolysis, icterus, and lipemia (HIL indices) before analyzer loading.',
        highlight:
          'Pre-analytical check prevents erroneous potassium elevation from gross hemolysis.',
        image: '/screens/case-detail.webp',
        speech:
          'Station 1: Phlebotomy intake and serum separation. Hemolysis, icterus, and lipemia index screened. SST tube loaded into centrifuge.',
        actionLabel: 'Scan Tube & Verify HIL Centrifuge Quality',
      },
      {
        id: 'interfacing',
        name: '2. Analyzer Bidirectional Interfacing',
        dept: 'Automated Track / Cobas Interfacing',
        barcode: 'CHM-2026-000452',
        status: 'ANALYSING',
        color: 'border-indigo-500 text-indigo-500 bg-indigo-500/10',
        details:
          'Bidirectional HL7 / ASTM interface queries test orders for Sodium, Potassium, Urea, Creatinine, and Liver Enzymes. Analyzer aspirates serum sample and returns raw optical densities.',
        highlight: 'Zero manual transcription: automated bidirectional worklist matching.',
        image: '/screens/results.jpg',
        speech:
          'Station 2: Bidirectional HL7 instrument interfacing. Chemistry analyzer processes liver panel, renal electrolytes, and cardiac enzymes.',
        actionLabel: 'Transmit Bi-Directional Analyzer Worklist',
      },
      {
        id: 'westgard',
        name: '3. Westgard QC & Levey-Jennings',
        dept: 'Quality Assurance Desk',
        barcode: 'QC-CHM-LOT-882',
        status: 'QC_VALIDATED',
        color: 'border-amber-500 text-amber-500 bg-amber-500/10',
        details:
          'System automatically evaluates daily commercial control runs against 6 Westgard rules: 1₃s, 2₂s, R₄s, 4₁s, 10x. Real-time Levey-Jennings plot confirms zero systematic drift before patient results release.',
        highlight:
          'Automatic analytical hold: analyzer batch results freeze if 1₃s or 2₂s rule triggers.',
        image: '/screens/qc.jpg',
        speech:
          'Station 3: Westgard quality control evaluation. Control levels 1 and 2 evaluated against 6 Westgard rules. Zero violations. Batch accepted.',
        actionLabel: 'Run 6-Rule Westgard Statistical QC Audit',
      },
      {
        id: 'deltacheck',
        name: '4. Historical Delta Checks Engine',
        dept: 'Clinical Decision Support',
        barcode: 'CHM-2026-000452',
        status: 'DELTA_CHECKED',
        color: 'border-teal-500 text-teal-500 bg-teal-500/10',
        details:
          'Delta check algorithms compare current analyte values against prior encounters for this patient. Flags unexpected shifts exceeding biological variation (e.g. Creatinine jumping >50% within 48 hours).',
        highlight: 'Catches IV fluid contamination or specimen misidentification before release.',
        image: '/screens/results.jpg',
        speech:
          'Station 4: Historical delta check. System compares current creatinine and potassium against prior patient encounters. Stable trajectory confirmed.',
        actionLabel: 'Run Biological Delta Shift Comparison',
      },
      {
        id: 'autoverify',
        name: '5. Sandboxed Autoverification Rules',
        dept: 'Autoverification Core',
        barcode: 'RULE-AUTO-PASS',
        status: 'AUTOVERIFIED',
        color: 'border-emerald-500 text-emerald-500 bg-emerald-500/10',
        details:
          'Safe JSON rules engine applies multi-factorial checks: reference ranges, age/sex stratification, and panic limits. Normal results autoverify within 3 seconds; critical values trigger urgent pathologist notification.',
        highlight: 'Reduces routine Chemistry turnaround time by 65% with zero human error.',
        image: '/screens/results.jpg',
        speech:
          'Station 5: Sandboxed autoverification. Normal physiological limits satisfied with zero critical alert flags. Instant auto-approval granted.',
        actionLabel: 'Execute Sandboxed JSON Autoverification Rules',
      },
      {
        id: 'release',
        name: '6. Verified Release & Panic Alert SMS',
        dept: 'Emergency Notification Rail',
        barcode: 'VERIFY-QR-9182',
        status: 'RELEASED',
        color: 'border-accent text-accent bg-accent/10',
        details:
          'Verified results post immediately to cumulative patient record. For panic limits (e.g. Potassium > 6.2 mmol/L), system automatically dispatches priority SMS and WhatsApp alerts to the attending doctor with read receipts.',
        highlight: 'Mandatory clinical acknowledgement audit trail for critical laboratory values.',
        image: '/screens/referral-portal.jpg',
        speech:
          'Station 6: Multidiscipline cumulative release. Cryptographically sealed chemistry result delivered via secure WhatsApp and clinician portal.',
        actionLabel: 'Deliver Cumulative Result & Log SMS Audit',
      },
    ],
  },
  haematology: {
    id: 'haematology',
    name: 'Haematology & Blood Transfusion',
    shortName: 'Haematology',
    icon: 'flask',
    badge: '6 Micro-Cytometry Stages',
    badgeColor: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
    specimenType: 'K2-EDTA Whole Blood Tube (Purple Top)',
    sampleBarcode: 'HAE-2026-000891',
    tatTarget: '< 30 Minutes (CBC / Diff / Coag)',
    description:
      '5-part differential laser flow cytometry, Levey-Jennings QC, blood film morphology review, coagulation tracking, and blood group crossmatching.',
    stations: [
      {
        id: 'edta_intake',
        name: '1. EDTA Whole Blood Intake & Inversion',
        dept: 'Haematology Sample Desk',
        barcode: 'HAE-2026-000891',
        status: 'ACCESSIONED',
        color: 'border-sky-500 text-sky-500 bg-sky-500/10',
        details:
          'EDTA purple-top tube barcoded and verified against tube fill volume line. Automated mechanical rocker checks for micro-clots before presentation to laser flow cell.',
        highlight: 'Enforces sample integrity: clotted EDTA samples rejected at accession.',
        image: '/screens/case-detail.webp',
        speech:
          'Station 1: EDTA whole blood accessioning. Automated inversion check ensures no micro-clotting before laser cytometry.',
        actionLabel: 'Scan Tube & Verify Anti-Coagulation State',
      },
      {
        id: 'flow_cytometry',
        name: '2. 5-Part Differential Laser Cytometry',
        dept: 'Haematology Analyzer Bench',
        barcode: 'HAE-2026-000891',
        status: 'ANALYSING',
        color: 'border-indigo-500 text-indigo-500 bg-indigo-500/10',
        details:
          'Analyzer aspirates whole blood, measures impedance and multi-angle laser scatter to classify Neutrophils, Lymphocytes, Monocytes, Eosinophils, and Basophils along with RBC, Hb, and Platelets.',
        highlight: 'Automated mathematical calculation of MCV, MCH, MCHC, and RDW-CV indices.',
        image: '/screens/disciplines.jpg',
        speech:
          'Station 2: 5-part differential laser flow cytometry. Enumerating red cells, white cell subsets, hemoglobin, and platelets in 45 seconds.',
        actionLabel: 'Run 5-Part Differential Laser Scatter Analysis',
      },
      {
        id: 'haem_qc',
        name: '3. Tri-Level Westgard Statistical QC',
        dept: 'Haematology Quality Desk',
        barcode: 'QC-HAE-TRI-LEVEL',
        status: 'QC_PASSED',
        color: 'border-amber-500 text-amber-500 bg-amber-500/10',
        details:
          'Daily tri-level commercial whole blood controls (Low, Normal, High) evaluated. Confirms laser scatter stability, aperture cleanliness, and coefficient of variation (<2.0% for RBC and Platelets).',
        highlight: 'ISO 15189 compliance: automatic analyzer lockout if QC rules fail.',
        image: '/screens/qc.jpg',
        speech:
          'Station 3: Tri-level commercial control validation. Low, normal, and high controls evaluated on Levey-Jennings charts with coefficients of variation under 2 percent.',
        actionLabel: 'Audit Tri-Level Control Scatter Co-Efficients',
      },
      {
        id: 'morphology',
        name: '4. Peripheral Blood Film Morphology',
        dept: 'Microscopy & Morphology Bench',
        barcode: 'SMR-HAE-000891',
        status: 'MORPHOLOGY_DONE',
        color: 'border-teal-500 text-teal-500 bg-teal-500/10',
        details:
          'Automated rule triggers when analyzer flags abnormal scatter (e.g. blast flag, nucleated RBCs, or severe thrombocytopenia). Medical Lab Scientist performs 100-cell differential and records morphology narrative.',
        highlight:
          'Standardized digital morphology codes: hypochromia, target cells, sickle forms, poikilocytosis.',
        image: '/screens/worklist.webp',
        speech:
          'Station 4: Peripheral blood film morphology. Scientist confirms normocytic normochromic red cells with no toxic granulation or blast cells.',
        actionLabel: 'Review Smear & Sign Morphology Narrative',
      },
      {
        id: 'coag_bank',
        name: '5. Coagulation & Blood Group Crossmatch',
        dept: 'Blood Transfusion Unit',
        barcode: 'COAG-PT-INR-1.1',
        status: 'CROSSMATCHED',
        color: 'border-purple-500 text-purple-500 bg-purple-500/10',
        details:
          'Citrate plasma evaluated for Prothrombin Time (PT/INR) and APTT. For surgical encounters, patient forward and reverse blood grouping (ABO/Rh) is crossmatched against donor pack units.',
        highlight:
          'Dual-scientist electronic sign-off ensures zero incompatible transfusion events.',
        image: '/screens/results.jpg',
        speech:
          'Station 5: Coagulation profile and blood group crossmatching. Patient confirmed O Rh-positive with normal INR of 1.10.',
        actionLabel: 'Confirm ABO/Rh Compatibility & INR Metric',
      },
      {
        id: 'haem_release',
        name: '6. Cumulative Release & Emergency Alert',
        dept: 'Clinical Outbox Rail',
        barcode: 'VERIFY-QR-5421',
        status: 'RELEASED',
        color: 'border-accent text-accent bg-accent/10',
        details:
          'Signed FBC, differential, coagulation, and blood group report delivered to surgical theatre and patient portal. Critical anemia (Hb < 7.0 g/dL) or severe thrombocytopenia triggers instant phone dispatch.',
        highlight:
          'Public QR verification confirms verified sign-out by registered Medical Laboratory Scientist.',
        image: '/screens/referral-portal.jpg',
        speech:
          'Station 6: Final sign-out. All indices validated. Cumulative PDF released to oncology and maternity wards.',
        actionLabel: 'Release Cryptographic Report to Surgical Ward',
      },
    ],
  },
  microbiology: {
    id: 'microbiology',
    name: 'Medical Microbiology & Parasitology',
    shortName: 'Microbiology',
    icon: 'shield',
    badge: '6 Culture & AST Stages',
    badgeColor: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
    specimenType: 'Mid-Stream Urine / Blood Culture / Wound Swab',
    sampleBarcode: 'MIC-2026-000318',
    tatTarget: '24 - 72 Hours (Culture & AST)',
    description:
      'Culture lifecycle tracking from specimen plating, automated incubation chamber logs, pathogen identification, to Kirby-Bauer / MIC antimicrobial susceptibility testing.',
    stations: [
      {
        id: 'micro_intake',
        name: '1. Specimen Intake & Direct Gram Stain',
        dept: 'Microbiology Reception Bench',
        barcode: 'MIC-2026-000318',
        status: 'ACCESSIONED',
        color: 'border-sky-500 text-sky-500 bg-sky-500/10',
        details:
          'Specimen accessioned with anatomic collection site, clinical antibiotic history, and provisional diagnosis. Primary direct microscopy (Gram stain, wet mount) performed and preliminary findings logged.',
        highlight:
          'Same-hour preliminary Gram stain report delivered to attending physician for acute sepsis.',
        image: '/screens/case-detail.webp',
        speech:
          'Station 1: Microbiology intake. Primary gram stain reveals Gram-negative bacilli with elevated pus cells.',
        actionLabel: 'Record Primary Direct Gram Stain Smear',
      },
      {
        id: 'plating',
        name: '2. Selective Agar Plating & Inoculation',
        dept: 'Inoculation Hood Desk',
        barcode: 'PLT-MIC-000318',
        status: 'PLATED',
        color: 'border-indigo-500 text-indigo-500 bg-indigo-500/10',
        details:
          'Specimen streaked onto calibrated agar plates (Blood Agar, Chocolate Agar, MacConkey, Sabouraud Dextrose). Each plate receives a unique thermal DataMatrix label linked to the master case.',
        highlight:
          'Enforces media QC: expired or unvalidated agar batches cannot be scanned for plating.',
        image: '/screens/disciplines.jpg',
        speech:
          'Station 2: Selective inoculation onto Blood agar and MacConkey agar plates with 4-quadrant streak barcoding.',
        actionLabel: 'Scan Media Plates & Log Streak Inoculation',
      },
      {
        id: 'incubation',
        name: '3. Incubation Chamber Monitoring',
        dept: 'Digital Incubation Core',
        barcode: 'INC-CHAMBER-B3',
        status: 'INCUBATING',
        color: 'border-amber-500 text-amber-500 bg-amber-500/10',
        details:
          'Plates placed into digitally monitored incubation chambers (35-37°C, ambient / 5% CO₂ / anaerobic). System tracks incubation timer with scheduled optical reading reminders at 18h, 24h, and 48h.',
        highlight:
          'Continuous temperature sensor logging with automated SMS alert on incubator temperature deviation.',
        image: '/screens/worklist.webp',
        speech:
          'Station 3: 24-hour incubation at 37 degrees Celsius with digital temperature logging and colony growth monitoring.',
        actionLabel: 'Check-In to 37°C CO₂ Incubation Chamber',
      },
      {
        id: 'pathogen_id',
        name: '4. Colony Morphology & Pathogen ID',
        dept: 'Bacteriology Workstation',
        barcode: 'ORG-KLEB-PNEUM',
        status: 'ID_DONE',
        color: 'border-teal-500 text-teal-500 bg-teal-500/10',
        details:
          'Scientist evaluates colonial characteristics (hemolysis, lactose fermentation, pigment) and performs biochemical testing (Oxidase, Catalase, Coagulase, Indole, VITEK card). Taxonomy selected from standardized database.',
        highlight:
          'Full SNOMED-CT bacterial taxonomy prevents free-text spelling ambiguities in medical records.',
        image: '/screens/results.jpg',
        speech:
          'Station 4: Colony morphology and biochemical tests confirm pathogen identification as Klebsiella pneumoniae.',
        actionLabel: 'Identify Pathogen & Confirm Taxonomy ID',
      },
      {
        id: 'ast_testing',
        name: '5. Antibiotic Susceptibility Testing (AST)',
        dept: 'Antimicrobial Resistance Bench',
        barcode: 'AST-CLSI-M100',
        status: 'AST_DONE',
        color: 'border-purple-500 text-purple-500 bg-purple-500/10',
        details:
          'Kirby-Bauer disc diffusion zone diameters or broth microdilution MIC values measured. Software applies CLSI M100 and EUCAST breakpoint rules to automatically categorize Susceptible (S), Intermediate (I), or Resistant (R).',
        highlight:
          'Automated antibiotic cascade reporting hides reserve carbapenems unless first-line agents fail.',
        image: '/screens/qc.jpg',
        speech:
          'Station 5: Antimicrobial susceptibility testing using Kirby-Bauer disk diffusion and MIC dilution against CLSI breakpoints.',
        actionLabel: 'Interpret Kirby-Bauer & MIC Breakpoint Rules',
      },
      {
        id: 'mdr_release',
        name: '6. MDR Infection Alert & Antibiogram Release',
        dept: 'Infection Control Rail',
        barcode: 'VERIFY-QR-3310',
        status: 'REPORTED & RELEASED',
        color: 'border-accent text-accent bg-accent/10',
        details:
          'Multi-Drug Resistant (MRSA, ESBL, CRE, VRE) flag automatically notifies the Hospital Infection Control committee. Verified culture report and cumulative antibiogram published with QR authentication seal.',
        highlight:
          'Automatic feeds into hospital pharmacological antimicrobial stewardship tracking.',
        image: '/screens/referral-portal.jpg',
        speech:
          'Station 6: Hospital infection control screening. Pathogen confirmed susceptible to Meropenem. Antibiogram report published.',
        actionLabel: 'Trigger Infection Control Check & Issue Antibiogram',
      },
    ],
  },
  preanalytics: {
    id: 'preanalytics',
    name: 'Pre-Analytics & Consignment Logistics',
    shortName: 'Pre-Analytics',
    icon: 'scan',
    badge: '5 Cold-Chain Stages',
    badgeColor: 'border-purple-500/30 text-purple-500 bg-purple-500/10',
    specimenType: 'Multi-Branch Consignment Bag with Vacuum Tubes',
    sampleBarcode: 'CSG-2026-042',
    tatTarget: 'Continuous Logistics Tracking',
    description:
      'Manage multi-branch sample collection, phlebotomy tube accessioning, temperature-monitored consignments, dispatch rider tracking, and reception verification.',
    stations: [
      {
        id: 'satellite_draw',
        name: '1. Satellite Centre Phlebotomy & Accession',
        dept: 'Branch Collection Clinic',
        barcode: 'SAT-TUBE-00812',
        status: 'DRAWN_AT_BRANCH',
        color: 'border-sky-500 text-sky-500 bg-sky-500/10',
        details:
          'Phlebotomist verifies patient identity, collects blood or biopsy, and prints primary barcode on-site. Electronic order links referring physician notes and clinical requirements before transit.',
        highlight:
          'Direct satellite-to-central linkage prevents transcription delays at main lab reception.',
        image: '/screens/preanalytics.jpg',
        speech:
          'Station 1: Satellite clinic phlebotomy. Patient ID verified at bedside. Primary barcode printed and affixed to vacuum tube.',
        actionLabel: 'Print Bedside Barcode & Log Phlebotomy Draw',
      },
      {
        id: 'consignment_bag',
        name: '2. Tamper-Evident Consignment Manifest',
        dept: 'Branch Logistics Desk',
        barcode: 'CSG-2026-042',
        status: 'MANIFESTED',
        color: 'border-indigo-500 text-indigo-500 bg-indigo-500/10',
        details:
          'Individual tubes and biopsy pots scanned into tamper-evident consignment bag. System records cold-chain gel pack activation and prints a master consignment barcode label.',
        highlight:
          'Immutable manifest: no specimen can be dropped or forgotten without system alert.',
        image: '/screens/preanalytics.jpg',
        speech:
          'Station 2: Consignment batching. 8 specimen tubes sealed inside tamper-evident pouch with temperature monitoring gel pack.',
        actionLabel: 'Seal Tamper-Proof Consignment Pouch',
      },
      {
        id: 'rider_handoff',
        name: '3. Dispatch Rider Electronic Transfer',
        dept: 'Rider Transit Chain',
        barcode: 'RIDER-MOTO-89',
        status: 'IN_TRANSIT',
        color: 'border-amber-500 text-amber-500 bg-amber-500/10',
        details:
          'Registered motorcycle courier scans consignment barcode with mobile web app and signs digital custody handoff. GPS coordinates and departure timestamp recorded with estimated transit window.',
        highlight:
          'Real-time rider tracking with automated alert if transit exceeds allowed cold-chain duration.',
        image: '/screens/referral-portal.jpg',
        speech:
          'Station 3: Electronic rider handoff. Digital custody signature logged with GPS departure timestamp.',
        actionLabel: 'Scan Rider ID & Sign Custody Transfer Handoff',
      },
      {
        id: 'central_intake',
        name: '4. Central Reception 1-Scan Intake',
        dept: 'Central Laboratory Reception',
        barcode: 'CSG-2026-042',
        status: 'RECEIVED_CENTRAL',
        color: 'border-teal-500 text-teal-500 bg-teal-500/10',
        details:
          'Reception scientist scans master bag barcode once. The system instantly verifies bag seal integrity, confirms custody handoff, and registers all enclosed tubes in under two seconds.',
        highlight:
          'Eliminates 90% of reception check-in queues during peak morning courier drop-offs.',
        image: '/screens/case-detail.webp',
        speech:
          'Station 4: Central lab 1-scan intake. Single master barcode scan checks in all 8 internal tubes in 2 seconds.',
        actionLabel: 'Perform 1-Scan Master Consignment Intake',
      },
      {
        id: 'rejection_route',
        name: '5. Quality Screening & Worklist Routing',
        dept: 'Central Specimen Routing Desk',
        barcode: 'QC-PASS-RECEPTION',
        status: 'TRANSFERRED_TO_BENCH',
        color: 'border-emerald-500 text-emerald-500 bg-emerald-500/10',
        details:
          'Specimens screened for standard pre-analytical rejection codes (hemolysis, clotting, underfill, fixation delay). Acceptable samples immediately route to Chemistry, Haematology, Microbiology, or Histology benches.',
        highlight:
          'Instant automated SMS to satellite clinic if a specimen fails quality criteria.',
        image: '/screens/worklist.webp',
        speech:
          'Station 5: Pre-analytical quality check. Zero hemolysis or clotting. Tubes automatically routed to designated departmental worklists.',
        actionLabel: 'Verify Specimen Quality & Dispatch to Worklists',
      },
    ],
  },
};

const activeUnit = computed(() => custodyUnits[activeCustodyUnitKey.value]);
const unitStations = computed(() => activeUnit.value.stations);
const activeStation = computed(
  () => unitStations.value[activeStationIndex.value] || unitStations.value[0],
);
const simulationProgressPercent = computed(() => {
  return Math.round(((activeStationIndex.value + 1) / unitStations.value.length) * 100);
});
const isFinalStation = computed(() => activeStationIndex.value === unitStations.value.length - 1);

function selectCustodyUnit(key: CustodyUnitKey) {
  stopAutoSimulation();
  activeCustodyUnitKey.value = key;
  activeStationIndex.value = 0;
  labAudio.playScanBeep();
  if (labAudio.isVoiceEnabled.value) {
    labAudio.speakBriefing(`Switched to ${custodyUnits[key].name}. ${activeStation.value.speech}`);
  }
}

function selectStation(idx: number) {
  activeStationIndex.value = idx;
  labAudio.playScanBeep();
  if (labAudio.isVoiceEnabled.value) {
    labAudio.speakBriefing(activeStation.value.speech);
  }
}

function simulateScanAndAdvance() {
  isScanningSimulated.value = true;
  simulatedScansCount.value++;
  labAudio.playScanBeep();

  setTimeout(() => {
    isScanningSimulated.value = false;
    if (activeStationIndex.value < unitStations.value.length - 1) {
      activeStationIndex.value++;
      if (labAudio.isVoiceEnabled.value) {
        labAudio.speakBriefing(activeStation.value.speech);
      }
      if (activeStationIndex.value === unitStations.value.length - 1) {
        labAudio.playSuccessChime();
      }
    } else {
      labAudio.playSuccessChime();
    }
  }, 240);
}

function toggleAutoSimulation() {
  if (isAutoSimulating.value) {
    stopAutoSimulation();
  } else {
    isAutoSimulating.value = true;
    runAutoSimulationStep();
  }
}

function runAutoSimulationStep() {
  if (!isAutoSimulating.value) return;

  if (activeStationIndex.value >= unitStations.value.length - 1) {
    activeStationIndex.value = 0;
  } else {
    activeStationIndex.value++;
  }

  isScanningSimulated.value = true;
  simulatedScansCount.value++;
  labAudio.playScanBeep();

  if (activeStationIndex.value === unitStations.value.length - 1) {
    labAudio.playSuccessChime();
  } else if (labAudio.isVoiceEnabled.value) {
    labAudio.speakBriefing(activeStation.value.speech);
  }

  setTimeout(() => {
    isScanningSimulated.value = false;
  }, 300);

  autoSimulationTimer = setTimeout(() => {
    if (isAutoSimulating.value) {
      runAutoSimulationStep();
    }
  }, 4800);
}

function stopAutoSimulation() {
  isAutoSimulating.value = false;
  if (autoSimulationTimer) {
    clearTimeout(autoSimulationTimer);
    autoSimulationTimer = null;
  }
}

function resetSimulation() {
  stopAutoSimulation();
  activeStationIndex.value = 0;
  labAudio.playScanBeep();
}

// Interactive ROI & Efficiency Calculator
const monthlyBiopsies = ref(450);
const numScientists = ref(6);
const avgTatDays = ref(10);

const calculatedHoursSavedPerMonth = computed(() => {
  return Math.round((monthlyBiopsies.value * 26) / 60);
});

const calculatedTatReductionDays = computed(() => {
  const reduced = avgTatDays.value * 0.5;
  return Math.max(2, Math.round(avgTatDays.value - reduced));
});

const calculatedRevenueProtected = computed(() => {
  return (monthlyBiopsies.value * 32).toLocaleString();
});

// Interactive Demo Request Modal
const isDemoModalOpen = ref(false);
const isDemoSubmitted = ref(false);
const demoLeadType = ref<'DEMO' | 'TRIAL'>('DEMO');
const demoSubmitting = ref(false);
const demoError = ref<string | null>(null);
const demoForm = reactive({
  hospitalName: '',
  contactName: '',
  clinicalRole: 'Chief Medical Laboratory Scientist (CMLS)',
  email: '',
  phone: '',
  monthlyVolume: '300 - 1,000 tests / month',
  disciplines: ['Histopathology', 'Clinical Chemistry', 'Haematology'],
  notes: '',
});

const roleOther = ref('');
const volumeOther = ref('');
const roleOptions = [
  'Chief Medical Laboratory Scientist (CMLS)',
  'Consultant Pathologist / Histopathologist',
  'Chief Medical Director (CMD) / Hospital Board',
  'Laboratory Manager / Quality Officer',
  'Head of Hospital IT / Informatics',
  'Private Diagnostic Center Director',
].map((value) => ({ value, label: value }));
roleOptions.push({ value: 'Other', label: 'Other — enter your role' });
const volumeOptions = [
  '< 300 tests / month',
  '300 - 1,000 tests / month',
  '1,000 - 5,000 tests / month',
  '5,000+ tests / month (Tertiary Centre)',
].map((value) => ({ value, label: value }));
volumeOptions.push({ value: 'Other', label: 'Other — enter a custom volume' });

function openDemo(type: 'DEMO' | 'TRIAL' = 'DEMO', discipline?: string): void {
  demoLeadType.value = type;
  demoError.value = null;
  if (discipline && !demoForm.disciplines.includes(discipline)) {
    demoForm.disciplines = [discipline, ...demoForm.disciplines].slice(0, 5);
  }
  isDemoModalOpen.value = true;
}

function toggleDiscipline(disc: string) {
  const index = demoForm.disciplines.indexOf(disc);
  if (index > -1) {
    if (demoForm.disciplines.length > 1) demoForm.disciplines.splice(index, 1);
  } else {
    demoForm.disciplines.push(disc);
  }
}

async function submitDemoRequest(): Promise<void> {
  if (!demoForm.hospitalName || !demoForm.email) return;
  demoSubmitting.value = true;
  demoError.value = null;
  try {
    await api.post('/leads', {
      type: demoLeadType.value,
      organizationName: demoForm.hospitalName,
      contactName: demoForm.contactName || demoForm.email,
      email: demoForm.email,
      phone: demoForm.phone || null,
      role:
        demoForm.clinicalRole === 'Other'
          ? roleOther.value.trim() || 'Other'
          : demoForm.clinicalRole,
      departments: demoForm.disciplines,
      monthlyVolume:
        demoForm.monthlyVolume === 'Other'
          ? volumeOther.value.trim() || 'Other'
          : demoForm.monthlyVolume,
      message: demoForm.notes || null,
    });
    isDemoSubmitted.value = true;
  } catch (caught) {
    demoError.value = apiErrorMessage(caught);
  } finally {
    demoSubmitting.value = false;
  }
}

const supportSubmitted = ref(false);
const supportSubmitting = ref(false);
const supportError = ref<string | null>(null);
const supportForm = reactive({
  organizationName: '',
  contactName: '',
  email: '',
  phone: '',
  message: '',
});

async function submitSupport(): Promise<void> {
  if (!supportForm.organizationName || !supportForm.contactName || !supportForm.email) return;
  supportSubmitting.value = true;
  supportError.value = null;
  try {
    await api.post('/leads', {
      type: 'SUPPORT',
      organizationName: supportForm.organizationName,
      contactName: supportForm.contactName,
      email: supportForm.email,
      phone: supportForm.phone || null,
      message: supportForm.message || null,
      departments: [],
    });
    supportSubmitted.value = true;
    toast.success('Support request received', 'Our clinical informatics team will respond.');
  } catch (caught) {
    supportError.value = apiErrorMessage(caught);
  } finally {
    supportSubmitting.value = false;
  }
}

const departmentDemoAccounts = [
  {
    discipline: 'Histopathology',
    subtitle: 'Biopsy custody, synoptic reporting and slide sign-out',
    email: 'pathologist@histo.ng',
    password: 'Pathologist#2026',
    icon: 'microscope',
  },
  {
    discipline: 'Clinical Chemistry',
    subtitle: 'Analytes, reference ranges, autoverification and critical alerts',
    email: 'scientist@histo.ng',
    password: 'Scientist#2026',
    icon: 'beaker',
  },
  {
    discipline: 'Haematology',
    subtitle: 'FBC, coagulation, morphology and Westgard QC',
    email: 'scientist@histo.ng',
    password: 'Scientist#2026',
    icon: 'flask',
  },
  {
    discipline: 'Medical Microbiology',
    subtitle: 'Culture lifecycle, organism ID and AST breakpoints',
    email: 'pathologist2@histo.ng',
    password: 'Pathologist#2026',
    icon: 'shield',
  },
];

function resetDemoModal() {
  isDemoModalOpen.value = false;
  roleOther.value = '';
  volumeOther.value = '';
  setTimeout(() => {
    isDemoSubmitted.value = false;
  }, 400);
}

// Interactive Demo Personas Drawer
const isPersonaDrawerOpen = ref(false);
const demoPersonas = [
  {
    role: 'Consultant Histopathologist',
    name: 'Dr. Adeleke (Anatomical Pathology)',
    email: 'pathologist@histo.ng',
    password: 'Pathologist#2026',
    tasks:
      'Review prioritised histology worklist, fill CAP synoptic cancer forms, sign and lock reports.',
    icon: 'microscope',
  },
  {
    role: 'Medical Lab Scientist (MLS)',
    name: 'Folake Okon (Senior MLS · Chemistry & Haem)',
    email: 'scientist@histo.ng',
    password: 'Scientist#2026',
    tasks:
      'Enter chemistry/haematology results, trigger autoverification rules, acknowledge critical values.',
    icon: 'beaker',
  },
  {
    role: 'Microbiology Scientist',
    name: 'Dr. Ada Nwosu (Medical Microbiology)',
    email: 'pathologist2@histo.ng',
    password: 'Pathologist#2026',
    tasks:
      'Culture bench, organism identification, CLSI/EUCAST AST, resistance flags and antibiogram review.',
    icon: 'shield',
  },
  {
    role: 'Histotechnologist',
    name: 'Ibrahim Bello (Bench Grossing & Microtomy)',
    email: 'grosser@histo.ng',
    password: 'Grosser#2026',
    tasks: 'Hands-free grossing scan station, cassette block generation, microtomy cutting queue.',
    icon: 'block',
  },
  {
    role: 'Referring Clinician / Surgeon',
    name: 'Dr. K. Williams (Surgeon / Clinic)',
    email: 'referrer@clinic.ng',
    password: 'Referrer#2026 (or OTP)',
    tasks:
      'Access Referral Portal, check live specimen custody, download cumulative multi-discipline PDFs.',
    icon: 'stethoscope',
    isPortal: true,
  },
  {
    role: 'Laboratory Administrator',
    name: 'Chief Medical Lab Director',
    email: 'admin@histo.ng',
    password: 'LabAdmin#2026',
    tasks:
      'Departmental oversight: Westgard QC, billing, HMO claims CSV, QA peer review, and user permissions.',
    icon: 'shield',
  },
];

// Interactive FAQ Accordion state
const openFaqIndex = ref<number | null>(0);
function toggleFaq(index: number) {
  openFaqIndex.value = openFaqIndex.value === index ? null : index;
}

const faqs = [
  {
    q: 'Does this software serve all medical laboratory departments or only histopathology?',
    a: 'It is built from the core up as a complete, unified Multi-Discipline Medical Laboratory Information System. Through our modular DisciplineRegistry, your laboratory or hospital can enable and configure: (1) Histopathology & Cytology (complete block-and-slide barcode custody, CAP synoptic cancer staging, WSI); (2) Clinical Chemistry / Chemical Pathology (catalogue panels, age/sex reference ranges, delta checks, autoverification rules); (3) Haematology & Blood Transfusion (FBC/CBC, differential counts, coagulation, blood grouping); (4) Medical Microbiology & Parasitology (culture plating, incubation, organism ID, Kirby-Bauer/MIC antibiotic susceptibility testing); and (5) Phlebotomy & Pre-Analytics (satellite collection centres, consignment tracking, dispatch rider handoffs).',
  },
  {
    q: 'Can a clinician view all departmental results for one patient on a single cumulative report?',
    a: 'Yes! Our cross-discipline cumulative reporting engine combines a patient’s historical and current results across departments into a unified chronological medical report. For example, an oncologist can view a patient’s histopathology biopsy diagnosis directly alongside their serum alkaline phosphatase, CA-125 / PSA tumor markers, and full blood count on a single official PDF.',
  },
  {
    q: 'How does the rules engine handle panic/critical limits and delta checks?',
    a: 'The system features a sandboxed, safe JSON rules engine. For Clinical Chemistry and Haematology, you can configure critical limits (e.g., Potassium > 6.2 mmol/L or Hemoglobin < 7.0 g/dL). When a result triggers a critical limit, the software places it on hold, alerts senior laboratory scientists, and mandates formal acknowledgement before release. Delta checks compare current findings against the patient’s previous results, flagging unexpected rapid shifts.',
  },
  {
    q: 'How does the system ensure zero downtime during hospital power outages or internet drops?',
    a: 'We built this system Nigeria-first with unstable electricity and internet realities in mind. Built as an offline-first Progressive Web App (PWA), laboratory workstations continue scanning barcodes, recording bench steps, and running worklists in local IndexedDB storage even when internet or Wi-Fi drops completely. When connectivity restores, mutations automatically replay with cryptographic idempotency—meaning zero duplicate accessions, zero lost scans, and zero benchtop interruptions.',
  },
  {
    q: 'How does the system help our hospital laboratory achieve ISO 15189:2022 accreditation?',
    a: 'ISO 15189 requires stringent quality management across pre-examination, examination, and post-examination phases. Our system provides: (1) Pre-analytics consignment and coded sample rejections; (2) Immutable, append-only custody event trails for every specimen, cassette, and slide; (3) Reagent and antibody lot quarantine with mandatory validation before routine consumption; (4) Automated Westgard QC evaluation (1₃s, 2₂s, R₄s, 4₁s, 10x) with Levey-Jennings charts; (5) Blinded QA peer-review sampling with discrepancy severity classification; and (6) Cryptographically sealed reports with public QR verification.',
  },
  {
    q: 'How do satellite collection centres and dispatch riders hand off specimens?',
    a: 'The Pre-Analytics module allows satellite clinics and collection centres to accession phlebotomy tubes and biopsies, assign them to tamper-evident consignment bags, and dispatch them with registered motorcycle riders. When the rider arrives at the central hospital laboratory, receiving scientists perform a single scan of the consignment barcode to verify and intake all specimens in seconds.',
  },
  {
    q: 'How does the LIMS integrate with our hospital’s existing EMR / HIS (e.g., Epic, Cerner, or custom systems)?',
    a: 'Our API includes bi-directional HL7 v2 and FHIR R4 interoperability out of the box. An embedded TCP MLLP listener ingests ORM^O01 / OML^O21 orders directly from your hospital EMR and returns signed ORU^R01 result messages. Furthermore, a modern FHIR R4 REST API exposes Patient, ServiceRequest, Specimen, and DiagnosticReport resources with SNOMED CT and ICD-O-3 oncological coding.',
  },
  {
    q: 'What barcode scanners and benchtop hardware are required?',
    a: 'No proprietary or expensive hardware lock-in. Our scan stations operate using standard, affordable USB or Bluetooth keyboard-wedge 2D barcode scanners (supporting DataMatrix and QR codes). The interface is designed for benchtop ergonomics: full-screen, high-contrast typography, large touch targets, and distinct audio tones. Labels print on standard thermal label printers (Zebra ZPL, TSC, or PDF).',
  },
];
</script>

<template>
  <div id="main-content" class="min-h-screen bg-canvas text-ink selection:bg-accent/20">
    <!-- Top Clinical Telemetry & Accreditation Ribbon -->
    <div
      class="border-b border-rail-line/70 bg-rail px-4 py-1.5 font-mono text-[11px] text-rail-muted"
    >
      <div class="mx-auto flex max-w-shell items-center justify-between gap-3">
        <!-- Live System & Standard Badges -->
        <div
          class="flex items-center gap-2 sm:gap-3 overflow-hidden text-ellipsis whitespace-nowrap"
        >
          <span class="inline-flex items-center gap-1.5 font-medium text-rail-ink">
            <span class="relative flex h-2 w-2">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
              />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span class="hidden xs:inline">MULTI-DISCIPLINE LAB ENGINE</span>
            <span class="xs:hidden">ENTERPRISE LIMS</span>
          </span>
          <span class="text-rail-line">|</span>
          <span
            class="hidden sm:inline-flex items-center gap-1 text-2xs tracking-wide text-rail-muted"
          >
            <span class="text-emerald-400 font-semibold">ISO 15189:2022</span>
            <span>·</span>
            <span>HL7 / FHIR R4</span>
            <span>·</span>
            <span>OFFLINE PWA</span>
          </span>
          <span class="sm:hidden text-2xs text-emerald-400 font-semibold">ISO 15189 ALIGNED</span>
        </div>

        <!-- Quick Demo Switcher Pill -->
        <div class="flex items-center gap-3 shrink-0">
          <button
            type="button"
            class="group inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-2xs font-medium text-accent hover:border-accent hover:bg-accent/20 transition-all font-mono"
            @click="isPersonaDrawerOpen = true"
          >
            <AppIcon name="users" size="12" class="text-accent" />
            <span class="font-semibold">Interactive Roles</span>
            <span class="hidden md:inline text-rail-muted text-[10px]">(6 Personas)</span>
            <span class="text-[10px] transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </div>
    </div>

    <!-- MODERN, SPACIOUS NAVIGATION HEADER -->
    <header
      class="sticky top-0 z-40 border-b border-line/70 bg-surface/90 backdrop-blur-xl shadow-xs transition-all duration-200"
    >
      <div class="mx-auto flex max-w-shell items-center justify-between px-4 h-16 sm:px-6 lg:px-8">
        <!-- Left: Wordmark & Medical Subtitle Badge -->
        <div class="flex items-center gap-3 shrink-0">
          <NuxtLink to="/landing" class="group flex items-center gap-3 focus:outline-none">
            <AppWordmark compact />
            <div class="hidden xl:flex flex-col border-l border-line/70 pl-3">
              <span class="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-ink">
                Hospital Grade LIMS
              </span>
              <span class="font-mono text-[8px] tracking-wide text-muted">
                Offline-First Lab Core
              </span>
            </div>
          </NuxtLink>
        </div>

        <!-- Center: Spacious, Refined Nav Items -->
        <nav
          class="hidden lg:flex items-center gap-1 font-mono text-xs uppercase tracking-wider"
          aria-label="Main Navigation"
        >
          <a
            href="#departments"
            class="px-3.5 py-2 rounded-md text-muted hover:text-ink hover:bg-raised transition-all"
          >
            Departments
          </a>
          <a
            href="#custody"
            class="px-3.5 py-2 rounded-md text-muted hover:text-ink hover:bg-raised transition-all"
          >
            Chain of Custody
          </a>
          <a
            href="#quality"
            class="px-3.5 py-2 rounded-md text-muted hover:text-ink hover:bg-raised transition-all"
          >
            Westgard QC &amp; QA
          </a>
          <a
            href="#calculator"
            class="px-3.5 py-2 rounded-md text-muted hover:text-ink hover:bg-raised transition-all"
          >
            ROI Calculator
          </a>
          <a
            href="#support"
            class="px-3.5 py-2 rounded-md text-muted hover:text-ink hover:bg-raised transition-all"
          >
            Support
          </a>
          <a
            href="#faq"
            class="px-3.5 py-2 rounded-md text-muted hover:text-ink hover:bg-raised transition-all"
          >
            FAQ
          </a>
        </nav>

        <!-- Right: Uncrowded Actions & Refined Portals Dropdown -->
        <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <ThemeToggle />

          <!-- Authenticated State -->
          <NuxtLink
            v-if="auth.isAuthenticated"
            to="/"
            class="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold transition hover:bg-emerald-500/20 shadow-xs"
          >
            <AppIcon name="dashboard" size="14" />
            <span>Staff Dashboard</span>
          </NuxtLink>

          <!-- Unauthenticated Portals Dropdown (Replaces 2 separate bulky buttons!) -->
          <div v-else ref="portalsDropdownRef" class="relative">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-2 font-mono text-xs uppercase tracking-wider text-ink transition hover:border-line-strong hover:bg-surface focus:outline-none"
              :class="{ 'border-accent/60 bg-surface shadow-xs': isPortalsMenuOpen }"
              aria-haspopup="true"
              :aria-expanded="isPortalsMenuOpen"
              @click.stop="isPortalsMenuOpen = !isPortalsMenuOpen"
            >
              <AppIcon name="lock" size="13" class="text-accent" />
              <span class="hidden sm:inline">Portals</span>
              <span class="sm:hidden">Sign In</span>
              <AppIcon
                name="chevron-down"
                size="12"
                class="text-muted transition-transform duration-200"
                :class="{ 'rotate-180': isPortalsMenuOpen }"
              />
            </button>

            <!-- Floating Portals Menu -->
            <transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="transform scale-95 opacity-0 -translate-y-1"
              enter-to-class="transform scale-100 opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="transform scale-100 opacity-100 translate-y-0"
              leave-to-class="transform scale-95 opacity-0 -translate-y-1"
            >
              <div
                v-if="isPortalsMenuOpen"
                class="absolute right-0 mt-2 w-80 rounded-lg border border-line-strong bg-surface p-2 shadow-2xl z-50 animate-scan-in"
                style="background-color: rgb(var(--surface))"
                role="menu"
              >
                <!-- Clinician Portal Link -->
                <NuxtLink
                  to="/portal/login"
                  class="group flex items-start gap-3 rounded-md p-2.5 transition hover:bg-raised"
                  role="menuitem"
                  @click="isPortalsMenuOpen = false"
                >
                  <div
                    class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/10 text-accent group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink transition"
                  >
                    <AppIcon name="stethoscope" size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span
                        class="font-mono text-xs font-semibold text-ink group-hover:text-accent transition"
                      >
                        Clinician Referral Portal
                      </span>
                      <span class="font-mono text-[9px] uppercase tracking-caps text-muted"
                        >Doctors</span
                      >
                    </div>
                    <p class="mt-0.5 text-xs text-muted leading-snug">
                      Referring surgeons, hospital wards, live specimen tracking &amp; cumulative
                      report downloads.
                    </p>
                  </div>
                </NuxtLink>

                <!-- Staff Console Link -->
                <NuxtLink
                  to="/login"
                  class="group flex items-start gap-3 rounded-md p-2.5 transition hover:bg-raised"
                  role="menuitem"
                  @click="isPortalsMenuOpen = false"
                >
                  <div
                    class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-ink group-hover:border-line-strong group-hover:bg-ink group-hover:text-canvas transition"
                  >
                    <AppIcon name="user" size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span
                        class="font-mono text-xs font-semibold text-ink group-hover:text-accent transition"
                      >
                        Staff Laboratory Console
                      </span>
                      <span class="font-mono text-[9px] uppercase tracking-caps text-muted"
                        >Lab Team</span
                      >
                    </div>
                    <p class="mt-0.5 text-xs text-muted leading-snug">
                      Benchtop grossing, microtomy queues, auto-verification, Westgard QC &amp;
                      report sign-off.
                    </p>
                  </div>
                </NuxtLink>

                <!-- Divider & Demo Roles Trigger -->
                <div class="my-1 border-t border-line/60" />
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-mono text-2xs uppercase tracking-wider text-accent hover:bg-accent/10 transition"
                  @click="
                    isPortalsMenuOpen = false;
                    isPersonaDrawerOpen = true;
                  "
                >
                  <span class="flex items-center gap-1.5 font-semibold">
                    <AppIcon name="users" size="13" />
                    <span>Try 6 Instant Demo Roles</span>
                  </span>
                  <span class="text-xs">→</span>
                </button>
              </div>
            </transition>
          </div>

          <!-- Primary CTA Button: Book Hospital Demo -->
          <button
            type="button"
            class="group inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink shadow-sm transition hover:bg-accent/90 hover:shadow-lift hover:-translate-y-0.5 active:translate-y-0"
            @click="openDemo('DEMO')"
          >
            <AppIcon name="calendar" size="14" class="transition-transform group-hover:scale-110" />
            <span class="whitespace-nowrap">Book Demo</span>
          </button>

          <!-- Mobile Hamburger Trigger -->
          <button
            type="button"
            class="lg:hidden flex h-9 w-9 items-center justify-center rounded-md border border-line bg-raised text-ink transition hover:bg-surface focus:outline-none"
            aria-label="Toggle navigation menu"
            @click="isMobileNavOpen = !isMobileNavOpen"
          >
            <AppIcon :name="isMobileNavOpen ? 'close' : 'menu'" size="18" />
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="isMobileNavOpen"
          class="border-b border-line bg-surface px-5 py-5 lg:hidden shadow-lift"
          style="background-color: rgb(var(--surface))"
        >
          <div class="flex flex-col gap-4">
            <!-- Nav Anchors -->
            <div class="flex flex-col gap-1 font-mono text-xs uppercase tracking-wide">
              <span class="pb-1 text-[10px] font-semibold text-muted tracking-caps"
                >Navigation</span
              >
              <a
                href="#departments"
                class="flex items-center justify-between rounded-md py-2 px-3 text-ink hover:bg-raised transition"
                @click="isMobileNavOpen = false"
              >
                <span>Laboratory Departments</span>
                <span class="font-mono text-2xs text-accent">5 Disciplines</span>
              </a>
              <a
                href="#custody"
                class="flex items-center justify-between rounded-md py-2 px-3 text-ink hover:bg-raised transition"
                @click="isMobileNavOpen = false"
              >
                <span>Specimen Custody Tour</span>
                <span class="font-mono text-2xs text-muted">7 Stations</span>
              </a>
              <a
                href="#quality"
                class="flex items-center justify-between rounded-md py-2 px-3 text-ink hover:bg-raised transition"
                @click="isMobileNavOpen = false"
              >
                <span>Westgard QC &amp; QA Peer Review</span>
                <span class="font-mono text-2xs text-emerald-500">ISO 15189</span>
              </a>
              <a
                href="#calculator"
                class="flex items-center justify-between rounded-md py-2 px-3 text-ink hover:bg-raised transition"
                @click="isMobileNavOpen = false"
              >
                <span>ROI &amp; Efficiency Calculator</span>
                <span class="font-mono text-2xs text-muted">Interactive</span>
              </a>
              <a
                href="#support"
                class="flex items-center justify-between rounded-md py-2 px-3 text-ink hover:bg-raised transition"
                @click="isMobileNavOpen = false"
              >
                <span>Support &amp; Commercial</span>
                <span class="font-mono text-2xs text-accent">Contact</span>
              </a>
              <a
                href="#faq"
                class="flex items-center justify-between rounded-md py-2 px-3 text-ink hover:bg-raised transition"
                @click="isMobileNavOpen = false"
              >
                <span>Frequently Asked Questions</span>
                <span class="font-mono text-2xs text-muted">8 Topics</span>
              </a>
            </div>

            <!-- Portal Access Cards -->
            <div class="border-t border-line/60 pt-3">
              <span
                class="block pb-2 font-mono text-[10px] font-semibold uppercase tracking-caps text-muted"
              >
                System Access
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <NuxtLink
                  to="/portal/login"
                  class="flex items-center gap-2.5 rounded-md border border-line bg-raised p-2.5 text-ink transition hover:border-accent"
                  @click="isMobileNavOpen = false"
                >
                  <AppIcon name="stethoscope" size="16" class="text-accent" />
                  <div class="min-w-0">
                    <span class="block font-mono text-xs font-semibold">Clinician Portal</span>
                    <span class="block text-[11px] text-muted"
                      >Referring Doctors &amp; Clinics</span
                    >
                  </div>
                </NuxtLink>
                <NuxtLink
                  to="/login"
                  class="flex items-center gap-2.5 rounded-md border border-line bg-raised p-2.5 text-ink transition hover:border-line-strong"
                  @click="isMobileNavOpen = false"
                >
                  <AppIcon name="user" size="16" class="text-ink" />
                  <div class="min-w-0">
                    <span class="block font-mono text-xs font-semibold">Staff Console</span>
                    <span class="block text-[11px] text-muted"
                      >Scientists, Pathologists &amp; Techs</span
                    >
                  </div>
                </NuxtLink>
              </div>
            </div>

            <!-- Quick Demo Personas -->
            <div class="border-t border-line/60 pt-3">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md border border-accent/30 bg-accent/10 px-3.5 py-2.5 font-mono text-xs text-accent transition hover:bg-accent/20"
                @click="
                  isMobileNavOpen = false;
                  isPersonaDrawerOpen = true;
                "
              >
                <span class="flex items-center gap-2 font-semibold uppercase tracking-wider">
                  <AppIcon name="users" size="14" />
                  <span>Launch 6 Live Demo Personas</span>
                </span>
                <span>→</span>
              </button>
            </div>

            <!-- Primary Action in Mobile -->
            <button
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink shadow-sm transition hover:bg-accent/90"
              @click="
                isMobileNavOpen = false;
                isDemoModalOpen = true;
              "
            >
              <AppIcon name="calendar" size="15" />
              <span>Book Hospital Live Demo</span>
            </button>
          </div>
        </div>
      </transition>
    </header>

    <!-- HERO SECTION: FULL MULTI-DISCIPLINE PLATFORM -->
    <section
      class="relative overflow-hidden border-b border-line bg-surface pt-12 pb-16 lg:pt-20 lg:pb-24"
    >
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.07]"
        style="
          background-image: radial-gradient(rgb(var(--ink)) 1px, transparent 1px);
          background-size: 24px 24px;
        "
        aria-hidden="true"
      />

      <div class="relative mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div class="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <!-- Left Hero Narrative -->
          <div class="lg:col-span-7">
            <div
              class="inline-flex items-center gap-2 border border-accent/30 bg-accent-soft/40 px-3 py-1 font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span>Enterprise Medical Laboratory Information System</span>
            </div>

            <h1 class="display mt-6 text-4xl sm:text-5xl lg:text-6xl tracking-tight text-ink">
              One Unified System.<br />
              All Laboratory Departments.<br />
              <span class="text-accent">Zero Diagnostic Compromise.</span>
            </h1>

            <p class="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-muted">
              Built specifically for
              <strong class="text-ink font-semibold">Medical Laboratory Scientists (MLS)</strong>,
              Pathologists, and Hospital Clinicians. Unify high-volume Clinical Chemistry
              autoverification, Haematology delta checks, Microbiology culture &amp; AST
              sensitivity, and deep Histopathology block-and-slide custody into a single,
              offline-resilient hospital platform.
            </p>

            <!-- Department Chips -->
            <div class="mt-6 flex flex-wrap gap-2 font-mono text-xs">
              <span class="border border-line bg-raised px-2.5 py-1 text-ink"
                >Histopathology &amp; Cytology</span
              >
              <span class="border border-line bg-raised px-2.5 py-1 text-ink"
                >Clinical Chemistry</span
              >
              <span class="border border-line bg-raised px-2.5 py-1 text-ink"
                >Haematology &amp; Blood Bank</span
              >
              <span class="border border-line bg-raised px-2.5 py-1 text-ink"
                >Medical Microbiology</span
              >
              <span class="border border-line bg-raised px-2.5 py-1 text-ink"
                >Phlebotomy &amp; Logistics</span
              >
            </div>

            <!-- CTA Actions -->
            <div class="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                class="flex items-center gap-2.5 bg-accent px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink shadow-lift transition hover:bg-accent/90"
                @click="openDemo('DEMO')"
              >
                <AppIcon name="calendar" size="16" />
                <span>Request Hospital Walkthrough</span>
              </button>

              <button
                type="button"
                class="flex items-center gap-2.5 border border-accent/50 bg-accent/10 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-accent transition hover:bg-accent/20"
                @click="openDemo('TRIAL')"
              >
                <AppIcon name="check" size="16" />
                <span>Start 1-Month Free Trial</span>
              </button>

              <a
                href="#departments"
                class="flex items-center gap-2 border border-line-strong bg-raised px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink transition hover:bg-canvas hover:border-ink"
              >
                <AppIcon name="beaker" size="16" class="text-accent" />
                <span>Explore All Departments</span>
              </a>

              <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 font-mono text-xs text-muted transition hover:text-accent"
                @click="isPersonaDrawerOpen = true"
              >
                <AppIcon name="users" size="16" />
                <span class="underline underline-offset-4">Test Drive Staff Roles</span>
              </button>
            </div>
          </div>

          <!-- Right Hero Console Card -->
          <div class="lg:col-span-5">
            <div
              class="relative overflow-hidden border border-line bg-rail text-rail-ink shadow-lift"
            >
              <div
                class="flex items-center justify-between border-b border-rail-line bg-rail px-4 py-3"
              >
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                  <span class="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span class="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  <span class="ml-2 font-mono text-2xs uppercase tracking-caps text-rail-muted">
                    Hospital Central Laboratory Console
                  </span>
                </div>
                <span class="font-mono text-2xs text-emerald-400 flex items-center gap-1">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ALL UNITS ONLINE
                </span>
              </div>

              <!-- Multi-Department Real-Time Telemetry -->
              <div class="p-6 space-y-4 font-mono text-xs">
                <!-- Patient Encounter Header -->
                <div class="flex items-start justify-between border-b border-rail-line pb-3">
                  <div>
                    <span class="text-2xs uppercase tracking-caps text-accent"
                      >Encounter: EN-2026-000482</span
                    >
                    <h3 class="font-display text-xl text-rail-ink">
                      Patient: Mrs. Amina Bello (Age: 52 · F)
                    </h3>
                    <p class="text-2xs text-rail-muted">
                      MRN: MRN-70419 · Ward: Oncology Annex · Dr. Adeleke
                    </p>
                  </div>
                  <span
                    class="border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-2xs uppercase tracking-caps text-emerald-400"
                  >
                    CUMULATIVE VIEW
                  </span>
                </div>

                <!-- Discipline 1: Histology -->
                <div class="border-l-2 border-rose-500 bg-rail-line/20 p-2.5">
                  <div class="flex justify-between items-center">
                    <span class="text-rose-400 font-semibold"
                      >HISTOPATHOLOGY: Breast Core Biopsy</span
                    >
                    <span class="text-2xs uppercase text-emerald-400">REPORT LOCKED</span>
                  </div>
                  <span class="text-2xs text-rail-muted block mt-1"
                    >CAP Synoptic: Invasive Ductal Carcinoma · Nottingham Grade II</span
                  >
                </div>

                <!-- Discipline 2: Clinical Chemistry -->
                <div class="border-l-2 border-sky-500 bg-rail-line/20 p-2.5">
                  <div class="flex justify-between items-center">
                    <span class="text-sky-400 font-semibold"
                      >CHEMICAL PATHOLOGY: Liver &amp; Renal Panel</span
                    >
                    <span class="text-2xs uppercase text-sky-400">AUTOVERIFIED</span>
                  </div>
                  <div class="flex justify-between text-2xs text-rail-muted mt-1">
                    <span>Creatinine: 78 μmol/L (Norm)</span>
                    <span class="text-amber-400">Alk Phos: 168 U/L (Elevated ↑)</span>
                  </div>
                </div>

                <!-- Discipline 3: Haematology -->
                <div class="border-l-2 border-amber-500 bg-rail-line/20 p-2.5">
                  <div class="flex justify-between items-center">
                    <span class="text-amber-400 font-semibold"
                      >HAEMATOLOGY: Full Blood Count (FBC)</span
                    >
                    <span class="text-2xs uppercase text-emerald-400">RELEASED</span>
                  </div>
                  <div class="flex justify-between text-2xs text-rail-muted mt-1">
                    <span>Hb: 11.8 g/dL</span>
                    <span>WBC: 6.4 × 10⁹/L</span>
                    <span>Platelets: 245 × 10⁹/L</span>
                  </div>
                </div>

                <!-- Discipline 4: Microbiology -->
                <div class="border-l-2 border-emerald-500 bg-rail-line/20 p-2.5">
                  <div class="flex justify-between items-center">
                    <span class="text-emerald-400 font-semibold"
                      >MICROBIOLOGY: Blood Culture &amp; AST</span
                    >
                    <span class="text-2xs uppercase text-emerald-400">NO GROWTH (48H)</span>
                  </div>
                  <span class="text-2xs text-rail-muted block mt-1"
                    >Automated incubation chamber log verified</span
                  >
                </div>

                <div
                  class="pt-2 border-t border-rail-line flex items-center justify-between text-2xs text-rail-muted"
                >
                  <span>Tamper-Proof QR Seal: QR-9921-HP</span>
                  <span class="text-emerald-400">Delivered via WhatsApp &amp; Portal</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Metric Stat Strip -->
        <div class="mt-16 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          <div class="bg-raised p-6 text-center sm:text-left">
            <span class="display block text-3xl sm:text-4xl text-accent font-semibold"
              >5 Units</span
            >
            <span class="mt-1 block font-mono text-xs uppercase tracking-caps text-muted"
              >All Departments Unified</span
            >
            <p class="mt-2 text-xs text-muted">
              Histo, Chemistry, Haem, Micro &amp; Pre-Analytics.
            </p>
          </div>
          <div class="bg-raised p-6 text-center sm:text-left">
            <span class="display block text-3xl sm:text-4xl text-ink font-semibold">48%</span>
            <span class="mt-1 block font-mono text-xs uppercase tracking-caps text-muted"
              >TAT Acceleration</span
            >
            <p class="mt-2 text-xs text-muted">
              Automated autoverification &amp; custody scan stations.
            </p>
          </div>
          <div class="bg-raised p-6 text-center sm:text-left">
            <span class="display block text-3xl sm:text-4xl text-ink font-semibold">100%</span>
            <span class="mt-1 block font-mono text-xs uppercase tracking-caps text-muted"
              >Offline-First Uptime</span
            >
            <p class="mt-2 text-xs text-muted">
              Local IndexedDB mutation queue ignores network drops.
            </p>
          </div>
          <div class="bg-raised p-6 text-center sm:text-left">
            <span class="display block text-3xl sm:text-4xl text-ink font-semibold">ISO 15189</span>
            <span class="mt-1 block font-mono text-xs uppercase tracking-caps text-muted"
              >Quality Aligned</span
            >
            <p class="mt-2 text-xs text-muted">
              Westgard multi-rules, lot quarantine &amp; peer review.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- INTERACTIVE DEPARTMENT EXPLORER: ALL 5 UNITS -->
    <section id="departments" class="scroll-mt-20 border-b border-line bg-canvas py-16 lg:py-24">
      <div class="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto">
          <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
            >Comprehensive Departmental Suite</span
          >
          <h2 class="display mt-3 text-3xl sm:text-4xl text-ink">
            Engineered for Every Division in Medical Laboratory Science
          </h2>
          <p class="mt-4 text-base text-muted">
            Click through each clinical department to inspect its specialized benchtop workflow,
            scientific rule engine, and integration with the central hospital system.
          </p>
        </div>

        <!-- Department Tabs Selector -->
        <div
          class="mt-12 flex flex-wrap justify-center gap-2 border-b border-line pb-4 font-mono text-xs uppercase tracking-wide"
        >
          <button
            v-for="dept in departments"
            :key="dept.id"
            type="button"
            class="flex items-center gap-2 border px-4 py-2.5 transition"
            :class="
              activeDepartment === dept.id
                ? 'border-accent bg-raised text-ink font-semibold shadow-sm'
                : 'border-line bg-surface text-muted hover:text-ink hover:border-line-strong'
            "
            @click="activeDepartment = dept.id as any"
          >
            <AppIcon :name="dept.icon as any" size="16" />
            <span>{{ dept.name }}</span>
          </button>
        </div>

        <!-- Department Detail Card -->
        <div
          v-for="dept in departments"
          :key="dept.id"
          v-show="activeDepartment === dept.id"
          class="mt-8 border border-line bg-raised p-6 sm:p-10 shadow-lift"
        >
          <div class="grid items-center gap-10 lg:grid-cols-12">
            <!-- Left Info -->
            <div class="lg:col-span-6">
              <div class="flex items-center gap-2">
                <span
                  class="border px-2.5 py-0.5 font-mono text-2xs uppercase tracking-caps font-semibold"
                  :class="dept.color"
                >
                  Department: {{ dept.name }}
                </span>
              </div>

              <h3 class="display mt-4 text-3xl text-ink">
                {{ dept.title }}
              </h3>

              <p class="mt-4 text-base leading-relaxed text-muted">
                {{ dept.summary }}
              </p>

              <!-- Feature Checklist -->
              <div class="mt-6 space-y-2.5">
                <div
                  v-for="(feat, fIdx) in dept.features"
                  :key="fIdx"
                  class="flex items-start gap-2.5 text-xs text-muted"
                >
                  <AppIcon name="check" size="16" class="text-emerald-500 shrink-0 mt-0.5" />
                  <span>{{ feat }}</span>
                </div>
              </div>

              <!-- Department KPI Highlight -->
              <div
                class="mt-8 border border-line bg-canvas p-4 flex items-center justify-between font-mono text-xs"
              >
                <div>
                  <span class="text-2xs text-muted uppercase tracking-caps block"
                    >Proven Metric</span
                  >
                  <span class="text-base font-bold text-ink">{{ dept.stat }}</span>
                </div>
                <span class="text-2xs text-muted">{{ dept.statDesc }}</span>
              </div>

              <div class="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  class="bg-accent px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink transition hover:bg-accent/90"
                  @click="openDemo('DEMO')"
                >
                  See {{ dept.shortName }} in Action
                </button>
                <button
                  type="button"
                  class="border border-line bg-surface px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-ink transition hover:bg-canvas"
                  @click="isPersonaDrawerOpen = true"
                >
                  Test Staff Persona
                </button>
              </div>
            </div>

            <!-- Right Screenshot Preview -->
            <div class="lg:col-span-6">
              <div
                class="relative overflow-hidden border border-line bg-rail text-rail-ink shadow-lift"
              >
                <div
                  class="flex items-center justify-between border-b border-rail-line bg-rail px-4 py-2.5 font-mono text-2xs uppercase tracking-caps text-rail-muted"
                >
                  <span>Actual Module Screenshot</span>
                  <span class="text-accent font-semibold">{{ dept.id.toUpperCase() }}</span>
                </div>
                <div class="aspect-[16/10] overflow-hidden bg-black/40">
                  <img
                    :src="dept.image"
                    :alt="dept.name"
                    class="h-full w-full object-cover object-top transition duration-300 hover:scale-105"
                  />
                </div>
                <div
                  class="border-t border-rail-line bg-rail/80 p-3 font-mono text-2xs text-rail-muted flex items-center justify-between"
                >
                  <span>Live Production Interface</span>
                  <span class="text-emerald-400">ISO 15189 Aligned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- INTERACTIVE 7-STATION SPECIMEN JOURNEY SIMULATOR -->
    <!-- INTERACTIVE MULTI-DISCIPLINE SPECIMEN JOURNEY & BENCHTOP SIMULATOR -->
    <section id="custody" class="scroll-mt-20 border-b border-line bg-surface py-16 lg:py-24">
      <div class="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-2xs uppercase tracking-caps text-accent font-semibold mb-3"
          >
            <span class="h-2 w-2 rounded-full bg-accent animate-ping" />
            <span>Interactive Multi-Discipline Custody Simulator</span>
          </div>
          <h2 class="display mt-1 text-3xl sm:text-4xl lg:text-5xl text-ink">
            Simulate Specimen Chain of Custody Across All 5 Units
          </h2>
          <p class="mt-4 text-base sm:text-lg text-muted">
            Step through, listen to, or auto-simulate physical specimen tracking. Experience
            hands-free barcode scanners, mathematical state machines, and real-time audio guidance
            ensuring zero lost or swapped samples.
          </p>
        </div>

        <!-- 1. UNIT SELECTION TABS: SWITCH TO ANY LABORATORY DEPARTMENT -->
        <div
          class="mt-10 flex flex-wrap items-center justify-center gap-2 border-b border-line/70 pb-6"
        >
          <button
            v-for="unit in Object.values(custodyUnits)"
            :key="unit.id"
            type="button"
            class="group flex items-center gap-2.5 rounded-lg border px-4 py-3 font-mono text-xs uppercase tracking-wider transition-all"
            :class="
              activeCustodyUnitKey === unit.id
                ? 'border-accent bg-accent text-accent-ink font-bold shadow-lift scale-[1.02]'
                : 'border-line bg-raised text-muted hover:border-line-strong hover:bg-canvas hover:text-ink'
            "
            @click="selectCustodyUnit(unit.id)"
          >
            <AppIcon :name="unit.icon" size="16" />
            <span>{{ unit.shortName }}</span>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="
                activeCustodyUnitKey === unit.id
                  ? 'bg-black/25 text-white'
                  : 'bg-surface text-muted border border-line/60'
              "
            >
              {{ unit.stations.length }} Stages
            </span>
          </button>
        </div>

        <!-- 2. AI VOICE ASSISTANT & BENCH SIMULATOR HUD CONTROLS -->
        <div class="mt-6 rounded-xl border border-line bg-canvas p-4 sm:p-5 shadow-sm">
          <div class="flex flex-col md:flex-row items-center justify-between gap-4">
            <!-- Left: AI Voice Assistant Controls -->
            <div class="flex flex-wrap items-center gap-3">
              <!-- Voice Toggle Button -->
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider transition-all"
                :class="
                  labAudio.isVoiceEnabled.value
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'border-line bg-raised text-muted hover:text-ink hover:bg-surface'
                "
                @click="labAudio.toggleVoice"
              >
                <AppIcon
                  :name="labAudio.isVoiceEnabled.value ? 'volume' : 'volume-off'"
                  size="15"
                />
                <span>AI Voice Assistant: {{ labAudio.isVoiceEnabled.value ? 'ON' : 'OFF' }}</span>
                <span
                  class="h-2 w-2 rounded-full"
                  :class="
                    labAudio.isVoiceEnabled.value ? 'bg-emerald-500 animate-pulse' : 'bg-muted/40'
                  "
                />
              </button>

              <!-- Live Audio Equalizer Waveform Indicator -->
              <div
                v-if="labAudio.isSpeaking.value"
                class="flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1.5"
                title="AI Speaking"
              >
                <span class="w-1 bg-accent h-3 animate-pulse" />
                <span class="w-1 bg-accent h-5 animate-pulse" style="animation-delay: 150ms" />
                <span class="w-1 bg-accent h-2 animate-pulse" style="animation-delay: 300ms" />
                <span class="w-1 bg-accent h-4 animate-pulse" style="animation-delay: 450ms" />
                <span class="font-mono text-2xs text-accent font-semibold ml-1"
                  >AI Narrating...</span
                >
              </div>

              <!-- Listen to Stage Audio Button -->
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-3 py-2 font-mono text-xs text-ink transition hover:border-accent hover:text-accent"
                @click="labAudio.speakBriefing(activeStation.speech)"
              >
                <AppIcon name="users" size="13" />
                <span>Hear Stage Clinical Briefing</span>
              </button>
            </div>

            <!-- Right: Simulator Mode & Gamification HUD -->
            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
              <!-- Auto-Simulation Toggle -->
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider transition-all"
                :class="
                  isAutoSimulating
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse'
                    : 'border-line bg-raised text-ink hover:border-line-strong hover:bg-surface'
                "
                @click="toggleAutoSimulation"
              >
                <AppIcon :name="isAutoSimulating ? 'close' : 'calendar'" size="13" />
                <span>{{ isAutoSimulating ? '⏸ Pause Auto-Play' : '▶ Auto-Play Simulation' }}</span>
              </button>

              <!-- Reset Button -->
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-3 py-2 font-mono text-xs text-muted hover:text-ink hover:bg-surface transition"
                title="Reset simulation to Stage 1"
                @click="resetSimulation"
              >
                <AppIcon name="refresh" size="13" />
                <span>Reset</span>
              </button>

              <!-- Gamification HUD Stats -->
              <div
                class="hidden xl:flex items-center gap-2 pl-2 border-l border-line font-mono text-2xs"
              >
                <span class="rounded bg-surface px-2 py-1 text-muted border border-line/60">
                  Scans: <strong class="text-ink font-bold">{{ simulatedScansCount }}</strong>
                </span>
                <span
                  class="rounded bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold"
                >
                  100% ISO Audit Pass
                </span>
              </div>
            </div>
          </div>

          <!-- Unit Summary & Specimen Metadata Rail -->
          <div
            class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3 font-mono text-xs"
          >
            <div class="flex items-center gap-2">
              <span class="text-muted uppercase tracking-caps text-2xs">Active Specimen:</span>
              <span class="text-ink font-bold">{{ activeUnit.specimenType }}</span>
              <span class="text-muted">·</span>
              <span class="text-accent font-semibold">{{ activeUnit.sampleBarcode }}</span>
            </div>
            <div class="flex items-center gap-3 text-2xs text-muted">
              <span
                >TAT Guarantee: <strong class="text-ink">{{ activeUnit.tatTarget }}</strong></span
              >
              <span>·</span>
              <span
                >Progress:
                <strong class="text-accent">{{ simulationProgressPercent }}%</strong> (Stage
                {{ activeStationIndex + 1 }} of {{ unitStations.length }})</span
              >
            </div>
          </div>
        </div>

        <!-- 3. STAGE SELECTOR STRIP -->
        <div class="mt-8 overflow-x-auto pb-4 scroll-area">
          <div class="flex gap-2.5 min-w-max">
            <button
              v-for="(st, idx) in unitStations"
              :key="st.id"
              type="button"
              class="group relative flex flex-col items-start rounded-lg border p-3.5 font-mono text-xs text-left transition-all"
              :class="
                activeStationIndex === idx
                  ? 'border-accent bg-raised shadow-lift text-ink font-semibold scale-[1.02]'
                  : activeStationIndex > idx
                    ? 'border-emerald-500/30 bg-canvas text-ink/80 hover:border-emerald-500/60'
                    : 'border-line bg-canvas text-muted hover:text-ink hover:border-line-strong'
              "
              @click="selectStation(idx)"
            >
              <!-- Top Row: Stage Index & Completed Badge -->
              <div class="flex w-full items-center justify-between gap-4">
                <span class="text-2xs uppercase tracking-caps text-muted"
                  >Stage 0{{ idx + 1 }}</span
                >
                <span
                  v-if="activeStationIndex > idx"
                  class="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500"
                  title="Completed"
                >
                  <AppIcon name="check" size="10" />
                </span>
                <span
                  v-else-if="activeStationIndex === idx"
                  class="h-2 w-2 rounded-full bg-accent animate-ping"
                  title="Active Bench Station"
                />
              </div>

              <!-- Station Name -->
              <span class="mt-1 text-sm font-sans font-semibold text-ink line-clamp-1">
                {{ st.name.split('. ')[1] }}
              </span>

              <!-- Department -->
              <span
                class="mt-1 text-2xs uppercase tracking-wide text-accent font-mono truncate max-w-[180px]"
              >
                {{ st.dept }}
              </span>
            </button>
          </div>
        </div>

        <!-- 4. ACTIVE BENCHTOP SIMULATOR DEEP-DIVE -->
        <div
          class="mt-6 rounded-xl border border-line bg-raised p-6 sm:p-8 lg:p-10 shadow-lift transition-all relative overflow-hidden"
          :class="{ 'ring-2 ring-emerald-500/60 bg-emerald-500/[0.02]': isScanningSimulated }"
        >
          <!-- Simulated Scanner Laser Line Animation -->
          <div
            v-if="isScanningSimulated"
            class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse shadow-[0_0_15px_rgba(255,111,71,1)]"
          />

          <div class="grid items-center gap-10 lg:grid-cols-12">
            <!-- Left: Bench Terminal & Interactive Scanner -->
            <div class="lg:col-span-6">
              <!-- Department & State Chip -->
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded border px-2.5 py-0.5 font-mono text-2xs uppercase tracking-caps font-semibold"
                  :class="activeStation.color"
                >
                  {{ activeStation.status }}
                </span>
                <span class="font-mono text-xs text-muted">
                  Bench Desk: {{ activeStation.dept }}
                </span>
              </div>

              <!-- Station Name -->
              <h3 class="display mt-4 text-2xl sm:text-3xl text-ink">
                {{ activeStation.name }}
              </h3>

              <!-- Station Workflow Explanation -->
              <p class="mt-4 text-base leading-relaxed text-muted">
                {{ activeStation.details }}
              </p>

              <!-- Live Benchtop Telemetry Terminal -->
              <div
                class="mt-6 rounded-lg border border-line bg-canvas p-4 font-mono text-xs shadow-xs"
              >
                <!-- Barcode Payload & Scan Status -->
                <div class="flex items-center justify-between border-b border-line/60 pb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-muted uppercase tracking-caps text-2xs"
                      >Barcode Payload:</span
                    >
                    <span
                      class="text-ink font-bold bg-raised px-2 py-0.5 rounded border border-line/60"
                    >
                      {{ activeStation.barcode }}
                    </span>
                  </div>
                  <span
                    class="rounded-full px-2 py-0.5 text-2xs font-semibold"
                    :class="
                      isScanningSimulated
                        ? 'bg-accent text-accent-ink animate-bounce'
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    "
                  >
                    {{ isScanningSimulated ? 'SCANNING...' : 'DATA MATRIX MATCHED' }}
                  </span>
                </div>

                <!-- State Machine Guarantee -->
                <div class="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span class="text-muted uppercase tracking-caps text-2xs">System Guarantee:</span>
                  <span class="text-emerald-600 dark:text-emerald-400 font-semibold text-right">
                    {{ activeStation.highlight }}
                  </span>
                </div>
              </div>

              <!-- GAMIFIED ACTION: BENCHTOP SCAN BUTTON -->
              <div class="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  class="group flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink shadow-lift transition hover:bg-accent/90 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                  @click="simulateScanAndAdvance"
                >
                  <AppIcon
                    name="scan"
                    size="16"
                    class="transition-transform group-hover:scale-110"
                  />
                  <span>{{ activeStation.actionLabel }}</span>
                  <span class="text-xs transition-transform group-hover:translate-x-1">→</span>
                </button>

                <!-- Navigation Chevrons -->
                <div class="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    class="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-canvas disabled:opacity-30"
                    :disabled="activeStationIndex === 0"
                    aria-label="Previous Stage"
                    @click="selectStation(Math.max(0, activeStationIndex - 1))"
                  >
                    <AppIcon name="chevron-up" size="16" class="-rotate-90" />
                  </button>
                  <button
                    type="button"
                    class="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-canvas disabled:opacity-30"
                    :disabled="activeStationIndex === unitStations.length - 1"
                    aria-label="Next Stage"
                    @click="
                      selectStation(Math.min(unitStations.length - 1, activeStationIndex + 1))
                    "
                  >
                    <AppIcon name="chevron-right" size="16" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Right: Software Screen Preview -->
            <div class="lg:col-span-6">
              <div
                class="relative overflow-hidden rounded-lg border border-line bg-rail text-rail-ink shadow-lift"
              >
                <!-- Terminal Window Header -->
                <div
                  class="flex items-center justify-between border-b border-rail-line bg-rail px-4 py-2.5 font-mono text-2xs uppercase tracking-caps text-rail-muted"
                >
                  <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span class="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span class="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span class="ml-2 font-semibold text-rail-ink">Actual Software Interface</span>
                  </div>
                  <span class="text-accent font-semibold">{{
                    activeStation.id.toUpperCase()
                  }}</span>
                </div>

                <!-- Live Interface Image -->
                <div class="aspect-[16/10] overflow-hidden bg-black/40">
                  <img
                    :src="activeStation.image"
                    :alt="activeStation.name"
                    class="h-full w-full object-cover object-top transition duration-300 hover:scale-105"
                  />
                </div>

                <!-- Footer Telemetry -->
                <div
                  class="border-t border-rail-line bg-rail/90 p-3 font-mono text-2xs text-rail-muted flex items-center justify-between"
                >
                  <span class="flex items-center gap-1.5">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Hardware Wedge Station Active</span>
                  </span>
                  <button
                    type="button"
                    class="text-accent hover:underline flex items-center gap-1"
                    @click="labAudio.speakBriefing(activeStation.speech)"
                  >
                    <AppIcon name="volume" size="12" />
                    <span>Replay Audio</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. GAMIFICATION CELEBRATION CARD (FINAL STAGE REACHED) -->
          <div
            v-if="isFinalStation"
            class="mt-8 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-6 text-center animate-scan-in"
          >
            <div
              class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white mb-2 shadow-sm"
            >
              <AppIcon name="check" size="20" />
            </div>
            <h4 class="font-sans text-xl font-bold text-ink">
              {{ activeUnit.name }} Specimen Journey Complete!
            </h4>
            <p class="mt-1 text-sm text-muted max-w-xl mx-auto">
              100% Chain-of-Custody validated. Zero lost or swapped samples enforced by physical
              barcode state machines. Cryptographically signed report released to patient and doctor
              portals.
            </p>
            <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                class="rounded-md bg-accent px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink hover:bg-accent/90 transition"
                @click="resetSimulation"
              >
                Re-Simulate This Workflow
              </button>
              <button
                type="button"
                class="rounded-md border border-line bg-raised px-4 py-2 font-mono text-xs uppercase tracking-wider text-ink hover:bg-surface transition"
                @click="
                  const keys = Object.keys(custodyUnits) as CustodyUnitKey[];
                  const nextIndex = (keys.indexOf(activeCustodyUnitKey) + 1) % keys.length;
                  selectCustodyUnit(keys[nextIndex]);
                "
              >
                Explore Next Unit →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ISO 15189, QUALITY CONTROL & WESTGARD RULES -->
    <section id="quality" class="scroll-mt-20 border-b border-line bg-canvas py-16 lg:py-24">
      <div class="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div class="grid items-center gap-12 lg:grid-cols-12">
          <div class="lg:col-span-5">
            <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
              >Laboratory Accreditation</span
            >
            <h2 class="display mt-3 text-3xl sm:text-4xl text-ink">
              Quality Management &amp; ISO 15189 Alignment
            </h2>
            <p class="mt-4 text-base leading-relaxed text-muted">
              Built specifically to satisfy the rigorous audit requirements of the Medical
              Laboratory Science Council of Nigeria (MLSCN) and international ISO 15189:2022
              assessors.
            </p>

            <div class="mt-8 space-y-4">
              <div class="border border-line bg-surface p-4">
                <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
                  >Westgard Multi-Rule QC Engine</span
                >
                <p class="mt-1 text-xs text-muted">
                  Automated evaluation of 1₃s, 2₂s, R₄s, 4₁s, and 10x rules on Levey-Jennings charts
                  for Chemistry and Haematology analyzers before releasing runs.
                </p>
              </div>
              <div class="border border-line bg-surface p-4">
                <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
                  >Reagent &amp; Antibody Lot Quarantine</span
                >
                <p class="mt-1 text-xs text-muted">
                  Every lot starts in QUARANTINE until a senior scientist validates it. Automatic
                  30-day expiry notifications and software-enforced blocks on expired stock.
                </p>
              </div>
              <div class="border border-line bg-surface p-4">
                <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
                  >Blinded QA Peer Review</span
                >
                <p class="mt-1 text-xs text-muted">
                  Automated random sampling of 10–15% of signed reports for double-blind second
                  opinions, discrepancy classification, and corrective action plans.
                </p>
              </div>
            </div>
          </div>

          <div class="lg:col-span-7">
            <div
              class="relative overflow-hidden border border-line bg-rail text-rail-ink shadow-lift"
            >
              <div
                class="flex items-center justify-between border-b border-rail-line bg-rail px-5 py-3 font-mono text-2xs uppercase tracking-caps text-rail-muted"
              >
                <span>Quality Control &amp; Levey-Jennings Telemetry</span>
                <span class="text-emerald-400">Westgard Rules Live</span>
              </div>
              <div class="p-6">
                <div class="overflow-hidden border border-rail-line bg-black/40">
                  <img
                    src="/screens/qc.jpg"
                    alt="Levey-Jennings QC and Westgard Rules"
                    class="h-auto w-full object-cover"
                  />
                </div>
                <div class="mt-6 grid grid-cols-3 gap-3 font-mono text-xs text-rail-muted">
                  <div class="bg-rail-line/30 p-3">
                    <span class="block text-2xs uppercase tracking-caps">Westgard 1₃s Rule</span>
                    <span class="mt-1 block text-emerald-400 font-bold">PASSED</span>
                  </div>
                  <div class="bg-rail-line/30 p-3">
                    <span class="block text-2xs uppercase tracking-caps">Peer Review Sampling</span>
                    <span class="mt-1 block text-rail-ink font-bold">15% Active</span>
                  </div>
                  <div class="bg-rail-line/30 p-3">
                    <span class="block text-2xs uppercase tracking-caps">Audit Event Trail</span>
                    <span class="mt-1 block text-emerald-400 font-bold">Immutable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- INTERACTIVE ROI & LABORATORY EFFICIENCY CALCULATOR -->
    <section id="calculator" class="scroll-mt-20 border-b border-line bg-surface py-16 lg:py-24">
      <div class="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto">
          <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
            >Hospital Financial &amp; Operational ROI</span
          >
          <h2 class="display mt-3 text-3xl sm:text-4xl text-ink">
            Interactive Laboratory Efficiency Calculator
          </h2>
          <p class="mt-4 text-base text-muted">
            Calculate your estimated throughput acceleration, hours saved in manual logging, and
            revenue recovered across all laboratory departments.
          </p>
        </div>

        <div class="mt-12 max-w-4xl mx-auto border border-line bg-raised p-6 sm:p-10 shadow-lift">
          <div class="grid gap-8 lg:grid-cols-2 items-center">
            <!-- Left: Sliders -->
            <div class="space-y-6">
              <div>
                <div
                  class="flex items-center justify-between font-mono text-xs uppercase tracking-wide"
                >
                  <span class="text-ink font-semibold">Monthly Specimen / Biopsy Volume</span>
                  <span class="text-accent font-bold text-sm">{{ monthlyBiopsies }} cases</span>
                </div>
                <input
                  v-model.number="monthlyBiopsies"
                  type="range"
                  min="50"
                  max="3000"
                  step="50"
                  class="mt-3 w-full accent-accent cursor-pointer"
                />
                <div class="flex justify-between font-mono text-2xs text-muted mt-1">
                  <span>50 cases</span>
                  <span>1,500 cases</span>
                  <span>3,000+ cases</span>
                </div>
              </div>

              <div>
                <div
                  class="flex items-center justify-between font-mono text-xs uppercase tracking-wide"
                >
                  <span class="text-ink font-semibold">Bench Scientists &amp; Pathologists</span>
                  <span class="text-accent font-bold text-sm">{{ numScientists }} clinicians</span>
                </div>
                <input
                  v-model.number="numScientists"
                  type="range"
                  min="1"
                  max="25"
                  step="1"
                  class="mt-3 w-full accent-accent cursor-pointer"
                />
                <div class="flex justify-between font-mono text-2xs text-muted mt-1">
                  <span>1 staff</span>
                  <span>12 staff</span>
                  <span>25 staff</span>
                </div>
              </div>

              <div>
                <div
                  class="flex items-center justify-between font-mono text-xs uppercase tracking-wide"
                >
                  <span class="text-ink font-semibold">Current Average Turnaround Time</span>
                  <span class="text-accent font-bold text-sm">{{ avgTatDays }} days</span>
                </div>
                <input
                  v-model.number="avgTatDays"
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  class="mt-3 w-full accent-accent cursor-pointer"
                />
                <div class="flex justify-between font-mono text-2xs text-muted mt-1">
                  <span>3 days</span>
                  <span>15 days</span>
                  <span>30 days</span>
                </div>
              </div>
            </div>

            <!-- Right: Results Card -->
            <div class="border border-line bg-surface p-6 sm:p-8">
              <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
                >Projected Laboratory Gains</span
              >

              <div class="mt-6 space-y-5">
                <div class="border-b border-line pb-4">
                  <span class="font-mono text-xs text-muted uppercase tracking-wide block"
                    >Estimated Clinical Time Saved</span
                  >
                  <div class="mt-1 flex items-baseline gap-2">
                    <span class="display text-4xl text-ink font-bold">{{
                      calculatedHoursSavedPerMonth
                    }}</span>
                    <span class="font-mono text-xs text-muted">hours / month</span>
                  </div>
                  <span class="text-2xs text-muted mt-1 block"
                    >In transcription, specimen hunting, phone calls, and manual logging.</span
                  >
                </div>

                <div class="border-b border-line pb-4">
                  <span class="font-mono text-xs text-muted uppercase tracking-wide block"
                    >Projected Turnaround Acceleration</span
                  >
                  <div class="mt-1 flex items-baseline gap-2">
                    <span class="display text-4xl text-emerald-600 dark:text-emerald-400 font-bold">
                      {{ calculatedTatReductionDays }}
                    </span>
                    <span class="font-mono text-xs text-muted"
                      >days (down from {{ avgTatDays }} days)</span
                    >
                  </div>
                  <span class="text-2xs text-muted mt-1 block"
                    >Clinicians receive definitive results faster, accelerating clinical care.</span
                  >
                </div>

                <div>
                  <span class="font-mono text-xs text-muted uppercase tracking-wide block"
                    >Prevented Revenue Leakage</span
                  >
                  <div class="mt-1 flex items-baseline gap-2">
                    <span class="display text-3xl text-accent font-bold"
                      >~${{ calculatedRevenueProtected }}</span
                    >
                    <span class="font-mono text-xs text-muted">equivalent / mo</span>
                  </div>
                  <span class="text-2xs text-muted mt-1 block"
                    >Unbilled stains/analytes, lost specimens, and rejected HMO claims.</span
                  >
                </div>
              </div>

              <button
                type="button"
                class="mt-8 w-full bg-ink text-surface py-3 font-mono text-xs uppercase tracking-wider font-semibold transition hover:bg-ink/80"
                @click="openDemo('DEMO')"
              >
                Validate ROI with Your Hospital Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- DEPARTMENT-SPECIFIC SANDBOX -->
    <section id="test-demo" class="scroll-mt-20 border-b border-line bg-surface py-16 lg:py-20">
      <div class="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto">
          <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
            >Test the demo by department</span
          >
          <h2 class="display mt-3 text-3xl sm:text-4xl text-ink">
            One platform. Every laboratory department.
          </h2>
          <p class="mt-4 text-base text-muted">
            Open a department-specific walkthrough or request sandbox credentials. The demo is not
            limited to histopathology.
          </p>
        </div>
        <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="account in departmentDemoAccounts"
            :key="account.discipline"
            class="flex flex-col border border-line bg-raised p-5"
          >
            <div class="flex items-center gap-2">
              <AppIcon :name="account.icon as any" :size="16" class="text-accent" /><span
                class="font-mono text-2xs uppercase tracking-caps text-accent"
                >{{ account.discipline }}</span
              >
            </div>
            <p class="mt-3 text-sm text-ink">{{ account.subtitle }}</p>
            <div class="mt-4 border border-line bg-canvas p-3 font-mono text-[10px] text-muted">
              <div>{{ account.email }}</div>
              <div>{{ account.password }}</div>
            </div>
            <div class="mt-auto flex flex-col gap-2 pt-4">
              <NuxtLink
                :to="{ path: '/login', query: { demo: account.discipline } }"
                class="border border-line-strong bg-raised px-3 py-2 text-center font-mono text-2xs uppercase tracking-wider text-ink hover:bg-canvas"
                >Open live sandbox</NuxtLink
              >
              <button
                type="button"
                class="bg-accent/10 px-3 py-2 font-mono text-2xs uppercase tracking-wider text-accent"
                @click="openDemo('DEMO', account.discipline)"
              >
                Book {{ account.discipline }} walkthrough
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- SUPPORT & COMMERCIAL CONTACT -->
    <section id="support" class="scroll-mt-20 border-b border-line bg-canvas py-16 lg:py-24">
      <div class="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div class="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
              >Support &amp; commercial</span
            >
            <h2 class="display mt-3 text-3xl sm:text-4xl text-ink">Talk to our laboratory team.</h2>
            <p class="mt-4 text-base leading-relaxed text-muted">
              Whether you run a standalone laboratory or a hospital group, we will help you scope
              deployment, data migration, instrument interfaces and staff training.
            </p>
            <div class="mt-8 space-y-3 font-mono text-xs text-muted">
              <a
                href="mailto:support@lims.africa"
                class="flex items-center gap-3 border border-line bg-raised p-4 hover:border-accent hover:text-ink"
                ><AppIcon name="send" :size="16" class="text-accent" /> support@lims.africa</a
              >
              <a
                href="mailto:sales@lims.africa"
                class="flex items-center gap-3 border border-line bg-raised p-4 hover:border-accent hover:text-ink"
                ><AppIcon name="billing" :size="16" class="text-accent" /> sales@lims.africa</a
              >
              <a
                href="https://wa.me/2348025550198"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-3 border border-line bg-raised p-4 hover:border-accent hover:text-ink"
                ><AppIcon name="external" :size="16" class="text-accent" /> WhatsApp the
                implementation desk</a
              >
            </div>
            <div class="mt-8 border border-accent/30 bg-accent/10 p-5">
              <p class="font-mono text-2xs uppercase tracking-caps text-accent">Commercial model</p>
              <p class="mt-2 text-sm text-ink">
                <strong>One month free trial</strong> after a scoping consultation. No card
                required. Deployment, data sovereignty and instrument integration are agreed before
                activation.
              </p>
              <button
                type="button"
                class="mt-4 bg-accent px-4 py-2.5 font-mono text-2xs font-semibold uppercase tracking-wider text-accent-ink"
                @click="openDemo('TRIAL')"
              >
                Request 30-day trial
              </button>
            </div>
          </div>
          <div class="border border-line bg-raised p-6 sm:p-8">
            <div v-if="supportSubmitted" class="py-10 text-center">
              <div
                class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
              >
                <AppIcon name="check" :size="24" />
              </div>
              <h3 class="display mt-4 text-2xl text-ink">Support request received</h3>
              <p class="mt-2 text-sm text-muted">
                Our team will reply to {{ supportForm.email }} within one business day.
              </p>
            </div>
            <form v-else class="space-y-4" @submit.prevent="submitSupport">
              <div>
                <p class="label-caps">Contact support</p>
                <p class="mt-1 text-xs text-muted">
                  Tell us what you need. This creates a tracked support enquiry for the platform
                  team.
                </p>
              </div>
              <FormField label="Hospital / laboratory" for-id="support-org" required
                ><input
                  id="support-org"
                  v-model="supportForm.organizationName"
                  class="input"
                  placeholder="Organization name"
              /></FormField>
              <div class="grid gap-3 sm:grid-cols-2">
                <FormField label="Your name" for-id="support-name" required
                  ><input
                    id="support-name"
                    v-model="supportForm.contactName"
                    class="input" /></FormField
                ><FormField label="Email" for-id="support-email" required
                  ><input id="support-email" v-model="supportForm.email" type="email" class="input"
                /></FormField>
              </div>
              <FormField label="Phone / WhatsApp" for-id="support-phone"
                ><input id="support-phone" v-model="supportForm.phone" class="input"
              /></FormField>
              <FormField label="How can we help?" for-id="support-message">
                <textarea
                  id="support-message"
                  v-model="supportForm.message"
                  rows="4"
                  class="textarea"
                  placeholder="Deployment, migration, instrument interface, pricing, training..."
                />
              </FormField>
              <p
                v-if="supportError"
                class="border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300"
              >
                {{ supportError }}
              </p>
              <button
                type="submit"
                class="w-full bg-accent px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink disabled:opacity-50"
                :disabled="
                  supportSubmitting ||
                  !supportForm.organizationName ||
                  !supportForm.contactName ||
                  !supportForm.email
                "
              >
                {{ supportSubmitting ? 'Sending…' : 'Send support request' }}
              </button>
              <p class="text-center text-[10px] text-muted">
                Prefer email?
                <a href="mailto:support@lims.africa" class="text-accent underline"
                  >support@lims.africa</a
                >
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>

    <!-- FREQUENTLY ASKED QUESTIONS (THE CLINICAL LABORATORY FAQ) -->
    <section id="faq" class="scroll-mt-20 border-b border-line bg-canvas py-16 lg:py-24">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
            >Common Inquiries &amp; Answers</span
          >
          <h2 class="display mt-3 text-3xl sm:text-4xl text-ink">
            Frequently Asked Questions by Laboratory Directors &amp; Scientists
          </h2>
          <p class="mt-4 text-base text-muted">
            Direct, technical answers addressing the real-world operational challenges of modern
            multi-discipline laboratories.
          </p>
        </div>

        <!-- FAQ Accordion -->
        <div class="mt-12 space-y-4">
          <div
            v-for="(faq, fIndex) in faqs"
            :key="fIndex"
            class="border border-line bg-raised transition"
            :class="openFaqIndex === fIndex ? 'border-line-strong' : ''"
          >
            <button
              type="button"
              class="w-full flex items-center justify-between p-5 text-left font-sans font-semibold text-ink text-base sm:text-lg"
              @click="toggleFaq(fIndex)"
            >
              <span class="pr-4">{{ faq.q }}</span>
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center border border-line bg-surface font-mono text-sm text-muted transition-transform"
                :class="openFaqIndex === fIndex ? 'rotate-180 text-accent' : ''"
              >
                <AppIcon name="chevron-down" size="16" />
              </span>
            </button>
            <div
              v-show="openFaqIndex === fIndex"
              class="px-5 pb-6 pt-1 text-sm leading-relaxed text-muted border-t border-line/60"
            >
              <p>{{ faq.a }}</p>
            </div>
          </div>
        </div>

        <!-- Still have questions CTA -->
        <div class="mt-12 text-center border border-line bg-surface p-8">
          <h3 class="display text-xl text-ink">
            Have a unique laboratory setup or analyzer interface requirement?
          </h3>
          <p class="mt-2 text-sm text-muted">
            Our medical laboratory informatics team can review your current equipment and design a
            seamless transition.
          </p>
          <div class="mt-6 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              class="bg-accent px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink transition hover:bg-accent/90"
              @click="openDemo('DEMO')"
            >
              Schedule Clinical Consultation
            </button>
            <button
              type="button"
              class="border border-line bg-raised px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-ink transition hover:bg-canvas"
              @click="isPersonaDrawerOpen = true"
            >
              Inspect Staff Demo Accounts
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- FINAL CTA SECTION -->
    <section class="relative overflow-hidden bg-rail py-16 lg:py-24 text-rail-ink">
      <div class="relative mx-auto max-w-shell px-4 sm:px-6 lg:px-8 text-center">
        <span
          class="inline-block border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
        >
          Upgrade Your Entire Laboratory Operations
        </span>
        <h2 class="display mt-6 text-3xl sm:text-5xl text-rail-ink max-w-3xl mx-auto">
          Every Specimen Accounted For. Every Result Verified. Zero Downtime.
        </h2>
        <p class="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-rail-muted">
          Transform your hospital's anatomical pathology, clinical chemistry, haematology, and
          microbiology throughput. Book a 20-minute tailored demonstration with our medical
          laboratory specialists today.
        </p>

        <div class="mt-10 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            class="bg-accent px-8 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink shadow-lift transition hover:bg-accent/90"
            @click="openDemo('DEMO')"
          >
            Schedule On-Site or Virtual Demo
          </button>
          <NuxtLink
            to="/login"
            class="border border-rail-line bg-rail-line/40 px-6 py-3.5 font-mono text-xs uppercase tracking-wider text-rail-ink transition hover:bg-rail-line"
          >
            Access Live Staff Sandbox
          </NuxtLink>
        </div>

        <div
          class="mt-12 flex flex-wrap justify-center gap-8 font-mono text-2xs uppercase tracking-caps text-rail-muted border-t border-rail-line pt-8"
        >
          <span>Deployment in &lt; 24 Hours</span>
          <span>Zero Hardware Lock-In</span>
          <span>Full Data Sovereignty</span>
          <span>On-Premises or Private Cloud</span>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="border-t border-line bg-surface py-12 text-ink">
      <div class="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Col 1: Identity -->
          <div>
            <AppWordmark />
            <p class="mt-4 text-xs text-muted leading-relaxed">
              Unified Medical Laboratory Information System engineered for Anatomical Pathology,
              Clinical Chemistry, Haematology, Microbiology, and Pre-Analytics Logistics.
            </p>
            <div class="mt-4 font-mono text-2xs text-muted">
              <span>Lagos First · Built for Low-Resource Reliability</span>
            </div>
          </div>

          <!-- Col 2: Clinical Modules -->
          <div>
            <span class="font-mono text-2xs uppercase tracking-caps text-ink font-semibold"
              >Laboratory Units</span
            >
            <ul class="mt-4 space-y-2 font-mono text-xs text-muted">
              <li>Histopathology &amp; Cytopathology</li>
              <li>Clinical Chemistry &amp; Endocrine</li>
              <li>Haematology &amp; Blood Bank</li>
              <li>Medical Microbiology &amp; AST</li>
              <li>Phlebotomy &amp; Pre-Analytics</li>
              <li>Levey-Jennings QC &amp; Westgard</li>
            </ul>
          </div>

          <!-- Col 3: Hospital Operations -->
          <div>
            <span class="font-mono text-2xs uppercase tracking-caps text-ink font-semibold"
              >Hospital Operations</span
            >
            <ul class="mt-4 space-y-2 font-mono text-xs text-muted">
              <li>Clinician Referral Portal (OTP)</li>
              <li>Consignment Bag &amp; Rider Tracking</li>
              <li>HL7 v2 MLLP &amp; FHIR R4 Interop</li>
              <li>Paystack / Flutterwave Billing</li>
              <li>HMO Claims CSV Export</li>
              <li>Public QR Report Verification</li>
            </ul>
          </div>

          <!-- Col 4: Quick Portals -->
          <div>
            <span class="font-mono text-2xs uppercase tracking-caps text-ink font-semibold"
              >System Access</span
            >
            <div class="mt-4 space-y-3 font-mono text-xs">
              <NuxtLink
                to="/login"
                class="block border border-line bg-raised p-2.5 text-ink transition hover:border-accent"
              >
                <span class="block font-bold">Staff Login Portal →</span>
                <span class="text-2xs text-muted">For Pathologists, Scientists &amp; Admins</span>
              </NuxtLink>
              <NuxtLink
                to="/portal/login"
                class="block border border-line bg-raised p-2.5 text-ink transition hover:border-accent"
              >
                <span class="block font-bold">Clinician Referral Portal →</span>
                <span class="text-2xs text-muted">For Referring Surgeons &amp; Clinics</span>
              </NuxtLink>
            </div>
          </div>
        </div>

        <div
          class="mt-12 border-t border-line pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-2xs text-muted uppercase tracking-wide"
        >
          <span
            >&copy; {{ new Date().getFullYear() }} Multi-Discipline Medical Laboratory LIMS. All
            rights reserved.</span
          >
          <div class="flex items-center gap-4">
            <a href="#support" class="text-accent hover:underline">Support</a>
            <span>·</span>
            <a href="mailto:support@lims.africa" class="hover:text-ink">support@lims.africa</a>
            <span>·</span>
            <span class="text-accent">ISO 15189:2022 Aligned</span>
            <span>·</span>
            <span>CAP Protocol Compliant</span>
            <span>·</span>
            <span>PWA Offline-First</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- INTERACTIVE DEMO REQUEST MODAL -->
    <AppModal
      :open="isDemoModalOpen"
      :title="
        demoLeadType === 'TRIAL'
          ? 'Start your one-month free trial'
          : 'Request a Hospital Demonstration'
      "
      :description="
        demoLeadType === 'TRIAL'
          ? 'Tell us about your laboratory. We will confirm scope, then activate a 30-day trial after a short consultation.'
          : 'Schedule a 20-minute clinical walkthrough tailored to your hospital\'s laboratory departments.'
      "
      size="lg"
      @close="resetDemoModal"
    >
      <div v-if="!isDemoSubmitted" class="space-y-4 font-sans text-ink">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-1"
              >Hospital / Laboratory Name *</label
            >
            <input
              v-model="demoForm.hospitalName"
              type="text"
              placeholder="e.g. Lagos University Teaching Hospital"
              required
              class="w-full border border-line bg-canvas p-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-1"
              >Your Name *</label
            >
            <input
              v-model="demoForm.contactName"
              type="text"
              placeholder="e.g. Dr. K. Adeleke / MLS F. Okon"
              required
              class="w-full border border-line bg-canvas p-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-1"
              >Your Clinical Role</label
            >
            <SearchSelect
              v-model="demoForm.clinicalRole"
              :options="roleOptions"
              placeholder="Select your role"
            />
            <input
              v-if="demoForm.clinicalRole === 'Other'"
              v-model="roleOther"
              type="text"
              maxlength="120"
              placeholder="e.g. Head of Laboratory Services"
              class="mt-2 w-full border border-accent/50 bg-canvas p-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-1"
              >Work Email *</label
            >
            <input
              v-model="demoForm.email"
              type="email"
              placeholder="doctor@hospital.org"
              required
              class="w-full border border-line bg-canvas p-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-1"
              >WhatsApp / Phone Number</label
            >
            <input
              v-model="demoForm.phone"
              type="tel"
              placeholder="+234 803 000 0000"
              class="w-full border border-line bg-canvas p-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-1"
              >Monthly Test Volume</label
            >
            <SearchSelect
              v-model="demoForm.monthlyVolume"
              :options="volumeOptions"
              placeholder="Select monthly volume"
            />
            <input
              v-if="demoForm.monthlyVolume === 'Other'"
              v-model="volumeOther"
              type="text"
              maxlength="80"
              placeholder="e.g. 12,000 tests / month across 4 labs"
              class="mt-2 w-full border border-accent/50 bg-canvas p-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-2"
            >Departments of Interest</label
          >
          <div class="flex flex-wrap gap-2">
            <button
              v-for="disc in [
                'Histopathology',
                'Clinical Chemistry',
                'Haematology',
                'Medical Microbiology',
                'Pre-Analytics Logistics',
              ]"
              :key="disc"
              type="button"
              class="border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition"
              :class="
                demoForm.disciplines.includes(disc)
                  ? 'border-accent bg-accent/10 text-accent font-semibold'
                  : 'border-line bg-surface text-muted'
              "
              @click="toggleDiscipline(disc)"
            >
              {{ disc }}
            </button>
          </div>
        </div>

        <div
          v-if="demoError"
          class="border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300"
        >
          {{ demoError }}
        </div>

        <div>
          <label class="block font-mono text-2xs uppercase tracking-caps text-muted mb-1"
            >Specific Workflow Questions or Current EMR</label
          >
          <textarea
            v-model="demoForm.notes"
            rows="2"
            placeholder="e.g. Seeking unified autoverification for chemistry and barcode custody for surgical pathology..."
            class="w-full border border-line bg-canvas p-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <!-- Success State -->
      <div v-else class="py-6 text-center">
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
        >
          <AppIcon name="check" size="28" />
        </div>
        <h3 class="display mt-4 text-2xl text-ink">
          {{
            demoLeadType === 'TRIAL' ? 'Trial request received' : 'Demonstration Request Received'
          }}
        </h3>
        <p class="mt-2 text-sm text-muted max-w-md mx-auto">
          Thank you, <strong class="text-ink">{{ demoForm.contactName || 'Doctor' }}</strong
          >. Our clinical informatics team will contact you at
          <strong class="text-ink">{{ demoForm.email }}</strong> within 4 business hours to
          {{
            demoLeadType === 'TRIAL'
              ? 'confirm scope and activate your 30-day trial'
              : 'schedule your live walkthrough'
          }}
          for {{ demoForm.hospitalName }}.
        </p>

        <div
          class="mt-6 border border-line bg-surface p-4 text-left max-w-md mx-auto font-mono text-xs space-y-1 text-muted"
        >
          <div class="text-ink font-semibold">While you wait:</div>
          <div>• You can test-drive live staff roles immediately using our demo sandbox.</div>
          <div>• Login accounts for Pathologists and Medical Lab Scientists are pre-seeded.</div>
        </div>

        <div class="mt-6 flex justify-center gap-3">
          <button
            type="button"
            class="bg-accent px-5 py-2 font-mono text-xs uppercase tracking-wider text-accent-ink"
            @click="
              isPersonaDrawerOpen = true;
              resetDemoModal();
            "
          >
            Open Test Drive Accounts
          </button>
          <button
            type="button"
            class="border border-line bg-surface px-5 py-2 font-mono text-xs uppercase tracking-wider text-ink"
            @click="resetDemoModal"
          >
            Close
          </button>
        </div>
      </div>

      <template #footer>
        <div v-if="!isDemoSubmitted" class="flex justify-end gap-3">
          <button
            type="button"
            class="border border-line bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
            @click="resetDemoModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="bg-accent px-5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink disabled:opacity-50"
            :disabled="demoSubmitting || !demoForm.hospitalName || !demoForm.email"
            @click="submitDemoRequest"
          >
            {{
              demoSubmitting
                ? 'Sending…'
                : demoLeadType === 'TRIAL'
                  ? 'Request 30-day trial'
                  : 'Confirm Walkthrough Request'
            }}
          </button>
        </div>
      </template>
    </AppModal>

    <!-- TEST DRIVE PERSONAS DRAWER / MODAL -->
    <AppModal
      :open="isPersonaDrawerOpen"
      title="Live Laboratory Sandbox Roles"
      description="Experience the LIMS from the perspective of each departmental stakeholder. All accounts are pre-seeded in lab HISTO."
      size="lg"
      @close="isPersonaDrawerOpen = false"
    >
      <div class="space-y-4">
        <div
          v-for="persona in demoPersonas"
          :key="persona.email"
          class="border border-line bg-surface p-4 transition hover:border-line-strong"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <span
                class="inline-block border border-accent/30 bg-accent-soft/40 px-2 py-0.5 font-mono text-2xs uppercase tracking-caps text-accent font-semibold"
              >
                {{ persona.role }}
              </span>
              <h4 class="mt-1 text-base font-semibold text-ink">{{ persona.name }}</h4>
              <p class="mt-1 text-xs text-muted">{{ persona.tasks }}</p>
            </div>
            <NuxtLink
              :to="persona.isPortal ? '/portal/login' : '/login'"
              class="shrink-0 bg-ink text-surface px-3 py-1.5 font-mono text-2xs uppercase tracking-wider font-semibold transition hover:bg-accent hover:text-accent-ink"
              @click="isPersonaDrawerOpen = false"
            >
              Sign In As {{ persona.role.split(' ')[0] }} →
            </NuxtLink>
          </div>

          <div
            class="mt-3 flex flex-wrap gap-4 border-t border-line pt-2 font-mono text-2xs text-muted"
          >
            <div>
              <span class="text-muted/70">Login: </span>
              <span class="text-ink font-semibold">{{ persona.email }}</span>
            </div>
            <div>
              <span class="text-muted/70">Password: </span>
              <span class="text-ink font-semibold">{{ persona.password }}</span>
            </div>
            <div>
              <span class="text-muted/70">Lab Code: </span>
              <span class="text-ink font-semibold">HISTO</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <span class="font-mono text-2xs text-muted">Passwords are for sandbox evaluation.</span>
          <button
            type="button"
            class="border border-line bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wider text-ink"
            @click="isPersonaDrawerOpen = false"
          >
            Close
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>
