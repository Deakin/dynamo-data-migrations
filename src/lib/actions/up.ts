import _ from 'lodash';
import pEachSeries from 'p-each-series';

import * as migrationsDir from '../env/migrationsDir';
import * as migrationsDb from '../env/migrationsDb';
import { status } from './status';

class ERROR extends Error {
    migrated?: string[];
}

export async function up(profile = 'default') {
    const ddb = await migrationsDb.getDdb(profile);
    console.log(ddb)
    if (!(await migrationsDb.doesMigrationsLogDbExists(ddb))) {
        await migrationsDb.configureMigrationsLogDbSchema(ddb);
    }
    const statusItems = await status(profile);
    console.log(statusItems)
    const pendingItems = _.filter(statusItems, { appliedAt: 'PENDING' });
    console.log(pendingItems)
    const migrated: string[] = [];
    const migrateItem = async (item: { fileName: string; appliedAt: string }) => {
        try {
            const migration = await migrationsDir.loadFilesToBeMigrated(item.fileName);
            console.log(migration)
            const migrationUp = migration.up;
            console.log(`migrationUp: ${migrationUp}`)
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

        try {
            await migrationsDb.addMigrationToMigrationsLogDb(migration, ddb);
        } catch (error) {
            const e = error as Error;
            throw new Error(`Could not update migrationsLogDb: ${e.message}`);
        }
        migrated.push(item.fileName);
    };

    await pEachSeries(pendingItems, migrateItem);
    return migrated;
}
