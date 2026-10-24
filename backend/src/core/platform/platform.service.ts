import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomBytes, randomUUID } from 'node:crypto';
import { Connection, Model, Types } from 'mongoose';
import {
  onboardingAdminSchema,
  onboardingSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  labOrganizationSchema,
  labProvisionSchema,
  type Discipline,
  type OnboardingResult,
  type Organization,
  type OrganizationDetail,
  type OrganizationLab,
  type SuperAdminOverview,
} from '@lims/shared';
import { hashPassword, hashToken } from '../../common/utils/crypto';
import { runWithSystemTenant, runWithTenant } from '../../common/context/tenant-context';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { OrganizationModelName, type OrganizationEntity } from './organization.schema';
import { NotificationService } from '../notifications/notification.service';

function starterTests() {
  return [
    {
      discipline: 'HAEMATOLOGY',
      code: 'FBC',
      name: 'Full blood count',
      specimenType: 'EDTA blood',
      method: 'Automated analyser',
      analytes: [
        {
          key: 'hb',
          name: 'Haemoglobin',
          unit: 'g/dL',
          resultType: 'NUMERIC',
          decimals: 1,
          required: true,
          referenceRanges: [{ low: 12, high: 17, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
        {
          key: 'wbc',
          name: 'White cell count',
          unit: '10^9/L',
          resultType: 'NUMERIC',
          decimals: 1,
          required: true,
          referenceRanges: [{ low: 4, high: 11, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
        {
          key: 'plt',
          name: 'Platelets',
          unit: '10^9/L',
          resultType: 'NUMERIC',
          decimals: 0,
          required: true,
          referenceRanges: [{ low: 150, high: 450, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
      ],
    },
    {
      discipline: 'CHEMICAL_PATHOLOGY',
      code: 'EUC',
      name: 'Urea and electrolytes',
      specimenType: 'Serum',
      method: 'Automated analyser',
      analytes: [
        {
          key: 'sodium',
          name: 'Sodium',
          unit: 'mmol/L',
          resultType: 'NUMERIC',
          decimals: 0,
          required: true,
          referenceRanges: [{ low: 135, high: 145, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
        {
          key: 'potassium',
          name: 'Potassium',
          unit: 'mmol/L',
          resultType: 'NUMERIC',
          decimals: 1,
          required: true,
          referenceRanges: [{ low: 3.5, high: 5.1, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
        {
          key: 'urea',
          name: 'Urea',
          unit: 'mmol/L',
          resultType: 'NUMERIC',
          decimals: 1,
          required: true,
          referenceRanges: [{ low: 2.5, high: 7.8, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
        {
          key: 'creatinine',
          name: 'Creatinine',
          unit: 'µmol/L',
          resultType: 'NUMERIC',
          decimals: 0,
          required: true,
          referenceRanges: [{ low: 60, high: 110, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
      ],
    },
    {
      discipline: 'CHEMICAL_PATHOLOGY',
      code: 'LFT',
      name: 'Liver function tests',
      specimenType: 'Serum',
      method: 'Automated analyser',
      analytes: [
        {
          key: 'alt',
          name: 'ALT',
          unit: 'U/L',
          resultType: 'NUMERIC',
          decimals: 0,
          required: true,
          referenceRanges: [{ low: 7, high: 56, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
        {
          key: 'ast',
          name: 'AST',
          unit: 'U/L',
          resultType: 'NUMERIC',
          decimals: 0,
          required: true,
          referenceRanges: [{ low: 10, high: 40, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
        {
          key: 'alp',
          name: 'ALP',
          unit: 'U/L',
          resultType: 'NUMERIC',
          decimals: 0,
          required: true,
          referenceRanges: [{ low: 44, high: 147, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
      ],
    },
    {
      discipline: 'CHEMICAL_PATHOLOGY',
      code: 'CRP',
      name: 'C-reactive protein',
      specimenType: 'Serum',
      method: 'Immunoturbidimetric',
      analytes: [
        {
          key: 'crp',
          name: 'CRP',
          unit: 'mg/L',
          resultType: 'NUMERIC',
          decimals: 1,
          required: true,
          referenceRanges: [{ low: 0, high: 5, sex: null, ageMin: null, ageMax: null }],
          formula: null,
        },
      ],
    },
  ];
}

@Injectable()
export class PlatformService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(OrganizationModelName)
    private readonly organizationModel: Model<OrganizationEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async overview(actor: AuthenticatedUser): Promise<SuperAdminOverview> {
    return runWithSystemTenant('super-admin-overview', actor.labId, async () => {
      const [
        organizations,
        activeOrganizations,
        labs,
        activeLabs,
        users,
        cases,
        trialsEndingSoon,
        recent,
      ] = await Promise.all([
        this.connection.collection('organizations').countDocuments(),
        this.connection.collection('organizations').countDocuments({ status: 'ACTIVE' }),
        this.connection.collection('labs').countDocuments(),
        this.connection.collection('labs').countDocuments({ active: true }),
        this.connection.collection('users').countDocuments({ active: true }),
        this.connection.collection('cases').countDocuments(),
        this.connection.collection('organizations').countDocuments({
          plan: 'TRIAL',
          trialEndsAt: { $lte: new Date(Date.now() + 7 * 86_400_000), $gte: new Date() },
        }),
        this.organizationModel.find({}).sort({ createdAt: -1 }).limit(6).exec(),
      ]);
      return {
        organizations,
        activeOrganizations,
        labs,
        activeLabs,
        users,
        cases,
        trialsEndingSoon,
        recentOrganizations: await Promise.all(recent.map((org) => this.toOrganization(org))),
      };
    });
  }

  async organizations(actor: AuthenticatedUser): Promise<Organization[]> {
    return runWithSystemTenant('super-admin-orgs', actor.labId, async () => {
      const rows = await this.organizationModel.find({}).sort({ createdAt: -1 }).exec();
      return Promise.all(rows.map((row) => this.toOrganization(row)));
    });
  }

  async organization(id: string, actor: AuthenticatedUser): Promise<OrganizationDetail> {
    return runWithSystemTenant('super-admin-org', actor.labId, async () => {
      const org = await this.organizationModel.findById(id).exec();
      if (!org) throw new NotFoundException('Organization not found.');
      const base = await this.toOrganization(org);
      const labs = await this.connection
        .collection('labs')
        .find({ organizationId: org._id })
        .sort({ name: 1 })
        .toArray();
      const labIds = labs.map((lab) => lab._id);
      const admins = await this.userModel
        .find({ labId: { $in: labIds }, role: 'LAB_ADMIN' })
        .exec();
      return {
        ...base,
        labs: await Promise.all(labs.map((lab) => this.toLab(lab))),
        admins: admins.map((admin) => ({
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
          subspecialties: admin.subspecialties,
          disciplines: admin.disciplines,
        })),
      };
    });
  }

  async createOrganization(body: unknown, actor: AuthenticatedUser): Promise<Organization> {
    const parsed = organizationCreateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    return runWithSystemTenant('super-admin-create-org', actor.labId, async () => {
      const exists = await this.organizationModel
        .findOne({ code: parsed.data.code.toUpperCase() })
        .exec();
      if (exists) throw new ConflictException('An organization with this code already exists.');
      const org = await this.organizationModel.create({
        ...parsed.data,
        code: parsed.data.code.toUpperCase(),
        status: 'ONBOARDING',
        plan: parsed.data.plan ?? 'TRIAL',
        seats: parsed.data.seats ?? 10,
        trialEndsAt:
          parsed.data.plan === 'STANDARD' || parsed.data.plan === 'ENTERPRISE'
            ? null
            : new Date(Date.now() + (parsed.data.trialDays ?? 30) * 86_400_000),
        createdBy: actor.id ? new Types.ObjectId(actor.id) : null,
      });
      await this.audit.record({
        action: 'CREATE',
        entityType: 'Organization',
        entityId: org._id.toString(),
        after: await this.toOrganization(org),
        metadata: { actor: actor.name, platform: true },
      });
      return this.toOrganization(org);
    });
  }

  async onboard(body: unknown, actor: AuthenticatedUser): Promise<OnboardingResult> {
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    return runWithSystemTenant('super-admin-onboarding', actor.labId, async () => {
      const orgCode = parsed.data.organization.code.toUpperCase();
      const labCode = parsed.data.lab.code.toUpperCase();
      const [orgExists, labExists] = await Promise.all([
        this.organizationModel.findOne({ code: orgCode }).exec(),
        this.labModel.findOne({ code: labCode }).exec(),
      ]);
      if (orgExists) throw new ConflictException('An organization with this code already exists.');
      if (labExists) throw new ConflictException('A laboratory with this code already exists.');
      const orgId = new Types.ObjectId();
      const labId = new Types.ObjectId();
      const token = randomBytes(32).toString('base64url');
      const inviteUrl = `${(process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/portal/accept-invite?token=${token}`;
      let adminId: Types.ObjectId | null = null;
      let catalogueTests = 0;
      await this.connection.transaction(async (session) => {
        await this.organizationModel.create(
          [
            {
              _id: orgId,
              ...parsed.data.organization,
              code: orgCode,
              status: 'ONBOARDING',
              plan: parsed.data.organization.plan ?? 'TRIAL',
              seats: parsed.data.organization.seats ?? 10,
              trialEndsAt:
                parsed.data.organization.plan === 'STANDARD' ||
                parsed.data.organization.plan === 'ENTERPRISE'
                  ? null
                  : new Date(Date.now() + (parsed.data.organization.trialDays ?? 30) * 86_400_000),
              createdBy: actor.id ? new Types.ObjectId(actor.id) : null,
            },
          ],
          { session },
        );
        await this.labModel.create(
          [
            {
              _id: labId,
              organizationId: orgId,
              code: labCode,
              name: parsed.data.lab.name,
              address: parsed.data.lab.address ?? null,
              phone: parsed.data.lab.phone ?? null,
              email: parsed.data.lab.email ?? null,
              enabledDisciplines: parsed.data.lab.enabledDisciplines,
              accessionPrefix: (parsed.data.lab.accessionPrefix ?? 'H').toUpperCase(),
              timezone: parsed.data.lab.timezone ?? 'Africa/Lagos',
              currency: (parsed.data.lab.currency ?? 'NGN').toUpperCase(),
              qaSamplingPercent: parsed.data.lab.qaSamplingPercent ?? 10,
              active: true,
              letterhead: {
                phone: parsed.data.lab.phone ?? null,
                email: parsed.data.lab.email ?? null,
              },
            },
          ],
          { session },
        );
        const created = await this.userModel.create(
          [
            {
              labId,
              name: parsed.data.administrator.name,
              email: parsed.data.administrator.email.toLowerCase(),
              phone: parsed.data.administrator.phone ?? null,
              role: 'LAB_ADMIN',
              disciplines: parsed.data.lab.enabledDisciplines,
              passwordHash: await hashPassword(randomUUID()),
              mustChangePassword: true,
              invitationTokenHash: hashToken(token),
              invitationExpiresAt: new Date(Date.now() + 7 * 86_400_000),
              active: true,
            },
          ],
          { session },
        );
        adminId = created[0]._id;
        const tests = starterTests()
          .filter((test) =>
            (parsed.data.lab.enabledDisciplines as string[]).includes(test.discipline),
          )
          .map((test) => ({
            ...test,
            labId,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
        if (tests.length) {
          await this.connection.collection('test_definitions').insertMany(tests, { session });
          catalogueTests = tests.length;
        }
      });
      await this.audit.record({
        action: 'CREATE',
        entityType: 'Organization',
        entityId: orgId.toString(),
        after: { labCode, admin: parsed.data.administrator.email },
        metadata: { actor: actor.name, platform: true, catalogueTests },
      });
      const org = await this.organizationModel.findById(orgId).exec();
      const lab = await this.connection.collection('labs').findOne({ _id: labId });
      const admin = await this.userModel.findById(adminId).exec();
      if (!org || !lab || !admin)
        throw new NotFoundException('Onboarding result could not be loaded.');
      await this.sendInvite(admin, org.name, lab.name, inviteUrl, actor);
      return {
        organization: await this.toOrganization(org),
        lab: await this.toLab(lab),
        admin: {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
          subspecialties: admin.subspecialties,
          disciplines: admin.disciplines,
        },
        inviteUrl,
        catalogueTests,
      };
    });
  }

  async updateOrganization(
    id: string,
    body: unknown,
    actor: AuthenticatedUser,
  ): Promise<Organization> {
    const parsed = organizationUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    return runWithSystemTenant('super-admin-update-org', actor.labId, async () => {
      const org = await this.organizationModel.findById(id).exec();
      if (!org) throw new NotFoundException('Organization not found.');
      Object.assign(org, parsed.data);
      await org.save();
      await this.audit.record({
        action: 'UPDATE',
        entityType: 'Organization',
        entityId: org._id.toString(),
        after: parsed.data,
        metadata: { actor: actor.name, platform: true },
      });
      return this.toOrganization(org);
    });
  }

  async provisionLab(
    organizationId: string,
    body: unknown,
    actor: AuthenticatedUser,
  ): Promise<OrganizationLab> {
    const parsed = labProvisionSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    return runWithSystemTenant('super-admin-provision-lab', actor.labId, async () => {
      const org = await this.organizationModel.findById(organizationId).exec();
      if (!org) throw new NotFoundException('Organization not found.');
      const existing = await this.labModel.findOne({ code: parsed.data.code.toUpperCase() }).exec();
      if (existing) throw new ConflictException('A laboratory with this code already exists.');
      const lab = await this.labModel.create({
        organizationId: org._id,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        enabledDisciplines: parsed.data.enabledDisciplines,
        accessionPrefix: (parsed.data.accessionPrefix ?? 'H').toUpperCase(),
        timezone: parsed.data.timezone ?? 'Africa/Lagos',
        currency: (parsed.data.currency ?? 'NGN').toUpperCase(),
        qaSamplingPercent: parsed.data.qaSamplingPercent ?? 10,
        active: true,
        letterhead: { phone: parsed.data.phone ?? null, email: parsed.data.email ?? null },
      });
      if (org.status === 'ONBOARDING') {
        org.status = 'ACTIVE';
        await org.save();
      }
      await this.audit.record({
        action: 'CREATE',
        entityType: 'Lab',
        entityId: lab._id.toString(),
        after: await this.toLab(lab.toObject()),
        metadata: { actor: actor.name, platform: true, organizationId },
      });
      return this.toLab(lab.toObject());
    });
  }

  async inviteAdmin(
    labId: string,
    body: unknown,
    actor: AuthenticatedUser,
  ): Promise<{ email: string; inviteUrl: string }> {
    const parsed = onboardingAdminSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    return runWithSystemTenant('super-admin-invite-admin', actor.labId, async () => {
      const lab = await this.labModel.findById(labId).exec();
      if (!lab) throw new NotFoundException('Laboratory not found.');
      const existing = await this.userModel
        .findOne({ labId: lab._id, email: parsed.data.email.toLowerCase() })
        .exec();
      if (existing)
        throw new ConflictException('A user with this email already exists in the laboratory.');
      const token = randomBytes(32).toString('base64url');
      const inviteUrl = `${(process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/portal/accept-invite?token=${token}`;
      const admin = await this.userModel.create({
        labId: lab._id,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone ?? null,
        role: 'LAB_ADMIN',
        disciplines: lab.enabledDisciplines,
        passwordHash: await hashPassword(randomUUID()),
        mustChangePassword: true,
        invitationTokenHash: hashToken(token),
        invitationExpiresAt: new Date(Date.now() + 7 * 86_400_000),
        active: true,
      });
      await this.sendInvite(admin, 'Your laboratory', lab.name, inviteUrl, actor);
      return { email: admin.email, inviteUrl };
    });
  }

  async assignLab(
    labId: string,
    body: unknown,
    actor: AuthenticatedUser,
  ): Promise<OrganizationLab> {
    const parsed = labOrganizationSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    return runWithSystemTenant('super-admin-assign-lab', actor.labId, async () => {
      const lab = await this.labModel.findById(labId).exec();
      if (!lab) throw new NotFoundException('Laboratory not found.');
      if (parsed.data.organizationId) {
        const org = await this.organizationModel.findById(parsed.data.organizationId).exec();
        if (!org) throw new NotFoundException('Organization not found.');
        lab.organizationId = org._id;
      } else {
        lab.organizationId = null;
      }
      await lab.save();
      await this.audit.record({
        action: 'UPDATE',
        entityType: 'Lab',
        entityId: lab._id.toString(),
        after: { organizationId: parsed.data.organizationId },
        metadata: { actor: actor.name, platform: true },
      });
      return this.toLab(lab.toObject());
    });
  }

  async setLabActive(
    labId: string,
    active: boolean,
    actor: AuthenticatedUser,
  ): Promise<OrganizationLab> {
    return runWithSystemTenant('super-admin-lab-status', actor.labId, async () => {
      const lab = await this.labModel.findById(labId).exec();
      if (!lab) throw new NotFoundException('Laboratory not found.');
      lab.active = active;
      await lab.save();
      await this.audit.record({
        action: 'UPDATE',
        entityType: 'Lab',
        entityId: lab._id.toString(),
        after: { active },
        metadata: { actor: actor.name, platform: true },
      });
      return this.toLab(lab.toObject());
    });
  }

  private async sendInvite(
    admin: UserEntity,
    orgName: string,
    labName: string,
    inviteUrl: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    try {
      await runWithTenant({ labId: admin.labId.toString() }, () =>
        this.notifications.send({
          labId: admin.labId.toString(),
          type: 'ADMIN_INVITATION',
          title: `Set up ${labName}`,
          body: `You have been invited to administer ${labName} (${orgName}). Set your password: ${inviteUrl}`,
          channels: ['EMAIL', 'IN_APP'],
          recipient: { email: admin.email, name: admin.name },
          entityType: 'User',
          entityId: admin._id.toString(),
          metadata: { inviteUrl, invitedBy: actor.name },
        }),
      );
    } catch {
      // The invitation is still returned to the super admin if the mail provider is unavailable.
    }
  }

  private async toOrganization(row: OrganizationEntity): Promise<Organization> {
    const labs = await this.connection
      .collection('labs')
      .find({ organizationId: row._id })
      .toArray();
    const labIds = labs.map((lab) => lab._id);
    const [userCount, caseCount] = await Promise.all([
      this.connection.collection('users').countDocuments({ labId: { $in: labIds }, active: true }),
      this.connection.collection('cases').countDocuments({ labId: { $in: labIds } }),
    ]);
    return {
      id: row._id.toString(),
      code: row.code,
      name: row.name,
      type: row.type,
      status: row.status,
      plan: row.plan,
      seats: row.seats,
      country: row.country,
      state: row.state,
      city: row.city,
      address: row.address,
      phone: row.phone,
      email: row.email,
      website: row.website,
      trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
      notes: row.notes,
      labCount: labs.length,
      userCount,
      caseCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toLab(lab: LabEntity | Record<string, unknown>): Promise<OrganizationLab> {
    const labId = lab._id as Types.ObjectId;
    const [userCount, caseCount] = await Promise.all([
      this.connection.collection('users').countDocuments({ labId, active: true }),
      this.connection.collection('cases').countDocuments({ labId }),
    ]);
    return {
      id: labId.toString(),
      code: String(lab.code),
      name: String(lab.name),
      organizationId: lab.organizationId?.toString() ?? null,
      enabledDisciplines: (lab.enabledDisciplines as Discipline[]) ?? [],
      active: Boolean(lab.active),
      userCount,
      caseCount,
      createdAt: (lab.createdAt as Date).toISOString(),
    };
  }
}
