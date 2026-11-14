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
const uploadProfileAvatar = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
            return callback(new Error('Ảnh đại diện phải là tệp hình ảnh.'));
        }
        callback(null, true);
    }
});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || 'sharemoney_secret_key';

const authenticateToken = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    }

    try {
        req.user = jwt.verify(authorization.slice(7), JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }
};

let userProfilesTableReady;
const ensureUserProfilesTable = () => {
    if (!userProfilesTableReady) {
        userProfilesTableReady = sql.query(`
            IF OBJECT_ID('dbo.UserProfiles', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.UserProfiles (
                    user_id INT NOT NULL PRIMARY KEY REFERENCES dbo.Users(id),
                    dia_chi NVARCHAR(255) NULL,
                    is_dia_chi_public BIT NOT NULL CONSTRAINT DF_UserProfiles_IsDiaChiPublic DEFAULT 0,
                    so_tai_khoan NVARCHAR(50) NULL,
                    is_so_tai_khoan_public BIT NOT NULL CONSTRAINT DF_UserProfiles_IsSoTaiKhoanPublic DEFAULT 0,
                    ngan_hang NVARCHAR(100) NULL,
                    is_ngan_hang_public BIT NOT NULL CONSTRAINT DF_UserProfiles_IsNganHangPublic DEFAULT 0,
                    avatar VARBINARY(MAX) NULL,
                    avatar_mimetype VARCHAR(100) NULL,
                    updated_at DATETIME2 NOT NULL CONSTRAINT DF_UserProfiles_UpdatedAt DEFAULT SYSUTCDATETIME()
                );
            END
        `).catch((error) => {
            userProfilesTableReady = null;
            throw error;
        });
    }
    return userProfilesTableReady;
};

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
            JWT_SECRET,
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

