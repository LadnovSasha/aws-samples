import { Controller, Resource } from 'lambda-core';
const manufacturers = require('../../mock/manufacturers.json');
const vehicles = require('../../mock/vehicles.json');

export class FitmentController extends Controller {
    @Resource()
    async getManufacturers() {
        return this.getResponse().ok(
            manufacturers,
        );
    }

    @Resource()
    async getCarByMake() {
        const { make } = this.getPathParams();
        const matchedVehicles = vehicles.filter((x: any) => x.manufacturer.id === make);
        return this.getResponse().ok(matchedVehicles);
    }

    @Resource()
    async getCarById() {
        const { vehicleId } = this.getPathParams();
        const matchedVehicle = vehicles.find((x: any) => x.id === vehicleId);
        if (!matchedVehicle) {
            return this.getResponse().notFound('Vehicle not found');
        }
        return this.getResponse().ok(matchedVehicle);
    }

    @Resource()
    async getCarByHsnTsn() {
        const { hsn, tsn } = this.getPathParams();
        const matchedVehicles = vehicles.filter((x: any) => {
            const hsntsnArray = x.hsntsn.map((z: any) => `${z.hsn}${z.tsn}`);
            return hsntsnArray.includes(`${hsn}${tsn}`);
        });
        return this.getResponse().ok(matchedVehicles);
    }

    @Resource()
    async getOriginalManufacturers() {
        return this.getResponse().ok(
            manufacturers.filter((x: any) => x.id === 'volkswagen'),
        );
    }

    @Resource()
    async getCarByOriginalEquipmentMake() {
        const { make } = this.getPathParams();
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
