import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Types, type Connection } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  flattenProtocolFields,
  protocolContentSchema,
  type ProtocolContent,
  type ReportData,
} from '@lims/shared';
import { hashPassword } from '../src/common/utils/crypto';
import { breastProtocol } from '../src/seed/protocol-seed';

jest.setTimeout(180_000);

interface SeededUsers {
  receptionist: string;
  grosser: string;
  technologist: string;
  pathologist: string;
  admin: string;
  referrer: string;
  otherLabPathologist: string;
  superadmin: string;
}

const PASSWORD = 'E2ePassword#2026';
const unique = Date.now().toString().slice(-6);

describe('Accession to sign-out (e2e)', () => {
  let app: INestApplication;
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let users: SeededUsers;
  let protocolId: Types.ObjectId;
  let protocolContent: ProtocolContent;
  let caseId: string;
  let accessionNumber: string;
  let specimenId: string;
  let blockId: string;
  let slideBarcodes: string[] = [];
  let slideIds: string[] = [];
  let blockBarcodeA2 = '';
  let patientId: string;
  let reportId: string;
  let verificationCode: string;
  let tokens: Record<keyof SeededUsers, string>;
  let pathologistId: string;

  const tmpRoot = path.resolve(process.cwd(), '.e2e-tmp');
  const storageDir = path.join(tmpRoot, 'storage');

  beforeAll(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
    await mkdir(path.join(tmpRoot, 'mongo', 'db'), { recursive: true });
    process.env.TMPDIR = tmpRoot;

    const downloadDir = path.resolve(
      process.cwd(),
      '../../node_modules/.cache/mongodb-memory-server',
    );
    if (existsSync(downloadDir)) {
      process.env.MONGOMS_DOWNLOAD_DIR = downloadDir;
      const cached = readdirSync(downloadDir).find((file) => file.startsWith('mongod-'));
      if (cached) process.env.MONGOMS_SYSTEM_BINARY = path.join(downloadDir, cached);
    }

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
      instanceOpts: [
        {
          dbPath: path.join(tmpRoot, 'mongo', 'db'),
        },
      ],
    });

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = replSet.getUri('histo_e2e');
    process.env.API_PORT = '4101';
    process.env.API_PREFIX = 'api';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.PUBLIC_WEB_URL = 'http://localhost:3000';
    process.env.PUBLIC_API_URL = 'http://localhost:4101/api';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.LOG_LEVEL = 'silent';
    process.env.QUEUES_ENABLED = 'false';
    process.env.STORAGE_DIR = storageDir;
    process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-000000000000000000000000000000';
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-00000000000000000000000000000';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '7d';
    process.env.PORTAL_DEBUG = 'true';
    process.env.HL7_LAB_CODE = 'E2E1';
    process.env.PAYMENTS_MODE = 'mock';
    process.env.WSI_WEBHOOK_SECRET = 'e2e-wsi-webhook-secret-0000000000';

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
    http = app.getHttpServer();
    connection = app.get<Connection>(getConnectionToken());

    const labId = new Types.ObjectId();
    const otherLabId = new Types.ObjectId();
    const now = new Date();
    const passwordHash = await hashPassword(PASSWORD);

    await connection.collection('labs').insertMany([
      {
        _id: labId,
        code: 'E2E1',
        name: 'E2E Histopathology Laboratory',
        address: '1 Test Way, Lagos',
        phone: '+234 800 000 0000',
        email: 'lab@e2e.test',
        accessionPrefix: 'TST',
        enabledDisciplines: ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'],
        accessionPrefixes: {},
        accessionFormat: '{PREFIX}-{YYYY}-{SEQ:6}',
        accessionCounters: {},
        tatHours: { FROZEN: 1, URGENT: 24, ROUTINE: 72 },
        tatWarningPercent: 80,
        timezone: 'Africa/Lagos',
        qaSamplingPercent: 0,
        currency: 'NGN',
        letterhead: {
          phone: '+234 800 000 0000',
          email: 'lab@e2e.test',
          website: 'e2e.test',
          pathologistName: 'Dr E2E Pathologist',
          pathologistTitle: 'Consultant Histopathologist',
          qualifications: 'MBBS, FMCPath',
          signatureText: 'Signed electronically.',
          footerNote: 'E2E laboratory report.',
        },
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: otherLabId,
        code: 'E2E2',
        name: 'Other Laboratory',
        address: null,
        phone: null,
        email: null,
        accessionPrefix: 'OTH',
        enabledDisciplines: ['HISTOPATHOLOGY'],
        accessionPrefixes: {},
        accessionFormat: '{PREFIX}-{YYYY}-{SEQ:4}',
        accessionCounters: {},
        tatHours: { FROZEN: 1, URGENT: 24, ROUTINE: 72 },
        tatWarningPercent: 80,
        timezone: 'Africa/Lagos',
        letterhead: {},
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const userIds = {
      receptionist: new Types.ObjectId(),
      grosser: new Types.ObjectId(),
      technologist: new Types.ObjectId(),
      pathologist: new Types.ObjectId(),
      admin: new Types.ObjectId(),
      referrer: new Types.ObjectId(),
      otherLabPathologist: new Types.ObjectId(),
      superadmin: new Types.ObjectId(),
    };

    const userDocs = [
      {
        _id: userIds.receptionist,
        name: 'E2E Reception',
        email: `reception-${unique}@e2e.test`,
        role: 'RECEPTIONIST',
        labId,
      },
      {
        _id: userIds.grosser,
        name: 'E2E Grosser',
        email: `grosser-${unique}@e2e.test`,
        role: 'GROSSER',
        labId,
        disciplines: ['HISTOPATHOLOGY'],
      },
      {
        _id: userIds.technologist,
        name: 'E2E Technologist',
        email: `tech-${unique}@e2e.test`,
        role: 'TECHNOLOGIST',
        labId,
        disciplines: ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'],
      },
      {
        _id: userIds.pathologist,
        name: 'Dr E2E Pathologist',
        email: `path-${unique}@e2e.test`,
        role: 'PATHOLOGIST',
        labId,
        disciplines: ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'],
      },
      {
        _id: userIds.admin,
        name: 'E2E Administrator',
        email: `admin-${unique}@e2e.test`,
        role: 'LAB_ADMIN',
        labId,
      },
      {
        _id: userIds.referrer,
        name: 'E2E Referrer',
        email: `referrer-${unique}@e2e.test`,
        role: 'REFERRER',
        labId,
        phone: '+234 803 555 0101',
      },
      {
        _id: userIds.superadmin,
        name: 'E2E Platform Admin',
        email: `super-${unique}@e2e.test`,
        role: 'SUPER_ADMIN',
        labId,
      },
      {
        _id: userIds.otherLabPathologist,
        name: 'Other Pathologist',
        email: `other-${unique}@e2e.test`,
        role: 'PATHOLOGIST',
        labId: otherLabId,
      },
    ].map((user) => ({
      ...user,
      passwordHash,
      subspecialties: user.role === 'PATHOLOGIST' ? ['Breast'] : [],
      active: true,
      refreshTokenHash: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    }));
    await connection.collection('users').insertMany(userDocs);

    protocolContent = protocolContentSchema.parse(breastProtocol);
    protocolId = new Types.ObjectId();
    await connection.collection('protocols').insertOne({
      _id: protocolId,
      labId,
      key: 'e2e_breast',
      title: protocolContent.title,
      cancerType: protocolContent.cancerType,
      subspecialty: protocolContent.subspecialty,
      version: 1,
      active: true,
      content: protocolContent,
      createdBy: userIds.admin,
      createdAt: now,
      updatedAt: now,
    });

    users = {
      receptionist: userDocs[0]!.email,
      grosser: userDocs[1]!.email,
      technologist: userDocs[2]!.email,
      pathologist: userDocs[3]!.email,
      admin: userDocs[4]!.email,
      referrer: userDocs[5]!.email,
      otherLabPathologist: userDocs[7]!.email,
      superadmin: userDocs[6]!.email,
    };
    tokens = {} as Record<keyof SeededUsers, string>;
    pathologistId = userIds.pathologist.toString();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (replSet) await replSet.stop();
    await rm(tmpRoot, { recursive: true, force: true });
  });

  async function login(labCode: string, email: string): Promise<string> {
    const response = await request(http)
      .post('/api/auth/login')
      .send({ labCode, email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  function auth(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  function buildCompleteReport(content: ProtocolContent): ReportData {
    const data: ReportData = {};
    for (const field of flattenProtocolFields(content)) {
      switch (field.type) {
        case 'select':
          data[field.key] = field.options?.[0]?.value ?? 'value';
          break;
        case 'multiselect':
          data[field.key] = field.options?.[0]?.value ? [field.options[0].value] : [];
          break;
        case 'boolean':
          data[field.key] = true;
          break;
        case 'number':
          data[field.key] = field.min ?? 1;
          break;
        case 'date':
          data[field.key] = '2026-01-15';
          break;
        case 'textarea':
          data[field.key] = 'Complete structured synoptic finding for the E2E case.';
          break;
        default:
          data[field.key] = 'Complete';
      }
    }
    return data;
  }

  it('authenticates every role in the laboratory', async () => {
    for (const [key, email] of Object.entries(users)) {
      const labCode = key === 'otherLabPathologist' ? 'E2E2' : 'E2E1';
      tokens[key as keyof SeededUsers] = await login(labCode, email);
      expect(tokens[key as keyof SeededUsers]).toMatch(/.+/);
    }
    const me = await request(http).get('/api/auth/me').set(auth(tokens.pathologist)).expect(200);
    expect(me.body.user.disciplines).toEqual([
      'HISTOPATHOLOGY',
      'HAEMATOLOGY',
      'CHEMICAL_PATHOLOGY',
      'MICROBIOLOGY',
    ]);
    expect(me.body.lab.enabledDisciplines).toContain('HISTOPATHOLOGY');
  });

  it('accessions a patient with a generated accession number and specimen label', async () => {
    const response = await request(http)
      .post('/api/cases/accession')
      .set(auth(tokens.receptionist))
      .send({
        patient: {
          firstName: 'Adaeze',
          lastName: 'E2E',
          sex: 'FEMALE',
          age: 44,
          phone: '+234 803 000 1111',
        },
        referringClinician: {
          name: 'Dr Referrer',
          facility: 'E2E Clinic',
          email: users.referrer,
        },
        clinicalHistory:
          'Left breast mass present for three months. Ultrasound shows a solid lesion.',
        clinicalDiagnosis: 'Suspected carcinoma',
        priority: 'ROUTINE',
        subspecialty: 'Breast',
        specimens: [
          {
            specimenType: 'Core biopsy',
            site: 'Left breast, upper outer quadrant',
            laterality: 'LEFT',
          },
        ],
      })
      .expect(201);

    caseId = response.body.id as string;
    accessionNumber = response.body.accessionNumber as string;
    specimenId = response.body.specimens[0].id as string;
    patientId = response.body.patient.id as string;

    expect(accessionNumber).toMatch(/^TST-\d{4}-\d{6}$/);
    expect(response.body.patient.mrn).toMatch(/^MRN-\d{4}-\d{5}$/);
    expect(response.body.specimens[0].label).toBe('A');
    expect(response.body.specimens[0].status).toBe('ACCESSIONED');
    expect(response.body.testRequests).toHaveLength(1);
    expect(response.body.testRequests[0].discipline).toBe('HISTOPATHOLOGY');
    expect(response.body.testRequests[0].status).toBe('RECEIVED');
    expect(response.body.custodyEvents.length).toBeGreaterThanOrEqual(2);

    const requests = await request(http)
      .get(`/api/test-requests?caseId=${caseId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(requests.body.items).toHaveLength(1);
    expect(requests.body.items[0].accessionNumber).toBe(accessionNumber);
  });

  it('creates blocks and enforces roles and valid custody transitions', async () => {
    const gross = await request(http)
      .post('/api/blocks/gross')
      .set(auth(tokens.grosser))
      .send({
        specimenId,
        grossDescription: 'Three cores of firm tan tissue, submitted in three cassettes.',
        blockCount: 2,
      })
      .expect(201);

    expect(gross.body).toHaveLength(2);
    blockId = gross.body[0].id as string;
    blockBarcodeA2 = gross.body[1].barcode as string;
    expect(gross.body[0].label).toBe('A1');
    const barcode = gross.body[0].barcode as string;

    await request(http)
      .post('/api/custody/scan')
      .set(auth(tokens.technologist))
      .send({ barcode, station: 'GROSSING' })
      .expect(403);

    const invalid = await request(http)
      .post('/api/custody/scan')
      .set(auth(tokens.technologist))
      .send({ barcode, station: 'PROCESSING' })
      .expect(409);
    expect(invalid.body.message).toContain('Accessioned cannot move to Processing');

    for (const station of ['GROSSING', 'PROCESSING', 'EMBEDDING']) {
      const token = station === 'GROSSING' ? tokens.grosser : tokens.technologist;
      const scan = await request(http)
        .post('/api/custody/scan')
        .set(auth(token))
        .send({ barcode, station })
        .expect(201);
      expect(scan.body.entity.barcode).toBe(barcode);
    }

    const detail = await request(http)
      .get(`/api/cases/${caseId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    const block = detail.body.blocks.find((item: { label: string }) => item.label === 'A1');
    expect(block.status).toBe('EMBEDDED');

    await request(http)
      .get(`/api/custody/locator/${encodeURIComponent(barcode)}`)
      .set(auth(tokens.referrer))
      .expect(403);
    await request(http).get('/api/patients').set(auth(tokens.referrer)).expect(403);
  });

  it('enforces laboratory and user discipline assignment on histopathology routes', async () => {
    const created = await request(http)
      .post('/api/users')
      .set(auth(tokens.admin))
      .send({
        name: 'Dr Haem Only',
        email: `haem-${unique}@e2e.test`,
        password: 'HaemOnly#2026',
        role: 'PATHOLOGIST',
        disciplines: ['HAEMATOLOGY'],
      })
      .expect(201);
    expect(created.body.disciplines).toEqual(['HAEMATOLOGY']);

    const haemLogin = await request(http)
      .post('/api/auth/login')
      .send({ labCode: 'E2E1', email: `haem-${unique}@e2e.test`, password: 'HaemOnly#2026' })
      .expect(200);
    const haemToken = haemLogin.body.accessToken as string;
    const denied = await request(http).get('/api/blocks').set(auth(haemToken)).expect(403);
    expect(denied.body.message).toContain('not assigned');
    await request(http).get('/api/test-requests').set(auth(haemToken)).expect(200);
  });

  it('cuts, stains and receives slides at the pathologist desk', async () => {
    const cut = await request(http)
      .post('/api/slides/cut')
      .set(auth(tokens.technologist))
      .send({ blockId, count: 2, stainType: 'H_AND_E' })
      .expect(201);

    expect(cut.body).toHaveLength(2);
    slideBarcodes = cut.body.map((slide: { barcode: string }) => slide.barcode);
    slideIds = cut.body.map((slide: { id: string }) => slide.id);
    expect(slideBarcodes).toHaveLength(2);

    for (const barcode of slideBarcodes) {
      await request(http)
        .post('/api/custody/scan')
        .set(auth(tokens.technologist))
        .send({ barcode, station: 'STAINING' })
        .expect(201);
      await request(http)
        .post('/api/custody/scan')
        .set(auth(tokens.pathologist))
        .send({ barcode, station: 'PATHOLOGIST' })
        .expect(201);
    }

    const detail = await request(http)
      .get(`/api/cases/${caseId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(detail.body.status).toBe('PENDING_REVIEW');
    expect(
      detail.body.slides.every((slide: { status: string }) => slide.status === 'WITH_PATHOLOGIST'),
    ).toBe(true);
  });

  it('creates, completes and signs out a synoptic report', async () => {
    const created = await request(http)
      .post(`/api/reports/case/${caseId}`)
      .set(auth(tokens.pathologist))
      .send({ protocolId: protocolId.toString() })
      .expect(201);

    reportId = created.body.id as string;
    expect(created.body.status).toBe('DRAFT');

    const data = buildCompleteReport(protocolContent);
    const updated = await request(http)
      .patch(`/api/reports/${reportId}`)
      .set(auth(tokens.pathologist))
      .send({ data })
      .expect(200);
    expect(updated.body.requiredComplete).toBe(true);
    expect(updated.body.missingRequired).toEqual([]);

    const signed = await request(http)
      .post(`/api/reports/${reportId}/sign-out`)
      .set(auth(tokens.pathologist))
      .expect(201);

    expect(signed.body.status).toBe('SIGNED_OUT');
    expect(signed.body.version).toBe(1);
    expect(signed.body.verificationCode).toMatch(/^[A-Z0-9]{10}$/);
    expect(signed.body.versions).toHaveLength(1);
    verificationCode = signed.body.verificationCode as string;

    const detail = await request(http)
      .get(`/api/cases/${caseId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(detail.body.status).toBe('REPORTED');
    expect(detail.body.report.status).toBe('SIGNED_OUT');
    expect(
      detail.body.slides.every((slide: { status: string }) => slide.status === 'REPORTED'),
    ).toBe(true);
    const cutBlock = detail.body.blocks.find((block: { label: string }) => block.label === 'A1');
    expect(cutBlock.status).toBe('REPORTED');

    const locked = await request(http)
      .patch(`/api/reports/${reportId}`)
      .set(auth(tokens.pathologist))
      .send({ data })
      .expect(409);
    expect(locked.body.message).toContain('locked');
  });

  it('verifies the signed report publicly and renders the PDF', async () => {
    const verified = await request(http).get(`/api/reports/verify/${verificationCode}`).expect(200);
    expect(verified.body.valid).toBe(true);
    expect(verified.body.accessionNumber).toBe(accessionNumber);
    expect(verified.body.status).toBe('SIGNED_OUT');

    const pdf = await request(http)
      .get(`/api/reports/${reportId}/pdf`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('.pdf');

    const labelPdf = await request(http)
      .get(`/api/labels/block/${blockId}`)
      .set(auth(tokens.technologist))
      .expect(200);
    expect(labelPdf.headers['content-type']).toBe('application/pdf');

    const zpl = await request(http)
      .get(`/api/labels/block/${blockId}?format=zpl`)
      .set(auth(tokens.technologist))
      .expect(200);
    expect(zpl.text).toContain('^XA');
    expect(zpl.text).toContain('^BXN');
  });

  it('amends the signed report into a new immutable version', async () => {
    const amended = await request(http)
      .post(`/api/reports/${reportId}/amend`)
      .set(auth(tokens.pathologist))
      .send({ reason: 'Corrected the tumour size after re-measurement of the slide.' })
      .expect(201);

    expect(amended.body.status).toBe('AMENDED');
    expect(amended.body.version).toBe(2);
    expect(amended.body.versions).toHaveLength(2);
    expect(amended.body.amendedAt).toBeTruthy();

    const detail = await request(http)
      .get(`/api/cases/${caseId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(detail.body.status).toBe('AMENDED');
  });

  it('scopes every query to the authenticated laboratory', async () => {
    await request(http)
      .get(`/api/cases/${caseId}`)
      .set(auth(tokens.otherLabPathologist))
      .expect(404);

    const otherCases = await request(http)
      .get('/api/cases')
      .set(auth(tokens.otherLabPathologist))
      .expect(200);
    expect(otherCases.body.total).toBe(0);

    const otherSpecimens = await request(http)
      .get('/api/specimens')
      .set(auth(tokens.otherLabPathologist))
      .expect(200);
    expect(otherSpecimens.body.total).toBe(0);
  });

  it('records scans, sign-out and amendment in the audit log', async () => {
    const response = await request(http)
      .get('/api/audit?limit=100')
      .set(auth(tokens.admin))
      .expect(200);

    const actions = new Set(
      (response.body.items as Array<{ action: string }>).map((item) => item.action),
    );
    expect(actions.has('CREATE')).toBe(true);
    expect(actions.has('SCAN')).toBe(true);
    expect(actions.has('SIGN_OUT')).toBe(true);
    expect(actions.has('AMEND')).toBe(true);

    const signOut = (response.body.items as Array<{ action: string; after: unknown }>).find(
      (item) => item.action === 'SIGN_OUT',
    );
    expect(signOut).toBeTruthy();
  });

  it('releases the amended report and opens the referrer portal with a one-time code', async () => {
    const released = await request(http)
      .post(`/api/reports/${reportId}/release`)
      .set(auth(tokens.pathologist))
      .send({ note: 'Released to the referring clinic after MDT.' })
      .expect(201);
    expect(released.body.releasedAt).toBeTruthy();
    expect(released.body.releasedBy.email).toBe(users.pathologist);
    const releasedRequests = await request(http)
      .get(`/api/test-requests?caseId=${caseId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(releasedRequests.body.items[0].status).toBe('RELEASED');

    const portalRequest = await request(http)
      .post('/api/portal/auth/request')
      .send({ labCode: 'E2E1', email: users.referrer })
      .expect(202);
    expect(portalRequest.body.sent).toBe(true);
    expect(portalRequest.body.debugCode).toMatch(/^\d{6}$/);

    const verified = await request(http)
      .post('/api/portal/auth/verify')
      .send({
        labCode: 'E2E1',
        email: users.referrer,
        code: portalRequest.body.debugCode,
      })
      .expect(200);
    const referrerToken = verified.body.accessToken as string;

    const portalCases = await request(http)
      .get('/api/portal/cases')
      .set(auth(referrerToken))
      .expect(200);
    expect(portalCases.body.total).toBeGreaterThanOrEqual(1);
    const referred = portalCases.body.items.find((item: { id: string }) => item.id === caseId);
    expect(referred.reportAvailable).toBe(true);

    const portalDetail = await request(http)
      .get(`/api/portal/cases/${caseId}`)
      .set(auth(referrerToken))
      .expect(200);
    expect(portalDetail.body.report.status).toBe('AMENDED');
    expect(portalDetail.body.report.releasedAt).toBeTruthy();
    expect(portalDetail.body.timeline.length).toBeGreaterThan(0);

    const portalPdf = await request(http)
      .get(`/api/portal/cases/${caseId}/report.pdf`)
      .set(auth(referrerToken))
      .expect(200);
    expect(portalPdf.headers['content-type']).toBe('application/pdf');

    const outbox = await request(http)
      .get('/api/notifications/outbox?limit=100')
      .set(auth(tokens.admin))
      .expect(200);
    expect(
      outbox.body.items.some((item: { type: string }) => item.type === 'PORTAL_MAGIC_LINK'),
    ).toBe(true);
    expect(
      outbox.body.items.some((item: { type: string }) => item.type === 'REPORT_RELEASED'),
    ).toBe(true);
  });

  it('validates reagent lots, blocks expired stock and records a stain run', async () => {
    const future = new Date(Date.now() + 120 * 86_400_000).toISOString();
    const received = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const activeLot = await request(http)
      .post('/api/inventory/lots')
      .set(auth(tokens.technologist))
      .send({
        name: 'E2E Haematoxylin',
        category: 'REAGENT',
        vendor: 'E2E Vendor',
        lotNumber: 'E2E-HX-1',
        quantity: 100,
        unit: 'mL',
        receivedAt: received,
        expiresAt: future,
      })
      .expect(201);
    expect(activeLot.body.status).toBe('QUARANTINED');
    expect(activeLot.body.validationStatus).toBe('PENDING');

    const validated = await request(http)
      .post(`/api/inventory/lots/${activeLot.body.id}/validate`)
      .set(auth(tokens.admin))
      .send({ note: 'Control passed.' })
      .expect(201);
    expect(validated.body.status).toBe('ACTIVE');
    expect(validated.body.validationStatus).toBe('VALIDATED');

    const expired = await request(http)
      .post('/api/inventory/lots')
      .set(auth(tokens.technologist))
      .send({
        name: 'E2E Expired Eosin',
        category: 'REAGENT',
        vendor: 'E2E Vendor',
        lotNumber: 'E2E-ES-2',
        quantity: 10,
        unit: 'mL',
        receivedAt: new Date(Date.now() - 100 * 86_400_000).toISOString(),
        expiresAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      })
      .expect(201);

    const blocked = await request(http)
      .post('/api/inventory/stain-runs')
      .set(auth(tokens.technologist))
      .send({
        caseId,
        blockId,
        stainType: 'H_AND_E',
        stainName: 'H&E',
        lots: [{ lotId: expired.body.id, quantityUsed: 1 }],
      })
      .expect(409);
    expect(blocked.body.message).toContain('not validated');

    const run = await request(http)
      .post('/api/inventory/stain-runs')
      .set(auth(tokens.technologist))
      .send({
        caseId,
        blockId,
        stainType: 'H_AND_E',
        stainName: 'H&E',
        lots: [{ lotId: activeLot.body.id, quantityUsed: 5 }],
      })
      .expect(201);
    expect(run.body.status).toBe('RUNNING');
    expect(run.body.lots[0].lotNumber).toBe('E2E-HX-1');

    const completed = await request(http)
      .post(`/api/inventory/stain-runs/${run.body.id}/complete`)
      .set(auth(tokens.technologist))
      .send({ qcResult: 'PASS', notes: 'Control tissue passed.' })
      .expect(201);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.qcResult).toBe('PASS');

    const lots = await request(http)
      .get('/api/inventory/lots?limit=100')
      .set(auth(tokens.technologist))
      .expect(200);
    const after = lots.body.items.find((item: { id: string }) => item.id === activeLot.body.id);
    expect(after.quantity).toBe(95);
  });

  it('records peer review agreement and a coded discrepancy', async () => {
    const created = await request(http)
      .post('/api/qa/reviews')
      .set(auth(tokens.pathologist))
      .send({
        caseId,
        reportId,
        type: 'SECOND_OPINION',
        reviewerId: pathologistId,
        reason: 'Confirm grading before chemotherapy.',
      })
      .expect(201);
    expect(created.body.status).toBe('ASSIGNED');

    await request(http)
      .post(`/api/qa/reviews/${created.body.id}/start`)
      .set(auth(tokens.pathologist))
      .send({ findings: 'Reviewed all levels and immunohistochemistry.' })
      .expect(201);

    const completed = await request(http)
      .post(`/api/qa/reviews/${created.body.id}/complete`)
      .set(auth(tokens.pathologist))
      .send({
        outcome: 'DISCREPANT',
        disagreementCode: 'GRADING',
        severity: 'MINOR',
        findings: 'Grade should be reported as grade 3 rather than grade 2.',
        actionPlan: 'Discuss at MDT and document an addendum if needed.',
      })
      .expect(201);
    expect(completed.body.status).toBe('DISCREPANT');
    expect(completed.body.discrepancyCode).toBe('GRADING');

    const stats = await request(http)
      .get('/api/qa/stats')
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(stats.body.discrepant).toBeGreaterThanOrEqual(1);
  });

  it('serves FHIR R4, WSI and HL7 interoperability surfaces', async () => {
    const metadata = await request(http).get('/api/fhir/r4/metadata').expect(200);
    expect(metadata.headers['content-type']).toContain('application/fhir+json');
    expect(metadata.body.resourceType).toBe('CapabilityStatement');

    const patient = await request(http)
      .get(`/api/fhir/r4/Patient/${patientId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(patient.body.resourceType).toBe('Patient');
    expect(patient.body.identifier[0].value).toMatch(/^MRN-/);

    const diagnostic = await request(http)
      .get(`/api/fhir/r4/DiagnosticReport/${reportId}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(diagnostic.body.resourceType).toBe('DiagnosticReport');
    expect(diagnostic.body.status).toBe('corrected');

    const wsi = await request(http)
      .post(`/api/wsi/slides/${slideIds[0]}/link`)
      .set(auth(tokens.pathologist))
      .send({
        url: `https://wsi.example.org/slides/${slideBarcodes[0]}.svs`,
        viewerUrl: `https://viewer.example.org/slide/${slideBarcodes[0]}`,
        scanner: 'Leica Aperio',
        magnification: '40x',
      })
      .expect(201);
    expect(wsi.body.wsi.status).toBe('LINKED');
    const byBarcode = await request(http)
      .get(`/api/wsi/${slideBarcodes[0]}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(byBarcode.body.wsi.viewerUrl).toContain('viewer.example.org');

    const hl7 = await request(http)
      .post('/api/interop/hl7/messages')
      .set(auth(tokens.admin))
      .send({
        message:
          'MSH|^~\\&|EMR|HOSPITAL|HISTOLIMS|LAB|20260115120000||ORM^O01|HL7-E2E-1|P|2.5\r' +
          'PID|1||HL7-E2E-MRN||Doe^Jane||19800101|F|||+2348000000000\r' +
          'ORC|NW|ORD-E2E-1\r' +
          'OBR|1|ORD-E2E-1|ORD-E2E-1|Histopathology^HP^L|||20260115120000|||||||||||||||R\r' +
          'SPM|1|||Core biopsy^TISSUE|Left breast\r',
      })
      .expect(201);
    expect(hl7.body.ack).toContain('MSA|AA');
    expect(hl7.body.accessionNumber).toMatch(/^TST-\d{4}-\d{6}$/);
  });

  it('creates, pays and exports a billable HMO claim', async () => {
    const invoice = await request(http)
      .post('/api/invoices')
      .set(auth(tokens.receptionist))
      .send({
        caseId,
        payerType: 'HMO',
        hmoName: 'E2E HMO',
        authorizationNumber: 'AUTH-E2E-1',
        items: [
          {
            description: 'Histopathology professional fee',
            quantity: 1,
            unitPrice: 50_000,
            category: 'PROFESSIONAL',
          },
        ],
      })
      .expect(201);
    expect(invoice.body.status).toBe('ISSUED');
    expect(invoice.body.number).toMatch(/^INV-\d{4}-\d{6}$/);

    const checkout = await request(http)
      .post(`/api/invoices/${invoice.body.id}/payments/initialize`)
      .set(auth(tokens.receptionist))
      .send({ provider: 'PAYSTACK', amount: 20_000 })
      .expect(201);
    expect(checkout.body.checkoutUrl).toContain('/payments/mock');
    expect(checkout.body.status).toBe('PENDING');

    const mockPayment = await request(http).post(
      `/api/payments/mock/${checkout.body.reference}/complete`,
    );
    expect(mockPayment.status).toBe(201);
    const status = await request(http).get(`/api/payments/${checkout.body.reference}`).expect(200);
    expect(status.body.status).toBe('SUCCESS');
    expect(status.body.balance).toBe(30_000);

    const claims = await request(http)
      .get(
        `/api/claims/export?from=${new Date(Date.now() - 30 * 86_400_000)
          .toISOString()
          .slice(
            0,
            10,
          )}&to=${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}&format=csv`,
      )
      .set(auth(tokens.receptionist))
      .expect(200);
    expect(claims.headers['content-type']).toContain('text/csv');
    expect(claims.text).toContain('invoice_number');
    expect(claims.text).toContain(invoice.body.number);
  });

  it('replays offline scan mutations idempotently', async () => {
    const mutationId = 'e2e-sync-mutation-0001';
    const payload = { barcode: blockBarcodeA2, station: 'GROSSING' };
    const first = await request(http)
      .post('/api/sync/batch')
      .set(auth(tokens.grosser))
      .send({ mutations: [{ id: mutationId, type: 'SCAN', payload }] })
      .expect(201);
    expect(first.body.results[0].ok).toBe(true);
    expect(first.body.results[0].duplicate).toBe(false);

    const replay = await request(http)
      .post('/api/sync/batch')
      .set(auth(tokens.grosser))
      .send({ mutations: [{ id: mutationId, type: 'SCAN', payload }] })
      .expect(201);
    expect(replay.body.results[0].ok).toBe(true);
    expect(replay.body.results[0].duplicate).toBe(true);
  });

  it('runs a multi-discipline result from catalogue through rules, critical acknowledgement, QC and cumulative history', async () => {
    const fbc = await request(http)
      .post('/api/catalog/tests')
      .set(auth(tokens.admin))
      .send({
        discipline: 'HAEMATOLOGY',
        code: 'FBC',
        name: 'Full blood count',
        specimenType: 'EDTA blood',
        analytes: [
          {
            key: 'hb',
            name: 'Haemoglobin',
            unit: 'g/dL',
            resultType: 'NUMERIC',
            required: true,
            criticalLow: 7,
            criticalHigh: 20,
            referenceRanges: [
              { low: 13, high: 17, sex: 'MALE' },
              { low: 12, high: 15, sex: 'FEMALE' },
            ],
          },
          {
            key: 'wbc',
            name: 'White cell count',
            unit: '×10⁹/L',
            resultType: 'NUMERIC',
            required: true,
            referenceRanges: [{ low: 4, high: 11 }],
          },
          {
            key: 'plt',
            name: 'Platelets',
            unit: '×10⁹/L',
            resultType: 'NUMERIC',
            required: true,
            criticalLow: 50,
            referenceRanges: [{ low: 150, high: 450 }],
          },
        ],
      })
      .expect(201);
    expect(fbc.body.code).toBe('FBC');

    await request(http)
      .post('/api/catalog/tests')
      .set(auth(tokens.admin))
      .send({
        discipline: 'CHEMICAL_PATHOLOGY',
        code: 'EUC',
        name: 'Electrolytes, urea and creatinine',
        specimenType: 'Serum',
        analytes: [
          {
            key: 'sodium',
            name: 'Sodium',
            unit: 'mmol/L',
            resultType: 'NUMERIC',
            required: true,
            referenceRanges: [{ low: 135, high: 145 }],
          },
          {
            key: 'potassium',
            name: 'Potassium',
            unit: 'mmol/L',
            resultType: 'NUMERIC',
            required: true,
            criticalLow: 2.5,
            criticalHigh: 6.5,
            referenceRanges: [{ low: 3.5, high: 5.1 }],
          },
          {
            key: 'creatinine',
            name: 'Creatinine',
            unit: 'µmol/L',
            resultType: 'NUMERIC',
            required: true,
            referenceRanges: [{ low: 44, high: 106 }],
          },
        ],
      })
      .expect(201);

    await request(http)
      .post('/api/rules')
      .set(auth(tokens.admin))
      .send({
        code: 'REFLEX_RETIC',
        name: 'Reflex reticulocyte count',
        discipline: 'HAEMATOLOGY',
        testCodes: ['FBC'],
        trigger: 'RESULT_SAVE',
        conditions: { field: 'values.hb.flag', op: 'in', value: ['LOW', 'CRITICAL_LOW'] },
        actions: [
          {
            type: 'REFLEX_TEST',
            testCode: 'RETIC',
            message: 'Low haemoglobin — reticulocyte count added.',
          },
        ],
      })
      .expect(201);

    await request(http)
      .post('/api/rules')
      .set(auth(tokens.admin))
      .send({
        code: 'CRITICAL_K',
        name: 'Critical potassium',
        discipline: 'CHEMICAL_PATHOLOGY',
        testCodes: ['EUC'],
        trigger: 'RESULT_SAVE',
        conditions: { field: 'values.potassium.critical', op: 'eq', value: true },
        actions: [
          { type: 'CRITICAL_ALERT', severity: 'CRITICAL', message: 'Telephone the clinician.' },
        ],
      })
      .expect(201);

    const haemAccession = await request(http)
      .post('/api/cases/accession')
      .set(auth(tokens.receptionist))
      .send({
        patient: {
          firstName: 'Chidi',
          lastName: 'Result',
          sex: 'MALE',
          age: 46,
          mrn: `P2-H-${unique}`,
        },
        referringClinician: { name: 'Dr Phase Two' },
        clinicalHistory: 'Routine full blood count for Phase 2.',
        priority: 'ROUTINE',
        discipline: 'HAEMATOLOGY',
        specimens: [{ specimenType: 'EDTA blood', site: 'Antecubital fossa' }],
      })
      .expect(201);
    const haemCaseId = haemAccession.body.id as string;
    const fbcRequestId = haemAccession.body.testRequests[0].id as string;

    const fbcDraft = await request(http)
      .post('/api/results')
      .set(auth(tokens.technologist))
      .send({ testRequestId: fbcRequestId })
      .expect(201);
    expect(fbcDraft.body.status).toBe('DRAFT');

    const fbcResult = await request(http)
      .patch(`/api/results/${fbcDraft.body.id}`)
      .set(auth(tokens.technologist))
      .send({
        values: [
          { analyteKey: 'hb', value: 9.2 },
          { analyteKey: 'wbc', value: 6.4 },
          { analyteKey: 'plt', value: 210 },
        ],
      })
      .expect(200);
    expect(fbcResult.body.status).toBe('RESULTED');
    expect(
      fbcResult.body.values.find((value: { analyteKey: string }) => value.analyteKey === 'hb').flag,
    ).toBe('LOW');
    const requestsAfterReflex = await request(http)
      .get(`/api/test-requests?caseId=${haemCaseId}`)
      .set(auth(tokens.admin))
      .expect(200);
    expect(
      requestsAfterReflex.body.items.some((item: { code: string }) => item.code === 'RETIC'),
    ).toBe(true);
    const executions = await request(http)
      .get(`/api/results/${fbcResult.body.id}/executions`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(
      executions.body.some((item: { ruleCode: string }) => item.ruleCode === 'REFLEX_RETIC'),
    ).toBe(true);

    await request(http)
      .post(`/api/results/${fbcResult.body.id}/verify`)
      .set(auth(tokens.pathologist))
      .expect(201);
    await request(http)
      .post(`/api/results/${fbcResult.body.id}/release`)
      .set(auth(tokens.pathologist))
      .expect(201);

    const chemAccession = await request(http)
      .post('/api/cases/accession')
      .set(auth(tokens.receptionist))
      .send({
        patient: {
          firstName: 'Halima',
          lastName: 'Critical',
          sex: 'FEMALE',
          age: 58,
          mrn: `P2-C-${unique}`,
        },
        referringClinician: { name: 'Dr Phase Two' },
        clinicalHistory: 'Critical potassium check.',
        priority: 'URGENT',
        discipline: 'CHEMICAL_PATHOLOGY',
        testCode: 'EUC',
        testName: 'Electrolytes, urea and creatinine',
        specimens: [{ specimenType: 'Serum', site: 'Antecubital fossa' }],
      })
      .expect(201);
    const chemCaseId = chemAccession.body.id as string;
    const chemDraft = await request(http)
      .post('/api/results')
      .set(auth(tokens.technologist))
      .send({ testRequestId: chemAccession.body.testRequests[0].id })
      .expect(201);
    const chemResult = await request(http)
      .patch(`/api/results/${chemDraft.body.id}`)
      .set(auth(tokens.technologist))
      .send({
        values: [
          { analyteKey: 'sodium', value: 140 },
          { analyteKey: 'potassium', value: 7.2 },
          { analyteKey: 'creatinine', value: 80 },
        ],
      })
      .expect(200);
    expect(chemResult.body.critical).toBe(true);
    await request(http)
      .post(`/api/results/${chemResult.body.id}/verify`)
      .set(auth(tokens.pathologist))
      .expect(409);
    await request(http)
      .post(`/api/results/${chemResult.body.id}/acknowledge-critical`)
      .set(auth(tokens.pathologist))
      .send({ note: 'Called the requesting clinician at 14:20.' })
      .expect(201);
    await request(http)
      .post(`/api/results/${chemResult.body.id}/verify`)
      .set(auth(tokens.pathologist))
      .expect(201);
    await request(http)
      .post(`/api/results/${chemResult.body.id}/release`)
      .set(auth(tokens.pathologist))
      .expect(201);

    const material = await request(http)
      .post('/api/qc/materials')
      .set(auth(tokens.admin))
      .send({
        discipline: 'CHEMICAL_PATHOLOGY',
        name: 'Chemistry normal control',
        lotNumber: `QC-${unique}`,
        level: 'NORMAL',
        testCode: 'EUC',
        analyteKey: 'sodium',
        targetMean: 140,
        targetSd: 2,
        unit: 'mmol/L',
      })
      .expect(201);
    const acceptedRun = await request(http)
      .post('/api/qc/runs')
      .set(auth(tokens.technologist))
      .send({ materialId: material.body.id, values: [140, 141, 139] })
      .expect(201);
    expect(acceptedRun.body.status).toBe('ACCEPTED');
    const rejectedRun = await request(http)
      .post('/api/qc/runs')
      .set(auth(tokens.technologist))
      .send({ materialId: material.body.id, values: [147, 148] })
      .expect(201);
    expect(rejectedRun.body.status).toBe('REJECTED');

    const cumulative = await request(http)
      .get(`/api/results/cumulative/${chemAccession.body.patient.id}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(cumulative.body.results[0].testCode).toBe('EUC');
    expect(cumulative.body.results[0].latest.status).toBe('RELEASED');
    expect(chemCaseId).toBeTruthy();
  });

  it('prints result PDFs and moves a sample through a collection centre consignment', async () => {
    const accession = await request(http)
      .post('/api/cases/accession')
      .set(auth(tokens.receptionist))
      .send({
        patient: {
          firstName: 'Rider',
          lastName: 'Sample',
          sex: 'FEMALE',
          age: 30,
          mrn: `P3-${unique}`,
        },
        referringClinician: { name: 'Dr Phase Three', email: users.referrer },
        clinicalHistory: 'Pre-analytical handoff test.',
        priority: 'ROUTINE',
        discipline: 'HAEMATOLOGY',
        specimens: [{ specimenType: 'EDTA blood', site: 'Antecubital fossa' }],
      })
      .expect(201);
    const requestId = accession.body.testRequests[0].id as string;
    const centre = await request(http)
      .post('/api/preanalytics/centres')
      .set(auth(tokens.receptionist))
      .send({
        code: `CC-${unique}`,
        name: 'Ikeja collection hub',
        homeCollection: true,
        phone: '+234 800 000 0000',
      })
      .expect(201);
    const consignment = await request(http)
      .post('/api/preanalytics/consignments')
      .set(auth(tokens.receptionist))
      .send({
        centreId: centre.body.id,
        testRequestIds: [requestId],
        riderName: 'Rider One',
        riderPhone: '+234 800 111 2222',
      })
      .expect(201);
    expect(consignment.body.testRequestCount).toBe(1);
    const dispatched = await request(http)
      .post(`/api/preanalytics/consignments/${consignment.body.id}/dispatch`)
      .set(auth(tokens.receptionist))
      .expect(201);
    expect(dispatched.body.status).toBe('DISPATCHED');
    const received = await request(http)
      .post(`/api/preanalytics/consignments/${consignment.body.id}/receive`)
      .set(auth(tokens.receptionist))
      .send({ accepted: true })
      .expect(201);
    expect(received.body.status).toBe('RECEIVED');

    const resultPdf = await request(http)
      .get('/api/results/000000000000000000000000/pdf')
      .set(auth(tokens.pathologist))
      .expect(404);
    expect(resultPdf.body.message).toBe('Result not found.');

    const cumulative = await request(http)
      .get(`/api/results/cumulative/${accession.body.patient.id}/pdf`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(cumulative.headers['content-type']).toContain('application/pdf');
  });

  it('moves a microbiology culture through identification, breakpoint AST, antibiogram and WHONET export', async () => {
    await request(http)
      .post('/api/micro/organisms')
      .set(auth(tokens.admin))
      .send({ code: 'EC', name: 'Escherichia coli', gram: 'NEGATIVE', whonetCode: 'EC' })
      .expect(201);
    await request(http)
      .post('/api/micro/antibiotics')
      .set(auth(tokens.admin))
      .send({ code: 'AMP', name: 'Ampicillin', className: 'Penicillin', whonetCode: 'AMP' })
      .expect(201);
    await request(http)
      .post('/api/micro/breakpoints')
      .set(auth(tokens.admin))
      .send({
        standard: 'CLSI',
        version: '2025',
        organismCode: 'EC',
        antibioticCode: 'AMP',
        method: 'MIC',
        susceptibleThreshold: 8,
        resistantThreshold: 32,
        unit: 'mg/L',
        firstLine: true,
      })
      .expect(201);

    const accession = await request(http)
      .post('/api/cases/accession')
      .set(auth(tokens.receptionist))
      .send({
        patient: {
          firstName: 'Micro',
          lastName: 'Patient',
          sex: 'FEMALE',
          age: 36,
          mrn: `P4-${unique}`,
        },
        referringClinician: { name: 'Dr Phase Four', email: users.referrer },
        clinicalHistory: 'Dysuria and fever; urine culture.',
        priority: 'ROUTINE',
        discipline: 'MICROBIOLOGY',
        testCode: 'MICRO',
        specimens: [{ specimenType: 'Midstream urine', site: 'Urinary tract' }],
      })
      .expect(201);
    const culture = await request(http)
      .post('/api/micro/cultures')
      .set(auth(tokens.technologist))
      .send({
        testRequestId: accession.body.testRequests[0].id,
        specimenType: 'Midstream urine',
        plateType: 'CLED + blood agar',
        media: 'CLED',
      })
      .expect(201);
    expect(culture.body.status).toBe('RECEIVED');
    for (const status of ['PLATED', 'INCUBATING', 'READ']) {
      await request(http)
        .patch(`/api/micro/cultures/${culture.body.id}`)
        .set(auth(tokens.technologist))
        .send({ status })
        .expect(200);
    }
    const isolate = await request(http)
      .post(`/api/micro/cultures/${culture.body.id}/isolates`)
      .set(auth(tokens.technologist))
      .send({ organismCode: 'EC' })
      .expect(201);
    const ast = await request(http)
      .post(`/api/micro/cultures/${culture.body.id}/ast`)
      .set(auth(tokens.technologist))
      .send({
        isolateId: isolate.body.id,
        antibioticCode: 'AMP',
        method: 'MIC',
        value: 32,
      })
      .expect(201);
    expect(ast.body.interpretation).toBe('R');
    const detail = await request(http)
      .get(`/api/micro/cultures/${culture.body.id}`)
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(detail.body.status).toBe('AST_DONE');
    expect(detail.body.susceptibilities[0].breakpointId).toBeTruthy();

    await request(http)
      .patch(`/api/micro/cultures/${culture.body.id}`)
      .set(auth(tokens.pathologist))
      .send({ status: 'REPORTED' })
      .expect(200);
    const antibiogram = await request(http)
      .get('/api/micro/antibiogram')
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(antibiogram.body[0].organismCode).toBe('EC');
    expect(antibiogram.body[0].resistant).toBe(1);
    const whonet = await request(http)
      .get('/api/micro/whonet')
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(whonet.headers['content-type']).toContain('text/csv');
    expect(whonet.text).toContain('EC;AMP');
    expect(whonet.text).toContain('AMP');
  });

  it('records equipment temperature, CAPA and a cross-lab send-out', async () => {
    const equipment = await request(http)
      .post('/api/quality/equipment')
      .set(auth(tokens.admin))
      .send({
        code: `FR-${unique}`,
        name: 'E2E Refrigerator',
        type: 'Refrigerator',
        location: 'Main lab',
      })
      .expect(201);
    const temperature = await request(http)
      .post(`/api/quality/equipment/${equipment.body.id}/temperature`)
      .set(auth(tokens.technologist))
      .send({
        temperature: 9.4,
        minAllowed: 2,
        maxAllowed: 8,
        unit: '°C',
        notes: 'Door alarm test',
      })
      .expect(201);
    expect(temperature.body.inRange).toBe(false);
    const nc = await request(http)
      .post('/api/quality/nonconformances')
      .set(auth(tokens.pathologist))
      .send({
        title: 'E2E temperature excursion',
        description: 'Refrigerator exceeded 8°C during monitoring.',
        category: 'Equipment',
        severity: 'MAJOR',
      })
      .expect(201);
    expect(nc.body.status).toBe('OPEN');
    const capa = await request(http)
      .post(`/api/quality/nonconformances/${nc.body.id}/capa`)
      .set(auth(tokens.pathologist))
      .send({
        action: 'Replace the door seal and revalidate.',
        owner: 'Lab manager',
        status: 'IN_PROGRESS',
      })
      .expect(201);
    expect(capa.body.status).toBe('IN_PROGRESS');

    const accession = await request(http)
      .post('/api/cases/accession')
      .set(auth(tokens.receptionist))
      .send({
        patient: {
          firstName: 'Send',
          lastName: 'Out',
          sex: 'FEMALE',
          age: 49,
          mrn: `P5-${unique}`,
        },
        referringClinician: { name: 'Dr Phase Five', email: users.referrer },
        clinicalHistory: 'Confirmatory testing required.',
        priority: 'ROUTINE',
        discipline: 'CHEMICAL_PATHOLOGY',
        testCode: 'LFT',
        specimens: [{ specimenType: 'Serum', site: 'Antecubital fossa' }],
      })
      .expect(201);
    const sendOut = await request(http)
      .post('/api/quality/send-outs')
      .set(auth(tokens.technologist))
      .send({
        testRequestId: accession.body.testRequests[0].id,
        referenceLab: 'Reference Laboratory',
        courier: 'E2E Courier',
        trackingNumber: `TRK-${unique}`,
      })
      .expect(201);
    expect(sendOut.body.status).toBe('SENT');
    await request(http)
      .patch(`/api/quality/send-outs/${sendOut.body.id}`)
      .set(auth(tokens.technologist))
      .send({ status: 'IN_TRANSIT' })
      .expect(200);
    await request(http)
      .patch(`/api/quality/send-outs/${sendOut.body.id}`)
      .set(auth(tokens.technologist))
      .send({ status: 'RECEIVED' })
      .expect(200);
    const reported = await request(http)
      .patch(`/api/quality/send-outs/${sendOut.body.id}`)
      .set(auth(tokens.technologist))
      .send({ status: 'REPORTED', resultSummary: 'External result received.' })
      .expect(200);
    expect(reported.body.status).toBe('REPORTED');
  });

  it('ingests an ASTM instrument message and matches the accession', async () => {
    const message = [
      'H|\\^&|||Analyzer|LIMS',
      'P|1||MRN||Doe^Jane',
      'O|1|HAE-2026-000001|||',
      'R|1|^^^HB^Haemoglobin|11.8|g/dL||N',
      'L|1|N',
    ].join('\r');
    const ingested = await request(http)
      .post('/api/instruments/messages')
      .set(auth(tokens.technologist))
      .send({ protocol: 'ASTM', message })
      .expect(201);
    expect(ingested.body.protocol).toBe('ASTM');
    expect(ingested.body.status).toBe('MATCHED');
    expect(ingested.body.accessionNumber).toBe('HAE-2026-000001');
    expect(ingested.body.values[0].code).toBe('HB');
    const messages = await request(http)
      .get('/api/instruments/messages')
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(messages.body.some((item: { id: string }) => item.id === ingested.body.id)).toBe(true);
  });

  it('onboards a hospital laboratory and accepts the administrator invitation', async () => {
    const orgCode = `ORG-${unique}`;
    const labCode = `NEW-${unique}`;
    const adminEmail = `newadmin-${unique}@e2e.test`;
    const onboarding = await request(http)
      .post('/api/super-admin/onboard')
      .set(auth(tokens.superadmin))
      .send({
        organization: {
          code: orgCode,
          name: 'E2E Hospital Group',
          type: 'HOSPITAL',
          country: 'Nigeria',
          state: 'Lagos',
          plan: 'TRIAL',
          seats: 20,
        },
        lab: {
          code: labCode,
          name: 'E2E New Laboratory',
          enabledDisciplines: ['CHEMICAL_PATHOLOGY'],
          accessionPrefix: 'NCH',
          currency: 'NGN',
        },
        administrator: { name: 'New Lab Administrator', email: adminEmail },
      })
      .expect(201);
    expect(onboarding.body.organization.code).toBe(orgCode);
    expect(onboarding.body.lab.code).toBe(labCode);
    expect(onboarding.body.catalogueTests).toBeGreaterThan(0);
    const token = new URL(onboarding.body.inviteUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    const accepted = await request(http)
      .post('/api/auth/accept-invite')
      .send({ token, password: 'NewAdmin#2026' })
      .expect(200);
    expect(accepted.body.user.role).toBe('LAB_ADMIN');
    expect(accepted.body.lab.code).toBe(labCode);
    const newToken = accepted.body.accessToken as string;
    const catalogue = await request(http).get('/api/catalog/tests').set(auth(newToken)).expect(200);
    expect(catalogue.body.total).toBeGreaterThan(0);

    const newLogin = await request(http)
      .post('/api/auth/login')
      .send({ labCode, email: adminEmail, password: 'NewAdmin#2026' })
      .expect(200);
    expect(newLogin.body.user.email).toBe(adminEmail);
    const overview = await request(http)
      .get('/api/super-admin/overview')
      .set(auth(tokens.superadmin))
      .expect(200);
    expect(overview.body.organizations).toBeGreaterThanOrEqual(1);
  });

  it('keeps the worklist and dashboard tenant-scoped and TAT-aware', async () => {
    const worklist = await request(http)
      .get('/api/worklist')
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(worklist.body.items.length).toBeLessThanOrEqual(10);
    expect(
      worklist.body.items.some((item: { testRequests: Array<{ discipline: string }> }) =>
        item.testRequests.some((request) => request.discipline === 'HISTOPATHOLOGY'),
      ),
    ).toBe(true);

    const configs = await request(http)
      .get('/api/worklist/configs')
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(configs.body[0]?.discipline).toBe('HISTOPATHOLOGY');

    const dashboard = await request(http)
      .get('/api/dashboard?days=30')
      .set(auth(tokens.admin))
      .expect(200);
    expect(dashboard.body.totals.cases).toBeGreaterThanOrEqual(1);
    expect(
      dashboard.body.casesByStatus.find((item: { status: string }) => item.status === 'AMENDED')
        .count,
    ).toBe(1);
    expect(dashboard.body.stageTat).toHaveLength(7);
  });
});
