import type { ClientSession, Connection } from 'mongoose';

/**
 * Runs a multi-document operation in a MongoDB transaction. The deployment uses
 * a replica set (see docker-compose.yml) precisely because accessioning, scans,
 * sign-out and amendments update several documents that must move together.
 */
export async function withTransaction<T>(
  connection: Connection,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    return await session.withTransaction(async () => work(session));
  } finally {
    await session.endSession();
  }
}
