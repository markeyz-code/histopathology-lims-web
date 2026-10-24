import mongoose from 'mongoose';
import { hashPassword } from '../common/utils/crypto';
import { runWithSystemTenant } from '../common/context/tenant-context';
import { LabModelName, LabSchema, type LabEntity } from '../core/labs/lab.schema';
import { UserModelName, UserSchema, type UserEntity } from '../core/users/user.schema';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for production bootstrap.`);
  return value;
}

function loadEnvironment(): void {
  for (const file of ['.env', '../../.env']) {
    try {
      process.loadEnvFile(file);
      return;
    } catch {
      // Environment variables may be injected by the platform.
    }
  }
}

async function main(): Promise<void> {
  loadEnvironment();
  const uri = required('MONGODB_URI');
  const labCode = required('BOOTSTRAP_LAB_CODE').toUpperCase();
  const labName = process.env.BOOTSTRAP_LAB_NAME?.trim() || 'Platform Administration';
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'System Administrator';
  const adminEmail = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  if (password.length < 12)
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');

  await mongoose.connect(uri);
  const LabModel = mongoose.model<LabEntity>(LabModelName, LabSchema);
  const UserModel = mongoose.model<UserEntity>(UserModelName, UserSchema);
  const existingLab = await LabModel.findOne({ code: labCode }).exec();
  if (existingLab)
    throw new Error(
      `Laboratory ${labCode} already exists. Bootstrap is only for first deployment.`,
    );
  const lab = await LabModel.create({
    code: labCode,
    name: labName,
    enabledDisciplines: ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'],
    active: true,
    letterhead: { email: adminEmail },
  });
  await runWithSystemTenant('bootstrap-superadmin', lab._id.toString(), async () => {
    const existing = await UserModel.findOne({ email: adminEmail }).exec();
    if (existing) throw new Error('An account with BOOTSTRAP_ADMIN_EMAIL already exists.');
    await UserModel.create({
      labId: lab._id,
      name: adminName,
      email: adminEmail,
      role: 'SUPER_ADMIN',
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      disciplines: [],
      active: true,
    });
  });
  console.log(`Super administrator created for ${adminEmail} at laboratory ${labCode}.`);
  await mongoose.disconnect();
}

main().catch(async (error: unknown) => {
  console.error('Bootstrap failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
