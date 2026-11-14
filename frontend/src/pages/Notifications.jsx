import { useState, useEffect } from "react";

function Notifications() {
  const [requests, setRequests] = useState([]);
  const storedUser = JSON.parse(localStorage.getItem('user'));
  const currentUserId = storedUser ? storedUser.id : null;

  useEffect(() => {
    if (currentUserId) {
      fetch(`https://web-sharing-money.onrender.com/api/notifications/${currentUserId}`)
        .then(res => res.json())
        .then(data => setRequests(data))
        .catch(err => console.error("Lỗi tải thông báo:", err));
    }
  }, [currentUserId]);

  const handleRespond = async (senderId, action) => {
    try {
      const res = await fetch("https://web-sharing-money.onrender.com/api/friends/respond", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: senderId, receiver_id: currentUserId, action, responder_name: storedUser.ten})
      });
      if (res.ok) {
        if (action === 'accepted') {
          // Thay vì xóa khỏi danh sách, đổi trạng thái cục bộ thành 'accepted'
          setRequests(requests.map(req => 
            req.sender_id === senderId ? { ...req, status: 'accepted' } : req
          ));
        } else {
          // Nếu từ chối thì xóa luôn khỏi giao diện
          setRequests(requests.filter(req => req.sender_id !== senderId));
        }
      }
    } catch (err) {
      alert("Lỗi xử lý yêu cầu!");
    }
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) return "Vừa xong";
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    if (diffInHours < 24 && now.getDate() === date.getDate()) return `${diffInHours} giờ trước`;
    if (diffInDays === 1 || (diffInHours >= 24 && now.getDate() !== date.getDate())) return "Hôm qua";
    if (diffInDays < 7) return `${diffInDays} ngày trước`;
    
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-6">Thông báo</h1>
      {requests.length === 0 ? (
        <p className="text-[var(--text-muted)]">Bạn không có thông báo nào mới.</p>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.sender_id} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--avatar-background)] font-bold text-[var(--avatar-text)]">
                  {req.ten.charAt(0).toUpperCase()}
                </div>
                <div>
                  {req.status === 'accepted' ? (
                    <p className="text-sm text-[var(--text)]">
                      Bạn và <span className="font-semibold">{req.hodem} {req.tenlot} {req.ten}</span> đã trở thành bạn bè.
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--text)]">
                      <span className="font-semibold">{req.hodem} {req.tenlot} {req.ten}</span> đã gửi cho bạn một lời mời kết bạn.
                    </p>
                  )}
                  
                  <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                    {formatRelativeTime(req.created_at)}
                  </p>
                </div>
              </div>
              
              {/* Chỉ hiện nút Chấp nhận/Từ chối nếu chưa xử lý */}
              {req.status !== 'accepted' && (
                <div className="flex gap-2">
                  <button onClick={() => handleRespond(req.sender_id, 'accepted')} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-text)] hover:opacity-80">
                    Chấp nhận
                  </button>
                  <button onClick={() => handleRespond(req.sender_id, 'rejected')} className="rounded-xl bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)]">
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
export default Notifications;