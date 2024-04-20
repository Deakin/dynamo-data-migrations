import * as AWS from '@aws-sdk/client-dynamodb';
import { AttributeValue, CreateTableCommandInput, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers'; // ES6 import
import * as config from './config';

export async function getDdb(profile = 'default') {
    const awsConfig = await loadAwsConfig(profile);
    return new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: awsConfig.region,
        credentials: { accessKeyId: awsConfig.accessKeyId, secretAccessKey: awsConfig.secretAccessKey },
    });
}

export type AWSConfig = {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
};

export async function configureMigrationsLogDbSchema(ddb: AWS.DynamoDB, maxWaitTimeForTableCreation = 120) {
    const params: CreateTableCommandInput = {
        AttributeDefinitions: [
            {
                AttributeName: 'FILE_NAME',
                AttributeType: 'S',
            },
            {
                AttributeName: 'APPLIED_AT',
                AttributeType: 'S',
            },
        ],
        KeySchema: [
            {
                AttributeName: 'FILE_NAME',
                KeyType: 'HASH',
            },
            {
                AttributeName: 'APPLIED_AT',
                KeyType: 'RANGE',
            },
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
        },
        TableName: 'MIGRATIONS_LOG_DB',
        StreamSpecification: {
            StreamEnabled: false,
        },
    };
    await ddb.createTable(params);

    try {
        const tableExists = await waitUntilTableExists(
            { client: ddb, maxWaitTime: maxWaitTimeForTableCreation },
            { TableName: 'MIGRATIONS_LOG_DB' },
        );
        if (tableExists.state === 'SUCCESS') {
            return await Promise.resolve();
        }
        return await Promise.reject(new Error('Migration table does not exist!'));
    } catch {
        return Promise.reject(new Error('Migration table does not exist!'));
    }
}

export async function addMigrationToMigrationsLogDb(item: { fileName: string; appliedAt: string }, ddb: AWS.DynamoDB) {
    const params = {
        TableName: 'MIGRATIONS_LOG_DB',
        Item: {
            FILE_NAME: { S: item.fileName },
            APPLIED_AT: { S: item.appliedAt },
        },
    };

    // Call DynamoDB to add the item to the table

    return new Promise((resolve, reject) => {
        ddb.putItem(params, async function callback(err: any, data: AWS.PutItemCommandOutput | undefined) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export async function deleteMigrationFromMigrationsLogDb(
    item: { fileName: string; appliedAt: string },
    ddb: AWS.DynamoDB,
) {
    const params = {
        TableName: 'MIGRATIONS_LOG_DB',
        Key: {
            FILE_NAME: { S: item.fileName },
            APPLIED_AT: { S: item.appliedAt },
        },
    };

    return new Promise((resolve, reject) => {
        ddb.deleteItem(params, function callback(err: any, data: AWS.DeleteItemCommandOutput | undefined) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export async function doesMigrationsLogDbExists(ddb: AWS.DynamoDB) {
    const params = {
        TableName: 'MIGRATIONS_LOG_DB',
    };
    return new Promise((resolve) => {
        ddb.describeTable(params, function callback(err) {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

export async function getAllMigrations(ddb: AWS.DynamoDB) {
    const migrations: { FILE_NAME?: string; APPLIED_AT?: string }[] = [];
    const recursiveProcess = async (lastEvaluatedKey?: Record<string, AttributeValue>) => {
        const params = {
            TableName: 'MIGRATIONS_LOG_DB',
            ExclusiveStartKey: lastEvaluatedKey,
        };

        const { Items, LastEvaluatedKey } = await ddb.scan(params);
        if (Items)
            migrations.push(
                ...Items.map((item) => {
                    return {
                        FILE_NAME: item.FILE_NAME.S,
                        APPLIED_AT: item.APPLIED_AT.S,
                    };
                }),
            );

        if (LastEvaluatedKey) await recursiveProcess(LastEvaluatedKey);
    };

    await recursiveProcess();
    return migrations;
}

async function loadAwsConfig(inputProfile: string): Promise<AWSConfig> {
    const resultConfig: AWSConfig = {
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
    };

    const configFromFile = await config.loadAWSConfig();

    // Check for data for input profile
    const profileConfig = configFromFile.find(
        (obj: { profile: string; region: string; accessKeyId: string; secretAccessKey: string }) => {
            return obj.profile === inputProfile || (!obj.profile && inputProfile === 'default');
        },
    );

    // Populate  region
    if (profileConfig && profileConfig.region) {
        resultConfig.region = profileConfig.region;
    } else {
        throw new Error(`Please provide region for profile:${inputProfile}`);
    }

    if (profileConfig && profileConfig.accessKeyId && profileConfig.secretAccessKey) {
        resultConfig.accessKeyId = profileConfig.accessKeyId;
        resultConfig.secretAccessKey = profileConfig.secretAccessKey;
    } else {
        // Load config from shared credentials ini file if present
        const credentials = await fromIni({ profile: inputProfile })();
        resultConfig.accessKeyId = credentials.accessKeyId;
        resultConfig.secretAccessKey = credentials.secretAccessKey;
    }
    return resultConfig;
}