app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        await ensureUserProfilesTable();
        const request = new sql.Request();
        request.input('user_id', sql.Int, req.user.id);
        const result = await request.query(`
            SELECT
                u.username,
                u.hodem,
                u.tenlot,
                u.ten,
                u.dienthoai AS soDienThoai,
                COALESCE(p.dia_chi, N'') AS diaChi,
                COALESCE(p.is_dia_chi_public, 0) AS isDiaChiPublic,
                COALESCE(p.so_tai_khoan, N'') AS soTaiKhoan,
                COALESCE(p.is_so_tai_khoan_public, 0) AS isSoTaiKhoanPublic,
                COALESCE(p.ngan_hang, N'') AS nganHang,
                COALESCE(p.is_ngan_hang_public, 0) AS isNganHangPublic,
                p.avatar,
                p.avatar_mimetype
            FROM dbo.Users u
            LEFT JOIN dbo.UserProfiles p ON p.user_id = u.id
            WHERE u.id = @user_id
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
        }

        const profile = result.recordset[0];
        const avatar = profile.avatar
            ? `data:${profile.avatar_mimetype};base64,${profile.avatar.toString('base64')}`
            : '';
        delete profile.avatar;
        delete profile.avatar_mimetype;
        return res.status(200).json({ ...profile, avatar });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.put(
    '/api/users/profile',
    authenticateToken,
    (req, res, next) => {
        uploadProfileAvatar.single('avatar')(req, res, (error) => {
            if (error) {
                return res.status(400).json({ error: error.message });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            await ensureUserProfilesTable();

            // 1. Nhận hoVaTen từ Frontend thay vì ten
            const {
                hoVaTen, 
                soDienThoai,
                diaChi,
                isDiaChiPublic,
                soTaiKhoan,
                isSoTaiKhoanPublic,
                nganHang,
                isNganHangPublic
            } = req.body;

            // 2. Logic cắt chuỗi Họ và Tên thành 3 phần
            let hodem = '';
            let tenlot = '';
            let ten = '';
            
            if (hoVaTen && typeof hoVaTen === 'string') {
                const parts = hoVaTen.trim().split(/\s+/);
                if (parts.length === 1) {
                    ten = parts[0];
                } else if (parts.length === 2) {
                    hodem = parts[0];
                    ten = parts[1];
                } else if (parts.length >= 3) {
                    hodem = parts[0];
                    ten = parts[parts.length - 1];
                    tenlot = parts.slice(1, parts.length - 1).join(' ');
                }
            }

            // 3. Validate dữ liệu (Đã sửa lại để không báo lỗi sai)
            if (!ten || ten.length > 10) {
                return res.status(400).json({ error: 'Tên (từ cuối cùng) không được để trống hoặc vượt quá 10 ký tự.' });
            }
            if (typeof soDienThoai !== 'string' || !/^\d{10}$/.test(soDienThoai)) {
                return res.status(400).json({ error: 'Số điện thoại phải gồm 10 chữ số.' });
            }
            if (typeof diaChi !== 'string' || diaChi.length > 255) {
                return res.status(400).json({ error: 'Địa chỉ không được vượt quá 255 ký tự.' });
            }
            if (typeof soTaiKhoan !== 'string' || soTaiKhoan.length > 50) {
                return res.status(400).json({ error: 'Số tài khoản không được vượt quá 50 ký tự.' });
            }
            if (typeof nganHang !== 'string' || nganHang.length > 100) {
                return res.status(400).json({ error: 'Tên ngân hàng không được vượt quá 100 ký tự.' });
            }

            const userId = Number(req.user.id);
            const userExists = await new sql.Request()
                .input('user_id', sql.Int, userId)
                .query('SELECT id FROM dbo.Users WHERE id = @user_id');
            if (userExists.recordset.length === 0) {
                return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
            }

            // Kiểm tra trùng số điện thoại
            const duplicatePhone = await new sql.Request()
                .input('user_id', sql.Int, userId)
                .input('phone', sql.Char(10), soDienThoai)
                .query('SELECT id FROM dbo.Users WHERE dienthoai = @phone AND id <> @user_id');
            if (duplicatePhone.recordset.length > 0) {
                return res.status(409).json({ error: 'Số điện thoại này đã được tài khoản khác sử dụng.' });
            }

            const request = new sql.Request();
            request.input('user_id', sql.Int, userId);
            request.input('hodem', sql.NVarChar(20), hodem.substring(0, 20));
            request.input('tenlot', sql.NVarChar(20), tenlot.substring(0, 20));
            request.input('ten', sql.NVarChar(10), ten.substring(0, 10));
            request.input('phone', sql.Char(10), soDienThoai);
            request.input('dia_chi', sql.NVarChar(255), diaChi.trim());
            request.input('is_dia_chi_public', sql.Bit, isDiaChiPublic === 'true');
            request.input('so_tai_khoan', sql.NVarChar(50), soTaiKhoan.trim());
            request.input('is_so_tai_khoan_public', sql.Bit, isSoTaiKhoanPublic === 'true');
            request.input('ngan_hang', sql.NVarChar(100), nganHang.trim());
            request.input('is_ngan_hang_public', sql.Bit, isNganHangPublic === 'true');
            request.input('avatar', sql.VarBinary(sql.MAX), req.file ? req.file.buffer : null);
            request.input('avatar_mimetype', sql.VarChar(100), req.file ? req.file.mimetype : null);

            const updateResult = await request.query(`
                SET XACT_ABORT ON;
                BEGIN TRANSACTION;
                BEGIN TRY
                    UPDATE dbo.Users
                    SET hodem = @hodem, tenlot = @tenlot, ten = @ten, dienthoai = @phone
                    WHERE id = @user_id;

                    IF EXISTS (SELECT 1 FROM dbo.UserProfiles WHERE user_id = @user_id)
                        UPDATE dbo.UserProfiles
                        SET dia_chi = @dia_chi,
                            is_dia_chi_public = @is_dia_chi_public,
                            so_tai_khoan = @so_tai_khoan,
                            is_so_tai_khoan_public = @is_so_tai_khoan_public,
                            ngan_hang = @ngan_hang,
                            is_ngan_hang_public = @is_ngan_hang_public,
                            avatar = COALESCE(@avatar, avatar),
                            avatar_mimetype = COALESCE(@avatar_mimetype, avatar_mimetype),
                            updated_at = SYSUTCDATETIME()
                        WHERE user_id = @user_id;
                    ELSE
                        INSERT INTO dbo.UserProfiles (
                            user_id, dia_chi, is_dia_chi_public, so_tai_khoan,
                            is_so_tai_khoan_public, ngan_hang, is_ngan_hang_public,
                            avatar, avatar_mimetype
                        )
                        VALUES (
                            @user_id, @dia_chi, @is_dia_chi_public, @so_tai_khoan,
                            @is_so_tai_khoan_public, @ngan_hang, @is_ngan_hang_public,
                            @avatar, @avatar_mimetype
                        );

                COMMIT TRANSACTION;
                END TRY
                BEGIN CATCH
                    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
                    THROW;
                END CATCH;

                SELECT @ten AS ten, @phone AS soDienThoai;
            `);

            const avatar = req.file
                ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
                : undefined;
            return res.status(200).json({
                message: 'Đã lưu thông tin cá nhân.',
                ten: updateResult.recordset[0].ten,
                soDienThoai: updateResult.recordset[0].soDienThoai,
                ...(avatar ? { avatar } : {})
            });
        } catch (error) {
            const status = error.number === 2627 || error.number === 2601 ? 409 : 500;
            const message = status === 409
                ? 'Số điện thoại này đã được tài khoản khác sử dụng.'
                : error.message;
            return res.status(status).json({ error: message });
        }
    }
);

server.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));