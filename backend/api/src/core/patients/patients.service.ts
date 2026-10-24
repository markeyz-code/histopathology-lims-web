import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection } from 'mongoose';
import type { Paginated, Patient as PatientDto } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { buildPaginated, escapeRegex, parseDateOnly } from '../../common/utils/format';
import { withTransaction } from '../../common/utils/transaction';
import { toPatient } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { LabsService } from '../labs/labs.service';
import { PatientModelName, type NextOfKinEntity, type PatientEntity } from './patient.schema';
import type {
  CreatePatientDto,
  NextOfKinDto,
  PatientListQueryDto,
  UpdatePatientDto,
} from './dto/patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectConnection() private readonly connection: Connection,
    private readonly labsService: LabsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PatientListQueryDto): Promise<Paginated<PatientDto>> {
    const filter: Record<string, unknown> = {};
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ mrn: regex }, { firstName: regex }, { lastName: regex }, { phone: regex }];
    }
    const [patients, total] = await Promise.all([
      this.patientModel
        .find(filter)
        .sort({ lastName: 1, firstName: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.patientModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(patients.map(toPatient), total, query.page, query.limit);
  }

  async get(id: string): Promise<PatientDto> {
    const patient = await this.patientModel.findById(id).exec();
    if (!patient) throw new NotFoundException('Patient not found.');
    return toPatient(patient);
  }

  async create(dto: CreatePatientDto, actor: AuthenticatedUser): Promise<PatientDto> {
    return withTransaction(this.connection, async (session) => {
      const patient = await this.createInSession(dto, actor, session, false);
      return toPatient(patient);
    });
  }

  /**
   * Used by accessioning. If an MRN is supplied and already exists, that patient
   * is reused (and demographics refreshed) rather than duplicated.
   */
  async resolveForAccession(
    dto: CreatePatientDto,
    actor: AuthenticatedUser,
    session: ClientSession,
  ): Promise<PatientEntity> {
    if (dto.mrn) {
      const existing = await this.patientModel
        .findOne({ mrn: dto.mrn.trim().toUpperCase() })
        .session(session)
        .exec();
      if (existing) {
        this.applyDemographics(existing, dto);
        await existing.save({ session });
        return existing;
      }
    }
    return this.createInSession(dto, actor, session, true);
  }

  async update(id: string, dto: UpdatePatientDto, actor: AuthenticatedUser): Promise<PatientDto> {
    return withTransaction(this.connection, async (session) => {
      const patient = await this.patientModel.findById(id).session(session).exec();
      if (!patient) throw new NotFoundException('Patient not found.');
      const before = toPatient(patient);
      this.applyDemographics(patient, dto);
      await patient.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Patient',
          entityId: patient._id.toString(),
          before,
          after: toPatient(patient),
          metadata: { actor: actor.email },
        },
        session,
      );
      return toPatient(patient);
    });
  }

  private async createInSession(
    dto: CreatePatientDto,
    actor: AuthenticatedUser,
    session: ClientSession,
    allowExisting: boolean,
  ): Promise<PatientEntity> {
    let mrn = dto.mrn?.trim().toUpperCase();
    if (mrn) {
      const duplicate = await this.patientModel.findOne({ mrn }).session(session).exec();
      if (duplicate) {
        if (allowExisting) return duplicate;
        throw new ConflictException('A patient with this MRN already exists.');
      }
    } else {
      mrn = await this.labsService.allocateMrn(actor.labId, session);
    }

    const patient = new this.patientModel({
      mrn,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      sex: dto.sex,
      dateOfBirth: dto.dateOfBirth ? parseDateOnly(dto.dateOfBirth) : null,
      age: dto.age ?? this.ageFromDate(dto.dateOfBirth),
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim().toLowerCase() || null,
      address: dto.address?.trim() || null,
      nationalId: dto.nationalId?.trim() || null,
      nextOfKin: this.mapNextOfKin(dto.nextOfKin),
      createdBy: new Types.ObjectId(actor.id),
    });
    await patient.save({ session });
    await this.audit.record(
      {
        action: 'CREATE',
        entityType: 'Patient',
        entityId: patient._id.toString(),
        after: toPatient(patient),
        metadata: { mrn: patient.mrn },
      },
      session,
    );
    return patient;
  }

  private applyDemographics(
    patient: PatientEntity,
    dto: UpdatePatientDto | CreatePatientDto,
  ): void {
    if (dto.firstName !== undefined) patient.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) patient.lastName = dto.lastName.trim();
    if (dto.sex !== undefined) patient.sex = dto.sex;
    if (dto.dateOfBirth !== undefined) {
      patient.dateOfBirth = parseDateOnly(dto.dateOfBirth);
      if (dto.age === undefined) patient.age = this.ageFromDate(dto.dateOfBirth);
    }
    if (dto.age !== undefined) patient.age = dto.age;
    if (dto.phone !== undefined) patient.phone = dto.phone.trim() || null;
    if (dto.email !== undefined) patient.email = dto.email.trim().toLowerCase() || null;
    if (dto.address !== undefined) patient.address = dto.address.trim() || null;
    if (dto.nationalId !== undefined) patient.nationalId = dto.nationalId.trim() || null;
    if (dto.nextOfKin !== undefined) patient.nextOfKin = this.mapNextOfKin(dto.nextOfKin);
  }

  private mapNextOfKin(input: NextOfKinDto | undefined): NextOfKinEntity | null {
    if (!input) return null;
    const kin: NextOfKinEntity = {
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      relationship: input.relationship?.trim() || null,
    };
    return kin.name || kin.phone ? kin : null;
  }

  private ageFromDate(dateOfBirth: string | undefined): number | null {
    if (!dateOfBirth) return null;
    const dob = parseDateOnly(dateOfBirth);
    if (!dob) return null;
    const diff = Date.now() - dob.getTime();
    return Math.max(0, Math.floor(diff / (365.25 * 86_400_000)));
  }
}
