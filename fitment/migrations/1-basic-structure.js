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
        CREATE TABLE fuelTypes (
            key varchar(50) PRIMARY KEY,
            value jsonb
        );
    `)).then(() => migration.sequelize.query(`
        CREATE TABLE formatTypes (
            key varchar(50) PRIMARY KEY,
            value jsonb
        );
    `)).then(() => migration.sequelize.query(`
        CREATE TABLE segmentTypes (
            key varchar(50) PRIMARY KEY,
            value jsonb
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
            hsntsn text[],
            countries text[],
            model varchar(50),
            manufacturer varchar(50) REFERENCES manufacturers(key) ON UPDATE CASCADE,
            platform varchar(50),
            "startBuildYear" INTEGER,
            "startBuildMonth" INTEGER,
            "endBuildYear" INTEGER,
            "endBuildMonth" INTEGER,
            "fuelId" varchar(50) REFERENCES fuelTypes(key) ON UPDATE CASCADE,
            "segmentId" varchar(50) REFERENCES segmentTypes(key) ON UPDATE CASCADE,
            volume INTEGER,
            "engineDescription" jsonb,
            "engineSizeKw" INTEGER,
            "formatId" varchar(50) REFERENCES formatTypes(key) ON UPDATE CASCADE,
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
           .query(`DROP TABLE IF EXISTS originaltires;`)
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS fitments;`))
           .then(() => migration.sequelize.query(`DROP TYPE IF EXISTS wheelposition;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS vehicles;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS tires;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS brands;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS designs;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS manufacturers;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS fuelTypes;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS formatTypes;`))
           .then(() => migration.sequelize.query(`DROP TABLE IF EXISTS segmentTypes;`))
           .then(() => migration.sequelize.query(`DROP TYPE IF EXISTS wheelposition;`));
    }
};
