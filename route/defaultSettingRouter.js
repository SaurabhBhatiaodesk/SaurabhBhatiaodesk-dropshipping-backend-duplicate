const { Router } = require("express")

const defaultSettingRouter = Router();
const defaultSettingController = require("../controller/defaultSettingController")
const multer  = require('multer')
const upload = multer({ dest: 'uploads/' })
const  verifyToken =  require("../middleware/checkAuth")
const {authCheck} =  require("../controller/authController")

// *****************************************************************************************************************//
// fetch Store Location
// *****************************************************************************************************************//

defaultSettingRouter.get("/fetchStoreLocation", verifyToken,   defaultSettingController.fetchStoreLocation)
// *****************************************************************************************************************//
// fetch Shop Tags
// *****************************************************************************************************************//

// *****************************************************************************************************************//
// save Defaut Setting
// *****************************************************************************************************************//

defaultSettingRouter.post("/saveDefautSetting"  ,verifyToken,  defaultSettingController.saveDefautSetting)

// *****************************************************************************************************************//
// fetch Defaut Setting
// *****************************************************************************************************************//

defaultSettingRouter.get("/fetchDefautSetting"  ,verifyToken,  defaultSettingController.fetchDefautSetting)


// *****************************************************************************************************************//
// Add Csv file
// *****************************************************************************************************************//

defaultSettingRouter.post("/addCsvFile",verifyToken,  defaultSettingController.addCsvFile)

// *****************************************************************************************************************//
// Add Csv file
// *****************************************************************************************************************//

defaultSettingRouter.post("/metchShopTags",verifyToken,  defaultSettingController.matchShopTags)


// *****************************************************************************************************************//
// Fetch Csv file
// *****************************************************************************************************************//

defaultSettingRouter.get("/fetchCsvFile",verifyToken,  defaultSettingController.fetchCsvFile)




module.exports = defaultSettingRouter;
