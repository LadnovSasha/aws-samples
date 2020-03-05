import squel = require('squel');
import { PoolClient } from 'pg';
import {
    IParseServiceConfig, Injectable, Inject,
    FileService, ParseService, Logger,
} from 'lambda-core';
import { dictionaryConfiguration } from './import.configuration';
import { IDictionary, IFitment } from 'fitment-interface';
import { MapService } from './map.service';
import { IFileRange, IDictionaryCsvRow, IFitmentChunk, IFitmentRow } from './import.service.interface';

export class ImportService {
    static delimeter = ';';
    static columnsCount = 40;
    static colSize = 50;

    protected fitmentTable = 'fitments';
    protected firstEntry = true;
    protected vehicleTable = 'vehicles';
    protected modelTypes = 'modeltypes';
    protected squel = squel.useFlavour('postgres');
    protected file: FileService = new FileService();
    protected squelOptions: squel.QueryBuilderOptions = {
        autoQuoteFieldNames: true,
        nameQuoteCharacter: '"',
        replaceSingleQuotes: true,
        singleQuoteReplacement: "''",
    };

    async importDictionaries(fuelFile: string, vehicleFormatFile: string, segmentFile: string) {
        if (await this.existsFiles([fuelFile, segmentFile, vehicleFormatFile])) {
            await this.importDictionary(fuelFile, 'fueltypes', dictionaryConfiguration);
            await this.importDictionary(segmentFile, 'segmenttypes', dictionaryConfiguration);
            await this.importDictionary(vehicleFormatFile, 'formattypes', dictionaryConfiguration);
        }
    }

    async importRows({ data, fileName }: { fileName: string, data: string[] }) {
        if (this.firstEntry) {
            data.shift(); // remove header from csv
        }
        this.firstEntry = false;
        const locale = this.getLocaleFromFileName(fileName);
        const { unique, duplicated } = this.mapAndUniqueByVehicleId(data, locale);
        await this.importModels(unique, locale);
        await this.insertVehicles(unique);
        await this.insertFitments(unique.concat(duplicated));
        await this.cleanupVehicles();
    }

    protected mapAndUniqueByVehicleId(data: string[], locale: string) {
        const { unique, duplicated } = data.reduce((res, val) => {
            const splitted = val.replace(/\r/ig, '').split(';');
            const data = MapService.mapTableData(splitted);
            if (!res.ids[data.vehicleId]) {
                res.unique.push({ data, locale });
                res.ids[data.vehicleId] = true;
                res.ids[data.fitment] = true;
            }
            if (!res.ids[data.fitment]) {
                res.duplicated.push({ data, locale });
                res.ids[data.fitment] = true;
            }
            return res;
        }, { unique: [] as IFitmentChunk[], duplicated: [] as IFitmentChunk[], ids: {} });
        return { unique, duplicated };
    }

    @Injectable()
    protected async importDictionary(
        filename: string,
        table: string,
        config: IParseServiceConfig[],
        @Inject('ParseService', { delimiter: ';' }) parser?: ParseService,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
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
                value: JSON.stringify({ ...item }),
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
            .setFieldsRows(rows)
            .toParam();

        await this.executeDBQuery(text + onConflictClause, values, `Insert dictionaries ${JSON.stringify(rows)}`);
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
        rows: IFitmentChunk[],
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const fitments = rows.reduce((res, { data }) => {
            const fitment = MapService.unmarshalFitment(data);
            return res.concat(this.areSpeedOrLoadNull(fitment) ? [] : {
                ...fitment,
                highwayPressure: JSON.stringify(fitment.highwayPressure),
                normalPressure: JSON.stringify(fitment.normalPressure),
                dimensions: JSON.stringify(fitment.dimensions),
            });
        }, [] as IFitmentRow[]);
        const onConflictClause = ` ON CONFLICT (id) DO UPDATE SET
            "highwayPressure" = excluded."highwayPressure",
            "normalPressure" = excluded."normalPressure",
            "dimensions" = excluded."dimensions"
        `;
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(this.fitmentTable)
            .setFieldsRows(fitments)
            .toParam();

        await this.executeDBQuery(text + onConflictClause, values, `Insert fitments ${JSON.stringify(fitments)}`);
    }

