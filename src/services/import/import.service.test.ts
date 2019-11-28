import { readFileSync } from 'fs';
import * as sinon from 'sinon';
import { ImportService } from './import.service';
import { injectCache, injectStore } from 'lambda-core';
const db = {
    query: sinon.stub().resolves({ rows: [] }),
};
const fileStorageMock = {
    getFileByRange: () => Promise.resolve({ data: readFileSync('./mock/GDY_DE_DE.csv', 'utf-8') }),
    isFile: sinon.stub().resolves(true),
    getFile: sinon.stub()
        .onFirstCall().resolves('key;en;de;pl\npetrol;petrol;Benzin;Benzyna')
        .onSecondCall().resolves('key;en;de;pl\nsmall_family_car;Small family car;Kompaktklasse;Auto segmentu C')
        .onThirdCall().resolves('key;en;de;pl\nhatchback;Hatchback;Schragheck;Hatchback'),
};

describe('src/services/import/import.service', () => {
    beforeAll(() => {
        injectCache.clear();
        injectStore.set('PG', {
            create: () => Promise.resolve(db),
        });
    });

    describe('importChunk()', () => {
        const instance: any = new ImportService();
        const dbMock = {
            query: sinon.stub().resolves({ rows: [{ key: 'key' }] }),
        };

        beforeAll(async () => {
            injectCache.clear();
            injectStore.set('PG', {
                create: () => Promise.resolve(dbMock),
            });
            instance.file = fileStorageMock;
            await instance.importChunk({ fileName: 'GDY_DE_DE.csv', start: 0, end: 100 });
        });

        it('Should insert vehicle data first', () => {
            const [query] = dbMock.query.getCall(4).args;
            expect(query).toMatch(/INSERT INTO vehicles/);
        });

        it('Should update vehicles on conflict', () => {
            const [query] = dbMock.query.getCall(4).args;
            expect(query).toMatch(/ ON CONFLICT \(id\) DO UPDATE SET/);
        });

        it('Should pass vehicle data', () => {
            const [, values] = dbMock.query.getCall(4).args;
            expect(values).toEqual([
                'P00000100000016', '{"4001,150","4136,320","4136,340"}', 'alfa-145_146', '{de}', false, 'Alfa 145/146',
                'alfa_romeo', '930', 1997, 1,
                2001, 1, 'key', 'key', 1370, '{"de_de":"1.4 TS(76 KW, 103 PS)"}',
                76, 103, 'key', 185, 1655, '{"front":950,"rear":900}',
            ]);
        });

        it('Should insert fitments', () => {
            const [query] = dbMock.query.getCall(5).args;
            expect(query).toMatch(/INSERT INTO fitments/);
        });

        it('Should update fitments on conflict', () => {
            const [query] = dbMock.query.getCall(5).args;
            expect(query).toMatch(/ ON CONFLICT \(id\) DO UPDATE SET/);
        });

        it('Should pass fitment data', () => {
            const [, values] = dbMock.query.getCall(5).args;
            expect(values).toEqual([
                '00354000001600354', 'P00000100000016', '{"front":2.8,"rear":2.6}', '{"front":2.6,"rear":2.2}',
                '{"mixedFitment":true,"front":{"widthMM":175,"rim":14,"loadIndex":82,"speedIndex":"H","aspectRatio":65},"rear":{"widthMM":175,"rim":14,"loadIndex":82,"aspectRatio":65,"speedIndex":"H"}}',
            ]);
        });
    });

    describe('importDictionaries()', () => {
        const instance: any = new ImportService();

        beforeAll(async () => {
            db.query.resetHistory();
            injectCache.clear();
            injectStore.set('PG', {
                create: () => Promise.resolve(db),
            });
            instance.file = fileStorageMock;

            await instance.importDictionaries('fuel.csv', 'segment.csv', 'format.csv');
        });

        it('Should verify that all files are present', () => {
            expect(fileStorageMock.isFile.callCount).toEqual(3);
        });

        it('Should parse and save fuel data', () => {
            const [query, values] = db.query.getCall(0).args;
            expect(query).toMatch(/INSERT INTO fueltypes \("key", "value"\) VALUES \(\$1, \$2\)/);
            expect(values).toEqual(['petrol', '{"en_gb":"petrol","de_de":"Benzin","pl_pl":"Benzyna"}']);
        });

        it('Should parse and save segment data', () => {
            const [query, values] = db.query.getCall(1).args;
            expect(query).toMatch(/INSERT INTO segmenttypes \("key", "value"\) VALUES \(\$1, \$2\)/);
            expect(values).toEqual(['small_family_car', '{"en_gb":"Small family car","de_de":"Kompaktklasse","pl_pl":"Auto segmentu C"}']);
        });

        it('Should parse and save format data', () => {
            const [query, values] = db.query.getCall(2).args;
            expect(query).toMatch(/INSERT INTO formattypes \("key", "value"\) VALUES \(\$1, \$2\)/);
            expect(values).toEqual(['hatchback', '{"en_gb":"Hatchback","de_de":"Schragheck","pl_pl":"Hatchback"}']);
        });
    });
});
