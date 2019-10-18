import squel = require('squel');
import { PoolClient } from 'pg';
import {
    IParseServiceConfig, Injectable, Inject,
    FileService, ParseService,
} from 'lambda-core';
import importConfiguration from './import.configuration';
import { IImportFitment } from 'fitment-interface';
import { MapService } from './map.service';

export class ImportService {
    static fitmentConfig: IParseServiceConfig[] = importConfiguration;
    protected fitmentTable = 'fitments';
    protected vehicleTable = 'vehicles';
    protected squel = squel.useFlavour('postgres');
    protected squelOptions: squel.QueryBuilderOptions = { autoQuoteFieldNames: true, nameQuoteCharacter: '"' };

    async importFile(fileName: string) {
        const rawFitments = await this.parseFile<IImportFitment>(fileName, ImportService.fitmentConfig);
        const locale: string = this.getLocaleFromFileName(fileName);
        const updatePromises = rawFitments.map(async (row) => {
            await this.insertVehicle(row, locale);
            await this.insertFitments(row);
        });

        await Promise.all(updatePromises);
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
            fuel = ${this.vehicleTable}.fuel || excluded.fuel,
            "engineDescription" = ${this.vehicleTable}."engineDescription" || excluded."engineDescription",
            "format" = ${this.vehicleTable}."format" || excluded."format"
        `;
        const { text, values } = this.squel.insert(this.squelOptions)
            .into(this.vehicleTable)
            .setFields({
                ...vehicle,
                hsntsn: this.marshalMultidimArray(vehicle.hsntsn),
                countries: `{${mapService.country}}`,
                fuel: JSON.stringify(vehicle.fuel),
                engineDescription: JSON.stringify(vehicle.engineDescription),
                format: JSON.stringify(vehicle.format),
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
    protected async parseFile<T>(
        fileName: string,
        config: IParseServiceConfig[],
        @Inject('FileStorageService') file?: FileService,
        @Inject('ParseService', {
            delimiter: ';',
        }) parser?: ParseService,
    ): Promise<T[]> {
        const data = await file!.getFile(fileName);
        return await parser!.parse<T>(data, config);
    }

    static async getInstance() {
        return new ImportService();
    }
}
