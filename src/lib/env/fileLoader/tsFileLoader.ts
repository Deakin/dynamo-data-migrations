import { FileLoader, Migration } from './fileLoader';
import * as paths from '../paths';
import { pathToFileURL } from 'url';

export class TsFileLoader extends FileLoader {
    constructor() {
        super(paths.tsExtension, paths.tsMigrationPath);
        // Ensure ts-node is registered
        require('ts-node').register({
            project: paths.tsConfigPath,
            transpileOnly: true,
            require: ['tsconfig-paths/register']
        });
    }

    async loadMigrationFile(importPath: string): Promise<Migration> {
        return import(pathToFileURL(importPath).href);
    }
}
