import * as request from 'request-promise';

const url = process.env.LAMBDA;

describe('Integration test example', () => {
    describe('GET /health/status', () => {
        it('Should response with success', async () => {
            const resource = '/health/status';
            const expectedResponse = {
                success: true,
            };

            const response = await request({
                method: 'GET',
                url: url + resource,
                json: true,
            });
            expect(response).toEqual(expectedResponse);
        });
    });
});
