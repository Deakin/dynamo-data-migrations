import { pathToFileURL } from 'url';
import { FileLoader, Migration } from './fileLoader';
import * as paths from '../paths';
import 'ts-node/esm';

export class TsFileLoader extends FileLoader {
    constructor() {
        super(paths.tsExtension, paths.tsMigrationPath);
    }

    async loadMigrationFile(importPath: string): Promise<Migration> {
        return import(pathToFileURL(importPath).href);
    }
}
