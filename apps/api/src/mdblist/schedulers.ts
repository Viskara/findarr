import { createScheduler, type Scheduler, type SchedulerContext } from '../scheduler/types.js';

/**
 * MDBList Sync Scheduler
 * Re-downloads every configured MDBList list every 6 hours
 */
export function createMdblistSyncScheduler(): Scheduler {
  return createScheduler(
    {
      name: 'mdblistSync',
      description: 'Sync configured MDBList lists',
      interval: 6 * 60 * 60 * 1000,
      enabled: true,
      runOnStartup: true,
    },
    async (context: SchedulerContext) => {
      await context.mdblist.syncAll();
      return true;
    },
  );
}
