const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION';

const verifyToken = (event) => {
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'Mangler autentisering. Vennligst logg inn på nytt.' })
    };
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      success: true,
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ error: 'Sesjonen har utløpt. Vennligst logg inn på nytt.' })
      };
    }
    return {
      success: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'Ugyldig autentisering. Vennligst logg inn på nytt.' })
    };
  }
};

const requireAuth = (event) => {
  return verifyToken(event);
};

const requireOwnership = (event, requestedUserId) => {
  const authResult = verifyToken(event);

  if (!authResult.success) {
    return authResult;
  }

  const requestedId = parseInt(requestedUserId);

  if (authResult.userId !== requestedId && authResult.role !== 'coach') {
    return {
      success: false,
      statusCode: 403,
      body: JSON.stringify({ error: 'Du har ikke tilgang til denne ressursen.' })
    };
  }

  return authResult;
};

module.exports = {
  verifyToken,
  requireAuth,
  requireOwnership
};
