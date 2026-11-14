import { useState, useEffect } from "react";

function ManageGroup({ onGroupCreated }) {
  const [groupName, setGroupName] = useState("");
  const [currentGroupId, setCurrentGroupId] = useState(null);
  
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);

  const [showAddMember, setShowAddMember] = useState(false);

  // Lấy ID thật từ localStorage
  const storedUser = JSON.parse(localStorage.getItem('user'));
  const currentUserId = storedUser ? storedUser.id : null;

  // Lấy danh sách bạn bè từ cơ sở dữ liệu khi component được load
  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUserId) return;
      try {
        const response = await fetch(`https://web-sharing-money.onrender.com/api/friends/${currentUserId}`);
        const data = await response.json();
        if (response.ok) {
          setFriends(data);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách bạn bè:", error);
      }
    };

    fetchFriends();
  }, [currentUserId]);

  // Gọi API tạo nhóm
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) return;
    if (!currentUserId) return alert("Vui lòng đăng nhập trước!");
    
    try {
      const response = await fetch('https://web-sharing-money.onrender.com/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: groupName, created_by: currentUserId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      alert(data.message);
      setCurrentGroupId(data.groupId);
      
      // Báo cho trang MyGroups hoặc Dashboard load lại danh sách nhóm
      if (onGroupCreated) onGroupCreated();
      
      setMembers([{ 
        id: currentUserId, 
        name: "Bạn (Admin)", 
        avatar: storedUser.ten ? storedUser.ten.charAt(0).toUpperCase() : "U", 
        role: "admin" 
      }]);
      setGroupName("");
    } catch (err) {
      alert("Lỗi tạo nhóm: " + err.message);
    }
  };

  // Gọi API thêm thành viên
  const handleAddMember = async (friend) => {
    if (!currentGroupId) return alert("Vui lòng tạo nhóm trước!");
    
    try {
      const response = await fetch('https://web-sharing-money.onrender.com/api/groups/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: currentGroupId, user_id: friend.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      alert(data.message);
      setMembers([...members, { ...friend, role: "member" }]);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveMember = (memberId, memberName) => {
    if (confirm(`Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`)) {
      setMembers(members.filter(m => m.id !== memberId));
    }
  };

  const handleDeleteGroup = () => {
    if (confirm("Cảnh báo: Bạn có chắc chắn muốn giải tán nhóm này không? Hành động này không thể hoàn tác.")) {
      alert("Đã giải tán nhóm.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Khối Tạo nhóm mới */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-[var(--text)] mb-4">Tạo nhóm mới</h2>
        <form onSubmit={handleCreateGroup} className="flex gap-3">
          <input
            type="text"
            placeholder="Tên nhóm (vd: Đi Đà Lạt)..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
          />
          <button 
            type="submit"
            className="rounded-xl bg-[var(--button-primary)] px-5 py-2 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]"
          >
            Tạo
          </button>
        </form>
      </div>

      {/* Khối Quản lý thành viên (Chỉ hiển thị khi đã tạo nhóm thành công) */}
      {currentGroupId && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text)]">Thành viên nhóm</h2>
              <p className="text-sm text-[var(--text-muted)]">{members.length} người</p>
            </div>
            <button 
              onClick={() => setShowAddMember(!showAddMember)}
              className="text-sm font-semibold text-[var(--primary)] transition hover:opacity-80"
            >
              {showAddMember ? "Đóng x" : "+ Thêm thành viên"}
            </button>
          </div>

          {/* Box chọn bạn bè để thêm */}
          {showAddMember && (
            <div className="mb-6 rounded-2xl bg-[var(--background)] p-4 border border-[var(--border)]">
              <p className="text-sm font-medium text-[var(--text)] mb-3">Chọn bạn bè để thêm:</p>
              {friends.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">Bạn chưa có bạn bè nào.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--avatar-background)] text-xs font-semibold text-[var(--avatar-text)]">
                          {friend.avatar}
                        </div>
                        <span className="text-sm text-[var(--text)]">{friend.name}</span>
                      </div>
                      <button 
                        onClick={() => handleAddMember(friend)}
                        className="text-xs font-semibold px-3 py-1 rounded bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-text)] transition"
                      >
                        Thêm
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Danh sách thành viên hiện tại trong nhóm */}
          <div className="space-y-4">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--avatar-background)] font-semibold text-[var(--avatar-text)]">
                    {member.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">
                      {member.name} {member.role === 'admin' && <span className="text-xs text-[var(--primary)] ml-1">(Trưởng nhóm)</span>}
                    </p>
                  </div>
                </div>
                {member.role !== 'admin' && (
                  <button 
                    onClick={() => handleRemoveMember(member.id, member.name)}
                    className="text-xs text-[var(--danger)] hover:underline"
                  >
                    Xóa
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Nút xóa nhóm */}
          <div className="mt-8 pt-4 border-t border-[var(--border)]">
            <button 
              onClick={handleDeleteGroup}
              className="w-full rounded-xl border border-[var(--danger)] bg-transparent py-3 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
            >
              Giải tán nhóm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageGroup;