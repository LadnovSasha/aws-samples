import { injectCache, injectStore } from 'lambda-core';
import * as sinon from 'sinon';

const importServiceMock = {
    importFile: sinon.stub().resolves(),
};

describe('src/import/import.controller', () => {
    beforeAll(() => {
        injectCache.clear();
        injectStore.set('ImportService', {
            create: () => Promise.resolve(importServiceMock),
        });
    });

    describe('importFitments()', () => {
        const instance: any = require('./handler');
        let response: any;
        const event = {
            s3: {
                object: { key: 'import/test.csv', size: 2097152 },
            },
        };

        beforeAll(async () => {
            response = await instance.importFitments({ Records: [event] }, null, null);
        });

        it('Should call importService with the filename', () => {
            expect(
                importServiceMock.importFile.calledWith('import/test.csv'),
            ).toBeTruthy();
        });

        it('Should return success', () => {
            expect(response.success).toBeTruthy();
        });
    });
});
