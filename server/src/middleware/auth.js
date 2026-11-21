import jwt from 'jsonwebtoken';

// 1) Is the person logged in?
// Reads the "token" cookie, checks its signature, and saves the user on req.user.
export function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    // verify() throws an error if the token was edited or has expired
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, name }
    next(); // allowed: continue to the route
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// 2) Does the person have the right role?
// Usage: requireRole('ACCOUNTS', 'SALES')
// The director owns the business, so the director is always allowed.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user.role === 'DIRECTOR' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'You do not have access to this' });
  };
}