const { DataTypes, Sequelize } = require('sequelize');
const {sq} = require("../config/dbConnect");

const DefaultSetting = sq.define("defaultSetting", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    // userId: {
    //     type: DataTypes.INTEGER,
    //     primaryKey: true,
    // },
    // sellerName: {
    //     type: DataTypes.STRING,
    //     allowNull: true, // Allow null values
    // },
    shop: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    // defaultSetting:{
    //     type: DataTypes.STRING,
    //     allowNull: true, // Allow null values
    // },
    // allExcels: {
    //     type: DataTypes.STRING,
    //     allowNull: true, // Allow null values
    // },
    // productTags: {
    //      type: DataTypes.ARRAY(DataTypes.STRING),
    //     // type: DataTypes.STRING,
    // },
    // skus:{
    //     type: DataTypes.STRING,
    // },
    continueSell: {
        type: Sequelize.ENUM('CONTINUE', 'DENY'), // Use string values for the ENUM
    },
    locations: {
        type: DataTypes.STRING,
    },
    bufferQqantity: {
        //type: Sequelize.ENUM('true', 'false'), // Use string values for the ENUM
        type: DataTypes.STRING
    },
    expireDate: {
        type: Sequelize.DATE,
    }
}, {
    tableName: "defaultSetting",
});

// Check if the table/model already exists
DefaultSetting.sync()
  .then(() => {
    console.log('DefaultSetting Model synced');
  })
  .catch((error) => {
    console.error('Error syncing DefaultSetting Model:', error);
  });


module.exports = DefaultSetting;
