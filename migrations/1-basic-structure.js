module.exports = {
    up(migration) {
        return migration.sequelize.query(`
        CREATE TABLE brands (
            key varchar(10) PRIMARY KEY,
            value varchar(255)
        );
    `).then(() => migration.sequelize.query(`
        CREATE TABLE designs (
            key varchar(10) PRIMARY KEY,
            value varchar(255)
        );
    `)).then(() => migration.sequelize.query(`
        CREATE TABLE manufacturers (
            key varchar(50) PRIMARY KEY,
            name jsonb,
            logo varchar(50)
        );
    `)).then(() => migration.sequelize.query(`
        CREATE TABLE tires (
            matnr varchar(20) PRIMARY KEY,
            brand varchar(10) REFERENCES brands (key) ON UPDATE CASCADE,
            design varchar(10) REFERENCES designs (key) ON UPDATE CASCADE,
            "widthMM" INTEGER,
            "widthInch" DECIMAL(10,1),
            "aspectRation" INTEGER,
            rim INTEGER,
            "speedIndex" varchar(10),
            "loadIndex" INTEGER,
            "loadIndex2" INTEGER
        );
    `)).then(() => migration.sequelize.query(`
        CREATE TYPE wheelPosition AS ENUM ('front', 'rear');
    `)).then(() => migration.sequelize.query(`
        CREATE TABLE vehicles (
            id varchar(50) PRIMARY KEY,
            hsntsn varchar(50),
            countries text[],
            model varchar(50),
            manufacturer varchar(50) REFERENCES manufacturers(key) ON UPDATE CASCADE,
            platform varchar(50),
            "startBuildYear" INTEGER,
            "startBuildMonth" INTEGER,
            "endBuildYear" INTEGER,
            "endBuildMonth" INTEGER,
            fuel jsonb,
            volume INTEGER,
            "engineDescription" jsonb,
            "engineSizeKw" INTEGER,
            format jsonb,
            "maxSpeed" INTEGER,
            weight DECIMAL(10, 1),
            "axleLoad" jsonb
        );
    `)).then(() => migration.sequelize.query(`
        CREATE TABLE fitments (
            id varchar(50) PRIMARY KEY,
            "vehicleId" varchar(50) NOT NULL REFERENCES vehicles(id) ON UPDATE CASCADE,
            "highwayPressure" jsonb,
            "normalPressure" jsonb,
            dimensions jsonb
        );
    `)).then(() => migration.sequelize.query(`
        CREATE TABLE originaltires (
            matnr varchar(20) REFERENCES tires(matnr) ON UPDATE CASCADE,
            position wheelPosition,
            fitment varchar(50) NOT NULL REFERENCES fitments(id) ON UPDATE CASCADE,
            PRIMARY KEY (matnr, position, fitment)
        );
    `));
    },
    down(migration) {
       return migration.sequelize
           .query(`DROP TABLE originaltires;`)
           .then(() => migration.sequelize.query(`DROP TABLE fitments;`))
           .then(() => migration.sequelize.query(`DROP TABLE vehicles;`))
           .then(() => migration.sequelize.query(`DROP TABLE tires;`))
           .then(() => migration.sequelize.query(`DROP TABLE brands;`))
           .then(() => migration.sequelize.query(`DROP TABLE designs;`))
           .then(() => migration.sequelize.query(`DROP TABLE manufacturers;`))
           .then(() => migration.sequelize.query(`DROP TYPE wheelposition;`));
    }
};