    protected async cleanupVehicles(
    ) {
        await this.executeDBQuery(`
        DELETE FROM vehicles v
        WHERE NOT EXISTS (Select 1 from fitments WHERE fitments."vehicleId" = v.id)
        `, [], 'Error in cleanup');
    }

    @Injectable()
    protected async insertVehicles(
        rows: IFitmentChunk[],
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const vehicles = [];
        for (const { data, locale } of rows) {
            const mapService = new MapService(locale);
            const vehicle = await mapService.unmarshalVehicle(data);
            vehicles.push({
                ...vehicle,
                hsntsn: this.marshalMultidimArray(vehicle.hsntsn),
                countries: `{${mapService.country}}`,
                engineDescription: JSON.stringify(vehicle.engineDescription),
                axleLoad: JSON.stringify(vehicle.axleLoad),
            });
        }
        const onConflictClause = ` ON CONFLICT (id) DO UPDATE SET
            countries = (
                Select array_agg(DISTINCT s1.unnest) FROM (
                    SELECT unnest(countries || excluded.countries) from ${this.vehicleTable} where id = excluded.id
                ) as s1
            ),
            "engineDescription" = ${this.vehicleTable}."engineDescription" || excluded."engineDescription",
            tpms = excluded.tpms, "engineSizePs" = excluded."engineSizePs", "hsntsn" = excluded."hsntsn", "code" = ${this.vehicleTable}."code"
        `;
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(this.vehicleTable)
            .setFieldsRows(vehicles)
            .toParam();

        await this.executeDBQuery(text + onConflictClause, values, `Insert vehicles ${JSON.stringify(vehicles)}`);
    }

    @Injectable()
    protected async importModels(
        rows: IFitmentChunk[],
        locale: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const { chunks } = rows.reduce((res, { data, locale }) => {
            const key = MapService.generateCodeByModelName(data.model);
            if (!res.codes[key]) {
                res.chunks.push({
                    key,
                    value: JSON.stringify({ [locale] : data.model.replace("'", "''") }),
                });
                res.codes[key] = true;
            }
            return res;
        }, { chunks: [] as { key: string, value: string }[], codes: {} });
        await this.upsertVehicleModel(chunks, locale);
    }

    @Injectable()
    protected async upsertVehicleModel(
        chunks: { key: string, value: string }[],
        locale: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(`${this.modelTypes} as m`)
            .setFieldsRows(chunks)
            .toParam();

        const onConflictClause = ` ON CONFLICT (key) DO UPDATE SET
            value = jsonb_set(m.value, '{"${locale}"}', excluded.value->'${locale}')
        `;

        await this.executeDBQuery(text + onConflictClause, values, `Insert vehicle model ${JSON.stringify(chunks)}`);
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

    @Injectable()
    public async parseStreamedFile<T>(
        fileName: string,
        @Inject('ParseService', { delimiter: ImportService.delimeter }) parser?: ParseService,
    ): Promise<void> {
        const stream = this.file.getReadable(fileName);
        await parser!.parseChunkData(stream, fileName, async (result: { fileName: string, data: string[] }) => await this.importRows(result));
    }

    @Injectable()
    protected async executeDBQuery(
        query: string,
        values: string[],
        additionalData = '',
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
        @Inject('LogService') log?: Logger,
    ) {

        try {
            return await db!.query(query, values);
        } catch (err) {
            log!.error(`Execution DB query errror: ${err.message}. Query - ${query}, Values - ${values}, Additional data - ${additionalData || 'missed'}`);
            throw err;
        }
    }

    protected splitCsvRows(csv: string): string[] {
        return csv.replace('\r', '').split('\n');
    }

    protected joinCsvRows(csvRows: string[]): string {
        return csvRows.join('\n');
    }

    protected areSpeedOrLoadNull(fitment: IFitment) {
        return (!fitment.dimensions.front.loadIndex || fitment.dimensions.front.loadIndex === 0) ||
        (!fitment.dimensions.front.speedIndex || fitment.dimensions.front.speedIndex === '0') ||
        (!fitment.dimensions.rear.loadIndex || fitment.dimensions.rear.loadIndex === 0) ||
        (!fitment.dimensions.rear.speedIndex || fitment.dimensions.rear.speedIndex === '0');
    }

    static async getInstance() {
        return new ImportService();
    }
}
