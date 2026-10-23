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
  let reportId: string;
  let verificationCode: string;
  let tokens: Record<keyof SeededUsers, string>;

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
        accessionFormat: '{PREFIX}-{YYYY}-{SEQ:6}',
        accessionCounters: {},
        tatHours: { FROZEN: 1, URGENT: 24, ROUTINE: 72 },
        tatWarningPercent: 80,
        timezone: 'Africa/Lagos',
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
      },
      {
        _id: userIds.technologist,
        name: 'E2E Technologist',
        email: `tech-${unique}@e2e.test`,
        role: 'TECHNOLOGIST',
        labId,
      },
      {
        _id: userIds.pathologist,
        name: 'Dr E2E Pathologist',
        email: `path-${unique}@e2e.test`,
        role: 'PATHOLOGIST',
        labId,
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
      otherLabPathologist: userDocs[6]!.email,
    };
    tokens = {} as Record<keyof SeededUsers, string>;
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
          email: 'referrer@e2e.test',
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

    expect(accessionNumber).toMatch(/^TST-\d{4}-\d{6}$/);
    expect(response.body.patient.mrn).toMatch(/^MRN-\d{4}-\d{5}$/);
    expect(response.body.specimens[0].label).toBe('A');
    expect(response.body.specimens[0].status).toBe('ACCESSIONED');
    expect(response.body.custodyEvents.length).toBeGreaterThanOrEqual(2);
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

  it('cuts, stains and receives slides at the pathologist desk', async () => {
    const cut = await request(http)
      .post('/api/slides/cut')
      .set(auth(tokens.technologist))
      .send({ blockId, count: 2, stainType: 'H_AND_E' })
      .expect(201);

    expect(cut.body).toHaveLength(2);
    slideBarcodes = cut.body.map((slide: { barcode: string }) => slide.barcode);
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

  it('keeps the worklist and dashboard tenant-scoped and TAT-aware', async () => {
    const worklist = await request(http)
      .get('/api/worklist')
      .set(auth(tokens.pathologist))
      .expect(200);
    expect(worklist.body.items).toHaveLength(0);

    const dashboard = await request(http)
      .get('/api/dashboard?days=30')
      .set(auth(tokens.admin))
      .expect(200);
    expect(dashboard.body.totals.cases).toBe(1);
    expect(
      dashboard.body.casesByStatus.find((item: { status: string }) => item.status === 'AMENDED')
        .count,
    ).toBe(1);
    expect(dashboard.body.stageTat).toHaveLength(7);
  });
});
