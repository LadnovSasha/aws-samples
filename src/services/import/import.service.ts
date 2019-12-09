import squel = require('squel');
import { PoolClient } from 'pg';
import {
    IParseServiceConfig, Injectable, Inject,
    FileService, ParseService, LogService,
} from 'lambda-core';
import { fitmentConfiguration, dictionaryConfiguration } from './import.configuration';
import { IImportFitment, IDictionary } from 'fitment-interface';
import { MapService } from './map.service';
import { IFileRange, IDictionaryCsvRow } from './import.service.interface';
import { FitmentService } from '../fitment/fitment.service';

export class ImportService {
    static delimeter = ';';
    static columnsCount = 40;
    static colSize = 50;

    protected fitmentTable = 'fitments';
    protected vehicleTable = 'vehicles';
    protected modelTypes = 'modeltypes';
    protected squel = squel.useFlavour('postgres');
    protected file: FileService = new FileService();
    protected squelOptions: squel.QueryBuilderOptions = {
        autoQuoteFieldNames: true,
        nameQuoteCharacter: '"',
    };
    protected log = LogService.getInstance();

    async importChunk(range: IFileRange) {
        const rawFitments = await this.parseFile<IImportFitment>(range, fitmentConfiguration);
        const locale: string = this.getLocaleFromFileName(range.fileName);
        const updatePromises = rawFitments.map(async (row) => {
            await this.importModels(row, locale);
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
            "engineDescription" = ${this.vehicleTable}."engineDescription" || excluded."engineDescription",
            tpms = excluded.tpms, "engineSizePs" = excluded."engineSizePs", hsntsn = excluded.hsntsn, code = excluded.code
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

    @Injectable()
    protected async importModels(
        rawFitments: IImportFitment,
        locale: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {

        const code = MapService.generateCodeByModelName(rawFitments.model);
        const { key, vehicleId } = await this.getKeyByVehicleId(code, rawFitments.vehicleId);

        if (key) {
            await this.updateVehicleModel(vehicleId, code, locale, rawFitments, key);
        } else {
            await this.upsertVehicleModel(rawFitments, locale, code);
        }
    }

    @Injectable()
    protected async upsertVehicleModel(
        rawFitments: IImportFitment,
        locale: string,
        code: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(`${this.modelTypes} as m`)
            .setFields({
                vehicleId: `{"${rawFitments.vehicleId}"}`,
                key: code,
                value: JSON.stringify({ [locale] : rawFitments.model }),
            })
            .toParam();

        const onConflictClause = ` ON CONFLICT (key) DO UPDATE SET
            value = jsonb_set(m.value, '{"${locale}"}', '"${rawFitments.model}"'),
            "vehicleId" = (
                Select array_agg(DISTINCT v.unnest) FROM (
                    SELECT unnest("vehicleId" || excluded."vehicleId") from ${this.modelTypes} where key = excluded.key
                ) as v
            )`;

        await this.executeDBQuery(text + onConflictClause, values, `Insert vehicle model ${rawFitments}`);
    }

    @Injectable()
    protected async updateVehicleModel(
        vehicleId: string | undefined,
        code: string,
        locale: string,
        rawFitments: IImportFitment,
        key: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const updateQuery = this.squel.update({ replaceSingleQuotes: true })
            .table(`${this.modelTypes} as m`)
            .set(`value = jsonb_set(m.value, '{"${locale}"}', '"${rawFitments.model}"')`)
            .where('key = ?', code);

        if (!vehicleId) {
            updateQuery.set(`"vehicleId" = (
                Select array_agg(DISTINCT v.unnest) FROM (
                    SELECT unnest("vehicleId" || '{"${rawFitments.vehicleId}"}') from modeltypes where key = ${code}
                ) as v
            )`);
        }

        if (locale === FitmentService.fallbackLocale) {
            updateQuery.set('key = ?', key);
        }

        const { text, values } = updateQuery.toParam();

        await this.executeDBQuery(text, values, `Update vehicle model ${code} found key ${key} with values ${rawFitments}`);
    }

    @Injectable()
    protected async getKeyByVehicleId(
        key: string,
        id: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<{ key: string, vehicleId: string | undefined }> {
        const { rows } = await db!.query<{key: string, vehicleId: string[]}>(`SELECT key, "vehicleId" FROM ${this.modelTypes} WHERE "vehicleId" @> '{"${id}"}' OR key = '${key}';`);
        return {
            key: rows[0]?.key,
            vehicleId: rows[0]?.vehicleId.includes(id) ? id : undefined,
        };
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
    protected async executeDBQuery(
        query: string,
        values: string[],
        additionalData?: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {

        try {
            await db!.query(query, values);
        } catch (err) {
            (await this.log).error(`Execution DB errror: ${additionalData}`);
        }
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
