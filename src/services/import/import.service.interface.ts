export interface IFileRange {
    fileName: string;
    start: number;
    end: number;
}

export interface IDictionaryCsvRow {
    key: string;
    [locale: string]: string;
}
