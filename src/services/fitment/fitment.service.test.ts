
import { FitmentService } from './fitment.service';
import * as sinon from 'sinon';
import { injectCache, injectStore } from 'lambda-core';
const sandbox = sinon.createSandbox();
const pgMock = {
    query: sandbox.stub().resolves({ rows: [] }),
};

describe('src/services/fitment/fitment.service', () => {
    beforeAll(() => {
        injectCache.clear();
        injectStore.set('PG', {
            create: () => Promise.resolve(pgMock),
        });
    });

    describe('getManufacturers()', () => {
        const instance: any = new FitmentService();

        it('Should request manufacturers by default locale', async () => {
            await instance.getManufacturers('de', '');
            const [query] = pgMock.query.getCall(0).args;
            expect(query).toMatch(/key as id, name->'de_de' as name, logo as "logoUrl"/);
        });

        it('Should request by query local', async () => {
            await instance.getManufacturers('de', 'en_us');
            const [query] = pgMock.query.getCall(1).args;
            expect(query).toMatch(/key as id, name->'en_us' as name, logo as "logoUrl"/);
        });

        afterAll(() => {
            sandbox.resetHistory();
        });
    });

    describe('getVehiclesByHsnTsn()', () => {
        let response: any;
        const instance: any = new FitmentService();
        const pg = {
            query: sandbox.stub()
                .onFirstCall().resolves({
                    rows: [{ hsntsnRaw: ['123,456'] }],
                })
                .resolves({ rows: [] }),
        };

        beforeAll(async () => {
            injectCache.clear();
            injectStore.set('PG', { create: () => Promise.resolve(pg) });
            response = await instance.getVehiclesByHsnTsn('de', { hsn: 123, tsn: 456 }, '');
        });

        it('Should build query with hsntsn selection', () => {
            const [query, values] = pg.query.getCall(0).args;
            expect(query).toMatch(/\$2 = ANY \(v.hsntsn\)/);
            expect(values).toEqual(['de', '123,456']);
        });

        it('Should map hsn and tsn values', () => {
            const [entity] = response;
            expect(entity.hsntsn).toEqual([{ hsn: '123', tsn: '456' }]);
        });
    });

    describe('getVehiclesByMake()', () => {
        let response: any;
        const instance: any = new FitmentService();
        const pg = {
            query: sandbox.stub()
                .onFirstCall().resolves({
                    rows: [{ hsntsnRaw: ['123,456'] }],
                })
                .resolves({ rows: [] }),
        };

        beforeAll(async () => {
            injectCache.clear();
            injectStore.set('PG', { create: () => Promise.resolve(pg) });
            response = await instance.getVehiclesByMake('de', 'makeId', {
                model: 'model',
                energyType: 'energyType',
                year: '2019',
            });
        });

        it('Should request vehicle by manufacturer and country', () => {
            const [query, values] = pg.query.getCall(0).args;

            expect(query).toMatch(/v.manufacturer = \$2/);
            expect(values[1]).toEqual('makeId');

            expect(query).toMatch(/\$1 = ANY \(v.countries\)/);
            expect(values[0]).toEqual('de');
        });

        it('Should filter by mode, energyType and year', () => {
            const [query, values] = pg.query.getCall(0).args;

            expect(query).toMatch(/v.model = \$3/);
            expect(query).toMatch(/v."fuelId" = \$4/);
            expect(query).toMatch(/v."startBuildYear" = \$5/);
            expect(values).toEqual(['de', 'makeId', 'model', 'energyType', '2019']);
        });

        it('Should return vehicle list', () => {
            expect(response.length).toBeGreaterThan(0);
        });
    });

    describe('getVehiclesById()', () => {
        const instance = new FitmentService();
        const pg = {
            query: sandbox.stub()
                .onFirstCall().resolves({
                    rows: [{ id: 'vehicleId', hsntsnRaw: ['123,456'], maxSpeedKm: 10 }],
                })
                .resolves({ rows: [] }),
        };

        beforeAll(() => {
            injectCache.clear();
            injectStore.set('PG', { create: () => Promise.resolve(pg) });
        });

        it('Should return vehicle info', async () => {
            const response = await instance.getVehicleById('de', 'vehicleId', '');

            expect(response).toEqual({
                id: 'vehicleId',
                fitments: [],
                hsntsn: [{ hsn: '123', tsn: '456' }],
                maxSpeed: { km: 10, mph: 6.21 },
            });
        });

        it('Should return undefined if vehicle not found', async () => {
            const response = await instance.getVehicleById('de', 'vehicleId', '');

            expect(response).toBeUndefined();
        });
    });

    describe('getFitmentsByVehicle()', () => {
        const instance: any = new FitmentService();
        const pg = {
            query: sandbox.stub().resolves({
                rows: [{ id: 'vehicleId', hsntsnRaw: ['123,456'], maxSpeedKm: 10 }],
            }),
        };
    });
});
