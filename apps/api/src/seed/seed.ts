import mongoose, { Types } from 'mongoose';
import {
  PRIORITY_RANK,
  formatAccession,
  formatMrn,
  isClinicalRole,
  generateNarrative,
  protocolContentSchema,
  reportCompleteness,
  validateReportData,
  type CaseStatus,
  type PhysicalState,
  type Priority,
  type ProtocolContent,
  type ReportData,
  type Role,
  type Sex,
  type StainType,
  type Station,
} from '@lims/shared';
import { LabModelName, LabSchema, type LabEntity } from '../core/labs/lab.schema';
import { TestRequestModelName, TestRequestSchema } from '../core/test-requests/test-request.schema';
import { UserModelName, UserSchema, type UserEntity } from '../core/users/user.schema';
import {
  PatientModelName,
  PatientSchema,
  type PatientEntity,
} from '../core/patients/patient.schema';
import { CaseModelName, CaseSchema, type CaseEntity } from '../core/cases/case.schema';
import {
  SpecimenModelName,
  SpecimenSchema,
  type SpecimenEntity,
} from '../core/specimens/specimen.schema';
import {
  BlockModelName,
  BlockSchema,
  type BlockEntity,
} from '../disciplines/histopathology/blocks/block.schema';
import {
  SlideModelName,
  SlideSchema,
  type SlideEntity,
} from '../disciplines/histopathology/slides/slide.schema';
import {
  CustodyEventModelName,
  CustodyEventSchema,
  type CustodyEventEntity,
} from '../core/custody/custody-event.schema';
import { ReportModelName, ReportSchema, type ReportEntity } from '../core/reports/report.schema';
import {
  ReportVersionModelName,
  ReportVersionSchema,
  type ReportVersionEntity,
} from '../core/reports/report-version.schema';
import {
  ProtocolModelName,
  ProtocolSchema,
  type ProtocolEntity,
} from '../disciplines/histopathology/protocols/protocol.schema';
import {
  AuditLogModelName,
  AuditLogSchema,
  type AuditLogEntity,
} from '../core/audit/audit-log.schema';
import {
  NotificationModelName,
  NotificationSchema,
  type NotificationEntity,
} from '../core/notifications/notification.schema';
import { runWithSystemTenant } from '../common/context/tenant-context';
import { seedPhase23 } from './phase23-seed';
import { seedPhase2 } from './phase2-seed';
import { seedPhase4 } from './phase4-seed';
import { hashPassword } from '../common/utils/crypto';
import {
  breastProtocol,
  cervixProtocol,
  colorectalProtocol,
  prostateProtocol,
} from './protocol-seed';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const LAB_CODE = 'HISTO';

type Stage =
  | 'RECEIVED'
  | 'GROSSED'
  | 'PROCESSING'
  | 'EMBEDDED'
  | 'CUT'
  | 'STAINED'
  | 'PENDING_REVIEW'
  | 'REPORTED'
  | 'AMENDED'
  | 'RECUT'
  | 'ARCHIVED';

interface CaseSeed {
  firstName: string;
  lastName: string;
  sex: Sex;
  age: number;
  site: string;
  specimenType: string;
  protocolKey:
    'breast_carcinoma' | 'colorectal_carcinoma' | 'prostate_carcinoma' | 'cervical_carcinoma';
  priority: Priority;
  stage: Stage;
  offsetDays: number;
}

interface SeedActor {
  userId: Types.ObjectId;
  userName: string;
  userRole: Role;
}

interface EventSeed {
  labId: Types.ObjectId;
  entityType: 'SPECIMEN' | 'BLOCK' | 'SLIDE' | 'CASE';
  entityId: Types.ObjectId;
  caseId: Types.ObjectId | null;
  eventType: string;
  station: Station | null;
  fromState: string | null;
  toState: string;
  reason: string | null;
  userId: Types.ObjectId;
  userName: string;
  userRole: Role;
  timestamp: Date;
  barcode: string | null;
  metadata: Record<string, unknown>;
}

