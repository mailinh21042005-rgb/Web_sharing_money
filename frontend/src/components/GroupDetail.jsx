import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// Khởi tạo kết nối Socket ngoài component để tránh render lại nhiều lần
const socket = io("http://localhost:5000");

function GroupDetail({ group, onClose, onGroupUpdated }) {
  const [viewMode, setViewMode] = useState("chat"); // 'chat' hoặc 'settings'
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const messagesEndRef = useRef(null);

  const storedUser = JSON.parse(localStorage.getItem('user'));
  const currentUserId = storedUser ? storedUser.id : null;

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, viewMode]);

  // Thiết lập Socket và Kéo dữ liệu tin nhắn cũ từ DB
  useEffect(() => {
    if (!currentUserId || !group.id) return;

    // 1. Join room (Tham gia vào kênh chat riêng của nhóm này)
    socket.emit("joinGroup", group.id);

    // 2. Kéo tin nhắn cũ từ Database
    fetch(`http://localhost:5000/api/groups/${group.id}/messages`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
            setChatHistory(data);
        } else {
            setChatHistory([]);
        }
      })
      .catch(err => console.error(err));

    // 3. Lắng nghe tin nhắn mới theo thời gian thực (Real-time)
    const handleNewMessage = (newMsg) => {
      setChatHistory(prev => [...prev, newMsg]);
    };
    
    socket.on("receiveMessage", handleNewMessage);

    // Cleanup kết nối khi đóng Modal
    return () => {
      socket.off("receiveMessage", handleNewMessage);
    };
  }, [group.id, currentUserId]);

  // Load danh sách thành viên của nhóm cụ thể này và danh sách bạn bè
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUserId || viewMode !== "settings") return;
      try {
        // Lấy danh sách bạn bè
        const friendsRes = await fetch(`http://localhost:5000/api/friends/${currentUserId}`);
        if (friendsRes.ok) setFriends(await friendsRes.json());

        // Lấy danh sách thành viên từ Database
        const membersRes = await fetch(`http://localhost:5000/api/groups/${group.id}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          
          // Lọc lại để đổi tên bản thân thành chữ "Bạn" cho thân thiện
          const formattedMembers = membersData.map(m => 
            m.id === currentUserId ? { ...m, name: "Bạn" } : m
          );
          setMembers(formattedMembers);
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu nhóm:", error);
      }
    };
    fetchData();
  }, [currentUserId, group.id, viewMode]);

  // Xử lý tin nhắn gửi đi
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Chuẩn bị gói dữ liệu tin nhắn gửi lên Server
    const msgData = {
      group_id: group.id,
      user_id: currentUserId,
      message: message.trim(),
      sender_name: storedUser.ten,
      avatar: storedUser.ten.charAt(0).toUpperCase()
    };

    // Phát tin nhắn qua Socket
    socket.emit("sendMessage", msgData);
    setMessage(""); // Xóa trắng ô nhập
  };

  // Xử lý quản lý nhóm: thêm/xóa thành viên, giải tán nhóm
  const handleAddMember = async (friend) => {
    try {
      const response = await fetch('http://localhost:5000/api/groups/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: group.id, user_id: friend.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      alert(data.message);
      setMembers([...members, { ...friend, role: "member" }]);
      onGroupUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`)) return;
    try {
      const response = await fetch('http://localhost:5000/api/groups/remove-member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: group.id, user_id: memberId })
      });
      if (!response.ok) throw new Error("Lỗi khi xóa thành viên");
      
      setMembers(members.filter(m => m.id !== memberId));
      onGroupUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Cảnh báo: Bạn có chắc chắn muốn giải tán nhóm này không? Toàn bộ dữ liệu sẽ bị xóa.")) return;
    try {
      const response = await fetch(`http://localhost:5000/api/groups/${group.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Lỗi khi giải tán nhóm");
      
      alert("Đã giải tán nhóm thành công!");
      onGroupUpdated();
      onClose(); // Đóng modal
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex h-[80vh] flex-col overflow-hidden">
      {/* Header Modal */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{group.name}</h2>
          <p className="text-xs text-[var(--text-muted)]">{group.members?.length || 1} thành viên</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode(viewMode === "chat" ? "settings" : "chat")}
            className="rounded-lg bg-[var(--surface-soft)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--border)]"
          >
            {viewMode === "chat" ? "⚙️ Quản lý" : "💬 Chat"}
          </button>
        </div>
      </div>

      {/* Màn hình chat */}
      {viewMode === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4 bg-[var(--background)] rounded-xl mt-2">
            {chatHistory.length === 0 && (
              <p className="text-center text-sm text-[var(--text-muted)] mt-4">
                Chưa có tin nhắn nào. Bắt đầu trò chuyện!
              </p>
            )}

            {chatHistory.map((msg, index) => {
              const isMe = msg.user_id === currentUserId;

              return (
                <div key={msg.id || index} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
                  {/* Avatar người gửi (Chỉ hiện nếu KHÔNG phải là mình) */}
                  {!isMe && (
                    <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--avatar-background)] text-xs font-bold text-[var(--avatar-text)] mt-auto mb-5 shadow-sm">
                      {msg.avatar || (msg.sender ? msg.sender.charAt(0).toUpperCase() : "U")}
                    </div>
                  )}

                  {/* Khung nội dung tin nhắn */}
                  <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    {/* Tên người gửi */}
                    {!isMe && (
                      <span className="mb-1 ml-1 text-xs text-[var(--text-muted)]">
                        {msg.sender}
                      </span>
                    )}

                    {/* Bubble Chat */}
                    <div
                      className={`px-4 py-2.5 text-sm shadow-sm ${
                        isMe
                          ? "bg-[var(--primary)] text-[var(--primary-text)] rounded-2xl rounded-br-sm" 
                          : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-2xl rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Thời gian gửi tin */}
                    <span className="mt-1 text-[10px] text-[var(--text-soft)]">
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }) : "Vừa xong"}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="mt-4 flex gap-2 border-t border-[var(--border)] pt-4">
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] outline-none transition shadow-sm"
            />
            <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-text)] hover:opacity-80 shadow-md transition">
              ➤
            </button>
          </form>
        </>
      )}

      {/* Màn hình quản lý nhóm */}
      {viewMode === "settings" && (
        <div className="flex-1 overflow-y-auto space-y-6 py-2">
          {/* Thêm thành viên */}
          <div className="rounded-2xl bg-[var(--surface-soft)] p-4 border border-[var(--border)]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-[var(--text)]">Thành viên ({members.length})</h3>
              <button onClick={() => setShowAddMember(!showAddMember)} className="text-sm text-[var(--primary)]">
                {showAddMember ? "Đóng" : "+ Thêm mới"}
              </button>
            </div>
            
            {showAddMember && (
              <div className="mb-4 space-y-2 border-b border-[var(--border)] pb-4">
                {friends.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">Chưa có bạn bè để thêm.</p>
                ) : (
                  friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text)]">{friend.name}</span>
                      <button onClick={() => handleAddMember(friend)} className="text-xs bg-[var(--primary-soft)] text-[var(--primary)] px-3 py-1 rounded transition hover:opacity-80">
                        Thêm
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Danh sách thành viên */}
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[var(--avatar-background)] flex items-center justify-center text-xs font-bold text-[var(--avatar-text)]">{m.avatar}</div>
                    <span className="text-sm text-[var(--text)]">{m.name} {m.role === 'admin' && '(Admin)'}</span>
                  </div>
                  {m.role !== 'admin' && (
                    <button onClick={() => handleRemoveMember(m.id, m.name)} className="text-xs text-[var(--danger)] hover:underline">Xóa</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Xóa nhóm */}
          <button onClick={handleDeleteGroup} className="w-full rounded-xl border border-[var(--danger)] py-3 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] transition">
            Giải tán nhóm
          </button>
        </div>
      )}
    </div>
  );
}

export default GroupDetail;