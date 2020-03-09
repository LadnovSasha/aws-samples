import { injectCache, injectStore } from 'lambda-core';
import * as sinon from 'sinon';

const importServiceMock = {
    importRows: sinon.stub().resolves(),
    parseStreamedFile: sinon.stub().resolves(),
};

describe('src/import/import.controller', () => {
    const instance = require('./handler');

    beforeAll(() => {
        injectCache.clear();
        injectStore.set('ImportService', {
            create: () => Promise.resolve(importServiceMock),
        });
    });

    describe('importFitments()', () => {
        let response: any;
        const fileName = 'import/test.txt';
        const event = {
            s3: {
                object: { key: fileName, size: 1048576 * 20 },
            },
        };

        beforeAll(async () => {
            response = await instance.importFitments({ Records: [event] }, null, null);
        });

        it('Should start import beadbarcode file', async () => {
            expect(response.success).toEqual(true);
        });

        it('Should pass to parseStreamedFile fileName as first argument', () => {
            expect(importServiceMock.parseStreamedFile.getCall(0).args[0]).toEqual(fileName);
        });
    });
});
