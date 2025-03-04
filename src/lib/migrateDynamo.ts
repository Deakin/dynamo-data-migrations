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

export const upAction = async (profile: string, event?: any) => {
    return up(profile, event);
};

export const downAction = async (profile: string, downShift: number, event?: any) => {
    return down(profile, downShift, event);
};

export const statusAction = async (profile: string, event?: any) => {
    return status(profile, event);
};
