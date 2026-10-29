require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const { connectDB, sql } = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { GoogleGenAI, Type } = require('@google/genai');

app.use(cors());
app.use(express.json());

connectDB();

const upload = multer({ storage: multer.memoryStorage() });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.get('/', (req, res) => {
    res.send('Backend API đang hoạt động!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});

//API quét hóa đơn qua Cloud AI
app.post('/api/scan-bill', upload.single('billImage'), async (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({ error: "Vui lòng gửi file ảnh hóa đơn!" });

        }



        const imageBase64 = req.file.buffer.toString('base64');

        // yêu cầu gửi kèm lên cùng ảnh cho AI

        const prompt = `

        Bạn là hệ thống bóc tách hóa đơn siêu thị tiếng Việt (Bách Hóa Xanh, Co.opmart...) chuyên nghiệp.

        Hãy đọc ảnh hóa đơn này và trích xuất danh sách sản phẩm.



        Cấu trúc hóa đơn gồm:

        - 1 dòng tên sản phẩm phía trên.

        - 1 dòng thông số phía dưới gồm các cột: SL, Giá bán (VAT), (Giá gốc bị gạch bỏ nếu có), Thành tiền.



        Lưu ý:

        - originalPrice: Giá gốc trước khi giảm (giá bị gạch bỏ bên trái). Nếu không giảm giá thì để null.

        - unitPrice: Giá bán thực tế (sau giảm nếu có).

        - Chuẩn hóa các số về dạng float/int (ví dụ: "50.000" -> 50000, "1,5" -> 1.5).

        `;



        // Gọi AI
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                            {
                            inlineData: {
                                mimeType: req.file.mimetype,
                                data: imageBase64,
                            },
                        },
                    ],
                },
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: 'Tên sản phẩm' },
                                    quantity: { type: Type.NUMBER, description: 'Số lượng' },
                                    originalPrice: { type: Type.NUMBER, nullable: true, description: 'Giá gốc bị gạch bỏ' },
                                    unitPrice: { type: Type.NUMBER, description: 'Giá bán thực tế' },
                                    totalPrice: { type: Type.NUMBER, description: 'Thành tiền' },
                                },
                                required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
                            },
                        },
                        grandTotal: { type: Type.NUMBER, description: 'Tổng tiền toàn bộ hóa đơn' },
                    },
                    required: ['items', 'grandTotal'],
                },
            },
        });
        const parsedData = JSON.parse(response.text);
        return res.status(200).json({ success: true, data: parsedData });

    } catch (error) {
        console.error("Lỗi khi quét bill:", error);
        return res.status(500).json({ error: "Không thể xử lý ảnh hóa đơn: " + error.message });
    }
});

// API Đăng ký tài khoản
app.post('/api/register', async (req, res) => {
    try {
        const { hodem, tenlot, ten, username, email, dienthoai, password } = req.body;

        if (!hodem || !tenlot || !ten || !username || typeof email !== 'string' || !email.trim() || !dienthoai || !password) {
            return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin!" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const request = new sql.Request();

        request.input('hodem', sql.NVarChar(20), hodem);
        request.input('tenlot', sql.NVarChar(20), tenlot);
        request.input('ten', sql.NVarChar(10), ten);
        request.input('username', sql.VarChar(50), username);
        request.input('email', sql.VarChar(50), normalizedEmail);
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

// Kiểm tra trùng tài khoản
app.post('/api/check-exists', async (req, res) => {
    const { username, dienthoai } = req.body;
    try {
        if (!username || !dienthoai) {
            return res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và số điện thoại." });
        }

        const checkDuplicate = await new sql.Request()
            .input('username', sql.VarChar, username)
            .input('dienthoai', sql.Char, dienthoai)
            .query(`
                SELECT id FROM Users
                WHERE username = @username OR dienthoai = @dienthoai
            `);
        if (checkDuplicate.recordset.length > 0) {
            return res.status(400).json({ error: "Tên đăng nhập hoặc số điện thoại đã được sử dụng!" });
        }
        res.status(200).json({ message: "OK" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi máy chủ cơ sở dữ liệu." });
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

// Kiểm tra số điện thoại trong database
app.post('/api/check-phone', async (req, res) => {
    const { dienthoai } = req.body;
    try {
        const checkUser = await pool.request()
            .input('dienthoai', sql.Char, dienthoai)
            .query(`SELECT id FROM Users WHERE dienthoai = @dienthoai`);

        if (checkUser.recordset.length === 0) {
            return res.status(404).json({ error: "Số điện thoại này chưa được đăng ký!" });
        }
        res.status(200).json({ message: "OK" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi máy chủ cơ sở dữ liệu." });
    }
});

//đổi mật khẩu
app.post('/api/reset-password', async (req, res) => {
    const { dienthoai, newPassword } = req.body;
    try {
        await pool.request()
            .input('dienthoai', sql.Char, dienthoai)
            .input('password', sql.VarChar, newPassword)
            .query(`UPDATE Users SET password_hash = @password WHERE dienthoai = @dienthoai`);

        res.status(200).json({ message: "Cập nhật mật khẩu thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi máy chủ cơ sở dữ liệu." });
    }
});