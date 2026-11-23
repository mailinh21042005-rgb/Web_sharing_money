require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors({
    origin: ["http://localhost:5173", "https://web-sharing-money.vercel.app"],
    credentials: true
}));
app.use(express.json());

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

const toAvatarDataUrl = (avatar, mimetype) => {
    if (!avatar || !mimetype) return null;
    return `data:${mimetype};base64,${Buffer.from(avatar).toString('base64')}`;
};

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
            const groupId = Number(data.group_id);
            const userId = Number(data.user_id);
            const { message, sender_name } = data;

            const senderProfile = await prisma.user.findUnique({
                where: { id: userId },
                include: { profile: true }
            });
            if (!senderProfile) throw new Error('Không tìm thấy người gửi tin nhắn.');

            const avatar =
                toAvatarDataUrl(senderProfile.profile?.avatar, senderProfile.profile?.avatar_mimetype) ||
                senderProfile.ten.charAt(0).toUpperCase();

            // Lưu tin nhắn VÀ cập nhật người gửi đã đọc tin nhắn cuối
            const [savedMsg] = await prisma.$transaction([
                prisma.chatMessage.create({
                    data: {
                        group_id: groupId,
                        user_id: userId,
                        message
                    }
                }),
                prisma.groupMember.updateMany({
                    where: { group_id: groupId, user_id: userId },
                    data: { last_read_at: new Date() }
                })
            ]);

            const newMessage = {
                id: savedMsg.id,
                group_id: groupId,
                user_id: userId,
                sender: senderProfile.ten,
                avatar,
                text: message,
                created_at: savedMsg.created_at
            };

            io.to(`group_${groupId}`).emit('receiveMessage', newMessage);

            const members = await prisma.groupMember.findMany({
                where: {
                    group_id: groupId,
                    user_id: { not: userId }
                },
                select: { user_id: true }
            });

            members.forEach((member) => {
                io.to(`user_${member.user_id}`).emit('newNotification', {
                    message: `${senderProfile.ten || sender_name || 'Ai đó'} đã gửi tin nhắn mới trong nhóm.`
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
        const groupId = Number(req.params.groupId);
        const rows = await prisma.chatMessage.findMany({
            where: { group_id: groupId },
            include: {
                user: { include: { profile: true } }
            },
            orderBy: { created_at: 'asc' }
        });

        const messages = rows.map((msg) => ({
            id: msg.id,
            user_id: msg.user_id,
            text: msg.message,
            created_at: msg.created_at,
            sender: msg.user.ten,
            avatar:
                toAvatarDataUrl(msg.user.profile?.avatar, msg.user.profile?.avatar_mimetype) ||
                msg.user.ten.charAt(0).toUpperCase()
        }));

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [THÔNG BÁO] Lấy danh sách kết bạn
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        await prisma.friend.deleteMany({
            where: { created_at: { lt: thirtyDaysAgo } }
        });

        const rows = await prisma.friend.findMany({
            where: {
                friend_id: userId,
                status: { in: ['pending', 'accepted'] }
            },
            include: {
                user: { include: { profile: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        const result = rows.map((f) => ({
            sender_id: f.user_id,
            ten: f.user.ten,
            hodem: f.user.hodem,
            tenlot: f.user.tenlot,
            created_at: f.created_at,
            status: f.status,
            avatar: f.user.profile?.avatar ? Buffer.from(f.user.profile.avatar) : null,
            avatar_mimetype: f.user.profile?.avatar_mimetype ?? null
        }));

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Người dùng
app.post('/api/users/search', async (req, res) => {
    try {
        const { searchQuery } = req.body;
        if (!searchQuery) return res.status(400).json({ error: "Vui lòng nhập thông tin tìm kiếm" });

        const user = await prisma.user.findFirst({
            where: {
                OR: [{ dienthoai: searchQuery }, { username: searchQuery }]
            },
            include: { profile: true }
        });

        if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng!" });

        res.status(200).json({
            id: user.id,
            ten: user.ten,
            hodem: user.hodem,
            tenlot: user.tenlot,
            dienthoai: user.dienthoai,
            username: user.username,
            avatar: user.profile?.avatar ? Buffer.from(user.profile.avatar) : null,
            avatar_mimetype: user.profile?.avatar_mimetype ?? null
        });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.post('/api/friends/add', async (req, res) => {
    try {
        const userId = Number(req.body.user_id);
        const friendId = Number(req.body.friend_id);
        const { sender_name } = req.body;

        const existing = await prisma.friend.findUnique({
            where: {
                user_id_friend_id: { user_id: userId, friend_id: friendId }
            }
        });
        if (existing) return res.status(400).json({ error: "Đã là bạn bè hoặc đã gửi yêu cầu!" });

        await prisma.friend.create({
            data: { user_id: userId, friend_id: friendId, status: 'pending' }
        });

        req.io.to(`user_${friendId}`).emit('newNotification', {
            message: `${sender_name || 'Ai đó'} đã gửi lời mời kết bạn!`
        });
        res.status(200).json({ message: "Đã gửi yêu cầu kết bạn!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.put('/api/friends/respond', async (req, res) => {
    try {
        const senderId = Number(req.body.sender_id);
        const receiverId = Number(req.body.receiver_id);
        const { action, responder_name } = req.body;

        if (action === 'accepted') {
            await prisma.$transaction([
                prisma.friend.updateMany({
                    where: { user_id: senderId, friend_id: receiverId },
                    data: { status: 'accepted' }
                }),
                prisma.friend.upsert({
                    where: {
                        user_id_friend_id: { user_id: receiverId, friend_id: senderId }
                    },
                    update: { status: 'accepted' },
                    create: { user_id: receiverId, friend_id: senderId, status: 'accepted' }
                })
            ]);

            req.io.to(`user_${senderId}`).emit('newNotification', {
                message: `${responder_name || 'Một người bạn'} đã chấp nhận kết bạn!`
            });
            res.status(200).json({ message: "Đã chấp nhận!" });
        } else {
            await prisma.friend.deleteMany({
                where: { user_id: senderId, friend_id: receiverId }
            });
            res.status(200).json({ message: "Đã từ chối!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/friends/remove', async (req, res) => {
    try {
        const userId = Number(req.body.user_id);
        const friendId = Number(req.body.friend_id);

        await prisma.friend.deleteMany({
            where: {
                OR: [
                    { user_id: userId, friend_id: friendId },
                    { user_id: friendId, friend_id: userId }
                ]
            }
        });
        res.status(200).json({ message: "Đã hủy kết bạn!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Nhóm
app.post('/api/groups/create', async (req, res) => {
    try {
        const { group_name } = req.body;
        const createdBy = Number(req.body.created_by);

        const group = await prisma.group.create({
            data: {
                name: group_name,
                created_by: createdBy,
                members: {
                    create: { user_id: createdBy, role: 'admin' }
                }
            }
        });

        res.status(201).json({ message: "Tạo nhóm thành công!", groupId: group.id });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.post('/api/groups/add-member', async (req, res) => {
    try {
        const groupId = Number(req.body.group_id);
        const userId = Number(req.body.user_id);

        const existing = await prisma.groupMember.findUnique({
            where: {
                group_id_user_id: { group_id: groupId, user_id: userId }
            }
        });
        if (existing) return res.status(400).json({ error: "Người dùng này đã ở trong nhóm!" });

        await prisma.groupMember.create({
            data: { group_id: groupId, user_id: userId, role: 'member' }
        });
        res.status(200).json({ message: "Đã thêm thành viên!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.delete('/api/groups/remove-member', async (req, res) => {
    try {
        const groupId = Number(req.body.group_id);
        const userId = Number(req.body.user_id);

        await prisma.groupMember.deleteMany({
            where: { group_id: groupId, user_id: userId }
        });
        res.status(200).json({ message: "Đã xóa thành viên!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.delete('/api/groups/:groupId', async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);

        await prisma.$transaction([
            prisma.chatMessage.deleteMany({ where: { group_id: groupId } }),
            prisma.groupMember.deleteMany({ where: { group_id: groupId } }),
            prisma.group.deleteMany({ where: { id: groupId } })
        ]);
        res.status(200).json({ message: "Đã giải tán nhóm!" });
    } catch (error) {
        console.error("Lỗi giải tán nhóm:", error);
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

app.get('/api/friends/:userId', async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const rows = await prisma.friend.findMany({
            where: { user_id: userId, status: 'accepted' },
            include: {
                friend: { include: { profile: true } }
            }
        });

        const friendsList = rows.map((f) => ({
            id: f.friend.id,
            name: f.friend.ten,
            avatar:
                toAvatarDataUrl(f.friend.profile?.avatar, f.friend.profile?.avatar_mimetype) ||
                f.friend.ten.charAt(0).toUpperCase()
        }));

        res.status(200).json(friendsList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [API QUAN TRỌNG] Lấy danh sách nhóm kèm trạng thái chấm đỏ từ DB
app.get('/api/users/:userId/groups', async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const memberships = await prisma.groupMember.findMany({
            where: { user_id: userId },
            include: {
                group: {
                    include: {
                        members: {
                            include: {
                                user: { include: { profile: true } }
                            }
                        },
                        messages: {
                            orderBy: { created_at: 'desc' },
                            take: 1,
                            select: { created_at: true }
                        }
                    }
                }
            }
        });

        const groups = memberships.map((gm) => {
            const latestMsg = gm.group.messages[0];
            const hasUnread = Boolean(
                latestMsg && (!gm.last_read_at || latestMsg.created_at > gm.last_read_at)
            );

            return {
                id: gm.group.id,
                name: gm.group.name,
                members: gm.group.members.map((m) => ({
                    id: m.user.id,
                    name: m.user.ten,
                    avatar: toAvatarDataUrl(m.user.profile?.avatar, m.user.profile?.avatar_mimetype),
                    role: m.role
                })),
                transaction_count: 0,
                total_amount: 0,
                hasUnread
            };
        });

        res.status(200).json(groups);
    } catch (error) {
        res.status(500).json({ error: "Lỗi lấy danh sách nhóm: " + error.message });
    }
});

// [API QUAN TRỌNG MỚI] Ghi nhận đã xem tin nhắn
app.put('/api/groups/:groupId/read', async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const userId = Number(req.body.user_id);

        await prisma.groupMember.updateMany({
            where: { group_id: groupId, user_id: userId },
            data: { last_read_at: new Date() }
        });
        res.status(200).json({ message: "Đã cập nhật trạng thái đọc" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups/:groupId/members', async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const rows = await prisma.groupMember.findMany({
            where: { group_id: groupId },
            include: {
                user: { include: { profile: true } }
            }
        });

        const membersList = rows.map((m) => ({
            id: m.user.id,
            name: m.user.ten,
            role: m.role,
            avatar:
                toAvatarDataUrl(m.user.profile?.avatar, m.user.profile?.avatar_mimetype) ||
                m.user.ten.charAt(0).toUpperCase()
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
        if (dienthoai && !/^\d{10}$/.test(dienthoai)) {
            return res.status(400).json({ error: 'Số điện thoại phải gồm 10 chữ số.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        await prisma.user.create({
            data: {
                hodem,
                tenlot: tenlot || null,
                ten,
                username,
                email: email.trim().toLowerCase(),
                dienthoai: dienthoai || null,
                password_hash
            }
        });
        res.status(201).json({ message: "Đăng ký thành công!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-exists', async (req, res) => {
    const { username, dienthoai } = req.body;
    try {
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { dienthoai }]
            },
            select: { id: true }
        });
        if (existing) return res.status(400).json({ error: "Trùng user!" });
        res.status(200).json({ message: "OK" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { username },
            include: { profile: true }
        });

        if (!user) return res.status(401).json({ error: "Không tồn tại!" });
        if (!(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: "Sai pass!" });
        }

        const token = jwt.sign(
            { id: user.id, role_id: user.role_id },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const avatarBase64 = toAvatarDataUrl(user.profile?.avatar, user.profile?.avatar_mimetype);

        res.status(200).json({
            message: "Đăng nhập thành công!",
            token,
            user: {
                id: user.id,
                ten: user.ten,
                username: user.username,
                ...(avatarBase64 ? { avatar: avatarBase64 } : {})
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(req.user.id) },
            include: { profile: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
        }

        const p = user.profile;
        const avatar = toAvatarDataUrl(p?.avatar, p?.avatar_mimetype) || '';

        return res.status(200).json({
            username: user.username,
            hodem: user.hodem,
            tenlot: user.tenlot,
            ten: user.ten,
            soDienThoai: user.dienthoai,
            diaChi: p?.dia_chi || '',
            isDiaChiPublic: Boolean(p?.is_dia_chi_public),
            soTaiKhoan: p?.so_tai_khoan || '',
            isSoTaiKhoanPublic: Boolean(p?.is_so_tai_khoan_public),
            nganHang: p?.ngan_hang || '',
            isNganHangPublic: Boolean(p?.is_ngan_hang_public),
            avatar
        });
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
            const {
                hodem: submittedHodem,
                tenlot: submittedTenlot,
                ten: submittedTen,
                hoVaTen,
                soDienThoai,
                diaChi,
                isDiaChiPublic,
                soTaiKhoan,
                isSoTaiKhoanPublic,
                nganHang,
                isNganHangPublic
            } = req.body;

            let hodem = '';
            let tenlot = '';
            let ten = '';

            const hasSeparateName = [submittedHodem, submittedTenlot, submittedTen]
                .some(value => typeof value === 'string');

            if (hasSeparateName) {
                hodem = typeof submittedHodem === 'string' ? submittedHodem.trim() : '';
                tenlot = typeof submittedTenlot === 'string' ? submittedTenlot.trim() : '';
                ten = typeof submittedTen === 'string' ? submittedTen.trim() : '';
            } else if (hoVaTen && typeof hoVaTen === 'string') {
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

            if (!ten || ten.length > 10) {
                return res.status(400).json({ error: 'Tên (từ cuối cùng) không được để trống hoặc vượt quá 10 ký tự.' });
            }
            if (hodem.length > 20 || tenlot.length > 20) {
                return res.status(400).json({ error: 'Họ và tên lót không được vượt quá 20 ký tự.' });
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
            const userExists = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true }
            });
            if (!userExists) {
                return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
            }

            const duplicatePhone = await prisma.user.findFirst({
                where: {
                    dienthoai: soDienThoai,
                    id: { not: userId }
                },
                select: { id: true }
            });
            if (duplicatePhone) {
                return res.status(409).json({ error: 'Số điện thoại này đã được tài khoản khác sử dụng.' });
            }

            const avatarBytes = req.file ? new Uint8Array(req.file.buffer) : undefined;
            const avatarMime = req.file ? req.file.mimetype : undefined;
            const diaChiBool = isDiaChiPublic === 'true' || isDiaChiPublic === true;
            const soTaiKhoanBool = isSoTaiKhoanPublic === 'true' || isSoTaiKhoanPublic === true;
            const nganHangBool = isNganHangPublic === 'true' || isNganHangPublic === true;

            await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { hodem, tenlot, ten, dienthoai: soDienThoai }
                }),
                prisma.userProfile.upsert({
                    where: { user_id: userId },
                    update: {
                        dia_chi: diaChi.trim(),
                        is_dia_chi_public: diaChiBool,
                        so_tai_khoan: soTaiKhoan.trim(),
                        is_so_tai_khoan_public: soTaiKhoanBool,
                        ngan_hang: nganHang.trim(),
                        is_ngan_hang_public: nganHangBool,
                        ...(avatarBytes ? { avatar: avatarBytes, avatar_mimetype: avatarMime } : {})
                    },
                    create: {
                        user_id: userId,
                        dia_chi: diaChi.trim(),
                        is_dia_chi_public: diaChiBool,
                        so_tai_khoan: soTaiKhoan.trim(),
                        is_so_tai_khoan_public: soTaiKhoanBool,
                        ngan_hang: nganHang.trim(),
                        is_ngan_hang_public: nganHangBool,
                        avatar: avatarBytes || null,
                        avatar_mimetype: avatarMime || null
                    }
                })
            ]);

            const avatar = req.file
                ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
                : undefined;

            return res.status(200).json({
                message: 'Đã lưu thông tin cá nhân.',
                ten,
                soDienThoai,
                ...(avatar ? { avatar } : {})
            });
        } catch (error) {
            const status = error.code === 'P2002' ? 409 : 500;
            const message = status === 409
                ? 'Số điện thoại này đã được tài khoản khác sử dụng.'
                : error.message;
            return res.status(status).json({ error: message });
        }
    }
);

if (!process.env.VERCEL) {
    server.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
}

module.exports = app;