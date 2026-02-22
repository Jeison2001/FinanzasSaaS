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

// Response Interceptor: Handle Global Errors (e.g. 401 Unauthorized)
axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Global 401 handler: clear token and redirect/reload
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default axiosClient;
