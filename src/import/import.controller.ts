import {
    Controller, Injectable, Resource,
    Inject, SqsService, ResourceTypes,
} from 'lambda-core';
import { ImportService } from '../services/import/import.service';
import { IFileRange } from '../services/import/import.service.interface';
import { S3EventRecord } from 'aws-lambda';

export class ImportController extends Controller {
    static chunkSize = 102400; // 100kb
    static dictionaryFiles = [
        'dictionaries/fuel.csv',
        'dictionaries/vehicleFormat.csv',
        'dictionaries/vehicleSegment.csv',
    ];

    @Injectable()
    @Resource({
        type: ResourceTypes.SQS,
    })
    public async handleImport(
        @Inject('ImportService') importService: ImportService,
    ) {
        const now = Date.now();
        const { Records } = <any>this.getEvent();
        const promises = Records.map(async (record: any) => {
            const { body: text }: { body: string } = record;
            const range: IFileRange = JSON.parse(text);
            await importService.importChunk(range);
        });
        await Promise.all(promises);

        return this.getResponse().ok({ duration: Date.now() - now });
    }

    @Injectable()
    @Resource()
    public async importFitments(
        @Inject('SqsService', { url: process.env.FITMENT_QUEUE_URL }) sqs?: SqsService,
    ) {
        const { Records } = <any>this.getEvent();
        const sqsRequests = Records.reduce((promises: Promise<any>[], record: S3EventRecord) => {
            const { s3 } = record;
            const fileName = s3.object.key;
            const length = s3.object.size || 0;
            const chunksAmount = Math.ceil(length / ImportController.chunkSize);
            const chunkSize = ImportController.chunkSize;

            for (let i = 0; i < chunksAmount; i += 1) {
                const start = i * chunkSize;
                const end = start + chunkSize - 1;

                promises.push(
                    sqs!.send<IFileRange>({ data: { start, end, fileName } }),
                );
            }

            return promises;
        }, []);

        await Promise.all(sqsRequests);
        return this.getResponse().ok();
    }

    @Injectable()
    @Resource()
    public async importDictionaries(
        @Inject('ImportService') importService: ImportService,
    ) {
        const [fuelType, vehicleFormat, segmentType] = ImportController.dictionaryFiles;
        await importService.importDictionaries(fuelType, vehicleFormat, segmentType);
    }
}
