#!/usr/bin/env node
import { Option, program } from 'commander';
import Table from 'cli-table3';
import _, { isEmpty } from 'lodash';
import packageJson from '../../package.json';
import { initAction, createAction, upAction, statusAction, downAction } from '../lib/migrateDynamo';
import fs from "fs";
import path from "path";

class ERROR extends Error {
    migrated?: string[];
}

function printMigrated(migrated: string[] = [], direction: string) {
    const migratedItemsInfo: string = migrated.map((item) => `${direction}: ${item}`).join('\n');
    console.info(migratedItemsInfo);
}

function printStatusTable(statusItems: { fileName: string; appliedAt: string }[]) {
    const table = new Table({ head: ['Filename', 'Applied At'] });
    table.push(
        ...statusItems.map((item) => {
            return _.values(item);
        }),
    );
    console.info(table.toString());
}
const profileOption = new Option('--profile <string>', 'AWS credentials and configuration to be used')
    .env('AWS_PROFILE')
    .default('default');

program
    .command('init')
    .description('initialize a new migration project')
    .action(async () => {
        try {
            await initAction();
            console.info('Initialization successful. Please edit the generated config.json file');
        } catch (error) {
            console.error(error);
        }
    });

program
    .command('create [description]')
    .description('create a new database migration with the provided description')
    .action(async (description) => {
        try {
            const fileName = await createAction(description);
            console.info('Created: migration-functions/'.concat(fileName));
        } catch (error) {
            console.error(error);
        }
    });

program
    .command('up')
    .addOption(profileOption)
    .option('-t, --migrations-table <table-name>', 'Migrations table name')
    .option('-d, --dry-run', 'Run migrations in dry-run mode', false)
    .description('Run all pending database migrations against a provided profile.')
    .action(async (option) => {
        let dryRun = false
        try {
            if (option.dryRun){ dryRun = true }

            const migrated = await upAction(option.profile, option.migrationsTable, dryRun);
            
            printMigrated(migrated, 'MIGRATED UP');
        } catch (error) {
            console.error(error);
            const e = error as ERROR;
            printMigrated(e.migrated, 'ERROR MIGRATING UP');
        }
    });

program
    .command('down')
    .addOption(profileOption)
    .option('-t, --migrations-table <table-name>', 'Migrations table name')
    .option('-d, --dry-run', 'Run migrations in dry-run mode', false)
    .option(
        '--shift <n>',
        'Number of down shift to perform. 0 will rollback all changes',
        (value) => Number.parseInt(value, 10),
        1,
    )
    .description('undo the last applied database migration against a provided profile.')
    .action(async (option) => {
        let dryRun = false
        try {

            if (option.dryRun){ dryRun = true }

            const migrated = await downAction(option.profile, option.shift, option.migrationsTable, dryRun);

            printMigrated(migrated, 'MIGRATED DOWN');
        } catch (error) {
            console.error(error);
        }
    });

program
    .command('status')
    .addOption(profileOption)
    .option('-t, --migrations-table <table-name>', 'Migrations table name')
    .description('print the changelog of the database against a provided profile')
    .action(async (option) => {
        try {
            const statusItems = await statusAction(option.profile, option.migrationsTable);
            printStatusTable(statusItems);
        } catch (error) {
            console.error(error);
        }
    });

program.version(packageJson.version);

program.parse(process.argv);

if (isEmpty(program.args)) {
    program.outputHelp();
}
