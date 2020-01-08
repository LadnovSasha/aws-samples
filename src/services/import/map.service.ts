import {
    IImportFitment, IVehicle, IFitment,
} from 'fitment-interface';
import { Injectable, Inject, SapService, Logger } from 'lambda-core';
import { PoolClient } from 'pg';
import { transliterate } from 'transliteration';
import { DictionaryTables } from './map.service.interface';
import { fitmentConfiguration } from './import.configuration';

const manufacturersCache: Map<string, Promise<any>> = new Map();

export class MapService {
    protected manufacturersTable: string = 'manufacturers';
    public country: string;

    constructor(protected locale: string) {
        this.country = locale.split('_')[0];
    }

    @Injectable()
    protected async queryManufacturer(
        key: string,
        logo: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<string> {
        const normalized = transliterate(key).replace(/\s/g, '_').toLowerCase();
        const { rows } = await db!.query(`Select key from ${this.manufacturersTable} where key='${normalized}' AND name ? '${this.locale}'`);

        if (!rows.length) {
            await db!.query(`
                INSERT INTO ${this.manufacturersTable} (key, name, logo)
                VALUES ($1, $2, $3)
                ON CONFLICT (key) DO UPDATE SET
                    name = manufacturers.name || excluded.name,
                    logo = excluded.logo;
            `, [normalized, JSON.stringify({ [this.locale]: key }), logo]);
        }

        return normalized;
    }

    async checkAndGetManufacturer(key: string, logo: string): Promise<string> {
        const normalized = transliterate(key).toLowerCase();
        const cacheKey = `${normalized}_${this.locale}`;

        if (manufacturersCache.has(cacheKey)) {
            return await manufacturersCache.get(cacheKey);
        }

        const promise = this.queryManufacturer(key, logo);
        manufacturersCache.set(cacheKey, promise);

        return await promise;
    }

    unmarshalHsnTsn(raw: string) {
        return raw.split(',').map((row: string) => {
            const hsntsn = row
                .split(' ');
            return hsntsn;
        });
    }

    async unmarshalVehicle(raw: IImportFitment): Promise<IVehicle> {
        const kwToPsKoeff = 1.35962;
        return {
            id: raw.vehicleId,
            hsntsn: this.unmarshalHsnTsn(raw.hsntsn),
            code: MapService.generateCodeByModelName(raw.model),
            countries: [this.country],
            tpms: SapService.unmarshalBoolean(raw.pressureMonitoringSystem),
            manufacturer: await this.checkAndGetManufacturer(raw.manufacturer, raw.imageName),
            platform: raw.platform,
            startBuildYear: raw.startBuildYear,
            startBuildMonth: raw.startBuildMonth,
            endBuildYear: raw.endBuildYear,
            endBuildMonth: raw.endBuildMonth,
            segmentId: await this.getDictionaryKey(DictionaryTables.SEGMENT, raw.segment),
            fuelId: await this.getDictionaryKey(DictionaryTables.FUEL, raw.fuel),
            volume: raw.hubraum,
            engineDescription: {
                [this.locale]: raw.engineDescription,
            },
            engineSizeKw: raw.engineSizeKW,
            engineSizePs: Number.parseInt((raw.engineSizeKW! * kwToPsKoeff).toFixed(0), 10),
            formatId: await this.getDictionaryKey(DictionaryTables.FORMAT, raw.format),
            maxSpeed: raw.maxSpeed,
            weight: raw.weight,
            axleLoad: {
                front: raw.axleLoadFront,
                rear: raw.axleLoadRear,
            },
        };
    }

    @Injectable()
    async getDictionaryKey(
        type: DictionaryTables,
        name: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
        @Inject('LogService') log?: Logger,
    ) {
        const { rows } = await db!.query(`
        SELECT key from ${type} WHERE lower(value->>'${this.locale}') = lower($1)
        `, [name]);

        if (rows.length === 0) {
            log!.warn(`Unsupported locale: ${this.locale} or dictionary value: ${name} for ${type} table`);
            return null;
        }

        return rows[0].key;
    }

    static unmarshalFitment(raw: IImportFitment): IFitment {
        const frontLoadIndex = MapService.getLoadIndexes(raw.frontLoadIndex);
        const rearLoadIndex = MapService.getLoadIndexes(raw.rearLoadIndex);
        return {
            id: raw.fitment,
            vehicleId: raw.vehicleId,
            highwayPressure: {
                front: raw.highwayPressureFront,
                rear: raw.highwayPressureRear,
            },
            normalPressure: {
                front: raw.normalPressureFront,
                rear: raw.normalPressureRear,
            },
            dimensions: {
                mixedFitment: !MapService.fitmentsEqual(raw),
                front: {
                    ...MapService.getWidthInDimensions(raw.frontWidth),
                    rim: raw.frontRim,
                    loadIndex: frontLoadIndex.loadIndex,
                    loadIndex2: frontLoadIndex.loadIndex2,
                    speedIndex: raw.frontSpeedIndex,
                    aspectRatio: raw.frontHeight,
                },
                rear: {
                    ...MapService.getWidthInDimensions(raw.rearWidth),
                    rim: raw.rearRim,
                    loadIndex: rearLoadIndex.loadIndex,
                    loadIndex2: rearLoadIndex.loadIndex2,
                    aspectRatio: raw.rearHeight,
                    speedIndex: raw.rearSpeedIndex,
                },
            },
        };
    }

    static fitmentsEqual(raw: IImportFitment): boolean {
        return raw.frontHeight === raw.rearHeight &&
            raw.frontWidth === raw.rearWidth &&
            raw.frontLoadIndex === raw.rearLoadIndex &&
            raw.frontSpeedIndex === raw.rearSpeedIndex &&
            raw.frontRim === raw.rearRim;
    }

    static getWidthInDimensions(width: number) {
        if (width < 75) {
            return {
                widthInch: width,
            };
        }
        return {
            widthMM: width,
        };
    }

    static getLoadIndexes(loadIndexes: string = '') {
        const [loadIndex = '', loadIndex2 = ''] = loadIndexes.split('/');
        return {
            loadIndex: loadIndex ? Number.parseInt(loadIndex, 10) : undefined,
            loadIndex2: loadIndex2 ? Number.parseInt(loadIndex2, 10) : undefined,
        };
    }

    static generateCodeByModelName(modelName: string): string {
        return modelName.toLowerCase().replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/ig, '_');
    }

    static mapTableData(data: string[]): IImportFitment {
        return fitmentConfiguration.reduce((result: IImportFitment, { target, format }, key: number) => {
            result[target] = format(data[key]);
            return result;
        }, {} as IImportFitment);
    }
}
