module.exports = {
    up(migration) {
        return migration.sequelize.query(`
        DROP INDEX idx_vehicles_manufacturer;
        CREATE INDEX idx_vehicles_manufacturer_countries_code ON vehicles (manufacturer, code, countries);
        `);
    },
    down(migration) {
        return migration.sequelize.query(`
        DROP INDEX idx_vehicles_manufacturer_countries_code;
        CREATE INDEX idx_vehicles_manufacturer ON vehicles(manufacturer);
        `);
    }
}
