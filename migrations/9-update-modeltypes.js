module.exports = {
    up(migration) {
        return migration.sequelize.query(`
        ALTER TABLE modeltypes DROP COLUMN "vehicleId";
        `);
    },
    down(migration) {
        return migration.sequelize.query(`
        ALTER TABLE modeltypes ADD COLUMN "vehicleId" varchar(50);
        `);
    }
}
