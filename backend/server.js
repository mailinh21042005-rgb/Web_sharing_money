require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, sql } = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { GoogleGenAI, Type } = require('@google/genai');
const http = require('http'); 
const { Server } = require('socket.io');

const app = express();
app.use(cors({
    origin: ["http://localhost:5173", "https://web-sharing-money.vercel.app"], 
    credentials: true
}));
app.use(express.json());

connectDB();

const upload = multer({ storage: multer.memoryStorage() });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const server = http.createServer(app); 
const io = new Server(server, {
    cors: { 
        origin: ["http://localhost:5173", "https://web-sharing-money.vercel.app"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Middleware chèn io vào mọi Request để gọi từ API
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- LOGIC SOCKET.IO ---
io.on('connection', (socket) => {
    // 1. User đăng nhập sẽ tham gia vào kênh thông báo cá nhân
    socket.on('userLogin', (userId) => {
        socket.join(`user_${userId}`);
    });

    // 2. Tham gia phòng chat nhóm
    socket.on('joinGroup', (groupId) => {
        socket.join(`group_${groupId}`);
    });

    // 3. Gửi và nhận tin nhắn
    socket.on('sendMessage', async (data) => {
        try {
            const { group_id, user_id, message, sender_name, avatar } = data;
            
            const request = new sql.Request();
            request.input('group_id', sql.Int, group_id);
            request.input('user_id', sql.Int, user_id);
            request.input('message', sql.NVarChar(sql.MAX), message);
            
            const result = await request.query(`
                INSERT INTO ChatMessages (group_id, user_id, message) 
                OUTPUT inserted.id, inserted.created_at
                VALUES (@group_id, @user_id, @message)
            `);

            const newMessage = {
                id: result.recordset[0].id,
                group_id,
                user_id,
                sender: sender_name,
                avatar,
                text: message,
                created_at: result.recordset[0].created_at
            };

            // 1. Gửi nội dung tin nhắn đến khung chat của nhóm
            io.to(`group_${group_id}`).emit('receiveMessage', newMessage);

            // 2. BỔ SUNG: Gửi tín hiệu thông báo (newNotification) tới các thành viên khác trong nhóm
            const memberReq = new sql.Request();
            memberReq.input('group_id', sql.Int, group_id);
            memberReq.input('sender_id', sql.Int, user_id);
            
            const members = await memberReq.query(`
                SELECT user_id FROM GroupMembers 
                WHERE group_id = @group_id AND user_id != @sender_id
            `);

            members.recordset.forEach(member => {
                io.to(`user_${member.user_id}`).emit('newNotification', { 
                    message: `${sender_name || 'Ai đó'} đã gửi tin nhắn mới trong nhóm.` 
                });
            });

        } catch (err) {
            console.error("Lỗi lưu tin nhắn:", err);
        }
    });
});

app.get('/', (req, res) => {
    res.send('Backend API đang hoạt động!');
});

const PORT = process.env.PORT || 5000;

// [CHAT] Lấy lịch sử tin nhắn của nhóm
app.get('/api/groups/:groupId/messages', async (req, res) => {
    try {
        const request = new sql.Request();
        request.input('group_id', sql.Int, req.params.groupId);
        const result = await request.query(`
            SELECT c.id, c.user_id, c.message as text, c.created_at, u.ten as sender
            FROM ChatMessages c
            JOIN Users u ON c.user_id = u.id
            WHERE c.group_id = @group_id
            ORDER BY c.created_at ASC
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [THÔNG BÁO] Lấy danh sách lời mời kết bạn
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const request = new sql.Request();
        request.input('user_id', sql.Int, req.params.userId);
        
        // 1. Tự động xóa các thông báo kết bạn (đang chờ hoặc đã xử lý) quá 30 ngày
        await request.query(`
            DELETE FROM Friends 
            WHERE created_at < DATEADD(DAY, -30, GETDATE())
        `);

        // 2. Lấy danh sách thông báo
        const result = await request.query(`
            SELECT f.user_id as sender_id, u.ten, u.hodem, u.tenlot, f.created_at, f.status
            FROM Friends f
            JOIN Users u ON f.user_id = u.id
            WHERE f.friend_id = @user_id 
              AND (f.status = 'pending' OR f.status = 'accepted')
            ORDER BY f.created_at DESC
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tìm kiếm người dùng theo SĐT hoặc Username
app.post('/api/users/search', async (req, res) => {
    try {
        const { searchQuery } = req.body;
        if (!searchQuery) return res.status(400).json({ error: "Vui lòng nhập thông tin tìm kiếm" });

        const request = new sql.Request();
        request.input('query', sql.VarChar(50), searchQuery);
        
        const result = await request.query(`
            SELECT id, ten, hodem, tenlot, dienthoai, username 
            FROM Users 
            WHERE dienthoai = @query OR username = @query
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy người dùng với SĐT hoặc Username này!" });
        }
        res.status(200).json(result.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Gửi yêu cầu kết bạn CÓ THÔNG BÁO PUSH
app.post('/api/friends/add', async (req, res) => {
    try {
        const { user_id, friend_id, sender_name } = req.body; 
        
        const request = new sql.Request();
        request.input('user_id', sql.Int, user_id);
        request.input('friend_id', sql.Int, friend_id);
        
        const check = await request.query(`SELECT * FROM Friends WHERE user_id = @user_id AND friend_id = @friend_id`);
        if (check.recordset.length > 0) return res.status(400).json({ error: "Đã là bạn bè hoặc đã gửi yêu cầu!" });

        await request.query(`INSERT INTO Friends (user_id, friend_id, status) VALUES (@user_id, @friend_id, 'pending')`);
        
        // Bắn thông báo Socket.io đến người nhận
        req.io.to(`user_${friend_id}`).emit('newNotification', { 
            message: `${sender_name || 'Ai đó'} đã gửi cho bạn một lời mời kết bạn mới!` 
        });

        res.status(200).json({ message: "Đã gửi yêu cầu kết bạn!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// [THÔNG BÁO] Phản hồi lời mời kết bạn CÓ THÔNG BÁO PUSH
app.put('/api/friends/respond', async (req, res) => {
    try {
        const { sender_id, receiver_id, action, responder_name } = req.body;
        const request = new sql.Request();
        request.input('sender', sql.Int, sender_id);
        request.input('receiver', sql.Int, receiver_id);

        if (action === 'accepted') {
            await request.query(`UPDATE Friends SET status = 'accepted' WHERE user_id = @sender AND friend_id = @receiver`);
            await request.query(`INSERT INTO Friends (user_id, friend_id, status) VALUES (@receiver, @sender, 'accepted')`);
            
            // Bắn thông báo về cho người gửi yêu cầu ban đầu
            req.io.to(`user_${sender_id}`).emit('newNotification', { 
                message: `${responder_name || 'Một người bạn'} đã chấp nhận lời mời kết bạn của bạn!` 
            });

            res.status(200).json({ message: "Đã chấp nhận kết bạn!" });
        } else {
            await request.query(`DELETE FROM Friends WHERE user_id = @sender AND friend_id = @receiver`);
            res.status(200).json({ message: "Đã từ chối kết bạn!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Xóa bạn bè (Hủy kết bạn)
app.delete('/api/friends/remove', async (req, res) => {
    try {
        const { user_id, friend_id } = req.body;
        const request = new sql.Request();
        request.input('user_id', sql.Int, user_id);
        request.input('friend_id', sql.Int, friend_id);
        
        // Xóa cả 2 chiều trong bảng Friends
        await request.query(`
            DELETE FROM Friends 
            WHERE (user_id = @user_id AND friend_id = @friend_id) 
               OR (user_id = @friend_id AND friend_id = @user_id)
        `);
        
        res.status(200).json({ message: "Đã hủy kết bạn thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Tạo nhóm mới
app.post('/api/groups/create', async (req, res) => {
    try {
        const { group_name, created_by } = req.body;
        
        const request = new sql.Request();
        request.input('name', sql.NVarChar(100), group_name);
        request.input('created_by', sql.Int, created_by);
        
        const result = await request.query(`
            INSERT INTO Groups (name, created_by) OUTPUT INSERTED.id VALUES (@name, @created_by);
        `);
        
        const groupId = result.recordset[0].id;
        
        const memberReq = new sql.Request();
        memberReq.input('group_id', sql.Int, groupId);
        memberReq.input('user_id', sql.Int, created_by);
        await memberReq.query(`INSERT INTO GroupMembers (group_id, user_id, role) VALUES (@group_id, @user_id, 'admin')`);

        res.status(201).json({ message: "Tạo nhóm thành công!", groupId: groupId });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// 4. Thêm thành viên vào nhóm
app.post('/api/groups/add-member', async (req, res) => {
    try {
        const { group_id, user_id } = req.body;
        
        const request = new sql.Request();
        request.input('group_id', sql.Int, group_id);
        request.input('user_id', sql.Int, user_id);
        
        const check = await request.query(`SELECT * FROM GroupMembers WHERE group_id = @group_id AND user_id = @user_id`);
        if (check.recordset.length > 0) return res.status(400).json({ error: "Người dùng này đã ở trong nhóm!" });

        await request.query(`INSERT INTO GroupMembers (group_id, user_id, role) VALUES (@group_id, @user_id, 'member')`);
        res.status(200).json({ message: "Đã thêm thành viên vào nhóm!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Xóa thành viên khỏi nhóm
app.delete('/api/groups/remove-member', async (req, res) => {
    try {
        const { group_id, user_id } = req.body;
        
        const request = new sql.Request();
        request.input('group_id', sql.Int, group_id);
        request.input('user_id', sql.Int, user_id);
        
        await request.query(`DELETE FROM GroupMembers WHERE group_id = @group_id AND user_id = @user_id`);
        
        res.status(200).json({ message: "Đã xóa thành viên khỏi nhóm!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Giải tán nhóm
app.delete('/api/groups/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const request = new sql.Request();
        request.input('group_id', sql.Int, groupId);
        
        await request.query(`DELETE FROM Groups WHERE id = @group_id`);
        res.status(200).json({ message: "Đã giải tán nhóm thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// API Lấy danh sách bạn bè
app.get('/api/friends/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const request = new sql.Request();
        request.input('user_id', sql.Int, userId);
        
        const result = await request.query(`
            SELECT u.id, u.ten as name
            FROM Users u
            INNER JOIN Friends f ON u.id = f.friend_id
            WHERE f.user_id = @user_id AND f.status = 'accepted' 
        `);
        
        const friendsList = result.recordset.map(friend => ({
            id: friend.id,
            name: friend.name,
            avatar: friend.name.charAt(0).toUpperCase()
        }));

        res.status(200).json(friendsList);
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// API Lấy danh sách nhóm của một user
app.get('/api/users/:userId/groups', async (req, res) => {
    try {
        const { userId } = req.params;
        const request = new sql.Request();
        request.input('user_id', sql.Int, userId);
        
        const result = await request.query(`
            SELECT 
                g.id, 
                g.name,
                (
                    SELECT STRING_AGG(u.ten, ',') 
                    FROM GroupMembers gm2 
                    JOIN Users u ON gm2.user_id = u.id 
                    WHERE gm2.group_id = g.id
                ) as member_names
            FROM Groups g
            JOIN GroupMembers gm ON g.id = gm.group_id
            WHERE gm.user_id = @user_id
        `);
        
        const formattedGroups = result.recordset.map(group => ({
            id: group.id,
            name: group.name,
            members: group.member_names ? group.member_names.split(',') : [],
            transaction_count: 0, 
            total_amount: 0       
        }));

        res.status(200).json(formattedGroups);
    } catch (error) {
        res.status(500).json({ error: "Lỗi lấy danh sách nhóm: " + error.message });
    }
});

// Gán quyền admin
// API Lấy danh sách thành viên của một nhóm
app.get('/api/groups/:groupId/members', async (req, res) => {
    try {
        const { groupId } = req.params;
        const request = new sql.Request();
        request.input('group_id', sql.Int, groupId);
        
        // Join bảng GroupMembers và Users để lấy tên và quyền (role)
        const result = await request.query(`
            SELECT u.id, u.ten as name, gm.role 
            FROM GroupMembers gm
            JOIN Users u ON gm.user_id = u.id
            WHERE gm.group_id = @group_id
        `);
        
        // Xử lý dữ liệu trả về, thêm avatar chữ cái đầu
        const membersList = result.recordset.map(m => ({
            id: m.id,
            name: m.name,
            role: m.role,
            avatar: m.name.charAt(0).toUpperCase()
        }));

        res.status(200).json(membersList);
    } catch (error) {
        res.status(500).json({ error: "Lỗi lấy danh sách thành viên: " + error.message });
    }
});

//API quét hóa đơn qua Cloud AI
app.post('/api/scan-bill', upload.single('billImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Vui lòng gửi file ảnh hóa đơn!" });
        }

        const imageBase64 = req.file.buffer.toString('base64');
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
            return res.status(400).json({ error: "Vui lòng điền đầy đủ thông margin!" });
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
                id: user.id,
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
        const checkUser = await new sql.Request()
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
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        await new sql.Request()
            .input('dienthoai', sql.Char, dienthoai)
            .input('password', sql.VarChar, password_hash)
            .query(`UPDATE Users SET password_hash = @password WHERE dienthoai = @dienthoai`);

        res.status(200).json({ message: "Cập nhật mật khẩu thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi máy chủ cơ sở dữ liệu." });
    }
});

server.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});