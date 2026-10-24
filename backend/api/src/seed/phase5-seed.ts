import { Types, type Connection } from 'mongoose';

export async function seedPhase5(
  connection: Connection,
  labId: Types.ObjectId,
  now: Date,
): Promise<void> {
  const fridgeId = new Types.ObjectId();
  const freezerId = new Types.ObjectId();
  await connection.collection('equipment').insertMany([
    {
      _id: fridgeId,
      labId,
      code: 'FRIDGE-01',
      name: 'Reagent refrigerator 01',
      type: 'Refrigerator',
      serialNumber: 'RF-2025-01',
      location: 'Main laboratory',
      status: 'ACTIVE',
      lastCalibrationAt: new Date(now.getTime() - 30 * 86_400_000),
      nextCalibrationAt: new Date(now.getTime() + 335 * 86_400_000),
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: freezerId,
      labId,
      code: 'FREEZER-01',
      name: 'Plasma freezer 01',
      type: 'Freezer',
      serialNumber: 'FZ-2025-01',
      location: 'Main laboratory',
      status: 'ACTIVE',
      lastCalibrationAt: new Date(now.getTime() - 45 * 86_400_000),
      nextCalibrationAt: new Date(now.getTime() + 320 * 86_400_000),
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await connection.collection('temperature_logs').insertMany([
    {
      labId,
      equipmentId: fridgeId,
      temperature: 4.2,
      unit: '°C',
      minAllowed: 2,
      maxAllowed: 8,
      inRange: true,
      recordedBy: null,
      notes: 'Morning check',
      createdAt: new Date(now.getTime() - 6 * 3_600_000),
      updatedAt: new Date(now.getTime() - 6 * 3_600_000),
    },
    {
      labId,
      equipmentId: fridgeId,
      temperature: 9.1,
      unit: '°C',
      minAllowed: 2,
      maxAllowed: 8,
      inRange: false,
      recordedBy: null,
      notes: 'Door left open — escalated',
      createdAt: new Date(now.getTime() - 2 * 3_600_000),
      updatedAt: new Date(now.getTime() - 2 * 3_600_000),
    },
    {
      labId,
      equipmentId: freezerId,
      temperature: -22,
      unit: '°C',
      minAllowed: -30,
      maxAllowed: -18,
      inRange: true,
      recordedBy: null,
      notes: 'Morning check',
      createdAt: new Date(now.getTime() - 5 * 3_600_000),
      updatedAt: new Date(now.getTime() - 5 * 3_600_000),
    },
  ]);
  const ncId = new Types.ObjectId();
  await connection.collection('non_conformances').insertOne({
    _id: ncId,
    labId,
    code: 'NC-DEMO-001',
    title: 'Reagent fridge temperature excursion',
    description:
      'Fridge 01 reached 9.1°C for an estimated 45 minutes. Reagents were quarantined pending review.',
    category: 'Equipment',
    severity: 'MAJOR',
    status: 'CAPA',
    reportedBy: null,
    assignedTo: null,
    dueAt: new Date(now.getTime() + 7 * 86_400_000),
    rootCause: 'Door seal failure.',
    createdAt: now,
    updatedAt: now,
  });
  await connection.collection('capa_actions').insertOne({
    labId,
    nonConformanceId: ncId,
    action: 'Replace door seal and revalidate fridge temperature mapping.',
    owner: 'Laboratory manager',
    dueAt: new Date(now.getTime() + 7 * 86_400_000),
    status: 'IN_PROGRESS',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const caseDoc = await connection
    .collection('cases')
    .findOne({ accessionNumber: 'CHM-2026-000002' });
  if (!caseDoc) return;
  const request = await connection
    .collection('test_requests')
    .findOne({ caseId: caseDoc._id, discipline: 'CHEMICAL_PATHOLOGY' });
  if (!request) return;
  await connection.collection('send_outs').insertOne({
    labId,
    caseId: caseDoc._id,
    testRequestId: request._id,
    referenceLab: 'University Teaching Hospital Reference Laboratory',
    reason: 'Confirmatory liver function testing.',
    courier: 'MedLog Couriers',
    trackingNumber: 'ML-2026-001',
    status: 'SENT',
    sentAt: new Date(now.getTime() - 3 * 3_600_000),
    receivedAt: null,
    reportedAt: null,
    resultSummary: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  });
}
