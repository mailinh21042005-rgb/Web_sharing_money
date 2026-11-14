import { useState, useEffect } from "react";
import AddFriend from "../components/AddFriend"; // Giả sử component thêm bạn đã tồn tại

function Friends() {
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem('user'));
  const currentUserId = storedUser ? storedUser.id : null;

  const fetchFriends = async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`https://web-sharing-money.onrender.com/api/friends/${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách bạn bè:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [currentUserId]);

  const handleRemoveFriend = async (friendId, friendName) => {
    if (!confirm(`Bạn có chắc chắn muốn hủy kết bạn với ${friendName}?`)) return;
    
    try {
      const response = await fetch('https://web-sharing-money.onrender.com/api/friends/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId, friend_id: friendId })
      });
      
      if (response.ok) {
        // Cập nhật lại giao diện bằng cách lọc ra bạn vừa xóa
        setFriends(friends.filter(f => f.id !== friendId));
        alert("Đã hủy kết bạn!");
      } else {
        const data = await response.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Lỗi khi hủy kết bạn.");
    }
  };

  if (!currentUserId) {
    return <div className="py-20 text-center text-[var(--text)]">Vui lòng đăng nhập.</div>;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Bạn bè</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Danh sách bạn bè hiện tại ({friends.length})
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="rounded-full bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]"
        >
          + Thêm bạn bè
        </button>
      </div>

      {isLoading ? (
        <p className="text-center text-[var(--text-muted)]">Đang tải danh sách...</p>
      ) : friends.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
          <p className="text-[var(--text-muted)]">Bạn chưa có bạn bè nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {friends.map((friend) => (
            <div key={friend.id} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--avatar-background)] font-semibold text-[var(--avatar-text)]">
                  {friend.avatar}
                </div>
                <span className="text-sm font-medium text-[var(--text)]">{friend.name}</span>
              </div>
              <button 
                onClick={() => handleRemoveFriend(friend.id, friend.name)}
                className="text-xs text-[var(--danger)] transition hover:underline"
              >
                Xóa bạn
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tích hợp component Thêm Bạn (Giả định bạn đã có AddFriend.jsx) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-[var(--background)] p-6 shadow-2xl">
            <button 
              onClick={() => {
                setShowAddModal(false);
                fetchFriends(); // Load lại khi tắt popup
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]"
            >
              ✕
            </button>
            <div className="mt-4">
              <AddFriend />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Friends;