const caseSeeds: CaseSeed[] = [
  {
    firstName: 'Adebayo',
    lastName: 'Ogunlesi',
    sex: 'MALE',
    age: 58,
    site: 'Prostate',
    specimenType: 'Transrectal prostate cores',
    protocolKey: 'prostate_carcinoma',
    priority: 'ROUTINE',
    stage: 'RECEIVED',
    offsetDays: 0.2,
  },
  {
    firstName: 'Ngozi',
    lastName: 'Eze',
    sex: 'FEMALE',
    age: 44,
    site: 'Left breast',
    specimenType: 'Wide local excision',
    protocolKey: 'breast_carcinoma',
    priority: 'URGENT',
    stage: 'RECEIVED',
    offsetDays: 0.5,
  },
  {
    firstName: 'Chinedu',
    lastName: 'Okeke',
    sex: 'MALE',
    age: 61,
    site: 'Right colon',
    specimenType: 'Right hemicolectomy',
    protocolKey: 'colorectal_carcinoma',
    priority: 'ROUTINE',
    stage: 'RECEIVED',
    offsetDays: 0.9,
  },
  {
    firstName: 'Aisha',
    lastName: 'Bello',
    sex: 'FEMALE',
    age: 38,
    site: 'Cervix',
    specimenType: 'Hysterectomy',
    protocolKey: 'cervical_carcinoma',
    priority: 'ROUTINE',
    stage: 'GROSSED',
    offsetDays: 1.2,
  },
  {
    firstName: 'Funmilayo',
    lastName: 'Adeyemi',
    sex: 'FEMALE',
    age: 52,
    site: 'Right breast',
    specimenType: 'Mastectomy',
    protocolKey: 'breast_carcinoma',
    priority: 'ROUTINE',
    stage: 'GROSSED',
    offsetDays: 1.6,
  },
  {
    firstName: 'Emeka',
    lastName: 'Nwachukwu',
    sex: 'MALE',
    age: 67,
    site: 'Prostate',
    specimenType: 'Radical prostatectomy',
    protocolKey: 'prostate_carcinoma',
    priority: 'URGENT',
    stage: 'GROSSED',
    offsetDays: 2.0,
  },
  {
    firstName: 'Halima',
    lastName: 'Musa',
    sex: 'FEMALE',
    age: 49,
    site: 'Left breast',
    specimenType: 'Wide local excision',
    protocolKey: 'breast_carcinoma',
    priority: 'ROUTINE',
    stage: 'GROSSED',
    offsetDays: 2.4,
  },
  {
    firstName: 'Tunde',
    lastName: 'Bakare',
    sex: 'MALE',
    age: 55,
    site: 'Rectum',
    specimenType: 'Anterior resection',
    protocolKey: 'colorectal_carcinoma',
    priority: 'URGENT',
    stage: 'PROCESSING',
    offsetDays: 1.0,
  },
  {
    firstName: 'Ifeoma',
    lastName: 'Obi',
    sex: 'FEMALE',
    age: 35,
    site: 'Cervix',
    specimenType: 'Hysterectomy',
    protocolKey: 'cervical_carcinoma',
    priority: 'URGENT',
    stage: 'PROCESSING',
    offsetDays: 0.8,
  },
  {
    firstName: 'Yusuf',
    lastName: 'Ibrahim',
    sex: 'MALE',
    age: 70,
    site: 'Prostate',
    specimenType: 'TURP chips',
    protocolKey: 'prostate_carcinoma',
    priority: 'ROUTINE',
    stage: 'PROCESSING',
    offsetDays: 3.2,
  },
  {
    firstName: 'Bukola',
    lastName: 'Adeleke',
    sex: 'FEMALE',
    age: 47,
    site: 'Right breast',
    specimenType: 'Wide local excision',
    protocolKey: 'breast_carcinoma',
    priority: 'ROUTINE',
    stage: 'PROCESSING',
    offsetDays: 3.5,
  },
  {
    firstName: 'Obinna',
    lastName: 'Nnamdi',
    sex: 'MALE',
    age: 63,
    site: 'Right colon',
    specimenType: 'Right hemicolectomy',
    protocolKey: 'colorectal_carcinoma',
    priority: 'URGENT',
    stage: 'EMBEDDED',
    offsetDays: 0.7,
  },
  {
    firstName: 'Zainab',
    lastName: 'Lawal',
    sex: 'FEMALE',
    age: 41,
    site: 'Cervix',
    specimenType: 'Hysterectomy',
    protocolKey: 'cervical_carcinoma',
    priority: 'ROUTINE',
    stage: 'EMBEDDED',
    offsetDays: 2.2,
  },
  {
    firstName: 'Olumide',
    lastName: 'Fashola',
    sex: 'MALE',
    age: 59,
    site: 'Prostate',
    specimenType: 'Radical prostatectomy',
    protocolKey: 'prostate_carcinoma',
    priority: 'ROUTINE',
    stage: 'EMBEDDED',
    offsetDays: 2.5,
  },
  {
    firstName: 'Chioma',
    lastName: 'Okonkwo',
    sex: 'FEMALE',
    age: 50,
    site: 'Left breast',
    specimenType: 'Mastectomy',
    protocolKey: 'breast_carcinoma',
    priority: 'FROZEN',
    stage: 'EMBEDDED',
    offsetDays: 2.8,
  },
  {
    firstName: 'Musa',
    lastName: 'Danjuma',
    sex: 'MALE',
    age: 66,
    site: 'Rectum',
    specimenType: 'Anterior resection',
    protocolKey: 'colorectal_carcinoma',
    priority: 'URGENT',
    stage: 'CUT',
    offsetDays: 0.9,
  },
  {
    firstName: 'Yetunde',
    lastName: 'Salami',
    sex: 'FEMALE',
    age: 45,
    site: 'Right breast',
    specimenType: 'Wide local excision',
    protocolKey: 'breast_carcinoma',
    priority: 'ROUTINE',
    stage: 'STAINED',
    offsetDays: 1.6,
  },
  {
    firstName: 'Kelechi',
    lastName: 'Umeh',
    sex: 'MALE',
    age: 57,
    site: 'Right colon',
    specimenType: 'Right hemicolectomy',
    protocolKey: 'colorectal_carcinoma',
    priority: 'ROUTINE',
    stage: 'STAINED',
    offsetDays: 1.9,
  },
  {
    firstName: 'Amina',
    lastName: 'Garba',
    sex: 'FEMALE',
    age: 39,
    site: 'Cervix',
    specimenType: 'Hysterectomy',
    protocolKey: 'cervical_carcinoma',
    priority: 'URGENT',
    stage: 'STAINED',
    offsetDays: 2.3,
  },
  {
    firstName: 'Segun',
    lastName: 'Ojo',
    sex: 'MALE',
    age: 72,
    site: 'Prostate',
    specimenType: 'Transrectal prostate cores',
    protocolKey: 'prostate_carcinoma',
    priority: 'FROZEN',
    stage: 'PENDING_REVIEW',
    offsetDays: 1.2,
  },
  {
    firstName: 'Adaobi',
    lastName: 'Nwosu',
    sex: 'FEMALE',
    age: 53,
    site: 'Left breast',
    specimenType: 'Wide local excision',
    protocolKey: 'breast_carcinoma',
    priority: 'URGENT',
    stage: 'PENDING_REVIEW',
    offsetDays: 0.8,
  },
  {
    firstName: 'Ibrahim',
    lastName: 'Sule',
    sex: 'MALE',
    age: 60,
    site: 'Right colon',
    specimenType: 'Right hemicolectomy',
    protocolKey: 'colorectal_carcinoma',
    priority: 'ROUTINE',
    stage: 'PENDING_REVIEW',
    offsetDays: 2.6,
  },
  {
    firstName: 'Temitope',
    lastName: 'Ajayi',
    sex: 'FEMALE',
    age: 46,
    site: 'Right breast',
    specimenType: 'Mastectomy',
    protocolKey: 'breast_carcinoma',
    priority: 'ROUTINE',
    stage: 'REPORTED',
    offsetDays: 4.0,
  },
  {
    firstName: 'Hassan',
    lastName: 'Abubakar',
    sex: 'MALE',
    age: 64,
    site: 'Prostate',
    specimenType: 'Radical prostatectomy',
    protocolKey: 'prostate_carcinoma',
    priority: 'URGENT',
    stage: 'REPORTED',
    offsetDays: 6.0,
  },
  {
    firstName: 'Nneka',
    lastName: 'Eze',
    sex: 'FEMALE',
    age: 37,
    site: 'Cervix',
    specimenType: 'Hysterectomy',
    protocolKey: 'cervical_carcinoma',
    priority: 'ROUTINE',
    stage: 'REPORTED',
    offsetDays: 8.0,
  },
  {
    firstName: 'Femi',
    lastName: 'Adebisi',
    sex: 'MALE',
    age: 58,
    site: 'Rectum',
    specimenType: 'Anterior resection',
    protocolKey: 'colorectal_carcinoma',
    priority: 'URGENT',
    stage: 'REPORTED',
    offsetDays: 10.0,
  },
  {
    firstName: 'Rukayat',
    lastName: 'Ogunbiyi',
    sex: 'FEMALE',
    age: 48,
    site: 'Left breast',
    specimenType: 'Wide local excision',
    protocolKey: 'breast_carcinoma',
    priority: 'ROUTINE',
    stage: 'AMENDED',
    offsetDays: 7.0,
  },
  {
    firstName: 'Chukwuma',
    lastName: 'Eze',
    sex: 'MALE',
    age: 62,
    site: 'Right colon',
    specimenType: 'Right hemicolectomy',
    protocolKey: 'colorectal_carcinoma',
    priority: 'URGENT',
    stage: 'AMENDED',
    offsetDays: 12.0,
  },
  {
    firstName: 'Fatima',
    lastName: 'Sani',
    sex: 'FEMALE',
    age: 42,
    site: 'Cervix',
    specimenType: 'Hysterectomy',
    protocolKey: 'cervical_carcinoma',
    priority: 'ROUTINE',
    stage: 'RECUT',
    offsetDays: 2.2,
  },
  {
    firstName: 'Damilola',
    lastName: 'Oyelaran',
    sex: 'FEMALE',
    age: 51,
    site: 'Right breast',
    specimenType: 'Mastectomy',
    protocolKey: 'breast_carcinoma',
    priority: 'ROUTINE',
    stage: 'ARCHIVED',
    offsetDays: 20.0,
  },
];

const protocolDefinitions: { key: CaseSeed['protocolKey']; content: ProtocolContent }[] = [
  { key: 'breast_carcinoma', content: breastProtocol },
  { key: 'colorectal_carcinoma', content: colorectalProtocol },
  { key: 'prostate_carcinoma', content: prostateProtocol },
  { key: 'cervical_carcinoma', content: cervixProtocol },
];

const referringClinicians = [
  {
    name: 'Dr Bola Adeyemi',
    facility: "St Mary's Specialist Clinic, Lagos",
    phone: '+234 803 441 2201',
    email: 'referrer@clinic.ng',
  },
  {
    name: 'Dr Ifeanyi Okoro',
    facility: 'Reddington Hospital, Victoria Island',
    phone: '+234 805 330 1188',
    email: 'i.okoro@reddington.ng',
  },
  {
    name: 'Dr Hauwa Bello',
    facility: 'Garki General Hospital, Abuja',
    phone: '+234 806 221 7744',
    email: 'h.bello@garkihospital.ng',
  },
  {
    name: 'Dr Tolu Ajayi',
    facility: 'Lagoon Fertility & Women\u2019s Clinic',
    phone: '+234 802 918 4432',
    email: 't.ajayi@lagoonclinic.ng',
  },
];

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR);
}

