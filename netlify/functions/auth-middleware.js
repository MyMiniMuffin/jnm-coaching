const jwt = require('jsonwebtoken');
const { getHeader } = require('./http-utils');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET miljøvariabel er ikke satt');
}

const verifyToken = (event) => {
  const authHeader = getHeader(event, 'authorization');

  if (!authHeader) {
    console.error('Auth middleware: Ingen authorization header funnet. Headers:', Object.keys(event.headers || {}));
    return {
      success: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'Mangler autentisering. Vennligst logg inn på nytt.' })
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.error('Auth middleware: Authorization header har ikke Bearer prefix');
    return {
      success: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'Ugyldig autentiseringsformat.' })
    };
  }

  const token = authHeader.substring(7);

  if (!token || token.trim().length === 0) {
    console.error('Auth middleware: Tomt token');
    return {
      success: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'Tomt token. Vennligst logg inn på nytt.' })
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      success: true,
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
  } catch (error) {
    console.error('Auth middleware: Token verification feilet:', error.name, error.message);
    if (error.name === 'TokenExpiredError') {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ error: 'Sesjonen har utløpt. Vennligst logg inn på nytt.' })
      };
    }
    if (error.name === 'JsonWebTokenError') {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ error: 'Ugyldig token. Vennligst logg inn på nytt.' })
      };
    }
    return {
      success: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'Autentiseringsfeil. Vennligst logg inn på nytt.' })
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

  const requestedId = parseInt(requestedUserId, 10);

  if (isNaN(requestedId) || requestedId <= 0) {
    return {
      success: false,
      statusCode: 400,
      body: JSON.stringify({ error: 'Ugyldig bruker-ID format' })
    };
  }

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
