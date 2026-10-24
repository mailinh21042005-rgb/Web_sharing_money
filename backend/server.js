require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const app = express();

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