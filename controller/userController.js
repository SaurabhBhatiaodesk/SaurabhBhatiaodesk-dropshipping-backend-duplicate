const userModel = require("../model/userModel");
const defaultSettingModel = require("../model/defaultSettingModel");
const bcrypt = require("bcrypt");
var jwt = require("jsonwebtoken");
class UserController {


  // *****************************************************************************************************************//
  // Use api for  user login
  // *****************************************************************************************************************//

  userLogin = async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const checkEmail = await userModel.findOne({ where: { email } });

      if (!checkEmail) {
        throw new Error("Check your Email and passwords");
      }
      const match = await bcrypt.compare(password, checkEmail.password);
      console.log("matchmatchmatch", match);

      if (!match) {
        throw new Error("Check your Email and password");
      }
      const token = jwt.sign(
        {
          userId: checkEmail.email,
        },
        process.env.SECRETKEY,
        { expiresIn: "4days" }
      );

      return res.status(200).json({
        status: true,
        message: "Login successfuly",
        token: token,
      });
    } catch (err) {
      return res.status(401).json({
        status: false,
        message: err.message,
        stack: err.stack,
      });
    }
  };
}

const userController = new UserController();

module.exports = userController;
