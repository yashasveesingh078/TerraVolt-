import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // { id, name, email, role } or null
  const [loading, setLoading] = useState(true); // true until we know if someone is logged in

  // When the app first opens (or the page is refreshed), ask the server "who am I?"
  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const loggedInUser = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Any component can call useAuth() to get { user, loading, login, logout }
export function useAuth() {
  return useContext(AuthContext);
}