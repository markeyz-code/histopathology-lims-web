import path from 'node:path';
import { seedDatabase } from './seed';

function loadEnvironment(): void {
  for (const file of ['.env', '../../.env', path.resolve(process.cwd(), '.env')]) {
    try {
      process.loadEnvFile(file);
      return;
    } catch {
      // Try the next location.
    }
  }
}

async function main(): Promise<void> {
  loadEnvironment();
  await seedDatabase();
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
