import { Injectable, Inject } from 'lambda-core';
import { PoolClient } from 'pg';

const countryToLocaleMap = new Map([
    ['de', 'de_de'],
]);

export class FitmentService {
    static fallbackLocale = 'de_de';

    @Injectable()
    async getManufacturers(
        country: string,
        @Inject('PG', { connectionString: process.env.DATABASE_URL }) db?: PoolClient,
    ) {
        const locale = this.getLocaleFromCountry(country);
        const { rows } = await db!.query(`
            Select
                key as id, name->'$1' as name, logo as "logoUrl"
            FROM manufacturers;
        `, [locale]);

        return rows;
    }

    protected getLocaleFromCountry(country: string) {
        const locale = countryToLocaleMap.get(country);

        return locale || FitmentService.fallbackLocale;
    }

    static async getInstance() {
        return new FitmentService();
    }
}
