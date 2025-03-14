import { init } from './actions/init';
import { create } from './actions/create';
import { up } from './actions/up';
import { status } from './actions/status';
import { down } from './actions/down';

export const initAction = async () => {
    return init();
};

export const createAction = async (description: string) => {
    return create(description);
};

export const upAction = async (profile: string, migrationsTable: string, dryRun: boolean) => {
    return up(profile, migrationsTable, dryRun);
};

export const downAction = async (profile: string, downShift: number, migrationsTable: string, dryRun: boolean) => {
    return down(profile, downShift, migrationsTable, dryRun);
};

export const statusAction = async (profile: string, event?: any) => {
    return status(profile, event);
};
