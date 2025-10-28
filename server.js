const express = require("express");
let app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const userRouter = require("./route/userRoute");
const defaultSettingRouter = require("./route/defaultSettingRouter");
const { sq } = require("./config/dbConnect");
const User = require("./model/userModel");
const cors = require("cors");
const nonce = require("nonce");
const request = require("request-promise");
const querystring = require("querystring");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const cron = require("node-cron");
const csvFileModel = require("./model/csvFileDataModel");

const server = require("http").createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: [process.env.CORS_URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true, // Allow credentials for Socket.IO
  },
});

app.use(cors());

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);
  socket.join("clock-room");

  socket.on("disconnect", (reason) => {
    console.log(reason);
  });
});

app.locals.io = io;

require("@shopify/shopify-api/adapters/node");
const {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod,
} = require("@shopify/shopify-api");

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES,
  hostName: process.env.APP_HOST,
  // webhooks: {
  //   APP_UNINSTALLED: {
  //     deliveryMethod: DeliveryMethod.Http,
  //     callbackUrl: "/api/webhooks",
  //   }
  // }
});

app.post("/api/webhooks", express.text({ type: "*/*" }), async (req, res) => {
  console.log(
    "Webhook Route Called...............................",
    shopify.shop
  );

  try {
    // const sessionId = shopify.session.getOfflineId(domain);
    const { valid, topic, domain, reason } = await shopify.webhooks.validate({
      rawBody: req.body, // is a string
      rawRequest: req,
      rawResponse: res,
    });
    console.log(reason);
    if (!valid) {
      console.error("Invalid webhook call, not handling it");
      // console.log('Body data: ', req.body);
      // console.log('Request Data: ', req);
      return res.status(400).send("Invalid webhook call, not handling it"); // Bad Request
    } else {
      const shop = domain;
      console.log(`Received webhook for ${topic} for shop ${domain}`);

      if (shop) {
        // await User.update(
        //   {
        //     // scope: null,
        //     // accessToken: null,
        //     // state: null,
        //     isInstalled: false,
        //     isOnline: false,
        //   },
        //   {
        //     where: {
        //       shop: domain,
        //     },
        //   }
        // );

        const shops = User.destroy({
          where: { shop: shop },
          truncate: true,
        });

        return res.status(200).send("Webhook received and processed.");
      } else {
        return res.status(404).send("Shop not found.");
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing webhook.");
  }
});

shopify.webhooks.addHandlers({
  APP_UNINSTALLED: [
    {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/api/webhooks",
      // callback: handleWebhookRequest,
    },
  ],
});

app.use(express.json({ limit: "50mb" })); // Increase the payload limit
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

app.use("/api/user", userRouter);

app.get("/auth", async (req, res) => {
  console.log("auth called");
  const shop = req.query.shop;
  console.log(req.query);
  if (shop != "undefined" || shop != "") {
    console.log("installing shop: " + shop);

    const shopInDb = await User.findOne({
      where: { shop: shop },
    });

    console.log("shopInDbshopInDb", shopInDb);

    if (!shopInDb || shopInDb.isInstalled == 0) {
      const state = nonce();
      const redirectUri = process.env.FE_URL + "/callback";
      const installUrl =
        "https://" +
        shop +
        "/admin/oauth/authorize?client_id=" +
        process.env.SHOPIFY_API_KEY +
        "&scope=" +
        process.env.SCOPES +
        "&state=" +
        state() +
        "&redirect_uri=" +
        redirectUri;

      res.cookie("state", state);
      return res.status(201).json({
        status: 201,
        installUrl,
      });
    }

    console.log("-------------------==========================");

    let token = jwt.sign({ id: shopInDb.id }, process.env.AUTH_KEY_SEC, {
      expiresIn: 7 * 24 * 60 * 60 * 1000,
    });

    // res.cookie("jwt", token, {
    //   maxAge: 7 * 24 * 60 * 60 * 1000,
    //   httpOnly: true,
    // });

    res.cookie("jwt", token);

    return res.status(200).json({
      status: 200,
      shop: shopInDb,
    });
  } else {
    return res.status(400).send('Missing "shop" parameter.');
  }
  //  res.status(201).send({ shop: 'not found', action: 'Failed', installUrl });
});

app.get("/api/auth/callback", async (req, res) => {
  console.log("callback calledddddddddddddddddddddddddddddddddddd");
  const { shop, hmac, code, state } = req.query;
  console.log("Query: ", req.query);
  if (shop && hmac) {
    const queryMap = Object.assign({}, req.query);
    delete queryMap["signature"];
    delete queryMap["hmac"];

    const message = querystring.stringify(queryMap);
    const providedHmac = Buffer.from(hmac, "utf-8");
    const generatedHash = Buffer.from(
      crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(message)
        .digest("hex"),
      "utf-8"
    );

    let hashEquals = false;

    try {
      hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac);
    } catch (e) {
      hashEquals = false;
    }

    if (!hashEquals) {
      return res.status(400).send("HMAC validation failed");
    }

    const accessTokenRequestUrl =
      "https://" + shop + "/admin/oauth/access_token";
    const accessTokenPayload = {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    };

    request
      .post(accessTokenRequestUrl, { json: accessTokenPayload })
      .then((accessTokenResponse) => {
        const accessToken = accessTokenResponse.access_token;
        console.log(
          "accessTokenaccessTokenaccessTokenaccessToken",
          accessToken
        );

        const shopRequestURL =
          "https://" + shop + "/admin/api/2023-10/shop.json";
        const shopRequestHeaders = { "X-Shopify-Access-Token": accessToken };

        console.log("Shop Req URL: ", shopRequestURL);
        console.log("Shop Req Header: ", shopRequestHeaders);

        request
          .get(shopRequestURL, { headers: shopRequestHeaders })
          .then(async (response) => {
            const shopResponse = JSON.parse(response).shop;
            console.log("Shop Found: ", JSON.parse(response));
            if (code) shopResponse.code = code;

            shopResponse.accessToken = accessToken;
            shopResponse.isInstalled = 1;

            const shopDetail = await User.findOne({ where: { shop: shop } });

            if (shopDetail == undefined || !shopDetail) {
              console.log("Creating shop");
              // await shopService.createShop(shopResponse);

              var user = await User.create({
                // id: shopResponse.id,
                phoneNumber: "123456788888",
                fullName: shopResponse.shop_owner,
                email: shopResponse.email,
                shop: shopResponse.domain,
                scope: process.env.SCOPES,
                accessToken: accessToken,
                state: state,
                isInstalled: 1,
                isOnline: 1,
              });

              console.log("shop Created...............................");
            } else {
              console.log("Shop details in local db: ", shopDetail);

              if (shopDetail.isInstalled == true) {
                res.writeHead(302, { Location: "/" });
                res.end();
              } else if (shopDetail.isInstalled == false) {
                console.log(
                  "trying to update the shop data...-------------------------"
                );
                //   await shopService.updateShop(shopResponse, shopDetail.id);
                var user = await User.update(
                  {
                    scope: process.env.SCOPES,
                    accessToken: accessToken,
                    state: state,
                    isInstalled: 1,
                    isOnline: 1,
                  },
                  {
                    where: {
                      shop: shopResponse.domain,
                    },
                  }
                );

                console.log("shop data updated");
              }
            }

            const hookRes = await shopify.webhooks.register({
              session: { shop: shopResponse.domain, accessToken: accessToken },
            });
            console.log("Hook Data: ", hookRes);

            if (hookRes && hookRes["APP_UNINSTALLED"]) {
              if (!hookRes["APP_UNINSTALLED"][0].success)
                console.log(
                  `Failed to register PRODUCTS_CREATE webhook: ${hookRes["APP_UNINSTALLED"][0].result}`
                );
              else {
                console.log(
                  "result data: ",
                  hookRes["APP_UNINSTALLED"][0].result
                );
                console.log(
                  "Webhook Registered Successfully ( APP_UNINSTALLED ) "
                );
              }
            } else {
              console.log("Webhook Registered Failed ( APP_UNINSTALLED ) ");
            }

            console.log("user.iduser.iduser.id", user.id);

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

            console.log("ooooooooooooooooooo", req.url);

            res.writeHead(302, { Location: "/" });
            res.end();
          })
          .catch((error) => {
            console.log(error);
            res.status(400).send(error.error);
          });
      })
      .catch((error) => {
        res.status(error.statusCode).send(error.error);
      });
  } else {
    res.status(400).send("Required parameters missing");
  }
});

cron.schedule("* * * * *", async () => {
  console.log("running a task every second");

  async function getAllCsvFiles() {
    let allCsvFilesShops = [];
    let allCsvFilesData = [];
    let userFilteredData = [];
    let matchedVariantIds = [];
    let storeLocationData = [];
    let skuMatchedProducts = [];
    try {
      // let allCsvFilesShops = [];
      // let allCsvFilesData = [];
      // let userFilteredData = [];

      // Using Sequelize's findAll method to get all records from the table
      const usersData = await User.findAll();
      const allCsvFiles = await csvFileModel.findAll();
      allCsvFiles.map((items, index) => {
        const shop = items?.dataValues?.shop;
        const csvFileData = items?.dataValues?.csvFileData;
        const csvExpire = items?.dataValues?.expireDate;
        const csvBufferQuantity = items?.dataValues?.bufferQqantity;

        console.log(`csvBufferQuantity ${index} ::`, csvBufferQuantity)

        // Push shop to allCsvFilesShops array
        allCsvFilesShops.push(shop);

        // Push object with shop and csvFileData to allCsvFilesData array
        allCsvFilesData.push({
          shop: shop,
          csvFileData: csvFileData,
          csvExpire: csvExpire,
          csvBufferQuantity: csvBufferQuantity,
        });
      });

      // user data from user table
      usersData.map((items) => {
        const user = items?.dataValues;

        // Push user to userFilteredData array
        userFilteredData.push(user);
      });
      // console.log("allCsvFilesData ::", allCsvFilesData)

      // Compare currentDate with expireDate for each record
      const currentDate = new Date();

      // Variable to store matched records
      // let matchedRecords = [];
      // let matchedCsvFile = null;
      // let matchedCsvFileShop = null;
      // let targetSkus = [];

      // Extract day, month, and year
      let currentDay = currentDate.getDate();
      let currentMonth = currentDate.getMonth() + 1; // Note: January is 0
      let currentYear = currentDate.getFullYear();

      // Add leading zeros if necessary
      currentDay = currentDay < 10 ? "0" + currentDay : currentDay;
      currentMonth = currentMonth < 10 ? "0" + currentMonth : currentMonth;

      // Format the date
      let currentFormattedDate =
        currentDay + "-" + currentMonth + "-" + currentYear;

      // console.log("formattedDate :", currentFormattedDate);

      allCsvFilesData.forEach((csvFile) => {
        const expireDate = new Date(csvFile.csvExpire);

        // console.log(`csvFile?.csvBufferQuantity ${index} :::`, csvFile?.csvBufferQuantity)

        // Extract day, month, and year
        let expireDay = expireDate.getDate();
        let expireMonth = expireDate.getMonth() + 1; // Note: January is 0
        let expireYear = expireDate.getFullYear();

        // Add leading zeros if necessary
        expireDay = expireDay < 10 ? "0" + expireDay : expireDay;
        expireMonth = expireMonth < 10 ? "0" + expireMonth : expireMonth;

        // Format the date
        let expireFormattedDate =
          expireDay + "-" + expireMonth + "-" + expireYear;

        // Check if currentDate is equal to expireDate
        const isExpireCurrentDataEqual =
          currentFormattedDate === expireFormattedDate;

        // if csv data and current is equal
        if (isExpireCurrentDataEqual) {
          // console.log("isExpireCurrentDataEqual");
          // console.log("csvFile ::", csvFile);

          // if (csvFile?.shop === )
          userFilteredData.forEach((user) => {
            if (csvFile?.shop === user?.shop) {
              // console.log("usersData.forEach if", user?.accessToken);
              // console.log("csvFile if ::", csvFile?.csvFileData);

              csvFile?.csvFileData.forEach(async (sku) => {
                // console.log(sku,'------------------sku------------------????')
                // return true
                // ****************************************************************************************************************************************
                // fetch locations of store starts
                // ****************************************************************************************************************************************
                var myHeaders = new Headers();
                myHeaders.append(
                  "X-Shopify-Access-Token",
                  `${user?.accessToken}`
                );
                myHeaders.append("Content-Type", "application/json");

                var graphql = JSON.stringify({
                  query:
                    "query {\r\n  shop {\r\n    locations(first: 2) {\r\n      edges {\r\n        node {\r\n          name\r\n          id\r\n        }\r\n      }\r\n    }\r\n  }\r\n}\r\n",
                  variables: {},
                });
                var requestOptions = {
                  method: "POST",
                  headers: myHeaders,
                  body: graphql,
                  redirect: "follow",
                };

                await fetch(
                  `https://${csvFile?.shop}/admin/api/2025-10/graphql.json`,
                  requestOptions
                )
                  .then((response) => response.text())
                  .then((result) => {
                    let allLocations = [];
                    storeLocationData.push(JSON.parse(result));
                    console.log(`result?.data?.shop :::`, JSON.parse(result))
                    storeLocationData.forEach(async (data, index) => {
                      console.log(`data?.data?.products?.edges ${index} :::`, data?.data?.products?.edges)
                      const edgesArray =
                        data?.data?.shop?.locations?.edges || [];
                      console.log(`edgesArray ${index} :::`, edgesArray);

                      const item = edgesArray[0];
                      if (item) {
                        const nodeArray = item?.node?.id || [];
                        const locationId = nodeArray;

                        // Print or use the location ID as needed (My Custom Location)
                        // console.log(`locationId :::::`, locationId);
                        // console.log(`nodeArray :::::`, nodeArray);
                        // console.log(`sku?.SKU ${index} :::::`, sku?.SKU);

                        // new code starts
                        // ****************************************************************************************************************************************
                        // fetch products of store starts
                        // ****************************************************************************************************************************************

                        // product with quantity starts
                        var myHeaders = new Headers();
                        myHeaders.append(
                          "X-Shopify-Access-Token",
                          `${user?.accessToken}`
                        );
                        myHeaders.append("Content-Type", "application/json");

                      var graphql = JSON.stringify({
  query: `{
    products(first: 1, query: "sku:${sku?.SKU}}") {
      edges {
        node {
          id
          variants(first: 1) {
            edges {
              node {
                id
                sku
                inventoryQuantity
                inventoryItem {
                  id
                  measurement {
                    weight {
                      value
                      unit
                    }
                  }
                  inventoryLevel(locationId: "${locationId}") {
                    id
                    location {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`,
  variables: {}
});

                        var requestOptions = {
                          method: "POST",
                          headers: myHeaders,
                          body: graphql,
                          redirect: "follow",
                        };

                        await fetch(
                          `https://${csvFile?.shop}/admin/api/2025-10/graphql.json`,
                          requestOptions
                        )
                          .then((response) => response.text())
                          // .then((result) => console.log(result))
                          // .then((result) => console.log("JSON.parse :::", result))

                          .then((result) => {
                            console.log("JSON.parse :::", JSON.parse(result))
                            skuMatchedProducts.push(JSON.parse(result));
                            console.log("skuMatchedProducts :::", skuMatchedProducts)

                            skuMatchedProducts.forEach((data) => {
                              const edgesArray =
                                data?.data?.products?.edges || [];
                              console.log(`edgesArray ${index} :::`, edgesArray);

                              edgesArray.forEach((edge) => {
                                // Check if node and variants exist
                                const nodeArray =
                                  edge?.node?.variants?.edges || [];
                                console.log(`nodeArrayeeee :::`, nodeArray);
                                nodeArray.forEach(async (node, index) => {
                                  console.log(
                                    `node?.node?.id ${index} ::`,
                                    node?.node?.id
                                  );
                                  // const inventoryItemId =
                                  const inventoryItemId =
                                    node?.node?.inventoryItem?.id;
                                  const productVariantId = node?.node?.id;
                                  let productInventoryQuantity =
                                    node?.node?.inventoryQuantity;
                                  // const variantsId = inventoryItem?.node?.id.split("/").pop();
                                  // console.log(
                                  //   `inventoryItemId ${index} ::`,
                                  //   inventoryItemId
                                  // );
                                  // console.log(
                                  //   `productVariantId ${index} ::`,
                                  //   productVariantId
                                  // );
                                  // console.log(
                                  //   `productInventoryQuantity ${index} ::`,
                                  //   productInventoryQuantity
                                  // );
                                  // console.log(
                                  //   `csvFile?.csvBufferQuantity ::`,
                                  //   csvFile?.csvBufferQuantity
                                  // );

                                  // console.log("user?.accessToken :::", user?.accessToken)
                                  // console.log("productVariantId :::", productVariantId)
                                  // console.log("csvFile?.shop :::", csvFile?.shop)

                                  let calculatedInventoryQuantity = 0;

                                  if (
                                    productInventoryQuantity >
                                    csvFile?.csvBufferQuantity
                                  ) {
                                    calculatedInventoryQuantity =
                                      productInventoryQuantity -
                                      csvFile?.csvBufferQuantity;
                                    console.log(
                                      "calculatedInventoryQuantity if 20 > 10 :::",
                                      calculatedInventoryQuantity
                                    );
                                  } else if (
                                    productInventoryQuantity <
                                    csvFile?.csvBufferQuantity
                                  ) {
                                    calculatedInventoryQuantity = 0;
                                    console.log(
                                      "calculatedInventoryQuantity else if 10 < 20 :::",
                                      calculatedInventoryQuantity
                                    );

                                    // *****************************************************************************************************************//
                                    // update inventory Policy starts
                                    // *****************************************************************************************************************//
                                    var myHeaders = new Headers();
                                    myHeaders.append(
                                      "X-Shopify-Access-Token",
                       
                                      `${user?.accessToken}`
                                    );
                                    myHeaders.append(
                                      "Content-Type",
                                      "application/json"
                                    );

                                    var graphql = JSON.stringify({
                                      query: `mutation MyMutation {\r\n  productVariantUpdate(input: { id: \"${productVariantId}\", inventoryPolicy: DENY }) {\r\n    product {\r\n      id\r\n    }\r\n  }\r\n}\r\n`,
                                      variables: {},
                                    });
                                    var requestOptions = {
                                      method: "POST",
                                      headers: myHeaders,
                                      body: graphql,
                                      redirect: "follow",
                                    };

                                    fetch(
                                      `https://${csvFile?.shop}/admin/api/2023-10/graphql.json`,
                                      requestOptions
                                    )
                                      .then((response) => response.text())
                                      // .then((result) => console.log(result))
                                      .then((result) => {
                                        console.log(
                                          "Continue selling Policy else if 10 < 20 :::",
                                          JSON.parse(result)
                                        );
                                      })
                                      .catch((error) =>
                                        console.log("error", error)
                                      );

                                    // *****************************************************************************************************************//
                                    // update inventory Policy ends
                                    // *****************************************************************************************************************//
                                  } else if (
                                    (productInventoryQuantity =
                                      csvFile?.csvBufferQuantity)
                                  ) {
                                    calculatedInventoryQuantity = 0;
                                    console.log(
                                      "calculatedInventoryQuantity else if 20 = 20 :::",
                                      calculatedInventoryQuantity
                                    );
                                    // *****************************************************************************************************************//
                                    // update Continue selling Policy starts
                                    // *****************************************************************************************************************//

                                    var myHeaders = new Headers();
                                    myHeaders.append(
                                      "X-Shopify-Access-Token",
                               
                                      `${user?.accessToken}`
                                    );
                                    myHeaders.append(
                                      "Content-Type",
                                      "application/json"
                                    );

                                    var graphql = JSON.stringify({
                                      query: `mutation MyMutation {\r\n  productVariantUpdate(input: { id: \"${productVariantId}\", inventoryPolicy: DENY }) {\r\n    product {\r\n      id\r\n    }\r\n  }\r\n}\r\n`,
                                      variables: {},
                                    });
                                    var requestOptions = {
                                      method: "POST",
                                      headers: myHeaders,
                                      body: graphql,
                                      redirect: "follow",
                                    };

                                    fetch(
                                      `https://${csvFile?.shop}/admin/api/2023-10/graphql.json`,
                                      requestOptions
                                    )
                                      .then((response) => response.text())
                                      // .then((result) => console.log(result))
                                      .then((result) => {
                                        console.log(
                                          "Continue selling Policy else if 20 = 20 :::",
                                          JSON.parse(result)
                                        );
                                      })
                                      .catch((error) =>
                                        console.log("error", error)
                                      );

                                    // *****************************************************************************************************************//
                                    // update Continue selling Policy Policy ends
                                    // *****************************************************************************************************************//
                                  }

                                  // ****************************************************************************************************************************************
                                  // product quantity update starts
                                  // ****************************************************************************************************************************************
                                  var myHeaders = new Headers();
                                  myHeaders.append(
                                    "X-Shopify-Access-Token",
                                 
                                    `${user?.accessToken}`
                                  );
                                  myHeaders.append(
                                    "Content-Type",
                                    "application/json"
                                  );

                                  var graphql = JSON.stringify({
                                    query:
                                      "mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {\r\n  inventorySetOnHandQuantities(input: $input) {\r\n    inventoryAdjustmentGroup {\r\n    id\r\n    }\r\n    userErrors {\r\n      field\r\n      message\r\n    }\r\n  }\r\n}",
                                    variables: {
                                      input: {
                                        reason: "correction",
                                        setQuantities: [
                                          {
                                            inventoryItemId:
                                              // "gid://shopify/InventoryItem/50233430606140",
                                              `${inventoryItemId}`,
                                            locationId:
                                              // "gid://shopify/Location/87867654460",
                                              `${locationId}`,
                                            // quantity: 500,
                                            quantity:
                                              calculatedInventoryQuantity,
                                          },
                                        ],
                                      },
                                    },
                                  });
                                  var requestOptions = {
                                    method: "POST",
                                    headers: myHeaders,
                                    body: graphql,
                                    redirect: "follow",
                                  };
                                  let updatedQuantityResponse = null;

                                  await fetch(
                                    `https://${csvFile?.shop}/admin/api/2023-10/graphql.json`,
                                    requestOptions
                                  )
                                    .then((response) => response.text())
                                    .then((result) => {
                                      console.log(
                                        "product quantity update successfull :::",
                                        JSON.parse(result)
                                      );
                                      updatedQuantityResponse =
                                        JSON.parse(result);
                                      // console.log(
                                      //   "updatedQuantityResponse :::",
                                      //   updatedQuantityResponse?.data?.inventorySetOnHandQuantities?.inventoryAdjustmentGroup
                                      // );
                                    })
                                    .catch((error) =>
                                      console.log("error", error)
                                    );
                                  // product quantity update end
                                });
                              });
                            });
                          })

                          .catch((error) => console.log("error", error));
                        // product with quantity ends

                        // ****************************************************************************************************************************************
                        // fetch locations of store ends
                        // ****************************************************************************************************************************************

                        // new code ends
                      }
                    });
                  })
                  .catch((error) => console.log("error", error));
              });
            }
          });
        } else {
          // console.log("Not matched else");
        }
      });
    } catch (error) {
      console.error("Error fetching CSV files:", error);
    }
  }

  // Calling the function to fetch all CSV files
  getAllCsvFiles();
});

app.use("/api", defaultSettingRouter);

// subscription api
app.get("/api/subscriptions", async (req, res) => {
  const accessToken = req.headers["x-shopify-access-token"];
  // Log the accessToken to verify it's being received
  console.log("Received accessToken:", accessToken);

  // Check if accessToken is undefined
  if (!accessToken) {
    return res.status(400).json({ message: "No access token provided" });
  } else {
    // const shop = await User.findOne({ where: { accessToken: accessToken } });
    // console.log(
    //   "shop?.user?.dataValues?.shop ::",
    //   shop
    // );

    const shopInstance = await User.findOne({
      where: { accessToken: accessToken },
    });

    if (shopInstance) {
      console.log("Shop ::::", shopInstance.dataValues.shop);
    } else {
      console.log("No shop found with the given accessToken");
    }

    // subscription code
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append(
      "X-Shopify-Access-Token",
    
      accessToken
    );

    var graphql = JSON.stringify({
      query: `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
        appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
          }
          confirmationUrl
        }
      }
    `,
      variables: {
        name: "Super Duper Recurring Plan",
        // returnUrl: "https://www.google.com",
        // returnUrl: "https://8e3f-49-43-96-223.ngrok-free.app",
        returnUrl: process.env.CORS_URL,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: 10, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
          console.log("returnUrl updatation ::::"),
        ],
        test: true, // Include the test variable as true for a test payment
      },
    });

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: graphql,
      redirect: "follow",
    };

    fetch(
      `https://${shopInstance?.dataValues?.shop}/admin/api/2023-01/graphql.json`,
      requestOptions
    )
      .then((response) => response.text())
      .then((result) => {
        console.log("result ::", JSON.parse(result));
        res.status(200).json({
          message: "success",
          result: JSON.parse(result),
        });
      })
      .catch((error) => {
        console.log("error :::", error);
        res.status(360).json({
          message: "error",
          result: [],
        });
      });
  }
});

