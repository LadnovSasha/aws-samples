module.exports = {
    up(migration) {
        return migration.sequelize.query('ALTER TABLE vehicles ADD COLUMN code varchar(50);');
    },
    down(migration) {
        return migration.sequelize.query('ALTER TABLE vehicles DROP COLUMN code;');
     }
}
