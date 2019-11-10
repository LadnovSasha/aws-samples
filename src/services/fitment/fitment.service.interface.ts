import { IVehicleResponse } from 'fitment-interface';

export type IVehicleRaw = IVehicleResponse & {
    maxSpeedKm: number;
    hsntsnRaw: string[];
};
