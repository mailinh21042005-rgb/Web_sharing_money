import { useState } from "react";

function AddFriend() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  // Lấy ID thật từ localStorage
  const storedUser = JSON.parse(localStorage.getItem('user'));
  const currentUserId = storedUser ? storedUser.id : null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError("");
    setSearchResult(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/users/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: searchQuery.trim() })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      // Chặn việc tự kết bạn với chính mình
      if (data.id === currentUserId) {
        throw new Error("Bạn không thể tự kết bạn với chính mình!");
      }
      
      setSearchResult({
        id: data.id,
        name: `${data.hodem} ${data.tenlot} ${data.ten}`,
        phone: data.dienthoai,
        username: data.username, // Lấy thêm username để hiển thị
        avatar: data.ten.charAt(0).toUpperCase()
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async () => {
    if (!currentUserId) return alert("Vui lòng đăng nhập trước!");

    try {
      const response = await fetch('http://localhost:5000/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId, friend_id: searchResult.id, sender_name: storedUser.ten})
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      alert(data.message);
      setSearchResult(null);
      setSearchQuery("");
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  };

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[var(--text)] mb-4">Tìm bạn bè</h2>
      
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Nhập SĐT hoặc Tên đăng nhập..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-4 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
        />
        <button 
          type="submit"
          disabled={isSearching}
          className="rounded-xl bg-[var(--button-primary)] px-5 py-2 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)] disabled:opacity-70"
        >
          {isSearching ? "Đang tìm..." : "Tìm kiếm"}
        </button>
      </form>

      {error && <p className="text-sm text-[var(--danger)] mb-4">{error}</p>}

      {searchResult && (
        <div className="flex items-center justify-between rounded-2xl bg-[var(--background)] p-4 border border-[var(--border)]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--avatar-background)] text-lg font-semibold text-[var(--avatar-text)]">
              {searchResult.avatar}
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">{searchResult.name}</p>
              <p className="text-xs text-[var(--text-muted)]">@{searchResult.username} • {searchResult.phone}</p>
            </div>
          </div>
          <button 
            onClick={handleAddFriend}
            className="rounded-full bg-[var(--button-secondary)] border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
          >
            + Thêm bạn
          </button>
        </div>
      )}
    </div>
  );
}

export default AddFriend;