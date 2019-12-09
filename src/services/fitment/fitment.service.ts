import { Injectable, Inject } from 'lambda-core';
import * as squel from 'squel';
import { PoolClient } from 'pg';
import {
    IManufacturersResponse, IVehicleFitmentsResponse,
    IHsnTsn,
    IVehicleByMakeQueryRequest,
    IVehicleCodesByMakeQueryRequest,
} from 'fitment-interface';
import { IVehicleRaw, IVehicleFitmentsRaw } from './fitment.service.interface';
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
        const baseQuery = this.getBaseVehicleRequest(locale, country);
        const { text, values } = this.getFitmentsRequest(baseQuery)
            .where('? = ANY (v.hsntsn)', hsntsnValue).toParam();

        const { rows } = await db!.query<IVehicleFitmentsRaw>(text, values);

        return rows.map(vehicle =>
            FitmentService.unmarshalVehicleResponse(vehicle),
        );
    }

    @Injectable()
    async getVehicleCodesByMake(
        country: string,
        make: string,
        query?: IVehicleCodesByMakeQueryRequest,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {

        const locale = query && query?.language
            ? this.buildLocale(country, query?.language)
            : FitmentService.fallbackLocale;

        const sqlQuery = this.squel.select()
            .field('distinct code')
            .field(`m.value->>'${locale}'`, 'model')
            .from(this.vehiclesTable, 'v')
            .left_join('modeltypes', 'm', 'code = m.key')
            .where('? = ANY (v.countries)', country)
            .where('v.manufacturer = ?', make);

        if (query?.energyType) {
            sqlQuery.where('v."fuelId" = ?', query.energyType);
        }

        if (query?.year) {
            sqlQuery.where('v."startBuildYear" = ?', query.year);
        }

        const { text, values } = sqlQuery.toParam();
        const { rows } = await db!.query<{code: string, model: string}>(text, values);
        return rows;
    }

    @Injectable()
    async getVehiclesByMake(
        country: string,
        makeId: string,
        model: string,
        query: IVehicleByMakeQueryRequest,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<IVehicleFitmentsResponse[]> {
        const locale = this.buildLocale(country, query.language);
        const sqlQuery = this.getBaseVehicleRequest(locale, country)
            .where('v.manufacturer = ?', makeId)
            .where('v.code = ?', model);

        if (query.energyType) {
            sqlQuery.where('v."fuelId" = ?', query.energyType);
        }
        if (query.year) {
            sqlQuery.where('v."startBuildYear" = ?', query.year);
        }

        const includeFitments = model || query.year || query.energyType;
        const { text, values } = includeFitments ? this.getFitmentsRequest(sqlQuery).toParam() : sqlQuery.toParam();
        const { rows } = await db!.query<IVehicleFitmentsRaw | IVehicleRaw>(text, values);

        return rows.map(
            vehicle => FitmentService.unmarshalVehicleResponse(vehicle),
        );
    }

    @Injectable()
    async getVehicleById(
        country: string,
        vehicleId: string,
        language?: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ): Promise<IVehicleFitmentsResponse | undefined> {
        const locale = language || FitmentService.fallbackLocale;
        const baseQuery = this.getBaseVehicleRequest(locale, country);
        const { text, values } = this.getFitmentsRequest(baseQuery)
            .where('v.id = ?', vehicleId).toParam();
        const { rows } = await db!.query<IVehicleFitmentsRaw>(text, values);

        if (rows.length === 0) {
            return;
        }
        return FitmentService.unmarshalVehicleResponse(rows[0]);
    }

    protected getBaseVehicleRequest(locale: string, country: string) {
        return this.squel.select()
            .field('v.id', 'id')
            .field(`COALESCE(mt.value->>'${locale}', mt.value->>'${FitmentService.fallbackLocale}')`, 'model')
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
            .left_join('fueltypes', 'fuelt', '"fuelId" = fuelt.key')
            .left_join('modeltypes', 'mt', 'v.code = mt.key');
    }

    protected getFitmentsRequest(squel: squel.PostgresSelect) {
        return squel
            .field(`
            json_agg(
                json_build_object(
                    'mixedFitment', fitments.dimensions->'mixedFitment',
                    'frontDimension', json_build_object(
                        'sizeMM', COALESCE((fitments.dimensions->'front'->'widthMM')::text, ''),
                        'sizeInch', COALESCE((fitments.dimensions->'front'->'widthInch')::text, ''),
                        'aspectRatio', COALESCE((fitments.dimensions->'front'->'aspectRatio')::text, ''),
                        'rim', COALESCE((fitments.dimensions->'front'->'rim')::text, ''),
                        'speedIndex', COALESCE(fitments.dimensions->'front'->>'speedIndex', ''),
                        'loadIndex', COALESCE((fitments.dimensions->'front'->'loadIndex')::text, ''),
                        'loadIndex2', COALESCE((fitments.dimensions->'front'->'loadIndex2')::text, ''),
                        'normalPressure', fitments."normalPressure"->'front',
                        'highwayPressure', fitments."highwayPressure"->'front'
                    ),
                    'rearDimension', json_build_object(
                        'sizeMM', COALESCE((fitments.dimensions->'rear'->'widthMM')::text, ''),
                        'sizeInch', COALESCE((fitments.dimensions->'rear'->'widthInch')::text, ''),
                        'aspectRatio', COALESCE((fitments.dimensions->'rear'->'aspectRatio')::text, ''),
                        'rim', COALESCE((fitments.dimensions->'rear'->'rim')::text, ''),
                        'speedIndex', COALESCE(fitments.dimensions->'rear'->>'speedIndex', ''),
                        'loadIndex', COALESCE((fitments.dimensions->'rear'->'loadIndex')::text, ''),
                        'loadIndex2', COALESCE((fitments.dimensions->'rear'->'loadIndex2')::text, ''),
                        'normalPressure', fitments."normalPressure"->'rear',
                        'highwayPressure', fitments."highwayPressure"->'rear'
                    )
                )
            )`, 'fitments')
            .left_join('fitments', 'fitments', 'v.id = fitments."vehicleId"')
            .group('v.id')
            .group('m.key')
            .group('st.key')
            .group('ft.key')
            .group('fuelt.key')
            .group('mt.key');
    }

    protected buildLocale(country: string, language?: string) {
        return `${country}_${language}`;
    }

    static unmarshalVehicleResponse(vehicle: IVehicleFitmentsRaw): IVehicleFitmentsResponse {
        return {
            ...omit(vehicle, ['maxSpeedKm', 'hsntsnRaw']),
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
