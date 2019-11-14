module.exports = {
    up(migration) {
        return migration.sequelize.query('ALTER TABLE vehicles ADD COLUMN tpms boolean;');
    },
    down(migration) {
        return migration.sequelize.query('ALTER TABLE vehicles DROP COLUMN tpms;');
     }
}
