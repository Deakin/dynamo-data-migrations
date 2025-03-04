import _ from 'lodash';
import pEachSeries from 'p-each-series';

import * as migrationsDir from '../env/migrationsDir';
import * as migrationsDb from '../env/migrationsDb';
import { status } from './status';

class ERROR extends Error {
    migrated?: string[];
}

export async function up(profile = 'default', event?: any) {
    const dryRun = event?.dryRun ?? false
    const stack = event?.stack ?? 'applicant-portal-api-ap1'
    const migrationsTableName = `${stack}-migrations`
    console.log(`Table: ${migrationsTableName}, Dry Run: ${dryRun}`)

    const ddb = await migrationsDb.getDdb(profile);
    if (!(await migrationsDb.doesMigrationsLogDbExists(ddb, migrationsTableName))) {
        await migrationsDb.configureMigrationsLogDbSchema(ddb, stack);
    }
    const statusItems = await status(profile, event);
    const pendingItems = _.filter(statusItems, { appliedAt: 'PENDING' });
    const migrated: string[] = [];
    const migrateItem = async (item: { fileName: string; appliedAt: string }) => {
        try {
            const migration = await migrationsDir.loadFilesToBeMigrated(item.fileName);
            const migrationUp = migration.up;
            await migrationUp(ddb);
        } catch (error_) {
            const e = error_ as Error;
            const error = new ERROR(`Could not migrate up ${item.fileName}: ${e.message}`);
            error.stack = e.stack;
            error.migrated = migrated;
            throw error;
        }

        const migration = {
            fileName: item.fileName,
            appliedAt: new Date().toJSON(),
        };

        if (dryRun === false){
            console.log(`Dry Run = ${dryRun}. Adding migration to ${migrationsTableName}...`)
            try {
                await migrationsDb.addMigrationToMigrationsLogDb(migration, ddb, migrationsTableName);
            } catch (error) {
                const e = error as Error;
                throw new Error(`Could not update migrationsLogDb: ${e.message}`);
            }
            migrated.push(item.fileName);
        }
    };

    await pEachSeries(pendingItems, migrateItem);
    return migrated;
}
