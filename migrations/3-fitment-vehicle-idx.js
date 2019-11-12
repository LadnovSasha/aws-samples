module.exports = {
    up(migration) {
        return migration.sequelize.query('CREATE INDEX idx_fitments_vehicleid ON fitments("vehicleId");');
    },
    down(migration) {
        return migration.sequelize.query('DROP INDEX idx_fitments_vehicleid;');
     }
}
