import {
    Controller, Resource, Injectable,
    Inject, MockService, ResponseCode,
} from 'lambda-core';
import { FitmentService } from '../services/fitment/fitment.service';
import {
    IManufacturersPathRequest, IManufacturersQueryRequest,
    IVehicleByIdPathRequest, IVehicleByIdQueryRequest,
    IVehicleByMakePathRequest, IVehicleByMakeQueryRequest, IVehicleByHsnTsnPathRequest,
    IVehicleByHsnTsnQueryRequest, IVehicleCodesByMakePathRequest, IVehicleCodesByMakeQueryRequest,
} from 'fitment-interface';

const responseHeaders = {
    'Cache-Control': `public, max-age=${60 * 60 * 24}`,
};

export class FitmentController extends Controller {
    @Injectable()
    @Resource()
    async getManufacturers(
        @Inject('FitmentService') service?: FitmentService,
    ) {
        const { country } = this.getPathParams<IManufacturersPathRequest>();
        const { language } = this.getPathParams<IManufacturersQueryRequest>();
        return this.getResponse().ok(
            await service!.getManufacturers(country, language),
        );
    }

    @Injectable()
    @Resource()
    async getCarByMake(
        @Inject('FitmentService') service?: FitmentService,
    ) {
        const { country, make, model } = this.getPathParams<IVehicleByMakePathRequest>();
        const query = this.getQueryParams<IVehicleByMakeQueryRequest>();
        return this.getResponse().general(
            ResponseCode.OK,
            await service!.getVehiclesByMake(country, make, model, query),
            responseHeaders,
        );
    }

    @Injectable()
    @Resource()
    async getCarById(
        @Inject('FitmentService') service?: FitmentService,
    ) {
        const { vehicleId, country } = this.getPathParams<IVehicleByIdPathRequest>();
        const { language } = this.getQueryParams<IVehicleByIdQueryRequest>();
        const response = await service!.getVehicleById(country, vehicleId, language);
        return response ? this.getResponse().general(ResponseCode.OK, response, responseHeaders) : this.getResponse().notFound('Requested vehicle not found');
    }

    @Injectable()
    @Resource()
    async getCarByHsnTsn(
        @Inject('FitmentService') service?: FitmentService,
    ) {
        const { hsn, tsn, country } = this.getPathParams<IVehicleByHsnTsnPathRequest>();
        const { language } = this.getPathParams<IVehicleByHsnTsnQueryRequest>();
        return this.getResponse().general(
            ResponseCode.OK,
            await service!.getVehiclesByHsnTsn(country, { hsn, tsn }, language),
            responseHeaders,
        );
    }

    @Injectable()
    @Resource()
    async getOriginalManufacturers(
        @Inject('MockService', { name: 'mock/manufacturers.json' }) mock?: MockService,
    ) {
        const manufacturers = await mock!.getAll();
        return this.getResponse().ok(
            manufacturers.filter((x: any) => x.id === 'volkswagen'),
        );
    }

    @Injectable()
    @Resource()
    async getCarByOriginalEquipmentMake(
        @Inject('MockService', { name: 'mock/vehicles.json' }) mock?: MockService,
    ) {
        const { make } = this.getPathParams();
        const vehicles = await mock!.getAll();
        const filteredVehicles = vehicles.filter((x: any) => x.manufacturer.id === make);

        const matchedVehicles = filteredVehicles.reduce((vehicleAcc: any, vehicle: any) => {
            const fitments = vehicle.fitments.reduce((acc: any, fitment: any) => {
                const frontMaterials = fitment.frontDimension.materials.filter((m: any) => m.isOE);
                const rearMaterials = fitment.rearDimension.materials.filter((m: any) => m.isOE);
                acc.push({
                    frontDimension: {
                        ...fitment.frontDimension,
                        materials: frontMaterials,
                    },
                    rearDimension: {
                        ...fitment.rearDimension,
                        materials: rearMaterials,
                    },
                });
                return acc;
            }, []);
            if (fitments.length > 0) {
                vehicleAcc.push({ ...vehicle, fitments });
            }

            return vehicleAcc;
        }, []);

        return this.getResponse().ok(matchedVehicles);
    }

    @Injectable()
    @Resource()
    async getCarCodesByMake(
        @Inject('FitmentService') service?: FitmentService,
    ) {
        const { country, make }: IVehicleCodesByMakePathRequest = this.getPathParams();
        const query: IVehicleCodesByMakeQueryRequest = this.getQueryParams();
        const response = await service!.getVehicleCodesByMake(country, make, query);
        return this.getResponse().general(ResponseCode.OK, response, responseHeaders);
    }
}
