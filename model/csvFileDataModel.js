const { DataTypes, Sequelize } = require('sequelize');
const {sq} = require("../config/dbConnect"); // Import the Sequelize instance

const csvFile = sq.define("csvFile", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    // userId: {
    //     type: DataTypes.INTEGER,
    //     primaryKey: true,
    // },
    sellerName: {
        type: DataTypes.STRING,
        allowNull: true, // Allow null values
    },
    shop: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    csvFileData: {
        type: DataTypes.JSON, // Use TEXT to store CSV data as text
    },
    defaultSetting:{
        type: DataTypes.STRING,
        allowNull: true, // Allow null values
    },
    allExcels: {
        type: DataTypes.STRING,
        allowNull: true, // Allow null values
    },
    productTags: {
         type: DataTypes.ARRAY(DataTypes.STRING),
        // type: DataTypes.STRING,
    },
    skus:{
        type: DataTypes.STRING,
    },
    continueSell: {
        type: Sequelize.ENUM('CONTINUE', 'DENY'), // Use string values for the ENUM
        allowNull: true, // Allow null values
    },
    locations: {
        type: DataTypes.STRING,
    },
    bufferQqantity: {
        type: DataTypes.STRING,
        primaryKey: true, // Use string values for the ENUM
    },

    fileHeaders:{
        type: DataTypes.STRING,
        primaryKey: true,
    },

    shopifyInventoryHeaders:{
        type: DataTypes.STRING,
        primaryKey: true,
    },

    
    fileInventoryHeaders:{
        type: DataTypes.STRING,
        allowNull: true,
    },

    shopifyQqantityInventoryHeaders:{
        type: DataTypes.STRING,
        allowNull: true,
    },




    expireDate: {
        type: Sequelize.DATE,
    }
}, {
    tableName: "csvFile",
});

// Check if the table/model already exists
csvFile.sync()
  .then(() => {
    console.log('CSV Model synced');
  })
  .catch((error) => {
    console.error('Error syncing CSV Model:', error);
  });

  JSON.stringify

module.exports = csvFile;
