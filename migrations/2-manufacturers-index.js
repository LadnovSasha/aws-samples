module.exports = {
    up(migration) {
        return migration.sequelize.query('create INDEX idx_vehicles_manufacturer ON vehicles(manufacturer);');
    },
    down(migration) {
        return migration.sequelize.query('DROP INDEX idx_vehicles_manufacturer;');
     }
}
