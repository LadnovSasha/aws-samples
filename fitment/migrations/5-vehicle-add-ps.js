module.exports = {
    up(migration) {
        return migration.sequelize.query('ALTER TABLE vehicles ADD COLUMN "engineSizePs" INTEGER;');
    },
    down(migration) {
        return migration.sequelize.query('ALTER TABLE vehicles DROP COLUMN "engineSizePs";');
     }
}
