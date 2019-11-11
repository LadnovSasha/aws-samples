import { injectCache, injectStore } from 'lambda-core';
import * as sinon from 'sinon';

const importServiceMock = {
    importChunk: sinon.stub().resolves(),
};

const sqsMock = {
    delete: sinon.stub().resolves(),
    send: sinon.stub().resolves(),
};

describe('src/import/import.controller', () => {
    const instance = require('./handler');

    beforeAll(() => {
        injectCache.clear();
        injectStore.set('ImportService', {
            create: () => Promise.resolve(importServiceMock),
        });
        injectStore.set('SqsService', {
            create: () => Promise.resolve(sqsMock),
        });
    });

    describe('importFitments()', () => {
        let response: any;
        const event = {
            s3: {
                object: { key: 'import/test.txt', size: 1048576 * 20 },
            },
        };

        beforeAll(async () => {
            response = await instance.importFitments({ Records: [event] }, null, null);
        });

        it('Should start import beadbarcode file', async () => {
            expect(response.success).toEqual(true);
        });

        it('Should send chunks to sqs queue', () => {
            const [firstRange] = sqsMock.send.getCall(0).args;
            const[secondRange] = sqsMock.send.getCall(1).args;

            expect(firstRange).toEqual({
                data: { start: 0, end: 1048575, fileName: 'import/test.txt' },
            });
            expect(secondRange).toEqual({
                data: { start: 1048576, end: 2097151, fileName: 'import/test.txt' },
            });
        });
    });

    describe('handleImport()', () => {
        beforeAll(async () => {
            await instance.handleImport({
                Records: [
                    { body: '{"start":0,"end":100,"fileName":"import/test.txt"}' },
                ],
            }, null, null);
        });

        it('Should process chunk', () => {
            const [query] = importServiceMock.importChunk.getCall(0).args;
            expect(query).toEqual({
                fileName: 'import/test.txt',
                start: 0,
                end: 100,
            });
        });
    });
});
