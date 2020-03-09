import { injectStore } from 'lambda-core';
import { ImportService } from '../services/import/import.service';
import { ImportController } from './import.controller';

injectStore.set('ImportService', {
    create: ImportService.getInstance,
});

module.exports = new ImportController();
