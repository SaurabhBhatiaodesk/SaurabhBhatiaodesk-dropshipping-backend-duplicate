const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const { authorization } = req.headers;

  console.log("authorizationauthorizationauthorization",authorization)

  if (!authorization) {
    return res.status(401).send("Unauthorized - No token provided");
  }
  
  const token = authorization.split(' ')[1];

  console.log("tokentokentoken=========middleware",token)
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_KEY_SEC); // Change 'key' to your own secret key
    req.user = decoded;

    console.log("req.userreq.user=====middleware",req.user.id)
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    res.status(401).send("Unauthorized");
  }
};

module.exports = verifyToken;
