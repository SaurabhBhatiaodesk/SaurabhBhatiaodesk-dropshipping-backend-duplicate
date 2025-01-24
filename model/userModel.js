const { DataTypes } = require('sequelize');
const {sq} = require("../config/dbConnect"); // Import the Sequelize instance

const User = sq.define("user", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    shop: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    fullName: {
        type: DataTypes.STRING,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    phoneNumber:{
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    password: {
        type: DataTypes.STRING,
    },
    accessToken:{
      type:DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type:DataTypes.STRING,
      allowNull: true,
    },
    isInstalled: {
      type:DataTypes.BOOLEAN,
      allowNull: true,
    },
    isOnline: {
      type:DataTypes.BOOLEAN,
      allowNull: true,
    },
    scope: {
      type:DataTypes.STRING,
      allowNull: true,
    },
    expires: {
      type:DataTypes.STRING,
      allowNull: true,
    },
    charge_id: {
      type:DataTypes.STRING,
      allowNull: true,
    },
}, {
    tableName: "user",
});

User.sync()
  .then(() => {
    console.log('User Model synced');
  })
  .catch((error) => {
    console.error('Error syncing DefaultSetting Model:', error);
  });
module.exports = User;
