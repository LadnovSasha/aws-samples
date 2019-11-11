import squel = require('squel');
import { PoolClient } from 'pg';
import {
    IParseServiceConfig, Injectable, Inject,
    FileService, ParseService,
} from 'lambda-core';
import { fitmentConfiguration, dictionaryConfiguration } from './import.configuration';
import { IImportFitment, IDictionary } from 'fitment-interface';
import { MapService } from './map.service';
import { IFileRange, IDictionaryCsvRow } from './import.service.interface';

export class ImportService {
    static delimeter = ';';
    static columnsCount = 40;
    static colSize = 50;

    protected fitmentTable = 'fitments';
    protected vehicleTable = 'vehicles';
    protected squel = squel.useFlavour('postgres');
    protected file: FileService = new FileService();
    protected squelOptions: squel.QueryBuilderOptions = { autoQuoteFieldNames: true, nameQuoteCharacter: '"' };

    async importChunk(range: IFileRange) {
        const rawFitments = await this.parseFile<IImportFitment>(range, fitmentConfiguration);
        const locale: string = this.getLocaleFromFileName(range.fileName);
        const updatePromises = rawFitments.map(async (row) => {
            await this.insertVehicle(row, locale);
            await this.insertFitments(row);
        });

        await Promise.all(updatePromises);
    }

    async importDictionaries(fuelFile: string, vehicleFormatFile: string, segmentFile: string) {
        if (await this.existsFiles([fuelFile, segmentFile, vehicleFormatFile])) {
            await this.importDictionary(fuelFile, 'fueltypes', dictionaryConfiguration);
            await this.importDictionary(segmentFile, 'segmenttypes', dictionaryConfiguration);
            await this.importDictionary(vehicleFormatFile, 'formattypes', dictionaryConfiguration);
        }
    }

    @Injectable()
    protected async importDictionary(
        filename: string,
        table: string,
        config: IParseServiceConfig[],
        @Inject('ParseService', { delimiter: ';' }) parser?: ParseService,
    ) {
        const items: IDictionaryCsvRow[] = await parser!.parse<IDictionaryCsvRow>(
            await this.file.getFile(filename),
            config,
        );
        if (items.length === 0) {
            return;
        }

        const rows = items.map<IDictionary>((item) => {
            const key = item.key;
            delete item.key;

            return {
                key,
                value: { ...item },
            };
        });

        await this.saveDictionary(rows, table);
    }

    @Injectable()
    protected async saveDictionary(
        rows: IDictionary[],
        table: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const onConflictClause = ` ON CONFLICT (key) DO UPDATE SET
            "value" = ${table}."value" || excluded."value"
        `;
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(table)
            .setFieldsRows(
                rows.map(x => ({ key: x.key, value: JSON.stringify(x.value) })),
            )
            .toParam();

        await db!.query(text + onConflictClause, values);
    }

    protected async existsFiles(
        files: string[],
    ): Promise<boolean> {
        return Promise
            .all(files.map(async (name: string) => await this.file!.isFile(name)))
            .then((list: boolean[]) => list.every((file: boolean) => file));
    }

    @Injectable()
    protected async insertFitments(
        rawFitments: IImportFitment,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const fitment = MapService.unmarshalFitment(rawFitments);
        const onConflictClause = ` ON CONFLICT (id) DO UPDATE SET
            "highwayPressure" = ${this.fitmentTable}."highwayPressure" || excluded."highwayPressure",
            "normalPressure" = ${this.fitmentTable}."normalPressure" || excluded."normalPressure",
            "dimensions" = ${this.fitmentTable}."dimensions" || excluded."dimensions"
        `;
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(this.fitmentTable)
            .setFields({
                ...fitment,
                highwayPressure: JSON.stringify(fitment.highwayPressure),
                normalPressure: JSON.stringify(fitment.normalPressure),
                dimensions: JSON.stringify(fitment.dimensions),
            })
            .toParam();

        await db!.query(text + onConflictClause, values);
    }

    @Injectable()
    protected async insertVehicle(
        rawFitments: IImportFitment,
        locale: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const mapService = new MapService(locale);
        const vehicle = await mapService.unmarshalVehicle(rawFitments);
        const onConflictClause = ` ON CONFLICT (id) DO UPDATE SET
            countries = (
                Select array_agg(DISTINCT s1.unnest) FROM (
                    SELECT unnest(countries || excluded.countries) from ${this.vehicleTable} where id = excluded.id
                ) as s1
            ),
            "engineDescription" = ${this.vehicleTable}."engineDescription" || excluded."engineDescription"
        `;
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(this.vehicleTable)
            .setFields({
                ...vehicle,
                hsntsn: this.marshalMultidimArray(vehicle.hsntsn),
                countries: `{${mapService.country}}`,
                engineDescription: JSON.stringify(vehicle.engineDescription),
                axleLoad: JSON.stringify(vehicle.axleLoad),
            })
            .toParam();

        await db!.query(text + onConflictClause, values);
    }

    protected getLocaleFromFileName(fileName: string) {
        const fileNameWithExtension = fileName.split('/').pop() || fileName;
        const name = fileNameWithExtension.split('.')[0];
        return name.replace('GDY_', '').toLowerCase();
    }

    protected marshalMultidimArray<T>(arr: T[][]): string {
        const plainArray = arr.map(x => `"${x.join(',')}"`);

        return `{${plainArray.join(',')}}`;
    }

    @Injectable()
    async parseFile<T>(
        range: IFileRange,
        config: IParseServiceConfig[],
        @Inject('ParseService', { delimiter: ImportService.delimeter }, { skipHeader: true }) parser?: ParseService,
    ): Promise<T[]> {
        const { data } = await this.file.getFileByRange(range.fileName, range.start, range.end);

        const normalizedCsvChunk = await this.normalizeCsvData(data, range.fileName, range.start);
        return await parser!.parse<T>(normalizedCsvChunk, config);
    }

    protected async normalizeCsvData(csv: string, filename: string, endRange: number): Promise<string> {
        let normalizedCsv = csv;
        const colCount: number = ImportService.columnsCount;

        if (csv.charAt(0) !== '\n' && endRange > 0) {
            const offset = colCount * ImportService.colSize;
            const { data, total } = await this.file!.getFileByRange(filename, endRange - offset, endRange - 1);
            const lastRowChunk = <string>this.splitCsvRows(data).pop();
            normalizedCsv = total && total <= endRange ? lastRowChunk : lastRowChunk + csv;
        }

        const resultRows: string[] = this.splitCsvRows(normalizedCsv);
        if (normalizedCsv.charAt(normalizedCsv.length - 1) !== '\n') {
            resultRows.pop();
        }
        return this.joinCsvRows(resultRows);
    }

    protected splitCsvRows(csv: string): string[] {
        return csv.replace('\r', '').split('\n');
    }

    protected joinCsvRows(csvRows: string[]): string {
        return csvRows.join('\n');
    }

    static async getInstance() {
        return new ImportService();
    }
}
