import axios from 'axios';

// Create a configured Axios instance
const VITE_API_URL = import.meta.env.VITE_API_URL;
if (!VITE_API_URL) throw new Error("VITE_API_URL not defined.");
const baseURL = VITE_API_URL.endsWith('/api') ? VITE_API_URL : `${VITE_API_URL}/api`;

const axiosClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request Interceptor: Attach JWT Token
axiosClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Rutas públicas que no requieren autenticación — un 401 allí es error de credenciales,
// no de sesión, por lo que el componente lo maneja directamente.
const PUBLIC_AUTH_ROUTES = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

// Response Interceptor: Handle Global Errors (e.g. 401 Unauthorized)
axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const requestUrl = error.config?.url || '';
            const isPublicRoute = PUBLIC_AUTH_ROUTES.some(route => requestUrl.includes(route));

            if (!isPublicRoute) {
                // Ruta protegida con 401 → sesión inválida (token expirado, borrado o manipulado)
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                window.location.href = '/';
            }
            // Si es ruta pública (login/register/etc.), el componente gestiona el error
        }
        return Promise.reject(error);
    }
);

export default axiosClient;