// update charge_id api
app.put("/api/subscriptionupdate", async (req, res) => {
  const accessToken = req.headers["x-shopify-access-token"];
  const charge_id = req.headers["charge_id"];

  // Log the received tokens for debugging
  console.log("Received accessToken:", accessToken);
  console.log("Received charge_id:", charge_id);

  // Check if accessToken is undefined
  if (!accessToken) {
    return res.status(400).json({ message: "No access token provided" });
  }

  try {
    const shopInstance = await User.findOne({
      where: { accessToken: accessToken },
    });

    // Check if a user is found
    if (shopInstance) {
      // Update the user with the new charge_id
      await shopInstance.update({ charge_id: charge_id });
      console.log("Updated shopInstance with charge_id:", charge_id);

      res.status(200).json({ message: "Successfully updated" });
    } else {
      console.log("No user found with the provided accessToken");
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error updating the user:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.toString() });
  }
});

//
app.get("/api/getChargeId", async (req, res) => {
  console.log("api/getChangeId");
  const email = req.headers["email"];
  console.log("email ::", email);
  const shop = await User.findOne({ where: { email: email } });
  console.log("shopshop", shop, email);
  res.status(200).json({ message: "success", shop: shop });
});

server.listen(port, () => {
  console.log("server running on port ========= ", port);
});
