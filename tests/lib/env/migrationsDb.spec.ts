import * as AWS from '@aws-sdk/client-dynamodb'
import { mockClient } from 'aws-sdk-client-mock';
import { CreateTableCommand, DeleteItemCommand, DescribeTableCommand, DynamoDBClient, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb'
import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types';
import * as credentialProviders from '@aws-sdk/credential-providers';
import * as migrationsDb from "../../../src/lib/env/migrationsDb";
import * as config from "../../../src/lib/env/config";

const mockedAwsCredentialIdenditiyProvider: AwsCredentialIdentityProvider = () => {
    const p = new Promise<AwsCredentialIdentity>((resolve) => {
        resolve({
        accessKeyId: 'testAccess',
        secretAccessKey: 'testSecret',
        sessionToken: 'mockSessionToken',
        credentialScope: 'mockCredentialScope' });
      });
    return p
}

jest.mock("@aws-sdk/credential-providers", () => ({
    ...jest.requireActual("@aws-sdk/credential-providers"),
    fromIni: jest.fn()
  }));


describe("migrationsDb", () => {

    const dynamoMock = mockClient(DynamoDBClient);

    afterEach(() => dynamoMock.reset());

    describe("configureMigrationsLogDbSchema()", () => {
        it("should resolve when no errors are thrown while creating migrationsLogDb", async () => {
            dynamoMock.on(CreateTableCommand).resolves({})
            dynamoMock.on(DescribeTableCommand).resolves({ Table: { TableStatus: "ACTIVE" } })
            await expect(migrationsDb.configureMigrationsLogDbSchema(new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).resolves.not.toThrow();
        })

        it("should reject when error is thrown while creating migrationsLogDb", async () => {
            dynamoMock.on(CreateTableCommand).rejects(new Error("Could not create table Migrations_Log"));
            await expect(migrationsDb.configureMigrationsLogDbSchema(new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).rejects.toThrowError("Could not create table Migrations_Log");
        })

        it("should reject when error is thrown while waiting for migrationsLogDb table to be active", async () => {
            dynamoMock.on(CreateTableCommand).resolves({})
            dynamoMock.on(DescribeTableCommand).resolves({ Table: { TableStatus: "CREATING" } })
            await expect(migrationsDb.configureMigrationsLogDbSchema(new AWS.DynamoDB({ apiVersion: '2012-08-10' }), 21)).rejects.toThrowError("Migration table does not exist!");
        }, 22_000)
    })

    
    describe("addMigrationToMigrationsLogDb()", () => {
        it("should resolve when no errors are thrown while adding migration to migrationsLogDb", async () => {
            dynamoMock.on(PutItemCommand).resolves({})
            await expect(migrationsDb.addMigrationToMigrationsLogDb({ fileName: "abc.ts", appliedAt: "20201014172343" }, new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).resolves.not.toThrow();
        })

        it("should reject when error is thrown while adding migration to migrationsLogDb", async () => {
            dynamoMock.on(PutItemCommand).rejects(new Error("Resource Not Found"))
            await expect(migrationsDb.addMigrationToMigrationsLogDb({ fileName: "abc.ts", appliedAt: "20201014172343" }, new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).rejects.toThrow("Resource Not Found");
        })
    })

    describe("deleteMigrationFromMigrationsLogDb()", () => {
        it("should resolve when no errors are thrown while deleting migration", async () => {
            dynamoMock.on(DeleteItemCommand).resolves({})

            const item: { fileName: string; appliedAt: string } = {
                fileName: "123.ts",
                appliedAt: "123"
            };
            await expect(migrationsDb.deleteMigrationFromMigrationsLogDb(item, new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).resolves.not.toThrow();

        })

        it("should reject when error is thrown while deleting migration", async () => {
            dynamoMock.on(DeleteItemCommand).rejects(new Error("Could not delete migration"));

            const item: { fileName: string; appliedAt: string } = {
                fileName: "123.ts",
                appliedAt: "123"
            };
            await expect(migrationsDb.deleteMigrationFromMigrationsLogDb(item, new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).rejects.toThrow("Could not delete migration");

        })
    })

    describe("doesMigrationsLogDbExists()", () => {
        it("should resolve when no errors are thrown while describing migrationsLogDb", async () => {
            dynamoMock.on(DescribeTableCommand).resolves({})
            await expect(migrationsDb.doesMigrationsLogDbExists(new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).resolves.toBeTruthy();

        })

        it("should reject when error is thrown while describing migrationsLogDb", async () => {
            dynamoMock.on(DescribeTableCommand).rejects(new Error("Resource Not Found"));
            await expect(migrationsDb.doesMigrationsLogDbExists(new AWS.DynamoDB({ apiVersion: '2012-08-10' }))).resolves.toBeFalsy();
        })
    })

    describe("getAllMigrations()", () => {
        it("should return a migrations array", async () => {
            const Items = [{
                FILE_NAME: { S: "abc.ts" },
                APPLIED_AT: { S: "123" }
            },
            {
                FILE_NAME: { S: "def.ts" },
                APPLIED_AT: { S: "124" }
            }];

            dynamoMock.on(ScanCommand).resolves({ Items })

            const migrations = await migrationsDb.getAllMigrations(new AWS.DynamoDB({ apiVersion: '2012-08-10' }));
            expect(migrations).toStrictEqual([{ FILE_NAME: "abc.ts", APPLIED_AT: "123" }, { FILE_NAME: "def.ts", APPLIED_AT: "124" }]);

        });

        it("should make recursive calls and return the data of all recursive calls in single array", async () => {
            const Items1 = [{
                FILE_NAME: { S: "1.ts" },
                APPLIED_AT: { S: "1" }
            },
            {
                FILE_NAME: { S: "2.ts" },
                APPLIED_AT: { S: "2" }
            }];

            const LastEvaluatedKey = {
                FILE_NAME: { S: "2.ts" },
                APPLIED_AT: { S: "2" }
            };
   
            const Items2 = [
                {
                    FILE_NAME: { S: "3.ts" },
                    APPLIED_AT: { S: "3" }
                }
            ]

            dynamoMock.on(ScanCommand).resolvesOnce({ Items: Items1, LastEvaluatedKey }).resolvesOnce({ Items: Items2 })
            const migrations = await migrationsDb.getAllMigrations(new AWS.DynamoDB({ apiVersion: '2012-08-10' }));
            expect(migrations).toStrictEqual([{ FILE_NAME: "1.ts", APPLIED_AT: "1" }, { FILE_NAME: "2.ts", APPLIED_AT: "2" }, { FILE_NAME: "3.ts", APPLIED_AT: "3" }]);

        })
        
    })

    describe("AWS config loading from config file", () => {
        it("should throw error if region is not defined in config file", async () => {
            jest.spyOn(config, "loadAWSConfig").mockResolvedValue([{
                region: ''
            }]);
            await expect(migrationsDb.getDdb()).rejects.toThrow(new Error('Please provide region for profile:default'));
        });

        it("should configure AWS with credentials from config file when config file contains access and secret access keys", async () => {
            jest.spyOn(config, "loadAWSConfig").mockResolvedValue([{
                region: 'testRegion',
                accessKeyId: 'testAccess',
                secretAccessKey: 'testSecret'

            }]);
            const dynamodb = await migrationsDb.getDdb();
            expect(await(dynamodb.config.region())).toStrictEqual('testRegion');
            expect((await dynamodb.config.credentials()).accessKeyId).toStrictEqual('testAccess');
            expect((await dynamodb.config.credentials()).secretAccessKey).toStrictEqual('testSecret');
        });

        it("should configure AWS credentials from shared credentials file when credentials are not provided in config file", async () => {
              const spyOnA = jest.spyOn(credentialProviders, 'fromIni');
              spyOnA.mockReturnValue(mockedAwsCredentialIdenditiyProvider);
            
            jest.spyOn(config, "loadAWSConfig").mockResolvedValue([{
                region: 'testRegion'
            }]);
            const dynamodb = await migrationsDb.getDdb();
            expect(await dynamodb.config.region()).toStrictEqual('testRegion');
            expect((await dynamodb.config.credentials()).accessKeyId).toStrictEqual('testAccess');
            expect((await dynamodb.config.credentials()).secretAccessKey).toStrictEqual('testSecret');
        });

        it("should configure AWS with credentials from config file based on input profile", async () => {
            jest.spyOn(config, "loadAWSConfig").mockResolvedValue([{
                region: 'defaultRegion',
                accessKeyId: 'defaultAccess',
                secretAccessKey: 'defaultSecret'
            },
            {
                profile: 'dev',
                region: 'devRegion',
                accessKeyId: 'devAccess',
                secretAccessKey: 'devSecret'
            },
            {
                profile: 'test',
                region: 'testRegion',
                accessKeyId: 'testAccess',
                secretAccessKey: 'testSecret'
            }]);

            const dynamodbTest = await migrationsDb.getDdb('test');
            expect(await dynamodbTest.config.region()).toStrictEqual('testRegion');
            expect((await dynamodbTest.config.credentials()).accessKeyId).toStrictEqual('testAccess');
            expect((await dynamodbTest.config.credentials()).secretAccessKey).toStrictEqual('testSecret');

            const dynamodbDev = await migrationsDb.getDdb('dev');
            expect(await dynamodbDev.config.region()).toStrictEqual('devRegion');
            expect((await dynamodbDev.config.credentials()).accessKeyId).toStrictEqual('devAccess');
            expect((await dynamodbDev.config.credentials()).secretAccessKey).toStrictEqual('devSecret');

            const dynamodbDevDefault = await migrationsDb.getDdb('default');
            expect(await dynamodbDevDefault.config.region()).toStrictEqual('defaultRegion');
            expect((await dynamodbDevDefault.config.credentials()).accessKeyId).toStrictEqual('defaultAccess');
            expect((await dynamodbDevDefault.config.credentials()).secretAccessKey).toStrictEqual('defaultSecret');
        });
    })
})