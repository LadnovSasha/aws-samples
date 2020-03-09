module.exports = {
    up(migration) {
        return migration.sequelize.query(`
        ALTER TABLE vehicles DROP COLUMN model,
                             DROP COLUMN code;
        `)
        .then(() => migration.sequelize.query(`CREATE TABLE modeltypes (
            key varchar(50) PRIMARY KEY,
            value jsonb,
            "vehicleId" text[]
        );`))
        .then(() => migration.sequelize.query(`ALTER TABLE vehicles ADD COLUMN code varchar(50) REFERENCES modeltypes (key) ON UPDATE CASCADE`));
    },
    down(migration) {
        return migration.sequelize.query('DROP TABLE IF EXISTS modeltypes CASCADE;')
        .then(() => migration.sequelize.query(`ALTER TABLE vehicles DROP COLUMN code;`))
        .then(() => migration.sequelize.query(`
        ALTER TABLE vehicles ADD COLUMN model varchar(50),
                             ADD COLUMN code varchar(50);
        `));
    }
}
