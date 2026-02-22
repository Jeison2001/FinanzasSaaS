import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY || process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(401); // 401 triggers interceptor logout
        req.user = user;
        next();
    });
};
