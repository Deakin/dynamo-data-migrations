/* eslint-disable global-require */
import * as tsImport from 'ts-import';

export async function importFile(importPath: string) {
    return tsImport.load(importPath, { mode: tsImport.LoadMode.Compile });
}

export async function importCjs(importPath: string) {
    return require(importPath); // eslint-disable-line import/no-dynamic-require
}