function ageDate(age: number): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear() - age, 0, 15));
}

function clinicalHistory(seed: CaseSeed): string {
  switch (seed.protocolKey) {
    case 'breast_carcinoma':
      return `${seed.site} mass noticed ${2 + (seed.age % 5)} months ago. ${seed.lastName} reports a painless lump with no nipple discharge. Ultrasound showed a solid mass; core/excision biopsy requested for histological assessment.`;
    case 'colorectal_carcinoma':
      return `Progressive change in bowel habit, abdominal discomfort and unintentional weight loss over ${2 + (seed.age % 4)} months. Colonoscopy identified a ${seed.site.toLowerCase()} mass. Resection specimen submitted for staging.`;
    case 'prostate_carcinoma':
      return `Lower urinary tract symptoms with a rising PSA over the last year. Digital rectal examination abnormal. ${seed.specimenType} submitted for histological assessment.`;
    case 'cervical_carcinoma':
      return `Postcoital bleeding and offensive vaginal discharge for ${3 + (seed.age % 4)} months. Cervical lesion seen on examination. ${seed.specimenType} submitted for histological assessment.`;
  }
}

function grossDescription(seed: CaseSeed): string {
  switch (seed.protocolKey) {
    case 'breast_carcinoma':
      return `Received in formalin, a firm grey-white ${seed.specimenType.toLowerCase()} specimen. The cut surface shows an ill-defined pale tumour. Margins inked. Representative sections taken.`;
    case 'colorectal_carcinoma':
      return `Received in formalin, a segment of ${seed.site.toLowerCase()} with attached mesorectal fat. An ulcerated fungating tumour is seen. Multiple lymph nodes identified. Sections taken from tumour, margins and nodes.`;
    case 'prostate_carcinoma':
      return `Received in formalin, ${seed.specimenType.toLowerCase()}. The tissue is processed in its entirety. Representative sections submitted in multiple cassettes.`;
    case 'cervical_carcinoma':
      return `Received in formalin, a ${seed.specimenType.toLowerCase()} specimen with cervix and adnexa. An exophytic cervical tumour is present. Parametrial margins and lymph nodes sampled.`;
  }
}

function fullReportData(seed: CaseSeed, index: number): ReportData {
  const grade2 = index % 3 !== 0;
  switch (seed.protocolKey) {
    case 'breast_carcinoma':
      return {
        procedure: seed.specimenType.toLowerCase().includes('wide') ? 'lumpectomy' : 'mastectomy',
        laterality: seed.site.toLowerCase().startsWith('left') ? 'left' : 'right',
        specimenIntegrity: 'inkMargin',
        histologicType: 'nst',
        grade: grade2 ? 'grade2' : 'grade3',
        tumourSize: 16 + (index % 6) * 4,
        lymphovascular: index % 4 === 0,
        perineural: false,
        dcisPresent: true,
        dcisGrade: index % 2 === 0 ? 'intermediate' : 'high',
        margins: 'clear',
        closestMargin: 3 + (index % 5),
        marginInvolved: [],
        nodesExamined: 6 + (index % 5),
        nodesPositive: index % 3,
        extranodal: false,
        er: index % 5 === 0 ? 'negative' : 'positive',
        erPercent: index % 5 === 0 ? 0 : 85,
        pr: 'positive',
        prPercent: 60,
        her2Ihc: index % 6 === 0 ? '2+' : '1+',
        her2Ish: 'notAmplified',
        ki67: 12 + (index % 25),
        pT: 'pT2',
        pN: 'pN0',
        pM: 'pM0',
        ajccStage: 'IIA',
        diagnosis: `Invasive carcinoma of no special type, ${grade2 ? 'grade 2 (moderately differentiated)' : 'grade 3 (poorly differentiated)'}, measuring ${16 + (index % 6) * 4} mm. Margins clear. No lymphovascular invasion.`,
        comment:
          'Case discussed at the multidisciplinary tumour board. Endocrine therapy is recommended.',
      };
    case 'colorectal_carcinoma':
      return {
        procedure:
          seed.site.toLowerCase() === 'rectum' ? 'anteriorResection' : 'rightHemicolectomy',
        site: seed.site.toLowerCase() === 'rectum' ? 'rectum' : 'ascending',
        histologicType: 'adenocarcinomaNos',
        grade: 'moderate',
        tumourSize: 32 + (index % 8) * 5,
        invasionDepth: 'pericolic',
        lymphovascular: index % 3 === 0,
        perineural: index % 4 === 0,
        margins: 'clear',
        closestMargin: 8 + (index % 6),
        nodesExamined: 12 + (index % 7),
        nodesPositive: 1 + (index % 3),
        tumourDeposits: false,
        msi: 'stable',
        pT: 'pT3',
        pN: 'pN1b',
        pM: 'pM0',
        ajccStage: 'Stage IIIB',
        diagnosis:
          'Adenocarcinoma, moderately differentiated, invading through the muscularis propria into pericolic tissue. Two of fourteen lymph nodes positive for metastatic carcinoma. Margins clear.',
        comment: 'Adjuvant chemotherapy recommended. MMR proficient.',
      };
    case 'prostate_carcinoma':
      return {
        procedure: seed.specimenType.toLowerCase().includes('turp')
          ? 'turp'
          : seed.specimenType.toLowerCase().includes('radical')
            ? 'radical'
            : 'coreBiopsy',
        coresInvolved: 3,
        coresTotal: 12,
        gleasonPrimary: 4,
        gleasonSecondary: 3,
        gleasonScore: 7,
        gradeGroup: '3',
        tumourExtent: 25 + (index % 25),
        perineural: true,
        extraprostatic: false,
        seminalVesicle: false,
        margins: 'clear',
        nodesExamined: 0,
        nodesPositive: 0,
        pT: 'pT2c',
        pN: 'pNx',
        diagnosis:
          'Acinar adenocarcinoma of the prostate, Gleason score 4+3=7 (ISUP grade group 3), involving 3 of 12 cores. No extraprostatic extension identified.',
        comment: 'Correlate with serial PSA and imaging. Genomic testing may be considered.',
      };
    case 'cervical_carcinoma':
      return {
        procedure: 'hysterectomy',
        histologicType: index % 2 === 0 ? 'squamousKeratinising' : 'squamousNonKeratinising',
        grade: 'moderate',
        tumourSize: 24 + (index % 7) * 5,
        depthInvasion: 5 + (index % 6),
        lvsi: index % 3 === 0,
        parametrial: false,
        vaginal: false,
        margins: 'clear',
        nodesExamined: 8 + (index % 5),
        nodesPositive: index % 4 === 0 ? 1 : 0,
        figoStage: index % 3 === 0 ? 'IB2' : 'IB1',
        diagnosis: `Squamous cell carcinoma, moderately differentiated, ${24 + (index % 7) * 5} mm in maximum dimension with ${5 + (index % 6)} mm stromal invasion. Margins clear.`,
        comment:
          'Findings discussed with the clinical oncology team. Concurrent chemoradiation planned.',
      };
  }
}

