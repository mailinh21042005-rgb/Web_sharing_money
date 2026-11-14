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

app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- LOGIC SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('userLogin', (userId) => {
        socket.join(`user_${userId}`);
    });

    socket.on('joinGroup', (groupId) => {
        socket.join(`group_${groupId}`);
    });

    socket.on('sendMessage', async (data) => {
        try {
            const { group_id, user_id, message, sender_name, avatar } = data;
            
            const request = new sql.Request();
            request.input('group_id', sql.Int, group_id);
            request.input('user_id', sql.Int, user_id);
            request.input('message', sql.NVarChar(sql.MAX), message);
            
            // Lưu tin nhắn VÀ cập nhật người gửi đã đọc tin nhắn cuối
            const result = await request.query(`
                INSERT INTO ChatMessages (group_id, user_id, message) 
                OUTPUT inserted.id, inserted.created_at
                VALUES (@group_id, @user_id, @message);
                
                UPDATE GroupMembers 
                SET last_read_at = GETDATE() 
                WHERE group_id = @group_id AND user_id = @user_id;
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

            io.to(`group_${group_id}`).emit('receiveMessage', newMessage);

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

app.get('/', (req, res) => res.send('Backend API đang hoạt động!'));

const PORT = process.env.PORT || 5000;

// [CHAT] Lấy lịch sử tin nhắn
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

// [THÔNG BÁO] Lấy danh sách kết bạn
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const request = new sql.Request();
        request.input('user_id', sql.Int, req.params.userId);
        
        await request.query(`DELETE FROM Friends WHERE created_at < DATEADD(DAY, -30, GETDATE())`);

        const result = await request.query(`
            SELECT f.user_id as sender_id, u.ten, u.hodem, u.tenlot, f.created_at, f.status
            FROM Friends f
            JOIN Users u ON f.user_id = u.id
            WHERE f.friend_id = @user_id AND (f.status = 'pending' OR f.status = 'accepted')
            ORDER BY f.created_at DESC
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Người dùng
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

        if (result.recordset.length === 0) return res.status(404).json({ error: "Không tìm thấy người dùng!" });
        res.status(200).json(result.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.post('/api/friends/add', async (req, res) => {
    try {
        const { user_id, friend_id, sender_name } = req.body; 
        const request = new sql.Request();
        request.input('user_id', sql.Int, user_id);
        request.input('friend_id', sql.Int, friend_id);
        
        const check = await request.query(`SELECT * FROM Friends WHERE user_id = @user_id AND friend_id = @friend_id`);
        if (check.recordset.length > 0) return res.status(400).json({ error: "Đã là bạn bè hoặc đã gửi yêu cầu!" });

        await request.query(`INSERT INTO Friends (user_id, friend_id, status) VALUES (@user_id, @friend_id, 'pending')`);
        
        req.io.to(`user_${friend_id}`).emit('newNotification', { 
            message: `${sender_name || 'Ai đó'} đã gửi lời mời kết bạn!` 
        });
        res.status(200).json({ message: "Đã gửi yêu cầu kết bạn!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.put('/api/friends/respond', async (req, res) => {
    try {
        const { sender_id, receiver_id, action, responder_name } = req.body;
        const request = new sql.Request();
        request.input('sender', sql.Int, sender_id);
        request.input('receiver', sql.Int, receiver_id);

        if (action === 'accepted') {
            await request.query(`UPDATE Friends SET status = 'accepted' WHERE user_id = @sender AND friend_id = @receiver`);
            await request.query(`INSERT INTO Friends (user_id, friend_id, status) VALUES (@receiver, @sender, 'accepted')`);
            req.io.to(`user_${sender_id}`).emit('newNotification', { 
                message: `${responder_name || 'Một người bạn'} đã chấp nhận kết bạn!` 
            });
            res.status(200).json({ message: "Đã chấp nhận!" });
        } else {
            await request.query(`DELETE FROM Friends WHERE user_id = @sender AND friend_id = @receiver`);
            res.status(200).json({ message: "Đã từ chối!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/friends/remove', async (req, res) => {
    try {
        const { user_id, friend_id } = req.body;
        const request = new sql.Request();
        request.input('user_id', sql.Int, user_id);
        request.input('friend_id', sql.Int, friend_id);
        
        await request.query(`
            DELETE FROM Friends 
            WHERE (user_id = @user_id AND friend_id = @friend_id) OR (user_id = @friend_id AND friend_id = @user_id)
        `);
        res.status(200).json({ message: "Đã hủy kết bạn!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Nhóm
app.post('/api/groups/create', async (req, res) => {
    try {
        const { group_name, created_by } = req.body;
        const request = new sql.Request();
        request.input('name', sql.NVarChar(100), group_name);
        request.input('created_by', sql.Int, created_by);
        
        const result = await request.query(`INSERT INTO Groups (name, created_by) OUTPUT INSERTED.id VALUES (@name, @created_by);`);
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

app.post('/api/groups/add-member', async (req, res) => {
    try {
        const { group_id, user_id } = req.body;
        const request = new sql.Request();
        request.input('group_id', sql.Int, group_id);
        request.input('user_id', sql.Int, user_id);
        
        const check = await request.query(`SELECT * FROM GroupMembers WHERE group_id = @group_id AND user_id = @user_id`);
        if (check.recordset.length > 0) return res.status(400).json({ error: "Người dùng này đã ở trong nhóm!" });

        await request.query(`INSERT INTO GroupMembers (group_id, user_id, role) VALUES (@group_id, @user_id, 'member')`);
        res.status(200).json({ message: "Đã thêm thành viên!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.delete('/api/groups/remove-member', async (req, res) => {
    try {
        const { group_id, user_id } = req.body;
        const request = new sql.Request();
        request.input('group_id', sql.Int, group_id);
        request.input('user_id', sql.Int, user_id);
        
        await request.query(`DELETE FROM GroupMembers WHERE group_id = @group_id AND user_id = @user_id`);
        res.status(200).json({ message: "Đã xóa thành viên!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.delete('/api/groups/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const request = new sql.Request();
        request.input('group_id', sql.Int, groupId);

        await request.query(`
            DELETE FROM ChatMessages WHERE group_id = @group_id;
            DELETE FROM GroupMembers WHERE group_id = @group_id;
            DELETE FROM Groups WHERE id = @group_id;
        `);
        res.status(200).json({ message: "Đã giải tán nhóm!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống" });
    }
});

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
        
        const friendsList = result.recordset.map(f => ({ id: f.id, name: f.name, avatar: f.name.charAt(0).toUpperCase() }));
        res.status(200).json(friendsList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [API QUAN TRỌNG] Lấy danh sách nhóm kèm trạng thái chấm đỏ từ DB
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
                ) as member_names,
                (
                    SELECT CASE 
                        WHEN MAX(c.created_at) IS NOT NULL AND (gm.last_read_at IS NULL OR MAX(c.created_at) > gm.last_read_at) THEN 1
                        ELSE 0
                    END
                    FROM ChatMessages c
                    WHERE c.group_id = g.id
                ) as has_unread
            FROM Groups g
            JOIN GroupMembers gm ON g.id = gm.group_id
            WHERE gm.user_id = @user_id
        `);
        
        const formattedGroups = result.recordset.map(group => ({
            id: group.id,
            name: group.name,
            members: group.member_names ? group.member_names.split(',') : [],
            transaction_count: 0, 
            total_amount: 0,
            hasUnread: group.has_unread === 1
        }));

        res.status(200).json(formattedGroups);
    } catch (error) {
        res.status(500).json({ error: "Lỗi lấy danh sách nhóm: " + error.message });
    }
});

// [API QUAN TRỌNG MỚI] Ghi nhận đã xem tin nhắn
app.put('/api/groups/:groupId/read', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { user_id } = req.body;
        const request = new sql.Request();
        request.input('group_id', sql.Int, groupId);
        request.input('user_id', sql.Int, user_id);

        await request.query(`
            UPDATE GroupMembers
            SET last_read_at = GETDATE()
            WHERE group_id = @group_id AND user_id = @user_id
        `);
        res.status(200).json({ message: "Đã cập nhật trạng thái đọc" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups/:groupId/members', async (req, res) => {
    try {
        const { groupId } = req.params;
        const request = new sql.Request();
        request.input('group_id', sql.Int, groupId);
        
        const result = await request.query(`
            SELECT u.id, u.ten as name, gm.role 
            FROM GroupMembers gm
            JOIN Users u ON gm.user_id = u.id
            WHERE gm.group_id = @group_id
        `);
        
        const membersList = result.recordset.map(m => ({
            id: m.id, name: m.name, role: m.role, avatar: m.name.charAt(0).toUpperCase()
        }));
        res.status(200).json(membersList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth & Bill Scan
app.post('/api/scan-bill', upload.single('billImage'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Thiếu file ảnh!" });
        const prompt = `Trích xuất hóa đơn: name, quantity, originalPrice, unitPrice, totalPrice. Chuẩn hóa số float/int. Trả mảng items và grandTotal.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } }
                ]
            }],
            config: { responseMimeType: 'application/json' }
        });
        return res.status(200).json({ success: true, data: JSON.parse(response.text) });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { hodem, tenlot, ten, username, email, dienthoai, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const request = new sql.Request();

        request.input('hodem', sql.NVarChar(20), hodem);
        request.input('tenlot', sql.NVarChar(20), tenlot);
        request.input('ten', sql.NVarChar(10), ten);
        request.input('username', sql.VarChar(50), username);
        request.input('email', sql.VarChar(50), email.trim().toLowerCase());
        request.input('dienthoai', sql.Char(10), dienthoai);
        request.input('password_hash', sql.VarChar(sql.MAX), password_hash);

        await request.query(`
            INSERT INTO Users (hodem, tenlot, ten, username, email, dienthoai, password_hash)
            VALUES (@hodem, @tenlot, @ten, @username, @email, @dienthoai, @password_hash)
        `);
        res.status(201).json({ message: "Đăng ký thành công!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-exists', async (req, res) => {
    const { username, dienthoai } = req.body;
    try {
        const checkDuplicate = await new sql.Request()
            .input('username', sql.VarChar, username)
            .input('dienthoai', sql.Char, dienthoai)
            .query(`SELECT id FROM Users WHERE username = @username OR dienthoai = @dienthoai`);
        if (checkDuplicate.recordset.length > 0) return res.status(400).json({ error: "Trùng user!" });
        res.status(200).json({ message: "OK" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const request = new sql.Request();
        request.input('username', sql.VarChar(50), username);
        const result = await request.query(`SELECT * FROM Users WHERE username = @username`);

        if (result.recordset.length === 0) return res.status(401).json({ error: "Không tồn tại!" });
        const user = result.recordset[0];
        if (!(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Sai pass!" });

        const token = jwt.sign(
            { id: user.id, role_id: user.role_id },
            process.env.JWT_SECRET || 'sharemoney_secret_key',
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: "Đăng nhập thành công!",
            token,
            user: { id: user.id, ten: user.ten, username: user.username }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-phone', async (req, res) => {
    try {
        const check = await new sql.Request().input('dienthoai', sql.Char, req.body.dienthoai).query(`SELECT id FROM Users WHERE dienthoai = @dienthoai`);
        if (check.recordset.length === 0) return res.status(404).json({ error: "Chưa đăng ký!" });
        res.status(200).json({ message: "OK" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(req.body.newPassword, salt);
        await new sql.Request()
            .input('dienthoai', sql.Char, req.body.dienthoai)
            .input('password', sql.VarChar, password_hash)
            .query(`UPDATE Users SET password_hash = @password WHERE dienthoai = @dienthoai`);
        res.status(200).json({ message: "OK" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));