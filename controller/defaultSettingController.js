const defaultSettingModel = require("../model/defaultSettingModel");
const csvfileDataModel = require("../model/csvFileDataModel");
const { json } = require("body-parser");
const userModel = require("../model/userModel");
const fetch = require("node-fetch-retry");



class DefaultSettingController {


  // *****************************************************************************************************************//
  // Use api for  Fetch store location
  // *****************************************************************************************************************//

  fetchStoreLocation = async (req, res, next) => {
    try {
      console.log("req.user.id", req.user.id);

      const fetchuser = await userModel.findOne({
        where: {
          id: req.user.id,
        },
      });

      console.log(
        "fetchuser?.dataValues?.shop---",
        fetchuser?.dataValues?.accessToken
      );
      var myHeaders = new Headers();
      myHeaders.append(
        "x-shopify-access-token",
        `${fetchuser?.dataValues?.accessToken}`
      );
      myHeaders.append("Content-Type", "application/json");
      console.log("myHeadersmyHeadersmyHeaders-----------locations", myHeaders);

      var graphql = JSON.stringify({
        query:
          "{\r\n  shop {\r\n    locations(first: 10) {\r\n      edges {\r\n        node {\r\n          name\r\n          id\r\n        }\r\n      }\r\n    }\r\n  }\r\n}",
        variables: {},
      });
      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: graphql,
        redirect: "follow",
      };
      const data = await fetch(
        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
        requestOptions
      );
      const response = await data.text();
      return res.status(201).json({
        status: true,
        message: "Store location fetch successfully",
        response: JSON.parse(response),
      });
    } catch (err) {
      return res.status(401).json({
        status: false,
        message: err.message,
        stack: err.stack,
      });
    }
  };

  // *****************************************************************************************************************//
  // Use api for  Fetch shop teg's
  // *****************************************************************************************************************//

  matchShopTags = async (req, res, next) => {
    try {
      const fetchuser = await userModel.findOne({
        where: {
          id: req.user.id,
        },
      });
      var myHeaders = new Headers();
      myHeaders.append(
        "x-shopify-access-token",
        `${fetchuser?.dataValues?.accessToken}`
      );
      myHeaders.append("Content-Type", "application/json");
      console.log("myHeadersmyHeadersmyHeaders", myHeaders);

      console.log(
        "fetchuserfetchuserfetchuserfetchuser",
        fetchuser?.dataValues?.shop
      );

      const { tags } = req.body;

      var graphql = JSON.stringify({
        query:
          "{\r\n  shop{\r\n    productTags(first: 250){\r\n      edges{\r\n        node\r\n      }\r\n    }\r\n  }\r\n}\r\n",
        variables: {},
      });
      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: graphql,
        redirect: "follow",
      };
      const data = await fetch(
        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
        requestOptions
      );
      const response = await data.text();
      const parseData = JSON.parse(response);

      let foundMatch = false;
      const tagToFind = tags.toLowerCase();
      for (const item of parseData?.data?.shop?.productTags?.edges) {
        console.log(item,'--------------item---------------<>')
        console.log(item?.node,'--------------item---------------node----------------<>')
        const itemTag = item.node.toLowerCase(); // Convert the tag from the data to lowercase

        console.log("itemTag", itemTag);
        console.log("tagToFind", tagToFind);

        if (itemTag === tagToFind) {
          foundMatch = true;
          return res.status(201).json({
            status: true,
            message: "Tag's matched",
          });
        }
      }
      if (foundMatch) {
        console.log("Match found");
      } else {
        throw new Error("Tag does not exist in the product");
      }
    } catch (err) {
      return res.status(401).json({
        status: false,
        message: err.message,
        stack: err.stack,
      });
    }
  };

  addCsvFile = async (req, res, next) => {
    try {
      const socketIo = req.app.locals.io; // Access the socketIo instance from app.locals
      var fetchuser = await userModel.findOne({
        where: {
          id: req.user.id,
        },
      });

      console.log(
        "fetchuserfetchuserfetchuser0000000",
        fetchuser.dataValues.shop
      );
      var myHeaders = new Headers();
      myHeaders.append(
        "x-shopify-access-token",
        `${fetchuser.dataValues.accessToken}`
      );
      myHeaders.append("Content-Type", "application/json");
      console.log(
        "myHeadersmyHeadersmyHeaders-----------csvvvv addd",
        myHeaders
      );

      const {
        csvFileData,
        defaultSetting,
        productTags,
        allExcels,
        continueSell,
        //  locations,
        bufferQqantity,
        expireDate,
        fileHeaders,
        shopifyInventoryHeaders,
        fileInventoryHeaders,
        shopifyQqantityInventoryHeaders,
        fileTagHeader,
      } = req.body;

      // const alllocations = [87867654460, 87867621692, 97364967740];

      const alllocations = req.body.locations;

      // console.log("req.bodyreq.bodyreq.bodyreq.body", req.body);

      const addcsvfile = await csvfileDataModel.create({
        shop: fetchuser.dataValues.shop,
        csvFileData: csvFileData,
        productTags: productTags,
        allExcels: allExcels,
        defaultSetting: defaultSetting,
        continueSell: continueSell,
        locations: alllocations.toString(),
        bufferQqantity: bufferQqantity,
        expireDate: expireDate,
        fileHeaders: fileHeaders,
        shopifyInventoryHeaders: shopifyInventoryHeaders,
        fileInventoryHeaders: fileInventoryHeaders,
        shopifyQqantityInventoryHeaders: shopifyQqantityInventoryHeaders,
      });

      const fetchDefautSettings = await defaultSettingModel.findOne({
        where: {
          shop: fetchuser.dataValues.shop,
        },
      });

      if (!fetchDefautSettings) {
        const saveDefultSetting = await defaultSettingModel.create({
          shop: fetchuser.dataValues.shop,
          continueSell: continueSell,
          locations: alllocations.toString(),
          bufferQqantity: bufferQqantity,
          expireDate: expireDate,
        });
      } else {
        const updateSaveSetting = await defaultSettingModel.update(
          {
            continueSell: continueSell,
            locations: alllocations.toString(),
            bufferQqantity: bufferQqantity,
            expireDate: expireDate,
          },
          {
            where: {
              shop: fetchuser.dataValues.shop,
            },
          }
        );
      }

      const csvFile = req.body.csvFileData;
      const chunkSize = 900;
      let processedCount = 0;
      let processingSuccessful = true; // Assume success initially
      let totalItems = csvFile.length; // Calculate the total number of items

      // *****************************************************************************************************************//
      // update available Quantity
      // *****************************************************************************************************************//

      const lowercaseshopifyInventoryHeaders =
        shopifyInventoryHeaders.toLowerCase();

      for (let i = 0; i < csvFile.length; i += chunkSize) {
        const chunk = csvFile.slice(i, i + chunkSize);

        console.log("chunkchunkchunk", chunk);

        for (const value of chunk) {
          try {
            console.log(
              "valuevaluevaluevaluevaluevalue----------------",
              value[fileHeaders]
            );
            console.log(
              "processedCount------------------------------",
              processedCount++
            );

            console.log(productTags,'---------------productTags---------------')
            if (productTags == [] || productTags == "" || productTags == null) {
              console.log("empty tags----------------------------------");

              const progressPercentage = (processedCount / totalItems) * 100;

              console.log(
                "progressPercentageprogressPercentageprogressPercentage",
                progressPercentage
              );

              socketIo.emit("progress", { percentage: progressPercentage });

              const plusBufferQuentityCsvQqantity =
                parseInt(value[fileInventoryHeaders]) -
                parseInt(bufferQqantity);

              console.log(
                "plusBufferQuentityCsvQqantity----------->",
                plusBufferQuentityCsvQqantity
              );
              for (const locations of alllocations) {
                if (
                  lowercaseshopifyInventoryHeaders == "sku" &&
                  value[fileHeaders] &&
                  value[fileInventoryHeaders] !== undefined
                ) {

                  var graphql = JSON.stringify({
  query: `
    {
      products(first: 1, query: "sku:${value[fileHeaders]}") {
        edges {
          node {
            id
            title
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
                    inventoryLevel(locationId: "gid://shopify/Location/${locations}") {
                      id
                      location {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `,
  variables: {}
});

                  var requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: graphql,
                  };
                  const itemidGet = await fetch(
                    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
                    requestOptions
                  );

                  const responseItemID = await itemidGet.text();
                  const data = JSON.parse(responseItemID);

                  const inventoryItemID =
                    data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                      ?.node?.inventoryItem?.id;

                  console.log(
                    "inventoryItemIDinventoryItemIDinventoryItemID",
                    inventoryItemID
                  );

                  const ProductVariantID =
                    data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                      ?.node?.id;

                      console.log(ProductVariantID,'ProductVariantID----------------')


                  var graphql = JSON.stringify({
                    query: `mutation MyMutation {\r\n  inventorySetOnHandQuantities(\r\n    input: {\r\n      reason: \"correction\"\r\n      setQuantities: {\r\n        inventoryItemId: \"${inventoryItemID}\"\r\n        locationId: \"gid://shopify/Location/${locations}\"\r\n        quantity: ${plusBufferQuentityCsvQqantity}\r\n      }\r\n    }\r\n  ) {\r\n    userErrors {\r\n      field\r\n      message\r\n    }\r\n  }\r\n}\r\n`,
                    variables: {},
                  });
                  var requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: graphql,
                    redirect: "follow",
                  };
                  const updatedata = await fetch(
                    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
                    requestOptions
                  );

                   // 🟢 1️⃣ Enable tracking before updating quantity
// 🧩 Step 1️⃣ — Check if tracking is already enabled
try {
  const checkTrackingQuery = JSON.stringify({
    query: `
      query {
        inventoryItem(id: "${inventoryItemID}") {
          id
          tracked
          trackedEditable { reason }
        }
      }
    `
  });

  const checkResponse = await fetch(
    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
    { method: "POST", headers: myHeaders, body: checkTrackingQuery }
  );

  const checkData = await checkResponse.json();
  const tracked = checkData?.data?.inventoryItem?.tracked;
  const editableReason = checkData?.data?.inventoryItem?.trackedEditable?.reason;

  console.log(`🔍 Checking tracking for ${inventoryItemID}: tracked=${tracked}, editable=${editableReason}`);

  if (!tracked && editableReason === null) {
    console.log(`⚙️ Enabling tracking for ${inventoryItemID}...`);

    const enableTracking = JSON.stringify({
      query: `
        mutation {
          inventoryItemUpdate(
            id: "${inventoryItemID}",
            input: { tracked: true }
          ) {
            inventoryItem { id tracked }
            userErrors { field message }
          }
        }
      `
    });

    const trackingResponse = await fetch(
      `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
      { method: "POST", headers: myHeaders, body: enableTracking }
    );

    const trackingData = await trackingResponse.json();
    if (trackingData?.data?.inventoryItemUpdate?.userErrors?.length) {
      console.warn(`⚠️ Failed to enable tracking for ${inventoryItemID}:`, trackingData.data.inventoryItemUpdate.userErrors);
    } else {
      console.log(`✅ Tracking successfully enabled for ${inventoryItemID}`);
    }
  } else if (tracked) {
    console.log(`✅ Already tracked: ${inventoryItemID}`);
  } else {
    console.log(`⚠️ Cannot enable tracking for ${inventoryItemID}. Reason: ${editableReason}`);
  }
} catch (err) {
  console.error(`❌ Tracking check error for ${inventoryItemID}:`, err.message);
}


                  // *****************************************************************************************************************//
                  // update inventory Policy
                  // *****************************************************************************************************************//
                  var graphql = JSON.stringify({
                    query: `mutation MyMutation {\r\n  productVariantUpdate(input: {id: \"${ProductVariantID}\", inventoryPolicy: ${continueSell}}) {\r\n    product {\r\n      id\r\n    }\r\n  }\r\n}\r\n`,
                    variables: {},
                  });
                  var requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: graphql,
                    redirect: "follow",
                  };

                  const updateContinewSeeling = await fetch(
                    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
                    requestOptions
                  );
                } else if (lowercaseshopifyInventoryHeaders == "barcode") {
                  // var graphql = JSON.stringify({
                  //   query: `{\r\n  products(first: 10, query: \"barcode:${value[fileHeaders]}\") {\r\n    edges {\r\n      node {\r\n        id\r\n        variants(first: 1) {\r\n          edges {\r\n            node {\r\n              id\r\n              weight\r\n              sku\r\n              inventoryItem {\r\n                id\r\n                inventoryLevel(locationId: \"gid://shopify/Location/${locations}\") {\r\n                  id\r\n                  location {\r\n                    id\r\n                  }\r\n                }\r\n              }\r\n            }\r\n          }\r\n        }\r\n      }\r\n    }\r\n  }\r\n}`,
                  //   variables: {},
                  // });
                  var graphql = JSON.stringify({
  query: `
    {
      products(first: 10, query: "barcode:${value[fileHeaders]}") {
        edges {
          node {
            id
            title
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
                    inventoryLevel(locationId: "gid://shopify/Location/${locations}") {
                      id
                      location {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `,
  variables: {}
});

                  var requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: graphql,
                    redirect: "follow",
                  };
                  const itemidGet = await fetch(
                    `https://${fetchuser?.dataValues?.shop}/admin/api/2025-10/graphql.json`,
                    requestOptions
                  );
                  const responseItemID = await itemidGet.text();
                  console.log(responseItemID,'-----------responseItemID---------')
                  const data = JSON.parse(responseItemID);

                  const inventoryItemID =
                    data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                      ?.node?.inventoryItem?.id;
                  const ProductVariantID =
                    data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                      ?.node?.id;

                  console.log(
                    "inventoryItemIDinventoryItemID",
                    inventoryItemID
                  );
                  console.log(
                    "ProductVariantIDProductVariantIDProductVariantID-----barcode-423",
                    ProductVariantID
                  );
               

                  var graphql = JSON.stringify({
                    query: `mutation MyMutation {\r\n  inventorySetOnHandQuantities(\r\n    input: {\r\n      reason: \"correction\"\r\n      setQuantities: {\r\n        inventoryItemId: \"${inventoryItemID}\"\r\n        locationId: \"gid://shopify/Location/${locations}\"\r\n        quantity: ${plusBufferQuentityCsvQqantity}\r\n      }\r\n    }\r\n  ) {\r\n    userErrors {\r\n      field\r\n      message\r\n    }\r\n  }\r\n}\r\n`,
                    variables: {},
                  });
                  var requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: graphql,
                    redirect: "follow",
                  };

                  const updateQqantity = await fetch(
                    `https://${fetchuser?.dataValues?.shop}/admin/api/2025-10/graphql.json`,
                    requestOptions
                  );


                   // 🟢 1️⃣ Enable tracking before updating quantity
// 🧩 Step 1️⃣ — Check if tracking is already enabled
try {
  const checkTrackingQuery = JSON.stringify({
    query: `
      query {
        inventoryItem(id: "${inventoryItemID}") {
          id
          tracked
          trackedEditable { reason }
        }
      }
    `
  });

  const checkResponse = await fetch(
    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
    { method: "POST", headers: myHeaders, body: checkTrackingQuery }
  );

  const checkData = await checkResponse.json();
  const tracked = checkData?.data?.inventoryItem?.tracked;
  const editableReason = checkData?.data?.inventoryItem?.trackedEditable?.reason;

  console.log(`🔍 Checking tracking for ${inventoryItemID}: tracked=${tracked}, editable=${editableReason}`);

  if (!tracked && editableReason === null) {
    console.log(`⚙️ Enabling tracking for ${inventoryItemID}...`);

    const enableTracking = JSON.stringify({
      query: `
        mutation {
          inventoryItemUpdate(
            id: "${inventoryItemID}",
            input: { tracked: true }
          ) {
            inventoryItem { id tracked }
            userErrors { field message }
          }
        }
      `
    });

    const trackingResponse = await fetch(
      `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
      { method: "POST", headers: myHeaders, body: enableTracking }
    );

    const trackingData = await trackingResponse.json();
    if (trackingData?.data?.inventoryItemUpdate?.userErrors?.length) {
      console.warn(`⚠️ Failed to enable tracking for ${inventoryItemID}:`, trackingData.data.inventoryItemUpdate.userErrors);
    } else {
      console.log(`✅ Tracking successfully enabled for ${inventoryItemID}`);
    }
  } else if (tracked) {
    console.log(`✅ Already tracked: ${inventoryItemID}`);
  } else {
    console.log(`⚠️ Cannot enable tracking for ${inventoryItemID}. Reason: ${editableReason}`);
  }
} catch (err) {
  console.error(`❌ Tracking check error for ${inventoryItemID}:`, err.message);
}


                  // *****************************************************************************************************************//
                  // update inventory Policy
                  // *****************************************************************************************************************//

                  var graphql = JSON.stringify({
                    query: `mutation MyMutation {\r\n  productVariantUpdate(input: {id: \"${ProductVariantID}\", inventoryPolicy: ${continueSell}}) {\r\n    product {\r\n      id\r\n    }\r\n  }\r\n}\r\n`,
                    variables: {},
                  });
                  var requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: graphql,
                    redirect: "follow",
                  };

                  const updateContinewSeeling = await fetch(
                    `https://${fetchuser?.dataValues?.shop}/admin/api/2025-10/graphql.json`,
                    requestOptions
                  );
                  console.log(updateContinewSeeling,'----------------updateContinewSeeling----------------')


                }
              }
            } else {
              console.log("match tags----------------------------------");
              const progressPercentage = (processedCount / totalItems) * 100;

              socketIo.emit("progress", { percentage: progressPercentage });

              const plusBufferQuentityCsvQqantity =
                parseInt(value[fileInventoryHeaders]) -
                parseInt(bufferQqantity);

              console.log(
                "plusBufferQuentityCsvQqantity----------->",
                plusBufferQuentityCsvQqantity
              );
              productTags.map(async (tagsvalue, index) => {
                console.log("tagsvaluetagsvalue=>>>>>>>", tagsvalue);
                console.log("value[fileTagHeader]=>>>>>>>", value[fileTagHeader]);

                if (value[fileTagHeader] == tagsvalue) {
                  console.log("value.Tagvalue.Tagvalue.Tag=>>>>>>>");
                  for (const locations of alllocations) {
                    if (lowercaseshopifyInventoryHeaders == "sku") {
                      // var graphql = JSON.stringify({
                      //   query: `{\r\n  products(first: 1, query: \"sku:${value[fileHeaders]}\") {\r\n    edges {\r\n      node {\r\n        id\r\n        variants(first: 1) {\r\n          edges {\r\n            node {\r\n              id\r\n              weight\r\n              sku\r\n              inventoryItem {\r\n                id\r\n                inventoryLevel(locationId: \"gid://shopify/Location/${locations}\") {\r\n                  id\r\n                  location {\r\n                    id\r\n                  }\r\n                }\r\n              }\r\n            }\r\n          }\r\n        }\r\n      }\r\n    }\r\n  }\r\n}\r\n`,
                      //   variables: {},
                      // });
                     
                     var graphql = JSON.stringify({
  query: `
    {
      products(first: 1, query: "sku:${value[fileHeaders]}") {
        edges {
          node {
            id
            title
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
                    inventoryLevel(locationId: "gid://shopify/Location/${locations}") {
                      id
                      location {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `,
  variables: {}
});

                      var requestOptions = {
                        method: "POST",
                        headers: myHeaders,
                        body: graphql,
                      };
                      const itemidGet = await fetch(
                        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
                        requestOptions
                      );
                      const responseItemID = await itemidGet.text();
                      const data = JSON.parse(responseItemID);

                      const inventoryItemID =
                        data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                          ?.node?.inventoryItem?.id;
                      const ProductVariantID =
                        data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                          ?.node?.id;

                      console.log(
                        "inventoryItemIDinventoryItemID",
                        inventoryItemID
                      );
                      console.log(
                        "ProductVariantIDProductVariantIDProductVariantID----sku600",
                        ProductVariantID
                      );
                      

                      var graphql = JSON.stringify({
                        query: `mutation MyMutation {\r\n  inventorySetOnHandQuantities(\r\n    input: {\r\n      reason: \"correction\"\r\n      setQuantities: {\r\n        inventoryItemId: \"${inventoryItemID}\"\r\n        locationId: \"gid://shopify/Location/${locations}\"\r\n        quantity: ${plusBufferQuentityCsvQqantity}\r\n      }\r\n    }\r\n  ) {\r\n    userErrors {\r\n      field\r\n      message\r\n    }\r\n  }\r\n}\r\n`,
                        variables: {},
                      });

                      var requestOptions = {
                        method: "POST",
                        headers: myHeaders,
                        body: graphql,
                        redirect: "follow",
                      };


                      const updatedata = await fetch(
                        `https://${fetchuser.dataValues.shop}/admin/api/2023-10/graphql.json`,
                        requestOptions
                      );

                       // 🟢 1️⃣ Enable tracking before updating quantity
// 🧩 Step 1️⃣ — Check if tracking is already enabled
try {
  const checkTrackingQuery = JSON.stringify({
    query: `
      query {
        inventoryItem(id: "${inventoryItemID}") {
          id
          tracked
          trackedEditable { reason }
        }
      }
    `
  });

  const checkResponse = await fetch(
    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
    { method: "POST", headers: myHeaders, body: checkTrackingQuery }
  );

  const checkData = await checkResponse.json();
  const tracked = checkData?.data?.inventoryItem?.tracked;
  const editableReason = checkData?.data?.inventoryItem?.trackedEditable?.reason;

  console.log(`🔍 Checking tracking for ${inventoryItemID}: tracked=${tracked}, editable=${editableReason}`);

  if (!tracked && editableReason === null) {
    console.log(`⚙️ Enabling tracking for ${inventoryItemID}...`);

    const enableTracking = JSON.stringify({
      query: `
        mutation {
          inventoryItemUpdate(
            id: "${inventoryItemID}",
            input: { tracked: true }
          ) {
            inventoryItem { id tracked }
            userErrors { field message }
          }
        }
      `
    });

    const trackingResponse = await fetch(
      `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
      { method: "POST", headers: myHeaders, body: enableTracking }
    );

    const trackingData = await trackingResponse.json();
    if (trackingData?.data?.inventoryItemUpdate?.userErrors?.length) {
      console.warn(`⚠️ Failed to enable tracking for ${inventoryItemID}:`, trackingData.data.inventoryItemUpdate.userErrors);
    } else {
      console.log(`✅ Tracking successfully enabled for ${inventoryItemID}`);
    }
  } else if (tracked) {
    console.log(`✅ Already tracked: ${inventoryItemID}`);
  } else {
    console.log(`⚠️ Cannot enable tracking for ${inventoryItemID}. Reason: ${editableReason}`);
  }
} catch (err) {
  console.error(`❌ Tracking check error for ${inventoryItemID}:`, err.message);
}


                      // *****************************************************************************************************************//
                      // update inventory Policy
                      // *****************************************************************************************************************//

                      var graphql = JSON.stringify({
                        query: `mutation MyMutation {\r\n  productVariantUpdate(input: {id: \"${ProductVariantID}\", inventoryPolicy: ${continueSell}}) {\r\n    product {\r\n      id\r\n    }\r\n  }\r\n}\r\n`,
                        variables: {},
                      });
                      var requestOptions = {
                        method: "POST",
                        headers: myHeaders,
                        body: graphql,
                        redirect: "follow",
                      };

                      const updateContinewSeeling = await fetch(
                        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
                        requestOptions
                      );
                      console.log(updateContinewSeeling,'------------updateContinewSeeling---------641')
                    } else if (lowercaseshopifyInventoryHeaders == "barcode") {
                      // var graphql = JSON.stringify({
                      //   query: `{\r\n  products(first: 10, query: \"barcode:${value[fileHeaders]}\") {\r\n    edges {\r\n      node {\r\n        id\r\n        variants(first: 1) {\r\n          edges {\r\n            node {\r\n              id\r\n              weight\r\n              sku\r\n              inventoryItem {\r\n                id\r\n                inventoryLevel(locationId: \"gid://shopify/Location/${locations}\") {\r\n                  id\r\n                  location {\r\n                    id\r\n                  }\r\n                }\r\n              }\r\n            }\r\n          }\r\n        }\r\n      }\r\n    }\r\n  }\r\n}`,
                      //   variables: {},
                      // });

                      var graphql = JSON.stringify({
  query: `
    {
      products(first: 10, query: "barcode:${value[fileHeaders]}") {
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
                    inventoryLevel(locationId: "gid://shopify/Location/${locations}") {
                      id
                      location {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `,
  variables: {}
});

    

                      var requestOptions = {
                        method: "POST",
                        headers: myHeaders,
                        body: graphql,
                        redirect: "follow",
                      };
                      const itemidGet = await fetch(
                        `https://${fetchuser.dataValues.shop}/admin/api/2023-10/graphql.json`,
                        requestOptions
                      );
                      const responseItemID = await itemidGet.text();
                      const data = JSON.parse(responseItemID);

                      const inventoryItemID =
                        data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                          ?.node?.inventoryItem?.id;
                      const ProductVariantID =
                        data?.data?.products?.edges[0]?.node?.variants?.edges[0]
                          ?.node?.id;

                      console.log(
                        "inventoryItemIDinventoryItemID",
                        inventoryItemID
                      );
                      console.log(
                        "ProductVariantIDProductVariantIDProductVariantID----barcode675",
                        ProductVariantID
                      );
               
             
                      var graphql = JSON.stringify({
                        query: `mutation MyMutation {\r\n  inventorySetOnHandQuantities(\r\n    input: {\r\n      reason: \"correction\"\r\n      setQuantities: {\r\n        inventoryItemId: \"${inventoryItemID}\"\r\n        locationId: \"gid://shopify/Location/${locations}\"\r\n        quantity: ${plusBufferQuentityCsvQqantity}\r\n      }\r\n    }\r\n  ) {\r\n    userErrors {\r\n      field\r\n      message\r\n    }\r\n  }\r\n}\r\n`,
                        variables: {},
                      });
                      var requestOptions = {
                        method: "POST",
                        headers: myHeaders,
                        body: graphql,
                        redirect: "follow",
                      };

                      const updateQqantity = await fetch(
                        `https://${fetchuser?.dataValues?.shop}/admin/api/2025-10/graphql.json`,
                        requestOptions
                      );

                       // 🟢 1️⃣ Enable tracking before updating quantity
// 🧩 Step 1️⃣ — Check if tracking is already enabled
try {
  const checkTrackingQuery = JSON.stringify({
    query: `
      query {
        inventoryItem(id: "${inventoryItemID}") {
          id
          tracked
          trackedEditable { reason }
        }
      }
    `
  });

  const checkResponse = await fetch(
    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
    { method: "POST", headers: myHeaders, body: checkTrackingQuery }
  );

  const checkData = await checkResponse.json();
  const tracked = checkData?.data?.inventoryItem?.tracked;
  const editableReason = checkData?.data?.inventoryItem?.trackedEditable?.reason;

  console.log(`🔍 Checking tracking for ${inventoryItemID}: tracked=${tracked}, editable=${editableReason}`);

  if (!tracked && editableReason === null) {
    console.log(`⚙️ Enabling tracking for ${inventoryItemID}...`);

    const enableTracking = JSON.stringify({
      query: `
        mutation {
          inventoryItemUpdate(
            id: "${inventoryItemID}",
            input: { tracked: true }
          ) {
            inventoryItem { id tracked }
            userErrors { field message }
          }
        }
      `
    });

    const trackingResponse = await fetch(
      `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
      { method: "POST", headers: myHeaders, body: enableTracking }
    );

    const trackingData = await trackingResponse.json();
    if (trackingData?.data?.inventoryItemUpdate?.userErrors?.length) {
      console.warn(`⚠️ Failed to enable tracking for ${inventoryItemID}:`, trackingData.data.inventoryItemUpdate.userErrors);
    } else {
      console.log(`✅ Tracking successfully enabled for ${inventoryItemID}`);
    }
  } else if (tracked) {
    console.log(`✅ Already tracked: ${inventoryItemID}`);
  } else {
    console.log(`⚠️ Cannot enable tracking for ${inventoryItemID}. Reason: ${editableReason}`);
  }
} catch (err) {
  console.error(`❌ Tracking check error for ${inventoryItemID}:`, err.message);
}

                      // *****************************************************************************************************************//
                      // update inventory Policy
                      // *****************************************************************************************************************//

                      var graphql = JSON.stringify({
                        query: `mutation MyMutation {\r\n  productVariantUpdate(input: {id: \"${ProductVariantID}\", inventoryPolicy: ${continueSell}}) {\r\n    product {\r\n      id\r\n    }\r\n  }\r\n}\r\n`,
                        variables: {},
                      });
                      var requestOptions = {
                        method: "POST",
                        headers: myHeaders,
                        body: graphql,
                        redirect: "follow",
                      };

                      const updateContinewSeeling = await fetch(
                        `https://${fetchuser?.dataValues?.shop}/admin/api/2025-10/graphql.json`,
                        requestOptions
                      );
                    }
                  }
                }
              });
            }

            // ...
          } catch (error) {
            console.error("Error processing csvFile entry:", error);
            // Depending on the logic, you may want to stop processing further or continue.
            processingSuccessful = false; // Mark processing as unsuccessful
          }
        }
      }

      // 🧩 Step 2️⃣ — Zero out discontinued SKUs
try {
  console.log("🔍 Checking for discontinued SKUs...");

  // 1️⃣ Fetch all Shopify SKUs
  const shopifyProductsQuery = JSON.stringify({
    query: `
      {
        products(first: 250) {
          edges {
            node {
              id
              title
              variants(first: 100) {
                edges {
                  node {
                    id
                    sku
                    inventoryItem { id }
                  }
                }
              }
            }
          }
        }
      }
    `
  });

  const shopifyResponse = await fetch(
    `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
    { method: "POST", headers: myHeaders, body: shopifyProductsQuery }
  );

  const shopifyData = await shopifyResponse.json();
  const shopifySkus =
    shopifyData?.data?.products?.edges?.flatMap((product) =>
      product.node.variants.edges
        .filter((variant) => variant.node.sku)
        .map((variant) => ({
          sku: variant.node.sku,
          inventoryItemId: variant.node.inventoryItem.id,
        }))
    ) || [];

  // 2️⃣ Compare with current CSV SKUs
  const csvSkus = csvFile.map((item) => item[fileHeaders]?.trim());
  const discontinued = shopifySkus.filter((p) => !csvSkus.includes(p.sku));

  console.log(`📦 Found ${discontinued.length} discontinued SKUs`);

  console.log(discontinued,'-------------discontinued-------<>')
  // 3️⃣ Loop and zero out
  for (const item of discontinued) {
    if (!item.inventoryItemId) continue;

    // ✅ Ensure tracking enabled
    const checkTrackingQuery = JSON.stringify({
      query: `
        query {
          inventoryItem(id: "${item.inventoryItemId}") {
            id
            tracked
          }
        }
      `
    });
    const checkRes = await fetch(
      `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
      { method: "POST", headers: myHeaders, body: checkTrackingQuery }
    );
    const checkData = await checkRes.json();
    const tracked = checkData?.data?.inventoryItem?.tracked;

    if (!tracked) {
      const enableTracking = JSON.stringify({
        query: `
          mutation {
            inventoryItemUpdate(id: "${item.inventoryItemId}", input: { tracked: true }) {
              inventoryItem { id tracked }
              userErrors { field message }
            }
          }
        `
      });
      await fetch(
        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
        { method: "POST", headers: myHeaders, body: enableTracking }
      );
    }

    // ✅ Set quantity to 0 across all locations
    for (const loc of alllocations) {
      console.log(loc,'------------loc------------<>')
      const zeroOutMutation = JSON.stringify({
        query: `
          mutation {
            inventorySetOnHandQuantities(
              input: {
                reason: "correction"
                setQuantities: {
                  inventoryItemId: "${item.inventoryItemId}"
                  locationId: "gid://shopify/Location/${loc}"
                  quantity: ${0}
                }
              }
            ) {
              userErrors { field message }
            }
          }
        `
      });

      await fetch(
        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
        { method: "POST", headers: myHeaders, body: zeroOutMutation }
      );
    }

    console.log(`🧹 Zeroed out SKU: ${item.sku}`);
  }
} catch (err) {
  console.error("❌ Error zeroing out discontinued SKUs:", err.message);
}


      
      if (processingSuccessful) {
        // Return the processedCount in the response with a "success" status
        return res.status(201).json({
          status: true,
          message: "CSV file processed successfully",
          processedCount: processedCount,
        });
      } else {
        // Return the processedCount in the response with a "pending" status
        return res.status(202).json({
          status: "pending",
          message: "CSV file processing incomplete",
          processedCount: processedCount,
        });
      }
    } catch (err) {
      return res.status(401).json({
        status: false,
        message: err.message,
        stack: err.stack,
      });
    }
  };

  // *****************************************************************************************************************//
  //save Defaut Setting  and update
  // *****************************************************************************************************************//

  saveDefautSetting = async (req, res, next) => {
    try {
      const fetchuser = await userModel.findOne({
        where: {
          id: req.user.id,
        },
      });

      console.log("fetchuserfetchuserfetchuser==savedefultSetting", fetchuser);
      var myHeaders = new Headers();
      myHeaders.append(
        "x-shopify-access-token",
        `${fetchuser.dataValues.accessToken}`
      );
      myHeaders.append("Content-Type", "application/json");
      console.log(
        "myHeadersmyHeadersmyHeaders================defult",
        myHeaders
      );

      var graphql = JSON.stringify({
        query:
          "{\r\n      shop {\r\n        name\r\n        primaryDomain {\r\n          url\r\n          host\r\n        }\r\n      }\r\n    }",
        variables: {},
      });
      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: graphql,
        redirect: "follow",
      };
      const data = await fetch(
        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
        requestOptions
      );
      const response = await data.text();
      const parseData = JSON.parse(response);
      const shop = fetchuser.dataValues.shop;

      console.log("store shop", shop);
      const {
        defaultSetting,
        allExcels,
        continueSell,
        locations,
        bufferQqantity,
        expireDate,
      } = req.body;

      console.log("req.bodyreq.body", req.body);
      const checkShop = await defaultSettingModel.findOne({
        where: {
          shop: shop,
        },
      });
      if (checkShop == null || checkShop == "") {
        const saveDefultSetting = await defaultSettingModel.create({
          shop: shop,
          continueSell: continueSell,
          locations: locations.toString(),
          bufferQqantity: bufferQqantity,
          expireDate: expireDate,
        });
        return res.status(201).json({
          status: true,
          message: "Default Setting Save successfully",
          response: saveDefultSetting,
        });
      } else {
        const updateSaveSetting = await defaultSettingModel.update(
          {
            continueSell: continueSell,
            locations: locations.toString(),
            bufferQqantity: bufferQqantity,
            expireDate: expireDate,
          },
          {
            where: {
              shop: shop,
            },
          }
        );
        return res.status(201).json({
          status: true,
          message: "Defult Setting Update successfully",
          response: updateSaveSetting,
        });
      }
    } catch (err) {
      return res.status(401).json({
        status: false,
        message: err.message,
        stack: err.stack,
      });
    }
  };

  // *****************************************************************************************************************//
  //Fetch defult setting
  // *****************************************************************************************************************//

  fetchDefautSetting = async (req, res, next) => {
    try {
      const fetchuser = await userModel.findOne({
        where: {
          id: req.user.id,
        },
      });

      console.log("fetchuser]]]]]]]]]]]]]]]]]]]]]]]]]]", fetchuser);
      var myHeaders = new Headers();
      myHeaders.append(
        "x-shopify-access-token",
        `${fetchuser.dataValues.accessToken}`
      );
      myHeaders.append("Content-Type", "application/json");
      console.log(
        "myHeadersmyHeadersmyHeaderooooooooooooooppppppppppppp",
        myHeaders
      );

      var graphql = JSON.stringify({
        query:
          "{\r\n      shop {\r\n        name\r\n        primaryDomain {\r\n          url\r\n          host\r\n        }\r\n      }\r\n    }",
        variables: {},
      });
      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: graphql,
        redirect: "follow",
      };
      const data = await fetch(
        `https://${fetchuser.dataValues.shop}/admin/api/2025-10/graphql.json`,
        requestOptions
      );
      const response = await data.text();
      const parseData = JSON.parse(response);
      const shop = fetchuser.dataValues.shop;
      const checkShop = await defaultSettingModel.findOne({
        where: {
          shop: shop,
        },
      });
      return res.status(201).json({
        status: true,
        message: "Defult Setting fetch successfully",
        response: {
          id: checkShop.id,
          shop: checkShop.shop,
          continueSell: checkShop.continueSell,
          locations: checkShop.locations.split(),
          bufferQqantity: checkShop.bufferQqantity,
          expireDate: checkShop.expireDate,
        },
      });
    } catch (err) {
      return res.status(401).json({
        status: false,
        message: err.message,
        stack: err.stack,
      });
    }
  };

  // *****************************************************************************************************************//
  //Fetch csv file
  // *****************************************************************************************************************//

  fetchCsvFile = async (req, res, next) => {
    try {
      const fetchuser = await userModel.findOne({
        where: {
          id: req.user.id,
        },
      });

      const fetchCsvlist = await csvfileDataModel.findAll({
        where: { shop: fetchuser.shop },
      });

      return res.status(201).json({
        status: true,
        message: "fetch csv files successfully",
        response: fetchCsvlist,
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

const defaultSettingController = new DefaultSettingController();

module.exports = defaultSettingController;