export async function seedDatabase(): Promise<void> {
  const reset = process.argv.includes('--reset') || process.env.SEED_RESET === 'true';
  const uri =
    process.env.MONGODB_URI ??
    'mongodb://localhost:27017/histo_lims?replicaSet=rs0&directConnection=true';

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20_000 });
  const connection = mongoose.connection;

  const LabModel = connection.model<LabEntity>(LabModelName, LabSchema);
  const UserModel = connection.model<UserEntity>(UserModelName, UserSchema);
  const PatientModel = connection.model<PatientEntity>(PatientModelName, PatientSchema);
  const CaseModel = connection.model<CaseEntity>(CaseModelName, CaseSchema);
  const SpecimenModel = connection.model<SpecimenEntity>(SpecimenModelName, SpecimenSchema);
  const BlockModel = connection.model<BlockEntity>(BlockModelName, BlockSchema);
  const SlideModel = connection.model<SlideEntity>(SlideModelName, SlideSchema);
  const CustodyModel = connection.model<CustodyEventEntity>(
    CustodyEventModelName,
    CustodyEventSchema,
  );
  const ReportModel = connection.model<ReportEntity>(ReportModelName, ReportSchema);
  const VersionModel = connection.model<ReportVersionEntity>(
    ReportVersionModelName,
    ReportVersionSchema,
  );
  const ProtocolModel = connection.model<ProtocolEntity>(ProtocolModelName, ProtocolSchema);
  const TestRequestModel = connection.model(TestRequestModelName, TestRequestSchema);
  const AuditModel = connection.model<AuditLogEntity>(AuditLogModelName, AuditLogSchema);
  const NotificationModel = connection.model<NotificationEntity>(
    NotificationModelName,
    NotificationSchema,
  );

  if (reset) {
    await connection.dropDatabase();
    console.log('Dropped existing database for a clean seed.');
  }

  const existing = await LabModel.findOne({ code: LAB_CODE }).lean().exec();
  if (existing && !reset) {
    console.log(
      `Laboratory ${LAB_CODE} already exists. Re-run with SEED_RESET=true (pnpm seed:reset) to rebuild the sample dataset.`,
    );
    await connection.close();
    return;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const lab = await LabModel.create({
    code: LAB_CODE,
    name: 'Lagos Central Histopathology Laboratory',
    address: '12 Oba Akran Avenue, Ikeja, Lagos, Nigeria',
    phone: '+234 802 555 0198',
    email: 'reports@lagoscentralhisto.ng',
    accessionPrefix: 'HP',
    accessionFormat: '{PREFIX}-{YYYY}-{SEQ:6}',
    tatHours: { FROZEN: 1, URGENT: 24, ROUTINE: 72 },
    tatWarningPercent: 80,
    timezone: 'Africa/Lagos',
    qaSamplingPercent: 15,
    currency: 'NGN',
    enabledDisciplines: ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'],
    accessionPrefixes: {},
    letterhead: {
      phone: '+234 802 555 0198',
      email: 'reports@lagoscentralhisto.ng',
      website: 'lagoscentralhisto.ng',
      pathologistName: 'Dr Adaeze Okafor',
      pathologistTitle: 'Consultant Histopathologist',
      qualifications: 'MBBS, FMCPath (Histopathology)',
      signatureText: 'Electronically signed in accordance with laboratory policy.',
      footerNote:
        'Lagos Central Histopathology Laboratory · Confidential clinical record · Verify this report with the QR code.',
    },
  });

  const labId = lab._id;
  const labIdString = labId.toString();

  await runWithSystemTenant('sample-data-seed', labIdString, async () => {
    const passwordHash = new Map<string, string>();
    const hashFor = async (password: string): Promise<string> => {
      const cached = passwordHash.get(password);
      if (cached) return cached;
      const hash = await hashPassword(password);
      passwordHash.set(password, hash);
      return hash;
    };

    const staffDefinitions: {
      key: string;
      name: string;
      email: string;
      password: string;
      role: Role;
      subspecialties: string[];
      phone?: string;
      disciplines?: readonly (
        'HISTOPATHOLOGY' | 'HAEMATOLOGY' | 'CHEMICAL_PATHOLOGY' | 'MICROBIOLOGY'
      )[];
    }[] = [
      {
        key: 'super',
        name: 'System Administrator',
        email: 'superadmin@histo.ng',
        password: 'SuperAdmin#2026',
        role: 'SUPER_ADMIN',
        subspecialties: [],
      },
      {
        key: 'admin',
        name: 'Folake Ogunleye',
        email: 'admin@histo.ng',
        password: 'LabAdmin#2026',
        role: 'LAB_ADMIN',
        subspecialties: [],
      },
      {
        key: 'reception',
        name: 'Blessing Okon',
        email: 'reception@histo.ng',
        password: 'Reception#2026',
        role: 'RECEPTIONIST',
        subspecialties: [],
      },
      {
        key: 'grosser',
        name: 'Sani Abdullahi',
        email: 'grosser@histo.ng',
        password: 'Grosser#2026',
        role: 'GROSSER',
        subspecialties: [],
      },
      {
        key: 'phleb',
        name: 'Amina Yusuf',
        email: 'phlebotomist@histo.ng',
        password: 'Phlebotomist#2026',
        role: 'PHLEBOTOMIST',
        subspecialties: [],
      },
      {
        key: 'scientist',
        name: 'Tunde Balogun',
        email: 'scientist@histo.ng',
        password: 'Scientist#2026',
        role: 'SCIENTIST',
        subspecialties: [],
        disciplines: ['HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'] as const,
      },
      {
        key: 'tech',
        name: 'Chiamaka Uche',
        email: 'technologist@histo.ng',
        password: 'Technologist#2026',
        role: 'TECHNOLOGIST',
        subspecialties: [],
      },
      {
        key: 'path1',
        name: 'Dr Adaeze Okafor',
        email: 'pathologist@histo.ng',
        password: 'Pathologist#2026',
        role: 'PATHOLOGIST',
        subspecialties: ['Breast', 'Gastrointestinal'],
      },
      {
        key: 'path2',
        name: 'Dr Emeka Nwosu',
        email: 'pathologist2@histo.ng',
        password: 'Pathologist#2026',
        role: 'PATHOLOGIST',
        subspecialties: ['Urology', 'Gynaecology'],
        disciplines: ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'],
      },
      {
        key: 'referrer',
        name: 'Dr Bola Adeyemi',
        email: 'referrer@clinic.ng',
        password: 'Referrer#2026',
        role: 'REFERRER',
        subspecialties: [],
        phone: '+234 803 441 2201',
      },
    ];

    const users: Record<string, UserEntity> = {};
    for (const definition of staffDefinitions) {
      const user = await UserModel.create({
        labId,
        name: definition.name,
        email: definition.email,
        passwordHash: await hashFor(definition.password),
        role: definition.role,
        phone: definition.phone ?? null,
        subspecialties: definition.subspecialties,
        disciplines:
          definition.disciplines ??
          (isClinicalRole(definition.role) ? (['HISTOPATHOLOGY'] as const) : []),
        active: true,
      });
      users[definition.key] = user;
    }

    const actor = (key: string): SeedActor => {
      const user = users[key];
      if (!user) throw new Error(`Seed actor ${key} is missing.`);
      return { userId: user._id, userName: user.name, userRole: user.role };
    };

    const protocols = new Map<string, ProtocolEntity>();
    for (const definition of protocolDefinitions) {
      const content = protocolContentSchema.parse(definition.content);
      const protocol = await ProtocolModel.create({
        labId,
        key: definition.key,
        title: content.title,
        cancerType: content.cancerType,
        subspecialty: content.subspecialty,
        version: 1,
        active: true,
        content,
        createdBy: users.admin?._id ?? null,
      });
      protocols.set(definition.key, protocol);
    }

    const custodyEvents: EventSeed[] = [];
    const audits: Partial<AuditLogEntity>[] = [];
    const notifications: Partial<NotificationEntity>[] = [];

    const pushEvent = (input: Omit<EventSeed, 'labId'>): void => {
      custodyEvents.push({ ...input, labId });
    };

    for (const [index, seed] of caseSeeds.entries()) {
      const accessionNumber = formatAccession(lab.accessionFormat, {
        prefix: lab.accessionPrefix,
        year,
        sequence: index + 1,
      });
      const mrn = formatMrn(year, index + 1);
      const receivedAt = new Date(now.getTime() - seed.offsetDays * DAY - index * 11 * 60_000);
      const protocol = protocols.get(seed.protocolKey);
      if (!protocol) throw new Error(`Protocol ${seed.protocolKey} not seeded.`);
      const content = protocol.content;
      const subspecialty = content.subspecialty;

      const grossAt = addHours(receivedAt, 1.8);
      const processingAt = addHours(grossAt, 2.4);
      const embeddedAt = addHours(processingAt, 2.1);
      const cutAt = addHours(embeddedAt, 10.5);
      const stainedAt = addHours(cutAt, 2);
      const pathAt = addHours(stainedAt, 1.5);
      const reportedAt = addHours(pathAt, 4);
      const amendedAt = addHours(reportedAt, 14);
      const archiveAt = addHours(reportedAt, 20);
      const tatHours = lab.tatHours[seed.priority] ?? 72;
      const tatDeadline = addHours(receivedAt, tatHours);

      const isReported =
        seed.stage === 'REPORTED' || seed.stage === 'AMENDED' || seed.stage === 'ARCHIVED';
      const isAmended = seed.stage === 'AMENDED';
      const isPending = seed.stage === 'PENDING_REVIEW' || seed.stage === 'RECUT';
      const advanceToGross = seed.stage !== 'RECEIVED';
      const advanceToSections = !['RECEIVED', 'GROSSED', 'PROCESSING', 'EMBEDDED'].includes(
        seed.stage,
      );

      const assignedPathologist =
        seed.stage === 'RECEIVED'
          ? null
          : index === 20
            ? null
            : seed.protocolKey === 'breast_carcinoma' || seed.protocolKey === 'colorectal_carcinoma'
              ? users.path1
              : users.path2;
      const signer = assignedPathologist ?? users.path1;
      if (!signer) throw new Error('Pathologist missing from seed.');

      let caseStatus: CaseStatus;
      if (isAmended) caseStatus = 'AMENDED';
      else if (isReported) caseStatus = 'REPORTED';
      else if (isPending) caseStatus = 'PENDING_REVIEW';
      else if (advanceToGross) caseStatus = 'IN_PROGRESS';
      else caseStatus = 'RECEIVED';

      const clinician = isReported
        ? referringClinicians[0]!
        : referringClinicians[index % referringClinicians.length]!;
      const patient = await PatientModel.create({
        labId,
        mrn,
        firstName: seed.firstName,
        lastName: seed.lastName,
        sex: seed.sex,
        dateOfBirth: ageDate(seed.age),
        age: seed.age,
        phone: `+234 80${3 + (index % 7)} ${String(1000000 + index * 137).slice(-7)}`,
        email: null,
        address: ['Ikeja, Lagos', 'Surulere, Lagos', 'Wuse II, Abuja', 'Port Harcourt, Rivers'][
          index % 4
        ],
        nationalId: null,
        nextOfKin: {
          name: `${seed.lastName} family`,
          phone: `+234 81${2 + (index % 6)} ${String(2000000 + index * 211).slice(-7)}`,
          relationship: 'Spouse',
        },
        createdBy: users.reception?._id ?? null,
      });

      const caseDoc = await CaseModel.create({
        labId,
        accessionNumber,
        patientId: patient._id,
        priority: seed.priority,
        priorityRank: PRIORITY_RANK[seed.priority],
        status: caseStatus,
        statusChangedAt: isAmended
          ? amendedAt
          : isReported
            ? reportedAt
            : isPending
              ? pathAt
              : advanceToGross
                ? grossAt
                : receivedAt,
        clinicalHistory: clinicalHistory(seed),
        clinicalDiagnosis: `Suspected ${content.cancerType.toLowerCase()}.`,
        subspecialty,
        referringClinician: {
          ...clinician,
          referrerUserId: clinician.email === users.referrer?.email ? users.referrer._id : null,
        },
        assignedPathologistId: assignedPathologist ? assignedPathologist._id : null,
        receivedAt,
        tatDeadline,
        reportedAt: isReported ? reportedAt : null,
        amendedAt: isAmended ? amendedAt : null,
        tatBreachedAt: isReported
          ? reportedAt > tatDeadline
            ? tatDeadline
            : null
          : tatDeadline < now
            ? tatDeadline
            : null,
        summary: { specimenCount: 1, blockCount: 0, slideCount: 0 },
        createdBy: users.reception?._id ?? null,
        reportedBy: isReported ? signer._id : null,
        lastScannedAt: isReported
          ? reportedAt
          : advanceToSections
            ? stainedAt
            : advanceToGross
              ? grossAt
              : receivedAt,
        createdAt: receivedAt,
        updatedAt: now,
      });

      const testRequestStatus =
        caseStatus === 'PENDING_REVIEW'
          ? 'PENDING_REVIEW'
          : caseStatus === 'REPORTED'
            ? 'VERIFIED'
            : caseStatus === 'AMENDED'
              ? 'VERIFIED'
              : caseStatus === 'IN_PROGRESS'
                ? 'IN_PROGRESS'
                : 'RECEIVED';
      await TestRequestModel.create({
        labId,
        caseId: caseDoc._id,
        accessionNumber,
        discipline: 'HISTOPATHOLOGY',
        code: 'HISTO',
        name: 'Histopathology examination',
        status: testRequestStatus,
        priority: seed.priority,
        requestedBy: users.reception?._id ?? null,
        requestedAt: receivedAt,
      });

      audits.push({
        labId,
        action: 'CREATE',
        entityType: 'Case',
        entityId: caseDoc._id.toString(),
        caseId: caseDoc._id.toString(),
        userId: users.reception?._id ?? null,
        userName: users.reception?.name ?? 'Reception',
        userRole: 'RECEPTIONIST',
        before: null,
        after: { accessionNumber, priority: seed.priority, status: 'RECEIVED' },
        metadata: { source: 'seed' },
        ip: null,
        userAgent: 'seed-script',
        requestId: 'seed',
        createdAt: receivedAt,
        updatedAt: receivedAt,
      });

      pushEvent({
        entityType: 'CASE',
        entityId: caseDoc._id,
        caseId: caseDoc._id,
        eventType: 'RECEIVED',
        station: null,
        fromState: null,
        toState: 'RECEIVED',
        reason: 'Accessioned',
        ...actor('reception'),
        timestamp: receivedAt,
        barcode: null,
        metadata: { accessionNumber, priority: seed.priority },
      });

      const specimenStatus: PhysicalState = advanceToGross ? 'GROSSED' : 'ACCESSIONED';
      const specimen = await SpecimenModel.create({
        labId,
        caseId: caseDoc._id,
        sequence: 1,
        label: 'A',
        barcode: `SP-${accessionNumber}-A`,
        specimenType: seed.specimenType,
        site: seed.site,
        laterality: seed.site.toLowerCase().startsWith('left')
          ? 'LEFT'
          : seed.site.toLowerCase().startsWith('right')
            ? 'RIGHT'
            : 'NOT_APPLICABLE',
        description: `${seed.specimenType} from ${seed.site}.`,
        collectedAt: new Date(receivedAt.getTime() - 12 * HOUR),
        receivedAt,
        grossDescription: advanceToGross ? grossDescription(seed) : null,
        status: specimenStatus,
        currentStation: advanceToGross ? 'GROSSING' : null,
      });
      pushEvent({
        entityType: 'SPECIMEN',
        entityId: specimen._id,
        caseId: caseDoc._id,
        eventType: 'ACCESSIONED',
        station: null,
        fromState: null,
        toState: 'ACCESSIONED',
        reason: 'Accessioned',
        ...actor('reception'),
        timestamp: receivedAt,
        barcode: specimen.barcode,
        metadata: { label: specimen.label, specimenType: specimen.specimenType },
      });
      if (advanceToGross) {
        pushEvent({
          entityType: 'SPECIMEN',
          entityId: specimen._id,
          caseId: caseDoc._id,
          eventType: 'GROSSED',
          station: 'GROSSING',
          fromState: 'ACCESSIONED',
          toState: 'GROSSED',
          reason: 'Gross examination recorded',
          ...actor('grosser'),
          timestamp: grossAt,
          barcode: specimen.barcode,
          metadata: { label: specimen.label },
        });
      }

      let specimenCount = 1;
      if (index === 5) {
        const rejected = await SpecimenModel.create({
          labId,
          caseId: caseDoc._id,
          sequence: 2,
          label: 'B',
          barcode: `SP-${accessionNumber}-B`,
          specimenType: 'Lymph node',
          site: 'Left iliac node',
          laterality: 'LEFT',
          description: 'Separate node submitted in a leaking container.',
          receivedAt,
          status: 'REJECTED',
          currentStation: null,
          rejectionReason: 'Container leaked; tissue partly dessicated and uninterpretable.',
        });
        specimenCount = 2;
        pushEvent({
          entityType: 'SPECIMEN',
          entityId: rejected._id,
          caseId: caseDoc._id,
          eventType: 'ACCESSIONED',
          station: null,
          fromState: null,
          toState: 'ACCESSIONED',
          reason: 'Accessioned',
          ...actor('reception'),
          timestamp: receivedAt,
          barcode: rejected.barcode,
          metadata: { label: rejected.label },
        });
        pushEvent({
          entityType: 'SPECIMEN',
          entityId: rejected._id,
          caseId: caseDoc._id,
          eventType: 'REJECTED',
          station: null,
          fromState: 'ACCESSIONED',
          toState: 'REJECTED',
          reason: 'Container leaked; tissue uninterpretable.',
          ...actor('grosser'),
          timestamp: addHours(receivedAt, 2),
          barcode: rejected.barcode,
          metadata: { label: rejected.label },
        });
      }

      const blocks: BlockEntity[] = [];
      if (advanceToGross) {
        const blockStatus: PhysicalState =
          seed.stage === 'GROSSED'
            ? 'ACCESSIONED'
            : seed.stage === 'PROCESSING'
              ? 'PROCESSING'
              : seed.stage === 'EMBEDDED'
                ? 'EMBEDDED'
                : seed.stage === 'ARCHIVED'
                  ? 'ARCHIVED'
                  : isReported
                    ? 'REPORTED'
                    : 'CUT';
        for (let blockNumber = 1; blockNumber <= 3; blockNumber += 1) {
          const label = `A${blockNumber}`;
          const block = await BlockModel.create({
            labId,
            caseId: caseDoc._id,
            specimenId: specimen._id,
            specimenSequence: 1,
            blockNumber,
            label,
            barcode: `BL-${accessionNumber}-${label}`,
            grossDescription: `${grossDescription(seed)} Block ${label}.`,
            status: blockStatus,
            currentStation: thisStationForBlock(blockStatus),
            slideCount: 0,
            lastEventAt: blockStatus === 'ACCESSIONED' ? grossAt : cutAt,
            notes: null,
          });
          blocks.push(block);
          pushEvent({
            entityType: 'BLOCK',
            entityId: block._id,
            caseId: caseDoc._id,
            eventType: 'ACCESSIONED',
            station: null,
            fromState: null,
            toState: 'ACCESSIONED',
            reason: 'Block created at grossing',
            ...actor('grosser'),
            timestamp: grossAt,
            barcode: block.barcode,
            metadata: { label },
          });
          if (blockStatus !== 'ACCESSIONED') {
            pushEvent({
              entityType: 'BLOCK',
              entityId: block._id,
              caseId: caseDoc._id,
              eventType: 'GROSSED',
              station: 'GROSSING',
              fromState: 'ACCESSIONED',
              toState: 'GROSSED',
              reason: 'Cassette confirmed at grossing',
              ...actor('grosser'),
              timestamp: addHours(grossAt, 0.1),
              barcode: block.barcode,
              metadata: { label },
            });
          }
          if (
            ['PROCESSING', 'EMBEDDED', 'CUT', 'REPORTED', 'ARCHIVED'].includes(blockStatus) &&
            seed.stage !== 'PROCESSING'
          ) {
            pushEvent({
              entityType: 'BLOCK',
              entityId: block._id,
              caseId: caseDoc._id,
              eventType: 'PROCESSING',
              station: 'PROCESSING',
              fromState: 'GROSSED',
              toState: 'PROCESSING',
              reason: 'Moved to processor',
              ...actor('tech'),
              timestamp: processingAt,
              barcode: block.barcode,
              metadata: { label },
            });
          }
          if (blockStatus === 'PROCESSING') {
            pushEvent({
              entityType: 'BLOCK',
              entityId: block._id,
              caseId: caseDoc._id,
              eventType: 'PROCESSING',
              station: 'PROCESSING',
              fromState: 'GROSSED',
              toState: 'PROCESSING',
              reason: 'Moved to processor',
              ...actor('tech'),
              timestamp: processingAt,
              barcode: block.barcode,
              metadata: { label },
            });
          }
          if (
            ['EMBEDDED', 'CUT', 'REPORTED', 'ARCHIVED'].includes(blockStatus) &&
            seed.stage !== 'PROCESSING'
          ) {
            pushEvent({
              entityType: 'BLOCK',
              entityId: block._id,
              caseId: caseDoc._id,
              eventType: 'EMBEDDED',
              station: 'EMBEDDING',
              fromState: 'PROCESSING',
              toState: 'EMBEDDED',
              reason: 'Embedded in wax',
              ...actor('tech'),
              timestamp: embeddedAt,
              barcode: block.barcode,
              metadata: { label },
            });
          }
          if (
            ['CUT', 'REPORTED', 'ARCHIVED'].includes(blockStatus) &&
            seed.stage !== 'PROCESSING'
          ) {
            pushEvent({
              entityType: 'BLOCK',
              entityId: block._id,
              caseId: caseDoc._id,
              eventType: 'CUT',
              station: 'MICROTOMY',
              fromState: 'EMBEDDED',
              toState: 'CUT',
              reason: 'Sections cut',
              ...actor('tech'),
              timestamp: cutAt,
              barcode: block.barcode,
              metadata: { label },
            });
          }
          if (blockStatus === 'REPORTED' || blockStatus === 'ARCHIVED') {
            pushEvent({
              entityType: 'BLOCK',
              entityId: block._id,
              caseId: caseDoc._id,
              eventType: 'REPORTED',
              station: 'PATHOLOGIST',
              fromState: 'CUT',
              toState: 'REPORTED',
              reason: 'Report signed out',
              ...actor('path1'),
              timestamp: reportedAt,
              barcode: block.barcode,
              metadata: { label },
            });
          }
          if (blockStatus === 'ARCHIVED') {
            pushEvent({
              entityType: 'BLOCK',
              entityId: block._id,
              caseId: caseDoc._id,
              eventType: 'ARCHIVED',
              station: 'ARCHIVE',
              fromState: 'REPORTED',
              toState: 'ARCHIVED',
              reason: 'Archived after sign-out',
              ...actor('tech'),
              timestamp: archiveAt,
              barcode: block.barcode,
              metadata: { label },
            });
          }
        }
      }

      let slideCount = 0;
      if (advanceToSections) {
        for (const [blockIndex, block] of blocks.entries()) {
          const perBlock = blockIndex === 0 ? 2 : 1;
          for (let number = 1; number <= perBlock; number += 1) {
            const label = `${block.label}-${number}`;
            let status: PhysicalState;
            if (seed.stage === 'CUT') status = 'CUT';
            else if (seed.stage === 'STAINED') status = 'STAINED';
            else if (seed.stage === 'ARCHIVED') status = 'ARCHIVED';
            else if (isReported) status = 'REPORTED';
            else if (seed.stage === 'RECUT') {
              status = blockIndex === 0 && number === 2 ? 'RECUT_REQUESTED' : 'WITH_PATHOLOGIST';
            } else status = 'WITH_PATHOLOGIST';

            const isSpecial = index === 17 && blockIndex === 0 && number === 1;
            const stainType: StainType = isSpecial ? 'IMMUNOHISTOCHEMISTRY' : 'H_AND_E';
            const slide = await SlideModel.create({
              labId,
              caseId: caseDoc._id,
              specimenId: specimen._id,
              blockId: block._id,
              blockLabel: block.label,
              slideNumber: number,
              label,
              barcode: `SL-${accessionNumber}-${label}`,
              stainType,
              specialStain: isSpecial ? 'CK20' : null,
              status,
              currentStation: thisStationForSlide(status),
              recutOfSlideId: null,
              requestReason:
                status === 'RECUT_REQUESTED' ? 'Section folded; recut at 3 microns.' : null,
              notes: null,
              createdBy: users.tech?._id ?? null,
              lastEventAt: archiveAt,
            });
            slideCount += 1;
            const fromStates: Record<string, string | null> = {
              CUT: 'ACCESSIONED',
              STAINED: 'CUT',
              WITH_PATHOLOGIST: 'STAINED',
              REPORTED: 'WITH_PATHOLOGIST',
              ARCHIVED: 'REPORTED',
              RECUT_REQUESTED: 'WITH_PATHOLOGIST',
            };
            pushEvent({
              entityType: 'SLIDE',
              entityId: slide._id,
              caseId: caseDoc._id,
              eventType: 'CUT',
              station: 'MICROTOMY',
              fromState: 'ACCESSIONED',
              toState: 'CUT',
              reason: 'Slide created at microtomy',
              ...actor('tech'),
              timestamp: cutAt,
              barcode: slide.barcode,
              metadata: { label, stainType },
            });
            if (status !== 'CUT') {
              pushEvent({
                entityType: 'SLIDE',
                entityId: slide._id,
                caseId: caseDoc._id,
                eventType: 'STAINED',
                station: 'STAINING',
                fromState: 'CUT',
                toState: 'STAINED',
                reason: 'Stained',
                ...actor('tech'),
                timestamp: stainedAt,
                barcode: slide.barcode,
                metadata: { label },
              });
            }
            if (['WITH_PATHOLOGIST', 'REPORTED', 'ARCHIVED', 'RECUT_REQUESTED'].includes(status)) {
              pushEvent({
                entityType: 'SLIDE',
                entityId: slide._id,
                caseId: caseDoc._id,
                eventType: 'WITH_PATHOLOGIST',
                station: 'PATHOLOGIST',
                fromState: 'STAINED',
                toState: 'WITH_PATHOLOGIST',
                reason: 'On pathologist desk',
                ...actor(
                  signer.role === 'PATHOLOGIST'
                    ? signer === users.path1
                      ? 'path1'
                      : 'path2'
                    : 'path1',
                ),
                timestamp: pathAt,
                barcode: slide.barcode,
                metadata: { label },
              });
            }
            if (status === 'REPORTED' || status === 'ARCHIVED') {
              pushEvent({
                entityType: 'SLIDE',
                entityId: slide._id,
                caseId: caseDoc._id,
                eventType: 'REPORTED',
                station: 'PATHOLOGIST',
                fromState: 'WITH_PATHOLOGIST',
                toState: 'REPORTED',
                reason: 'Report signed out',
                ...actor(signer === users.path1 ? 'path1' : 'path2'),
                timestamp: reportedAt,
                barcode: slide.barcode,
                metadata: { label },
              });
            }
            if (status === 'ARCHIVED') {
              pushEvent({
                entityType: 'SLIDE',
                entityId: slide._id,
                caseId: caseDoc._id,
                eventType: 'ARCHIVED',
                station: 'ARCHIVE',
                fromState: 'REPORTED',
                toState: 'ARCHIVED',
                reason: 'Archived after sign-out',
                ...actor('tech'),
                timestamp: archiveAt,
                barcode: slide.barcode,
                metadata: { label },
              });
            }
            if (status === 'RECUT_REQUESTED') {
              pushEvent({
                entityType: 'SLIDE',
                entityId: slide._id,
                caseId: caseDoc._id,
                eventType: 'RECUT_REQUESTED',
                station: 'PATHOLOGIST',
                fromState: 'WITH_PATHOLOGIST',
                toState: 'RECUT_REQUESTED',
                reason: 'Section folded; recut at 3 microns.',
                ...actor(signer === users.path1 ? 'path1' : 'path2'),
                timestamp: addHours(pathAt, 1),
                barcode: slide.barcode,
                metadata: { label, fromState: fromStates[status] ?? null },
              });
            }
          }
          await BlockModel.updateOne({ _id: block._id }, { $set: { slideCount: perBlock } }).exec();
        }

        if (index === 18) {
          const block = blocks[0];
          if (block) {
            const label = `${block.label}-3`;
            const extra = await SlideModel.create({
              labId,
              caseId: caseDoc._id,
              specimenId: specimen._id,
              blockId: block._id,
              blockLabel: block.label,
              slideNumber: 3,
              label,
              barcode: `SL-${accessionNumber}-${label}`,
              stainType: 'IMMUNOHISTOCHEMISTRY',
              specialStain: 'p16',
              status: 'ACCESSIONED',
              currentStation: null,
              recutOfSlideId: null,
              requestReason: 'Confirm HPV status in squamous carcinoma.',
              notes: null,
              createdBy: users.path2?._id ?? null,
              lastEventAt: addHours(stainedAt, 1),
            });
            slideCount += 1;
            pushEvent({
              entityType: 'SLIDE',
              entityId: extra._id,
              caseId: caseDoc._id,
              eventType: 'ACCESSIONED',
              station: null,
              fromState: null,
              toState: 'ACCESSIONED',
              reason: 'Special stain requested',
              ...actor('path2'),
              timestamp: addHours(stainedAt, 1),
              barcode: extra.barcode,
              metadata: { label, specialStain: 'p16' },
            });
            await BlockModel.updateOne({ _id: block._id }, { $set: { slideCount: 3 } }).exec();
          }
        }
      }

      await CaseModel.updateOne(
        { _id: caseDoc._id },
        {
          $set: {
            'summary.specimenCount': specimenCount,
            'summary.blockCount': blocks.length,
            'summary.slideCount': slideCount,
          },
        },
      ).exec();

      if (advanceToGross) {
        pushEvent({
          entityType: 'CASE',
          entityId: caseDoc._id,
          caseId: caseDoc._id,
          eventType: 'IN_PROGRESS',
          station: null,
          fromState: 'RECEIVED',
          toState: 'IN_PROGRESS',
          reason: 'Grossing recorded',
          ...actor('grosser'),
          timestamp: grossAt,
          barcode: null,
          metadata: { trigger: 'Grossing recorded' },
        });
      }
      if (isPending || isReported) {
        pushEvent({
          entityType: 'CASE',
          entityId: caseDoc._id,
          caseId: caseDoc._id,
          eventType: 'PENDING_REVIEW',
          station: null,
          fromState: 'IN_PROGRESS',
          toState: 'PENDING_REVIEW',
          reason: 'Slides on pathologist desk',
          ...actor(signer === users.path1 ? 'path1' : 'path2'),
          timestamp: pathAt,
          barcode: null,
          metadata: { trigger: 'Slides on pathologist desk' },
        });
      }
      if (isReported) {
        pushEvent({
          entityType: 'CASE',
          entityId: caseDoc._id,
          caseId: caseDoc._id,
          eventType: 'REPORTED',
          station: null,
          fromState: 'PENDING_REVIEW',
          toState: 'REPORTED',
          reason: 'Report signed out',
          ...actor(signer === users.path1 ? 'path1' : 'path2'),
          timestamp: reportedAt,
          barcode: null,
          metadata: { trigger: 'Report signed out' },
        });
      }
      if (isAmended) {
        pushEvent({
          entityType: 'CASE',
          entityId: caseDoc._id,
          caseId: caseDoc._id,
          eventType: 'AMENDED',
          station: null,
          fromState: 'REPORTED',
          toState: 'AMENDED',
          reason: 'Corrected HER2 interpretation after repeat ISH',
          ...actor(signer === users.path1 ? 'path1' : 'path2'),
          timestamp: amendedAt,
          barcode: null,
          metadata: { trigger: 'Amendment' },
        });
      }

      if (isPending || isReported) {
        const fullData = fullReportData(seed, index);
        const validation = validateReportData(content, fullData);
        if (!validation.valid) {
          throw new Error(
            `Seed report data invalid for ${seed.protocolKey}: ${validation.errors
              .map((error) => error.message)
              .concat(validation.missingRequired)
              .join('; ')}`,
          );
        }
        const draftData = { ...validation.data };
        draftData.diagnosis = null;
        draftData.margins = null;
        const data = isReported ? validation.data : draftData;
        const completeness = reportCompleteness(content, data);
        const narrative = generateNarrative(content, data);
        const reportStatus = isAmended ? 'AMENDED' : isReported ? 'SIGNED_OUT' : 'DRAFT';
        const version = isAmended ? 2 : isReported ? 1 : 0;
        const verificationCode =
          reportStatus === 'DRAFT' ? null : `V${String(index + 1).padStart(9, '0')}`;
        const signedAt = isAmended ? amendedAt : isReported ? reportedAt : null;

        const report = await ReportModel.create({
          labId,
          caseId: caseDoc._id,
          protocolId: protocol._id,
          protocolSnapshot: {
            protocolId: protocol._id.toString(),
            key: protocol.key,
            title: protocol.title,
            cancerType: protocol.cancerType,
            subspecialty: protocol.subspecialty,
            version: protocol.version,
            content,
          },
          protocolVersion: protocol.version,
          status: reportStatus,
          data,
          narrative,
          version,
          requiredComplete: completeness.complete,
          missingRequired: completeness.missingRequired,
          signedOutBy: isReported ? signer._id : null,
          signedOutAt: signedAt,
          amendedAt: isAmended ? amendedAt : null,
          amendmentReason: isAmended
            ? 'Corrected synoptic data after review of source documents.'
            : null,
          verificationCode,
          pdfPath: null,
          pdfGeneratedAt: null,
          createdBy: users.path1?._id ?? null,
        });

        if (isReported) {
          const earlierData = { ...validation.data };
          if (seed.protocolKey === 'breast_carcinoma') earlierData.her2Ihc = '2+';
          await new VersionModel({
            labId,
            reportId: report._id,
            caseId: caseDoc._id,
            version: 1,
            action: 'SIGN_OUT',
            data: isAmended ? earlierData : data,
            narrative: generateNarrative(content, isAmended ? earlierData : data),
            reason: null,
            createdBy: signer._id,
            createdAt: reportedAt,
            updatedAt: reportedAt,
          }).save({ timestamps: false });
          audits.push({
            labId,
            action: 'SIGN_OUT',
            entityType: 'Report',
            entityId: report._id.toString(),
            caseId: caseDoc._id.toString(),
            userId: signer._id,
            userName: signer.name,
            userRole: 'PATHOLOGIST',
            before: { status: 'DRAFT', version: 0 },
            after: { status: 'SIGNED_OUT', version: 1, verificationCode },
            metadata: { source: 'seed' },
            ip: null,
            userAgent: 'seed-script',
            requestId: 'seed',
            createdAt: reportedAt,
            updatedAt: reportedAt,
          });
        }
        if (isAmended) {
          await new VersionModel({
            labId,
            reportId: report._id,
            caseId: caseDoc._id,
            version: 2,
            action: 'AMEND',
            data: validation.data,
            narrative,
            reason: 'Corrected synoptic data after review of source documents.',
            createdBy: signer._id,
            createdAt: amendedAt,
            updatedAt: amendedAt,
          }).save({ timestamps: false });
          audits.push({
            labId,
            action: 'AMEND',
            entityType: 'Report',
            entityId: report._id.toString(),
            caseId: caseDoc._id.toString(),
            userId: signer._id,
            userName: signer.name,
            userRole: 'PATHOLOGIST',
            before: { status: 'SIGNED_OUT', version: 1, her2Ihc: '2+' },
            after: { status: 'AMENDED', version: 2, her2Ihc: validation.data.her2Ihc ?? null },
            metadata: { reason: 'Corrected HER2 interpretation' },
            ip: null,
            userAgent: 'seed-script',
            requestId: 'seed',
            createdAt: amendedAt,
            updatedAt: amendedAt,
          });
        }
      }

      if (tatDeadline < now && !isReported) {
        notifications.push({
          labId,
          type: 'TAT_BREACH',
          title: `TAT breach — ${accessionNumber}`,
          body: `${seed.priority.toLowerCase()} case ${accessionNumber} has passed its turnaround deadline.`,
          userId: assignedPathologist?._id ?? null,
          role: assignedPathologist ? null : 'LAB_ADMIN',
          entityType: 'Case',
          entityId: caseDoc._id.toString(),
          caseId: caseDoc._id.toString(),
          readAt: null,
          metadata: { seed: true },
        });
      }
    }

    await seedPhase23(connection, labId, users, year);
    await seedPhase2(connection, lab, now);
    await seedPhase4(connection, labId, now);
    lab.accessionCounters.set(`invoice-${year}`, 9);

    for (const event of custodyEvents) {
      await CustodyModel.create(event);
    }
    for (const audit of audits) {
      await new AuditModel(audit).save({ timestamps: false });
    }
    for (const notification of notifications) {
      await NotificationModel.create(notification);
    }

    lab.accessionCounters.set(String(year), caseSeeds.length);
    lab.accessionCounters.set(`mrn-${year}`, caseSeeds.length);
    await lab.save();

    console.log('');
    console.log('Seed complete — Lagos Central Histopathology Laboratory');
    console.log('────────────────────────────────────────────────────────');
    console.log(`Lab code: ${LAB_CODE}`);
    console.log(
      `Protocols: ${protocols.size}  Cases: ${caseSeeds.length}  Custody events: ${custodyEvents.length}`,
    );
    console.log('');
    console.log('Demo accounts (password in brackets):');
    for (const definition of staffDefinitions) {
      console.log(`  ${definition.role.padEnd(13)} ${definition.email}  [${definition.password}]`);
    }
    console.log('');
    console.log(
      'Try scanning: BL-HP-' + year + '-000004-A1 (block awaiting grossing confirmation)',
    );
  });

  await connection.close();
}

function thisStationForBlock(status: PhysicalState): Station | null {
  switch (status) {
    case 'ACCESSIONED':
      return null;
    case 'GROSSED':
      return 'GROSSING';
    case 'PROCESSING':
      return 'PROCESSING';
    case 'EMBEDDED':
      return 'EMBEDDING';
    case 'CUT':
      return 'MICROTOMY';
    case 'REPORTED':
      return 'PATHOLOGIST';
    case 'ARCHIVED':
      return 'ARCHIVE';
    default:
      return null;
  }
}

function thisStationForSlide(status: PhysicalState): Station | null {
  switch (status) {
    case 'ACCESSIONED':
      return null;
    case 'CUT':
      return 'MICROTOMY';
    case 'STAINED':
      return 'STAINING';
    case 'WITH_PATHOLOGIST':
    case 'RECUT_REQUESTED':
      return 'PATHOLOGIST';
    case 'REPORTED':
      return 'PATHOLOGIST';
    case 'ARCHIVED':
      return 'ARCHIVE';
    default:
      return null;
  }
}
