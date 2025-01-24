const User = require("../model/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Error } = require("sequelize");
// const defaultSettingModel = require("../model/defaultSettingModel")

class AuthController {
  authCheck = async (req, res) => {
    const authcookie = req.cookies.jwt;
    console.log("authcookieauthcookieauthcookie", authcookie);
    let data = {};

    if (!authcookie) {
      data = {
        error: true,
        message: "Cookie Expired",
      };
      console.log("data: line 17, ", data);
      res.status(401).send(data);
    }
    console.log("cookie: ", req.cookies.jwt);
    // console.log('request: ', req)
    // console.log('Response: ', res)

    //verify token which is in cookie value
    jwt.verify(authcookie, process.env.AUTH_KEY_SEC, async (err, res2) => {
      if (err) {
        return res.status(500);
      } else if (res2) {
        console.log("res:================ ", res2);
        if (!res2) {
          var checkUser = await User.findOne({
            where: {
              id: res2?.id,
            },
          });
        } else {
          if (res2 && res2.id) {
            var checkUser = await User.findOne({
              where: {
                id: res2.id,
              },
            });

            if (checkUser) {
              data = {
                error: false,
                message: "Success",
                user: res2.id,
                accessToken: checkUser.accessToken,
                shop: checkUser.shop,
                charge_id:checkUser.charge_id,
              };
            } else {
              data = {
                error: true,
                message: "User not found",
              };
            }
          } else {
            data = {
              error: true,
              message: "Invalid user ID",
            };
          }

          console.log("res:res: res: ", data);
          return res.status(200).send(data);
        }

        // next()
      } else {
        console.log(res2);
        res.status(500).send("something fishi");
      }
    });
  };

  signup = async (req, res) => {
    try {
      const { username, password, storeName, phoneNumber, email } = req.body;
      let data = {};
      const form_data = {
        username,
        storeName,
        email,
        password: await bcrypt.hash(password, 10),
        phoneNumber,
      };

      console.log("form_dataform_data", form_data);

      const checkUser = await User.findOne({
        where: {
          shop: storeName,
        },
      });

      console.log("checkUsercheckUsercheckUser", checkUser);

      if (!checkUser) {
        const user = await User.create({
          shop: form_data.storeName,
          fullName: form_data.username,
          email: form_data.email,
          password: form_data.password,
          phoneNumber: form_data.phoneNumber,
        });

        if (user) {
          let token = jwt.sign({ id: user.id }, process.env.AUTH_KEY_SEC, {
            expiresIn: 1 * 24 * 60 * 60 * 1000,
          });

          // res.cookie("jwt", token, { maxAge: 1 * 24 * 60 * 60, httpOnly: true });
          res.cookie("jwt", token);

          // res.cookie("jwt", token, { maxAge: 1 * 24 * 60 * 60, httpOnly: true })

          res.cookie("jwt", token);

          console.log("user", JSON.stringify(user, null, 2));
          console.log(token);

          //send users details
          data = {
            error: false,
            message: "Success",
            user: user.id,
          };
          res.status(201).send(data);
        } else {
          data = {
            error: true,
            message: "Signup Failed",
            user: user.id,
          };
          res.status(409).send(data);
        }
      } else {
        // saving the user
        const user = await User.update(
          {
            password: form_data.password,
          },
          {
            where: {
              shop: storeName,
            },
          }
        );

        if (user) {
          let token = jwt.sign({ id: user.id }, process.env.AUTH_KEY_SEC, {
            expiresIn: 1 * 24 * 60 * 60 * 1000,
          });

          // res.cookie("jwt", token, { maxAge: 1 * 24 * 60 * 60, httpOnly: true });
          res.cookie("jwt", token);

          // res.cookie("jwt", token, { maxAge: 1 * 24 * 60 * 60, httpOnly: true })

          res.cookie("jwt", token);

          console.log("user", JSON.stringify(user, null, 2));
          console.log(token);

          //send users details
          data = {
            error: false,
            message: "Success",
            user: user.id,
          };
          res.status(201).send(data);
        } else {
          data = {
            error: true,
            message: "Signup Failed",
            user: user.id,
          };
          res.status(409).send(data);
        }
      }

      // console.log("userrrrrrrrr", user);
    } catch (error) {
      console.log(error);
      res.status(500).send(error);
    }
  };

  login = async (req, res) => {
    try {
      let data = {};
      const authcookie = req.cookies.jwt;
      console.log("check cookie: ", authcookie);
      if (authcookie) {
        res.writeHead(200, { Location: "/" });
        res.end();
      }

      const { email, password } = req.body;
      console.log("Form Data loginnnnnnnnnnnnnnnnnnnnnnn", req.body);
      //find a user by their email
      const user = await User.findOne({
        where: {
          email: email,
        },
      });

      console.log("`useruseruseruser`", user);

      //if user email is found, compare password with bcrypt
      if (user) {
        console.log("User:-----------", user);

        if (user.password == null) {
          return res.status(401).send(
            (data = {
              error: true,
              message: "Please signup to create password",
            })
          );
        }

        const isSame = await bcrypt.compare(password, user.password);

        //if password is the same
        //generate token with the user's id and the secretKey in the env file

        if (isSame) {
          let token = jwt.sign({ id: user.id }, process.env.AUTH_KEY_SEC, {
            expiresIn: 7 * 24 * 60 * 60 * 1000,
          });

          //if password matches wit the one in the database
          //go ahead and generate a cookie for the user
          // res.cookie("jwt", token, {
          //   maxAge: 7 * 24 * 60 * 60 * 1000,
          //   httpOnly: true,
          // });
          res.cookie("jwt", token);

          console.log("user", JSON.stringify(user, null, 2));
          console.log(token);
          //send user data
          data = {
            error: false,
            message: "Authentication successful",
            user: user.email,
            token: token,
            accessToken: user.accessToken,
          };

          return res.status(200).send(data);
        } else {
          data = {
            error: true,
            message: "Authentication Failed",
            user: email,
          };

          return res.status(200).send(data);
          // res.status(401).send("Authentication failed");
        }
      } else {
        data = {
          error: true,
          message: "Authentication Failed",
          user: email,
        };

        return res.status(200).send(data);
      }
    } catch (error) {
      console.log(error);
      res.status(401).send(error);
    }
  };

  logout = async (req, res) => {
    return res
      .clearCookie("jwt")
      .status(200)
      .json({ message: "Successfully logged out 😏 🍀" });
  };
}

const authController = new AuthController();

module.exports = authController;
