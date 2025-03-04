import { pathToFileURL } from 'url';
import { register } from 'ts-node';
import { FileLoader, Migration } from './fileLoader';
import * as paths from '../paths';

export class TsFileLoader extends FileLoader {
    constructor() {
        super(paths.tsExtension, paths.tsMigrationPath);

        console.log('Registering ts-node...');
        register({
            transpileOnly: true,
            project: paths.tsConfigPath,
            require: ['tsconfig-paths/register'],
        });
    }

    async loadMigrationFile(importPath: string): Promise<Migration> {
        console.log('Importing migration file:', importPath);
        return import(pathToFileURL(importPath).href);
    }
}
