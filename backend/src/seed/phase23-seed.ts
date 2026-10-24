import { Types, type Connection } from 'mongoose';
import type { Role } from '@lims/shared';

interface SeedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  subspecialties: string[];
}

interface SeedCase {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  accessionNumber: string;
  subspecialty: string | null;
  receivedAt: Date;
}

interface SeedReport {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  signedOutBy: Types.ObjectId | null;
  signedOutAt: Date | null;
  status: string;
  narrative: string;
  data: Record<string, unknown>;
}

interface SeedSlide {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  blockId: Types.ObjectId;
  barcode: string;
  stainType: string;
  specialStain: string | null;
  createdAt: Date;
}

interface SeedPatient {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * Phase 2/3 sample data is inserted through raw collections. This keeps the
 * seed fast and avoids coupling the demo dataset to Mongoose model inference.
 */
export async function seedPhase23(
  connection: Connection,
  labId: Types.ObjectId,
  users: Record<string, SeedUser>,
  year: number,
): Promise<void> {
  const admin = users.admin;
  const path1 = users.path1;
  const path2 = users.path2;
  const tech = users.tech;
  const reception = users.reception;
  if (!admin || !path1 || !path2 || !tech) throw new Error('Seed users are incomplete.');
  const now = new Date();
  const lab = await connection.collection('labs').findOne({ _id: labId });
  const currency = typeof lab?.currency === 'string' ? lab.currency : 'NGN';

  const terminology = [
    ['SNOMED_CT', '408643008', 'Infiltrating duct carcinoma of breast', 'Breast', ['IDC']],
    ['SNOMED_CT', '254837009', 'Malignant tumor of breast', 'Breast', ['breast cancer']],
    ['SNOMED_CT', '363406005', 'Malignant tumor of colon', 'Colorectal', ['colon cancer']],
    ['SNOMED_CT', '399068003', 'Malignant tumor of prostate', 'Urology', ['prostate cancer']],
    ['SNOMED_CT', '363354003', 'Malignant tumor of cervix', 'Gynaecology', ['cervical cancer']],
    ['ICD_O_3_MORPHOLOGY', '8500/3', 'Infiltrating duct carcinoma, NOS', 'Breast', ['IDC']],
    ['ICD_O_3_MORPHOLOGY', '8140/3', 'Adenocarcinoma, NOS', 'General', []],
    ['ICD_O_3_MORPHOLOGY', '8480/3', 'Mucinous adenocarcinoma', 'Colorectal', []],
    ['ICD_O_3_MORPHOLOGY', '8070/3', 'Squamous cell carcinoma, NOS', 'Gynaecology', ['SCC']],
    ['ICD_O_3_MORPHOLOGY', '8141/3', 'Scirrhous adenocarcinoma', 'Breast', []],
    ['ICD_O_3_TOPOGRAPHY', 'C50.9', 'Breast, unspecified', 'Breast', []],
    ['ICD_O_3_TOPOGRAPHY', 'C18.9', 'Colon, unspecified', 'Colorectal', []],
    ['ICD_O_3_TOPOGRAPHY', 'C20', 'Rectum', 'Colorectal', []],
    ['ICD_O_3_TOPOGRAPHY', 'C61', 'Prostate gland', 'Urology', []],
    ['ICD_O_3_TOPOGRAPHY', 'C53.9', 'Cervix uteri, unspecified', 'Gynaecology', []],
  ].map(([system, code, display, category, synonyms]) => ({
    labId,
    system,
    code,
    display,
    category,
    synonyms,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
  await connection.collection('terminology_codes').insertMany(terminology);

  const lots = [
    {
      _id: new Types.ObjectId(),
      name: 'Hematoxylin (Harris)',
      category: 'REAGENT',
      vendor: 'Leica Biosystems',
      catalogNumber: 'HX-3801540',
      lotNumber: 'HX-24091',
      storageLocation: 'Bench A · shelf 1',
      quantity: 420,
      initialQuantity: 500,
      unit: 'mL',
      receivedAt: new Date(now.getTime() - 46 * DAY),
      openedAt: new Date(now.getTime() - 30 * DAY),
      expiresAt: new Date(now.getTime() + 120 * DAY),
      status: 'ACTIVE',
      validationStatus: 'VALIDATED',
      validatedAt: new Date(now.getTime() - 45 * DAY),
      validatedBy: admin._id,
      reorderLevel: 100,
      expiryAlertedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'Eosin (alcoholic)',
      category: 'REAGENT',
      vendor: 'Leica Biosystems',
      catalogNumber: 'ES-3801600',
      lotNumber: 'ES-24112',
      storageLocation: 'Bench A · shelf 1',
      quantity: 260,
      initialQuantity: 500,
      unit: 'mL',
      receivedAt: new Date(now.getTime() - 40 * DAY),
      openedAt: new Date(now.getTime() - 24 * DAY),
      expiresAt: new Date(now.getTime() + 21 * DAY),
      status: 'ACTIVE',
      validationStatus: 'VALIDATED',
      validatedAt: new Date(now.getTime() - 39 * DAY),
      validatedBy: admin._id,
      reorderLevel: 100,
      expiryAlertedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'Estrogen receptor (EP1) antibody',
      category: 'ANTIBODY',
      vendor: 'Roche/Ventana',
      catalogNumber: '790-4324',
      lotNumber: 'ER-2418',
      storageLocation: 'Fridge 2 · drawer 3',
      quantity: 8,
      initialQuantity: 12,
      unit: 'mL',
      receivedAt: new Date(now.getTime() - 60 * DAY),
      openedAt: new Date(now.getTime() - 45 * DAY),
      expiresAt: new Date(now.getTime() + 180 * DAY),
      status: 'ACTIVE',
      validationStatus: 'VALIDATED',
      validatedAt: new Date(now.getTime() - 59 * DAY),
      validatedBy: admin._id,
      reorderLevel: 3,
      expiryAlertedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'HER2 (4B5) antibody',
      category: 'ANTIBODY',
      vendor: 'Roche/Ventana',
      catalogNumber: '790-2991',
      lotNumber: 'HER2-2402',
      storageLocation: 'Fridge 2 · drawer 4',
      quantity: 5,
      initialQuantity: 12,
      unit: 'mL',
      receivedAt: new Date(now.getTime() - 18 * DAY),
      expiresAt: new Date(now.getTime() + 240 * DAY),
      status: 'QUARANTINED',
      validationStatus: 'PENDING',
      reorderLevel: 3,
      expiryAlertedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'Papanicolaou stain set',
      category: 'REAGENT',
      vendor: 'Sigma-Aldrich',
      catalogNumber: 'PAP-123',
      lotNumber: 'PAP-2312',
      storageLocation: 'Bench C · shelf 2',
      quantity: 0,
      initialQuantity: 250,
      unit: 'mL',
      receivedAt: new Date(now.getTime() - 200 * DAY),
      expiresAt: new Date(now.getTime() - 5 * DAY),
      status: 'EXPIRED',
      validationStatus: 'VALIDATED',
      validatedAt: new Date(now.getTime() - 199 * DAY),
      validatedBy: admin._id,
      reorderLevel: 0,
      expiryAlertedAt: now,
    },
  ].map((lot) => ({ ...lot, labId, createdBy: admin._id, createdAt: now, updatedAt: now }));
  await connection.collection('reagent_lots').insertMany(lots);
  const [hx, es, er, her2] = lots;
  if (!hx || !es || !er || !her2) throw new Error('Seed lots missing.');

  const cases = await connection
    .collection<SeedCase>('cases')
    .find({ labId })
    .sort({ receivedAt: 1 })
    .limit(20)
    .toArray();
  const slides = await connection
    .collection<SeedSlide>('slides')
    .find({ labId, status: { $in: ['STAINED', 'WITH_PATHOLOGIST', 'REPORTED'] } })
    .sort({ createdAt: 1 })
    .limit(12)
    .toArray();

  for (const [index, slide] of slides.entries()) {
    if (index < 8) {
      await connection.collection('slides').updateOne(
        { _id: slide._id },
        {
          $set: {
            wsiStatus: 'LINKED',
            wsiUrl: `https://wsi.example.org/slides/${slide.barcode}.svs`,
            wsiViewerUrl: `https://viewer.example.org/slide/${slide.barcode}`,
            wsiScanner: 'Leica Aperio GT450',
            wsiMagnification: index % 3 === 0 ? '40x' : '20x',
            wsiAddedAt: new Date(now.getTime() - (index + 1) * HOUR),
            wsiAddedBy: path1._id,
            wsiMetadata: { source: 'seed', scanner: 'aperio-gt450' },
            updatedAt: now,
          },
        },
      );
    }
  }

  const reports = await connection
    .collection<SeedReport>('reports')
    .find({ labId, status: { $in: ['SIGNED_OUT', 'AMENDED'] } })
    .sort({ signedOutAt: 1 })
    .toArray();

  for (const [index, report] of reports.entries()) {
    const caseDoc = await connection.collection<SeedCase>('cases').findOne({ _id: report.caseId });
    if (!caseDoc) continue;
    const subspecialty = caseDoc.subspecialty ?? 'Breast';
    const coding = codingFor(subspecialty);
    const releasedAt =
      index < reports.length - 1 && report.signedOutAt
        ? new Date(report.signedOutAt.getTime() + 2 * HOUR)
        : null;
    await connection.collection('reports').updateOne(
      { _id: report._id },
      {
        $set: {
          coding,
          releasedAt,
          releasedBy: releasedAt ? (report.signedOutBy ?? path1._id) : null,
          releaseNote: releasedAt ? 'Released through the referral portal.' : null,
          updatedAt: now,
        },
      },
    );

    if (index < 6) {
      const other = report.signedOutBy?.equals(path1._id) ? path2 : path1;
      const status =
        index === 0
          ? 'IN_REVIEW'
          : index === 1
            ? 'DISCREPANT'
            : index === 2
              ? 'ASSIGNED'
              : index === 3
                ? 'AGREED'
                : 'PENDING';
      await connection.collection('qa_reviews').insertOne({
        labId,
        caseId: report.caseId,
        reportId: report._id,
        type: index === 2 ? 'SECOND_OPINION' : 'PEER_REVIEW',
        status,
        reason:
          index === 2
            ? 'Clinician requested a second opinion before treatment planning.'
            : 'Random peer-review sample.',
        requestedBy: path1._id,
        reviewerId: index === 4 ? null : other._id,
        dueAt: new Date(now.getTime() + (index + 1) * 3 * DAY),
        originalDiagnosis:
          typeof report.data.finalDiagnosis === 'string'
            ? report.data.finalDiagnosis
            : typeof report.data.diagnosis === 'string'
              ? report.data.diagnosis
              : report.narrative.slice(0, 500),
        reviewDiagnosis: index === 1 ? 'Invasive carcinoma with a different grade.' : null,
        discrepancyCode: index === 1 ? 'GRADING' : null,
        severity: index === 1 ? 'MINOR' : null,
        findings: index === 1 ? 'Nuclear pleomorphism supports grade 3 rather than grade 2.' : null,
        actionPlan:
          index === 1
            ? 'Discuss at MDT; add a comment to the report if clinically material.'
            : null,
        startedAt: index === 0 ? new Date(now.getTime() - 2 * DAY) : null,
        completedAt: index === 1 || index === 3 ? new Date(now.getTime() - 1 * DAY) : null,
        metadata: { seeded: true },
        createdAt: new Date(now.getTime() - (index + 2) * DAY),
        updatedAt: now,
      });
    }

    if (index < 9) {
      const patient = await connection
        .collection<SeedPatient>('patients')
        .findOne({ _id: caseDoc.patientId });
      if (!patient) continue;
      const hmo = index % 3 === 0;
      const items = [
        {
          description: 'Histopathology professional fee',
          quantity: 1,
          unitPrice: 45_000,
          total: 45_000,
          category: 'PROFESSIONAL',
        },
        {
          description: 'H&E processing and staining',
          quantity: 1,
          unitPrice: 12_500,
          total: 12_500,
          category: 'LABORATORY',
        },
        ...(index % 2 === 0
          ? [
              {
                description: 'Immunohistochemistry panel',
                quantity: 1,
                unitPrice: 28_000,
                total: 28_000,
                category: 'LABORATORY',
              },
            ]
          : []),
      ];
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const amountPaid = index < 3 ? subtotal : index === 3 ? 30_000 : 0;
      const balance = subtotal - amountPaid;
      const invoiceId = new Types.ObjectId();
      await connection.collection('invoices').insertOne({
        _id: invoiceId,
        labId,
        number: `INV-${year}-${String(index + 1).padStart(6, '0')}`,
        caseId: caseDoc._id,
        patientId: patient._id,
        payerType: hmo ? 'HMO' : 'SELF',
        hmoName: hmo ? 'Hygeia HMO' : null,
        hmoCode: hmo ? 'HYG-NG' : null,
        authorizationNumber: hmo ? `AUTH-${year}-${String(index + 1).padStart(4, '0')}` : null,
        status: balance === 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED',
        currency,
        items,
        subtotal,
        discount: 0,
        total: subtotal,
        amountPaid,
        balance,
        dueAt: new Date(now.getTime() + 14 * DAY),
        issuedAt: new Date(now.getTime() - (index + 1) * DAY),
        paidAt: balance === 0 ? new Date(now.getTime() - index * DAY) : null,
        notes: hmo ? 'HMO claim — authorization attached.' : null,
        createdBy: reception?._id ?? admin._id,
        createdAt: new Date(now.getTime() - (index + 1) * DAY),
        updatedAt: now,
      });
      if (amountPaid > 0) {
        await connection.collection('payments').insertOne({
          labId,
          invoiceId,
          provider: hmo ? 'HMO' : 'PAYSTACK',
          status: 'SUCCESS',
          amount: amountPaid,
          currency,
          reference: `PAY-SEED-${String(index + 1).padStart(4, '0')}`,
          providerReference: `SEED-INV-${index + 1}`,
          checkoutUrl: null,
          paidAt: new Date(now.getTime() - index * DAY),
          metadata: { source: 'seed' },
          createdBy: reception?._id ?? admin._id,
          createdAt: new Date(now.getTime() - (index + 1) * DAY),
          updatedAt: now,
        });
      }
    }
  }

  const runSlides = slides.slice(0, 3);
  for (const [index, slide] of runSlides.entries()) {
    const runId = new Types.ObjectId();
    await connection.collection('stain_runs').insertOne({
      _id: runId,
      labId,
      caseId: slide.caseId,
      slideId: slide._id,
      blockId: slide.blockId,
      stainType: slide.stainType,
      stainName:
        slide.specialStain ??
        (slide.stainType === 'IMMUNOHISTOCHEMISTRY' ? 'Immunohistochemistry' : 'H&E'),
      status: 'COMPLETED',
      qcResult: 'PASS',
      lots: [
        { lotId: hx._id, lotNumber: hx.lotNumber, name: hx.name, quantityUsed: 8 + index },
        { lotId: es._id, lotNumber: es.lotNumber, name: es.name, quantityUsed: 4 + index },
        ...(slide.specialStain
          ? [
              {
                lotId: slide.specialStain.includes('HER2') ? her2._id : er._id,
                lotNumber: slide.specialStain.includes('HER2') ? her2.lotNumber : er.lotNumber,
                name: slide.specialStain.includes('HER2') ? her2.name : er.name,
                quantityUsed: 1,
              },
            ]
          : []),
      ],
      equipment: 'Leica ST5020',
      operatorId: tech._id,
      startedAt: new Date(now.getTime() - (index + 2) * DAY),
      completedAt: new Date(now.getTime() - (index + 2) * DAY + 2 * HOUR),
      notes: 'QC pass — control tissue appropriately stained.',
      createdBy: tech._id,
      createdAt: new Date(now.getTime() - (index + 2) * DAY),
      updatedAt: now,
    });
    await connection
      .collection('slides')
      .updateOne({ _id: slide._id }, { $set: { stainRunId: runId, updatedAt: now } });
  }

  void cases;
}

function codingFor(subspecialty: string) {
  if (subspecialty === 'Breast') {
    return {
      snomedCode: '408643008',
      snomedDisplay: 'Infiltrating duct carcinoma of breast',
      icdo3MorphologyCode: '8500/3',
      icdo3MorphologyDisplay: 'Infiltrating duct carcinoma, NOS',
      icdo3TopographyCode: 'C50.9',
      icdo3TopographyDisplay: 'Breast, unspecified',
    };
  }
  if (subspecialty === 'Colorectal') {
    return {
      snomedCode: '363406005',
      snomedDisplay: 'Malignant tumor of colon',
      icdo3MorphologyCode: '8140/3',
      icdo3MorphologyDisplay: 'Adenocarcinoma, NOS',
      icdo3TopographyCode: 'C18.9',
      icdo3TopographyDisplay: 'Colon, unspecified',
    };
  }
  if (subspecialty === 'Urology') {
    return {
      snomedCode: '399068003',
      snomedDisplay: 'Malignant tumor of prostate',
      icdo3MorphologyCode: '8140/3',
      icdo3MorphologyDisplay: 'Adenocarcinoma, NOS',
      icdo3TopographyCode: 'C61',
      icdo3TopographyDisplay: 'Prostate gland',
    };
  }
  return {
    snomedCode: '363354003',
    snomedDisplay: 'Malignant tumor of cervix',
    icdo3MorphologyCode: '8140/3',
    icdo3MorphologyDisplay: 'Adenocarcinoma, NOS',
    icdo3TopographyCode: 'C53.9',
    icdo3TopographyDisplay: 'Cervix uteri, unspecified',
  };
}
