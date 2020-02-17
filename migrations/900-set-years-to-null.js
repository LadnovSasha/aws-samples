module.exports = {
    up(migration) {
        return migration.sequelize.query(`
        Update vehicles SET "startBuildYear" = null WHERE "startBuildYear" = 0;
        `)
        .then(() => migration.sequelize.query(`Update vehicles SET "endBuildYear" = null WHERE "endBuildYear" = 0;`));
    },
    down(migration) {
        return migration.sequelize.query(`
        Update vehicles SET "startBuildYear" = 0 WHERE "startBuildYear" = null;
        `)
        .then(() => migration.sequelize.query(`Update vehicles SET "endBuildYear" = 0 WHERE "endBuildYear" = null;`));
    }
}
