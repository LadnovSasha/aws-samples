import {
    Controller, Resource, Injectable,
    Inject, MockService,
} from 'lambda-core';

export class FitmentController extends Controller {
    @Injectable()
    @Resource()
    async getManufacturers(
        @Inject('MockService', { name: 'mock/manufacturers.json' }) mock?: MockService,
    ) {
        return this.getResponse().ok(
            await mock!.getAll(),
        );
    }

    @Injectable()
    @Resource()
    async getCarByMake(
        @Inject('MockService', { name: 'mock/vehicles.json' }) mock?: MockService,
    ) {
        const { make } = this.getPathParams();
        const vehicles = await mock!.getAll();
        const matchedVehicles = vehicles.filter((x: any) => x.manufacturer.id === make);
        return this.getResponse().ok(matchedVehicles);
    }

    @Injectable()
    @Resource()
    async getCarById(
        @Inject('MockService', { name: 'mock/vehicles.json' }) mock?: MockService,
    ) {
        const { vehicleId } = this.getPathParams();
        const vehicles = await mock!.getAll();
        const matchedVehicle = vehicles.find((x: any) => x.id === vehicleId);
        if (!matchedVehicle) {
            return this.getResponse().notFound('Vehicle not found');
        }
        return this.getResponse().ok(matchedVehicle);
    }

    @Injectable()
    @Resource()
    async getCarByHsnTsn(
        @Inject('MockService', { name: 'mock/vehicles.json' }) mock?: MockService,
    ) {
        const { hsn, tsn } = this.getPathParams();
        const vehicles = await mock!.getAll();
        const matchedVehicles = vehicles.filter((x: any) => {
            const hsntsnArray = x.hsntsn.map((z: any) => `${z.hsn}${z.tsn}`);
            return hsntsnArray.includes(`${hsn}${tsn}`);
        });
        return this.getResponse().ok(matchedVehicles);
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
}
