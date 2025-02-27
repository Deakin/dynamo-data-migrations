import { pathToFileURL } from 'url';
import { register } from 'ts-node';
import { FileLoader, Migration } from './fileLoader';
import * as paths from '../paths';

export class TsFileLoader extends FileLoader {
    constructor() {
        super(paths.tsExtension, paths.tsMigrationPath);

        console.log('Registering ts-node...'); // Debugging log
        register({
            transpileOnly: true,
            project: paths.tsConfigPath, // Ensure this is set
            require: ['tsconfig-paths/register'],
        });
    }

    async loadMigrationFile(importPath: string): Promise<Migration> {
        console.log('Importing migration file:', importPath); // Debugging log
        return import(pathToFileURL(importPath).href);
    }
}
