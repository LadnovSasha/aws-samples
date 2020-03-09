import * as sinon from 'sinon';
import { injectCache, injectStore } from 'lambda-core';
const vehiclesMock = require('../../mock/vehicles.json');
const manufacturersMock = require('../../mock/manufacturers.json');
const vehicleCodesMock = [{ code: 'test', model: 'test' }];

const sandbox = sinon.createSandbox();
const fitmentMock = {
    getManufacturers: sandbox.stub().resolves([{ id: 'test' }]),
    getVehiclesByMake: sandbox.stub().resolves([{ id: 'vehicleId' }]),
    getVehicleById: sandbox.stub().resolves({ id: 'vehicleId' }),
    getVehiclesByHsnTsn:    sandbox.stub().resolves([{ id: 'vehicleId' }]),
    getVehicleCodesByMake:    sandbox.stub().resolves(vehicleCodesMock),
};

describe('src/fitment/fitment.controller', () => {
    const controller = require('./handler');
    beforeAll(() => {
        injectCache.clear();
        injectStore.set('FitmentService', {
            create: () => Promise.resolve(fitmentMock),
        });
    });

    beforeEach(() => {
        sandbox.resetHistory();
    });

    describe('getmanufacturers()', () => {
        it('Should return a list of manufacturers', async () => {
            const { body, statusCode } = await controller.getManufacturers({
                pathParameters: { country: 'de' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            expect({ statusCode, body }).toEqual({
                statusCode: 200,
                body: JSON.stringify([{ id: 'test' }]),
            });
        });

        it('Should filter manufacturers by country', async () => {
            await controller.getManufacturers({
                pathParameters: { country: 'de' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            const [actualCountry] = fitmentMock.getManufacturers.getCall(0).args;
            expect(actualCountry).toEqual('de');
        });
    });

    describe('getCarByMake()', () => {
        it('Should return a list of vehicles by manufacturer', async () => {
            const { body, statusCode } = await controller.getCarByMake({
                pathParameters: { country: 'de', make: 'audi' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            expect({ statusCode, body }).toEqual({
                statusCode: 200,
                body: JSON.stringify([{ id: 'vehicleId' }]),
            });
        });

        it('Should filter vehicles by country and make', async () => {
            await controller.getCarByMake({
                pathParameters: { country: 'de', make: 'audi' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            const [actualCountry, actualMake] = fitmentMock.getVehiclesByMake.getCall(0).args;
            expect(actualCountry).toEqual('de');
            expect(actualMake).toEqual('audi');
        });
    });

    describe('getCarById()', () => {
        const controller = require('./handler');
        const carIdFitmentMock = {
            getVehicleById: sinon.stub()
                .onFirstCall().resolves({ id: 'vehicleId' })
                .onSecondCall().resolves()
                .resolves({ id: 'vehicleId' }),
        };

        beforeAll(() => {
            injectCache.clear();
            injectStore.set('FitmentService', {
                create: () => Promise.resolve(carIdFitmentMock),
            });
        });
        it('Should return  vehicle by id', async () => {
            const { body, statusCode } = await controller.getCarById({
                pathParameters: { country: 'de', vehicleId: 'vehicleId' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            expect({ statusCode, body }).toEqual({
                statusCode: 200,
                body: JSON.stringify({ id: 'vehicleId' }),
            });
        });

        it('Should return not found if vehicle is absent', async () => {
            const { statusCode } = await controller.getCarById({
                pathParameters: { country: 'de', vehicleId: 'audi' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            expect(statusCode).toEqual(404);
        });

        afterAll(() => {
            injectCache.clear();
            injectStore.set('FitmentService', {
                create: () => Promise.resolve(fitmentMock),
            });
        });
    });

    describe('getCarByHsnTsn()', () => {
        it('Should return a list of vehicles by hsntsn', async () => {
            const { body, statusCode } = await controller.getCarByHsnTsn({
                pathParameters: { country: 'de', hsn: 'hsn', tsn: 'tsn' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            expect({ statusCode, body }).toEqual({
                statusCode: 200,
                body: JSON.stringify([{ id: 'vehicleId' }]),
            });
        });

        it('Should pass hsntsn to the service', async () => {
            await controller.getCarByHsnTsn({
                pathParameters: { country: 'de', hsn: 'hsn', tsn: 'tsn' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            const [actualCountry, hsntsn] = fitmentMock.getVehiclesByHsnTsn.getCall(0).args;
            expect(actualCountry).toEqual('de');
            expect(hsntsn).toEqual({ hsn: 'hsn', tsn: 'tsn' });
        });
    });

    describe('getOriginalManufacturers()', () => {
        const controller = require('./handler');
        const mockService = {
            getAll: sinon.stub().resolves(manufacturersMock),
        };

        beforeAll(() => {
            injectCache.clear();
            injectStore.set('MockService', {
                create: () => Promise.resolve(mockService),
            });
        });

        it('Should return original manufacturers', async () => {
            const { statusCode } = await controller.getOriginalManufacturers({
                pathParameters: { country: 'de' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);
            expect(statusCode).toEqual(200);
        });
    });

    describe('getCarByOriginalEquipmentMake()', () => {
        const controller = require('./handler');
        const mockService = {
            getAll: sinon.stub().resolves(vehiclesMock),
        };

        beforeAll(() => {
            injectCache.clear();
            injectStore.set('MockService', {
                create: () => Promise.resolve(mockService),
            });
        });

        it('Should return vehicles by oe manufacturer', async () => {
            const { statusCode } = await controller.getCarByOriginalEquipmentMake({
                pathParameters: { country: 'de', make: 'volkswagen' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);
            expect(statusCode).toEqual(200);
        });
    });

    describe('getCarCodesByMake()', () => {

        it('Should return a list of vehicles codes', async () => {
            const { body, statusCode } = await controller.getCarCodesByMake({
                pathParameters: { country: 'de', make: 'audi' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            expect({ statusCode, body }).toEqual({
                statusCode: 200,
                body: JSON.stringify(vehicleCodesMock),
            });
        });

        it('Should call with path params', async () => {
            await controller.getCarCodesByMake({
                pathParameters: { country: 'de', make: 'audi' },
                headers: {},
                httpMethod: 'get',
            }, {}, null);

            expect(fitmentMock.getVehicleCodesByMake.calledOnceWith('de', 'audi', {})).toBeTruthy;
        });
    });
});
