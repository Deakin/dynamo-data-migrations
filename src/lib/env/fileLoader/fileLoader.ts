import * as AWS from '@aws-sdk/client-dynamodb';

export interface Migration {
    up(ddb: AWS.DynamoDB, dryRun: boolean): Promise<void>;
    down(ddb: AWS.DynamoDB): Promise<void>;
}

export abstract class FileLoader {
    configExtension: string;

    migrationTemplate: string;

    constructor(extension: string, migrationPath: string) {
        this.configExtension = extension;
        this.migrationTemplate = migrationPath;
    }

    abstract loadMigrationFile(importPath: string): Promise<Migration>;
}
