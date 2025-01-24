const {Router} =  require("express")

const userRouter =  Router();

const userController =  require("../controller/userController")
const authController =  require("../controller/authController")

// userRouter.post("/userLogin", userController.userLogin)
// userRouter.post("/userSignup", userController.userSignup)

userRouter.post("/login", authController.login)
userRouter.post("/signup", authController.signup)
userRouter.post("/chklogin", authController.authCheck)
userRouter.post("/logout", authController.logout)


module.exports =  userRouter;