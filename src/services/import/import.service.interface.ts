import { IImportFitment } from 'fitment-interface';

export interface IFileRange {
    fileName: string;
    start: number;
    end: number;
}

export interface IDictionaryCsvRow {
    key: string;
    [locale: string]: string;
}

export interface IFitmentChunk {
    locale: string;
    data: IImportFitment;
}
