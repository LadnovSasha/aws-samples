import { Controller, Injectable, Resource, Inject } from 'lambda-core';
import { ImportService } from '../services/import/import.service';

export class ImportController extends Controller {
    @Injectable()
    @Resource()
    async importFitments(
        @Inject('ImportService') importService: ImportService,
    ) {
        const { Records } = <any>this.getEvent();
        const { s3 } = Records[0];
        await importService.importFile(s3.object.key);
        return this.getResponse().ok();
    }
}
