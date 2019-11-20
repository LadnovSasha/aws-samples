import { Injectable, Inject } from 'lambda-core';
import * as squel from 'squel';
import { PoolClient } from 'pg';
import {
    IManufacturersResponse, IFitmentResponse, IVehicleFitmentsResponse,
    IFitmentsResponse, IHsnTsn,
    IVehicleByMakeQueryRequest,
} from 'fitment-interface';
import { IVehicleRaw } from './fitment.service.interface';
const omit = require('lodash.omit');

export class FitmentService {
    static fallbackLocale = 'de_de';

    protected vehiclesTable = 'vehicles';
    protected squel = squel.useFlavour('postgres');

    @Injectable()
    async getManufacturers(
        country: string,
        language?: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<IManufacturersResponse> {
        const locale = language || FitmentService.fallbackLocale;
        const { rows } = await db!.query(`
            Select
                key as id, COALESCE(name->'${locale}', name->'${FitmentService.fallbackLocale}') as name, logo as "logoUrl"
            FROM manufacturers ORDER BY name ASC;
        `);

        return rows;
    }

    @Injectable()
    async getVehiclesByHsnTsn(
        country: string,
        hsntsn: IHsnTsn,
        language?: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<IVehicleFitmentsResponse[]> {
        const locale = this.buildLocale(country, language);
        const hsntsnValue = [hsntsn.hsn, hsntsn.tsn].join(',');
        const { text, values } = this.getBaseVehicleRequest(locale, country)
            .where('? = ANY (v.hsntsn)', hsntsnValue).toParam();

        const { rows } = await db!.query<IVehicleRaw>(text, values);
        const promises = rows.map(async vehicle =>
            FitmentService.unmarshalVehicleResponse(
                vehicle,
                await this.getFitmentsByVehicle(vehicle.id),
            ),
        );

        return await Promise.all(promises);
    }

    @Injectable()
    async getVehiclesByMake(
        country: string,
        makeId: string,
        query: IVehicleByMakeQueryRequest,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<IVehicleFitmentsResponse[]> {
        const locale = this.buildLocale(country, query.language);
        const sqlQuery = this.getBaseVehicleRequest(locale, country)
            .where('v.manufacturer = ?', makeId);

        if (query.model) {
            sqlQuery.where('v.model = ?', query.model);
        }
        if (query.energyType) {
            sqlQuery.where('v."fuelId" = ?', query.energyType);
        }
        if (query.year) {
            sqlQuery.where('v."startBuildYear" = ?', query.year);
        }

        const { text, values } = sqlQuery.toParam();
        const { rows } = await db!.query<IVehicleRaw>(text, values);
        const includeFitments = query.model || query.year || query.energyType;
        const promises = rows.map(async vehicle =>
            FitmentService.unmarshalVehicleResponse(
                vehicle,
                includeFitments ? await this.getFitmentsByVehicle(vehicle.id) : [],
            ),
        );

        return await Promise.all(promises);
    }

    @Injectable()
    async getVehicleById(
        country: string,
        vehicleId: string,
        language?: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<IVehicleFitmentsResponse | undefined> {
        const locale = language || FitmentService.fallbackLocale;
        const { text, values } = this.getBaseVehicleRequest(locale, country)
            .where('v.id = ?', vehicleId).toParam();
        const { rows } = await db!.query<IVehicleRaw>(text, values);

        if (rows.length === 0) {
            return;
        }
        const fitments = await this.getFitmentsByVehicle(vehicleId);
        return FitmentService.unmarshalVehicleResponse(rows[0], fitments);
    }

    protected getBaseVehicleRequest(locale: string, country: string) {
        return this.squel.select()
            .field('v.id', 'id')
            .field('model')
            .field(`
            json_build_object('id', m.key, 'name', COALESCE(m.name->>'${locale}', m.name->>'${FitmentService.fallbackLocale}'), 'logo', m.logo, 'description', '')
            `, 'manufacturer')
            .field('platform')
            .field('hsntsn', '"hsntsnRaw"')
            .field('tpms')
            .field(`COALESCE(st.value->>'${locale}', st.value->>'${FitmentService.fallbackLocale}')`, 'segment')
            .field(`COALESCE(ft.value->>'${locale}', ft.value->>'${FitmentService.fallbackLocale}')`, 'bodyCategory')
            .field(`json_build_object('month', "startBuildMonth"::text, 'year', "startBuildYear"::text)`, 'from')
            .field(`json_build_object('month', "endBuildMonth"::text, 'year', "endBuildYear"::text)`, 'to')
            .field(`json_build_object(
                'id', fuelt.key,
                'name', COALESCE(fuelt.value->>'${locale}', fuelt.value->>'${FitmentService.fallbackLocale}')
            )`, 'energyType')
            .field(`
            json_build_object(
                'cubicCapacity', volume::text,
                'description', COALESCE("engineDescription"->>'${locale}', "engineDescription"->>'${FitmentService.fallbackLocale}'),
                'size', json_build_object('kw', "engineSizeKw"::text, 'ps', "engineSizePs"::text)
            )`, 'engine')
            .field('"maxSpeed"', '"maxSpeedKm"')
            .field('weight::text', 'weight')
            .field('"axleLoad"')
            .from(this.vehiclesTable, 'v')
            .where('? = ANY (v.countries)', country)
            .left_join('manufacturers', 'm', 'manufacturer = m.key')
            .left_join('segmenttypes', 'st', '"segmentId" = st.key')
            .left_join('formattypes', 'ft', '"formatId" = ft.key')
            .left_join('fueltypes', 'fuelt', '"fuelId" = fuelt.key');
    }

    @Injectable()
    protected async getFitmentsByVehicle(
        vehicleId: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const { rows } = await db!.query(`
        Select
            json_build_object(
                'sizeMM', COALESCE((dimensions->'front'->'widthMM')::text, ''),
                'sizeInch', COALESCE((dimensions->'front'->'widthInch')::text, ''),
                'aspectRatio', COALESCE((dimensions->'front'->'aspectRatio')::text, ''),
                'rim', COALESCE((dimensions->'front'->'rim')::text, ''),
                'speedIndex', COALESCE(dimensions->'front'->>'speedIndex', ''),
                'loadIndex', COALESCE((dimensions->'front'->'loadIndex')::text, ''),
                'loadIndex2', COALESCE((dimensions->'front'->'loadIndex2')::text, ''),
                'normalPressure', "normalPressure"->'front',
                'highwayPressure', "highwayPressure"->'front'
            ) as "frontDimension",
            json_build_object(
                'sizeMM', COALESCE((dimensions->'rear'->'widthMM')::text, ''),
                'sizeInch', COALESCE((dimensions->'rear'->'widthInch')::text, ''),
                'aspectRatio', COALESCE((dimensions->'rear'->'aspectRatio')::text, ''),
                'rim', COALESCE((dimensions->'rear'->'rim')::text, ''),
                'speedIndex', COALESCE(dimensions->'rear'->>'speedIndex', ''),
                'loadIndex', COALESCE((dimensions->'rear'->'loadIndex')::text, ''),
                'loadIndex2', COALESCE((dimensions->'rear'->'loadIndex2')::text, ''),
                'normalPressure', "normalPressure"->'rear',
                'highwayPressure', "highwayPressure"->'rear'
            ) as "rearDimension"
        FROM fitments WHERE "vehicleId" = $1;
        `, [vehicleId]);

        return FitmentService.unmarshalFitments(rows);
    }

    protected buildLocale(country: string, language?: string) {
        return `${country}_${language}`;
    }

    static unmarshalFitments(fitments: IFitmentResponse[]): IFitmentResponse[] {
        return fitments.map((fitment) => {
            const { frontDimension, rearDimension } = fitment;
            const equal = frontDimension.sizeMM === rearDimension.sizeMM &&
                frontDimension.sizeInch === rearDimension.sizeInch &&
                frontDimension.rim === rearDimension.rim &&
                frontDimension.aspectRatio === rearDimension.aspectRatio &&
                frontDimension.speedIndex === rearDimension.speedIndex &&
                frontDimension.loadIndex === rearDimension.loadIndex;

            return {
                frontDimension,
                rearDimension,
                mixedFitment: !equal,
            };
        });
    }

    static unmarshalVehicleResponse(vehicle: IVehicleRaw, fitments: IFitmentsResponse): IVehicleFitmentsResponse {
        return {
            ...omit(vehicle, ['maxSpeedKm', 'hsntsnRaw']),
            fitments,
            hsntsn: vehicle.hsntsnRaw.map((hsntsn: string) => {
                const [hsn, tsn] = hsntsn.split(',');
                return { hsn, tsn };
            }),
            maxSpeed: {
                km: vehicle.maxSpeedKm,
                mph: Number.parseFloat(
                    (vehicle.maxSpeedKm * 0.621371).toFixed(2),
                ),
            },
        };
    }

    static async getInstance() {
        return new FitmentService();
    }
}
