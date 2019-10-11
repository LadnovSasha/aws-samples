import { MapService } from './map.service';
import { injectCache, injectStore } from 'lambda-core';
import * as sinon from 'sinon';

const db = {
    query: sinon.stub()
        .onFirstCall().resolves({
            rows: [],
        })
        .onSecondCall().resolves({
            rows: [{ id: 'id' }],
        }),
};

describe('src/services/import/import.service', () => {
    beforeAll(() => {
        injectCache.delete('PG');
        injectStore.set('PG', {
            create: () => Promise.resolve(db),
        });
    });

    beforeEach(() => {
        db.query.resetHistory();
    });

    describe('constructor()', () => {
        it('Should map country from locale', () => {
            const instance = new MapService('de_de');
            expect(instance.country).toEqual('de');
        });
    });

    describe('queryManufacturer()', () => {
        const instance: any = new MapService('de_de');

        it('Should create manufacturer if none is present', async () => {
            await instance.queryManufacturer('Alfa', 'logoUrl');
            const [selectQuery] = db.query.getCall(0).args;
            const [insertQuery, values] = db.query.getCall(1).args;

            expect(selectQuery).toEqual("Select key from manufacturers where key='alfa' AND name ? 'de_de'");
            expect(insertQuery.trim()).toMatch(/^INSERT INTO manufacturers \(key, name, logo\)/);
            expect(values).toEqual(['alfa', JSON.stringify({ de_de: 'Alfa' }), 'logoUrl']);
        });
    });

    describe('checkAndGetManufacturer()', () => {
        const instance: any = new MapService('de_de');

        it('Should call insert only once for the same key', async () => {
            const response = await Promise.all([
                instance.checkAndGetManufacturer('Alfa'),
                instance.checkAndGetManufacturer('Alfa'),
            ]);

            expect(db.query.callCount).toEqual(2);
            expect(response).toEqual(['alfa', 'alfa']);
        });
    });

    describe('unmarshalVehicle()', () => {
        const instance: any = new MapService('de_de');

        beforeAll(() => {
            instance.checkAndGetManufacturer = () => Promise.resolve('alfa');
        });
        it('Should map vehicle data', async () => {
            const result = await instance.unmarshalVehicle({
                vehicleId: 'test',
                fuel: 'fuel',
                hubraum: 1,
            });

            expect(result.id).toEqual('test');
            expect(result.countries).toEqual(['de']);
            expect(result.fuel).toEqual({ de_de: 'fuel' });
        });
    });

    describe('unmarshalFitment()', () => {
        it('Should map fitment data', () => {
            const fitment = MapService.unmarshalFitment(<any>{
                fitment: 'id',
                frontLoadIndex: '195/10',
                rearLoadIndex: '20',
                frontWidth: 210,
                rearWidth: 6.8,
            });

            expect(fitment.id).toEqual('id');
            expect(fitment.dimensions.front.widthMM).toEqual(210);
            expect(fitment.dimensions.front.widthInch).toBeUndefined();
            expect(fitment.dimensions.rear.widthInch).toEqual(6.8);
            expect(fitment.dimensions.rear.widthMM).toBeUndefined();
        });
    });

    describe('getLoadIndexes()', () => {
        it('Should map load indexes', () => {
            const indexes = MapService.getLoadIndexes('195/10');

            expect(indexes).toEqual({
                loadIndex: 195,
                loadIndex2: 10,
            });
        });

        it('Should set loadindex2 to undefined', () => {
            const indexes = MapService.getLoadIndexes('195');

            expect(indexes).toEqual({
                loadIndex: 195,
                loadIndex2: undefined,
            });
        });
    });
});
