import { readFileSync } from 'fs';
import * as sinon from 'sinon';
import { ImportService } from './import.service';
import { injectCache, injectStore } from 'lambda-core';
const db = {
    query: sinon.stub().resolves({ rows: [] }),
};
const fileStorageMock = {
    getFile: async (name: string) => readFileSync(`./mock/${name}`),
};

describe('src/services/import/import.service', () => {
    beforeAll(() => {
        injectCache.delete('PG');
        injectStore.set('PG', {
            create: () => Promise.resolve(db),
        });
        injectStore.set('FileStorageService', {
            create: () => Promise.resolve(fileStorageMock),
        });
    });

    describe('importFile()', () => {
        const instance: any = new ImportService();
        beforeAll(async () => {
            await instance.importFile('GDY_DE_DE.csv');
        });

        it('Should insert vehicle data first', () => {
            const [query] = db.query.getCall(2).args;
            expect(query).toMatch(/INSERT INTO vehicles/);
        });

        it('Should update vehicles on conflict', () => {
            const [query] = db.query.getCall(2).args;
            expect(query).toMatch(/ ON CONFLICT \(id\) DO UPDATE SET/);
        });

        it('Should pass vehicle data', () => {
            const [, values] = db.query.getCall(2).args;
            expect(values).toEqual([
                'P00000100000016', '4001 150,4136 320,4136 340', '{de}', 'Alfa 145/146',
                'alfa romeo', '930', 1997, 1,
                2001, 1, '{"de_de":"Benzin"}', 1370, '{"de_de":"1.4 TS(76 KW, 103 PS)"}',
                76, '{"de_de":"Schrägheck"}', 185, 1655, '{"front":950,"rear":900}',
            ]);
        });

        it('Should insert fitments', () => {
            const [query] = db.query.getCall(3).args;
            expect(query).toMatch(/INSERT INTO fitments/);
        });

        it('Should update fitments on conflict', () => {
            const [query] = db.query.getCall(3).args;
            expect(query).toMatch(/ ON CONFLICT \(id\) DO UPDATE SET/);
        });

        it('Should pass fitment data', () => {
            const [, values] = db.query.getCall(2).args;
            expect(values).toEqual([
                'P00000100000016', '4001 150,4136 320,4136 340', '{de}', 'Alfa 145/146', 'alfa romeo',
                '930', 1997, 1, 2001, 1, '{"de_de":"Benzin"}',
                1370, '{"de_de":"1.4 TS(76 KW, 103 PS)"}', 76, '{"de_de":"Schrägheck"}', 185,
                1655, '{"front":950,"rear":900}',
            ]);
        });
    });
});
