import { FileLoader, Migration } from './fileLoader';
import * as paths from '../paths';
import { pathToFileURL } from 'url';
import { register } from 'ts-node';

export class TsFileLoader extends FileLoader {
    constructor() {
        super(paths.tsExtension, paths.tsMigrationPath);
        // Ensure ts-node is registered
        register({
          project: paths.tsConfigPath,
          transpileOnly: true,
          require: ['tsconfig-paths/register']
        });
        
    }

    async loadMigrationFile(importPath: string): Promise<Migration> {
        return import(pathToFileURL(importPath).href);
    }
}
