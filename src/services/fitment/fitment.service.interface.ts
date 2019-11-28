import { IVehicleResponse, IFitmentsResponse } from 'fitment-interface';

export type IVehicleRaw = IVehicleResponse & {
    maxSpeedKm: number;
    hsntsnRaw: string[];
};

export type IVehicleFitmentsRaw = IVehicleRaw & { fitments: IFitmentsResponse };
