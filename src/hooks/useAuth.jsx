import React, { createContext, useContext, useState } from 'react';

/**
 * Contexto de autenticación. Expone token, rol y métodos login/logout.
 * El token JWT se persiste en localStorage para sobrevivir recargas.
 */
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [role, setRole] = useState(localStorage.getItem('role') || null);

    const login = (newToken, userRole) => {
        setToken(newToken);
        setRole(userRole);
        localStorage.setItem('token', newToken);
        localStorage.setItem('role', userRole);
    };

    const logout = () => {
        setToken(null);
        setRole(null);
        localStorage.removeItem('token');
        localStorage.removeItem('role');
    };

    return (
        <AuthContext.Provider value={{ token, role, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};
