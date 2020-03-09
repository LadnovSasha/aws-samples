import { FitmentController } from './fitment.controller';
import { injectStore } from 'lambda-core';
import { FitmentService } from '../services/fitment/fitment.service';

injectStore.set('FitmentService', {
    create: FitmentService.getInstance,
});

module.exports = new FitmentController();
