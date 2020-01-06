import {
    Controller, Injectable, Resource, Inject,
} from 'lambda-core';
import { ImportService } from '../services/import/import.service';

export class ImportController extends Controller {
    static chunkSize = 102400; // 100kb
    static dictionaryFiles = [
        'dictionaries/fuel.csv',
        'dictionaries/vehicleFormat.csv',
        'dictionaries/vehicleSegment.csv',
    ];

    @Injectable()
    @Resource()
    public async importFitments(
        @Inject('ImportService') importService?: ImportService,
    ) {
        const { Records } = <any>this.getEvent();
        for (const record of Records) {
            const { s3 } = record;
            const fileName = s3.object.key;
            await importService!.parseStreamedFile(fileName);
        }
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
