require('dotenv').config();
const express = require('express');
const cors = require('cors');
app.use(cors());
const { connectDB } = require('./db');
const app = express();
const jwt = require('jsonwebtoken');

app.use(cors());
app.use(express.json());

connectDB();

app.get('/', (req, res) => {
    res.send('Backend API đang hoạt động!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});

const bcrypt = require('bcrypt');
const { sql } = require('./db');

// API Đăng ký tài khoản
app.post('/api/register', async (req, res) => {
    try {
        const { hodem, tenlot, ten, username, email, dienthoai, password } = req.body;

        if (!hodem || !tenlot || !ten || !username || !email || !dienthoai || !password) {
            return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin!" });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const request = new sql.Request();
        
        request.input('hodem', sql.NVarChar(20), hodem);
        request.input('tenlot', sql.NVarChar(20), tenlot);
        request.input('ten', sql.NVarChar(10), ten);
        request.input('username', sql.VarChar(50), username);
        request.input('email', sql.VarChar(50), email);
        request.input('dienthoai', sql.Char(10), dienthoai);
        request.input('password_hash', sql.VarChar(sql.MAX), password_hash);

        await request.query(`
            INSERT INTO Users (hodem, tenlot, ten, username, email, dienthoai, password_hash)
            VALUES (@hodem, @tenlot, @ten, @username, @email, @dienthoai, @password_hash)
        `);

        res.status(201).json({ message: "Đăng ký tài khoản thành công!" });

    } catch (error) {
        if (error.message.includes('Violation of UNIQUE KEY constraint')) {
            return res.status(400).json({ error: "Username hoặc Email đã được sử dụng!" });
        }
        
        if (error.message.includes('conflicted with the CHECK constraint')) {
            return res.status(400).json({ error: "Số điện thoại không hợp lệ (phải gồm 10 chữ số)!" });
        }
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Đăng nhập
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Vui lòng nhập Username và Mật khẩu!" });
        }

        const request = new sql.Request();
        request.input('username', sql.VarChar(50), username);
        const result = await request.query(`SELECT * FROM Users WHERE username = @username`);

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: "Tài khoản không tồn tại!" });
        }

        const user = result.recordset[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: "Mật khẩu không chính xác!" });
        }

        const token = jwt.sign(
            { id: user.id, role_id: user.role_id }, 
            process.env.JWT_SECRET || 'sharemoney_secret_key', 
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            message: "Đăng nhập thành công!",
            token: token,
            user: {
                ten: user.ten,
                username: user.username
            }
        });

    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});