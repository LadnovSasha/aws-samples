import { IImportFitment, IVehicle, IFitment } from 'fitment-interface';
import { Injectable, Inject } from 'lambda-core';
import { PoolClient } from 'pg';
import { transliterate } from 'transliteration';

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
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<string> {
        const normalized = transliterate(key).toLowerCase();
        const { rows } = await db!.query(`Select key from ${this.manufacturersTable} where key='${normalized}' AND name ? '${this.locale}'`);

        if (!rows.length) {
            await db!.query(`
                INSERT INTO ${this.manufacturersTable} (key, name)
                VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET
                    name = manufacturers.name || $2;

            `, [normalized, JSON.stringify({ [this.locale]: key })]);
        }

        return normalized;
    }

    async checkAndGetManufacturer(key: string): Promise<string> {
        const normalized = transliterate(key).toLowerCase();
        const cacheKey = `${normalized}_${this.locale}`;

        if (manufacturersCache.has(cacheKey)) {
            return await manufacturersCache.get(cacheKey);
        }

        const promise = this.queryManufacturer(key);
        manufacturersCache.set(cacheKey, promise);

        return await promise;
    }

    async unmarshalVehicle(raw: IImportFitment): Promise<IVehicle> {
        return {
            id: raw.vehicleId,
            hsntsn: raw.hsntsn,
            countries: [this.country],
            model: raw.model,
            manufacturer: await this.checkAndGetManufacturer(raw.manufacturer),
            platform: raw.platform,
            startBuildYear: raw.startBuildYear,
            startBuildMonth: raw.startBuildMonth,
            endBuildYear: raw.endBuildYear,
            endBuildMonth: raw.endBuildMonth,
            fuel: {
                [this.locale]: raw.fuel,
            },
            volume: raw.hubraum,
            engineDescription: {
                [this.locale]: raw.engineDescription,
            },
            engineSizeKw: raw.engineSizeKW,
            format: {
                [this.locale]: raw.format,
            },
            maxSpeed: raw.maxSpeed,
            weight: raw.weight,
            axleLoad: {
                front: raw.axleLoadFront,
                rear: raw.axleLoadRear,
            },
        };
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
                front: {
                    ...MapService.getWidthInDimensions(raw.frontWidth),
                    rim: raw.frontRim,
                    loadIndex: frontLoadIndex.loadIndex,
                    loadIndex2: frontLoadIndex.loadIndex2,
                    aspectRatio: raw.frontHeight,
                },
                rear: {
                    ...MapService.getWidthInDimensions(raw.rearWidth),
                    rim: raw.rearRim,
                    loadIndex: rearLoadIndex.loadIndex,
                    loadIndex2: rearLoadIndex.loadIndex2,
                    aspectRatio: raw.rearHeight,
                },
            },
        };
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
}
