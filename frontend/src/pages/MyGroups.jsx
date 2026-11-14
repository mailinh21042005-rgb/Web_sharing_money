import { useState, useEffect, useCallback } from "react";
import GroupCard from "../components/GroupCard";
import ManageGroup from "../components/ManageGroup";
import GroupDetail from "../components/GroupDetail"; 
import { io } from "socket.io-client";

const socket = io("https://web-sharing-money.onrender.com");

function MyGroups() {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null); 
  const [refreshTrigger, setRefreshTrigger] = useState(0); 
  
  // State lưu trạng thái thông báo: { [groupId]: 'unread' | 'read' }
  const [notifStatus, setNotifStatus] = useState({});

  const storedUser = JSON.parse(localStorage.getItem('user'));
  const currentUserId = storedUser ? storedUser.id : null;

  // Nhận thông báo tin nhắn mới từ mọi nhóm
  useEffect(() => {
    if (!currentUserId) return;
    
    const handleNewGroupMessage = (newMsg) => {
      // Nếu nhóm CÓ tin nhắn mới KHÔNG PHẢI là nhóm đang mở, đổi trạng thái thành chưa đọc (đỏ)
      if (!selectedGroup || selectedGroup.id !== newMsg.group_id) {
        setNotifStatus(prev => ({
          ...prev, 
          [newMsg.group_id]: 'unread'
        }));
      }
    };
    
    socket.on("receiveMessage", handleNewGroupMessage);
    
    return () => {
      socket.off("receiveMessage", handleNewGroupMessage);
    };
  }, [currentUserId, selectedGroup]);

  // Khai báo hàm fetch data
  const fetchMyGroups = useCallback(async () => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`https://web-sharing-money.onrender.com/api/users/${currentUserId}/groups`);
      const data = await response.json();
      
      if (response.ok) {
        setGroups(data);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách nhóm:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // Tự động fetch data
  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups, refreshTrigger]);

  const handleGroupUpdated = () => {
    setRefreshTrigger(prev => prev + 1); 
  };

  // Xử lý khi bấm mở nhóm
  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    
    // Đổi trạng thái từ 'unread' (chưa đọc) sang 'read' (đã đọc)
    if (notifStatus[group.id] === 'unread') {
      setNotifStatus(prev => ({
        ...prev,
        [group.id]: 'read'
      }));
    }
    
    // GỬI TÍN HIỆU TẮT CHẤM ĐỎ LÊN THANH NAVBAR
    window.dispatchEvent(new Event("clearNavbarNotif"));
  };

  if (!currentUserId) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-10">
        <h2 className="text-2xl font-bold text-[var(--text)]">Bạn chưa đăng nhập</h2>
        <p className="mt-2 text-[var(--text-muted)]">Vui lòng đăng nhập để xem danh sách nhóm của bạn.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 relative lg:px-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Nhóm của tôi</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Quản lý và theo dõi chi tiêu trong các nhóm bạn tham gia.
          </p>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)}
          className="rounded-full bg-[var(--button-primary)] px-6 py-3 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]"
        >
          + Tạo nhóm mới
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-[var(--text-muted)]">Đang tải danh sách nhóm...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-xl font-medium text-[var(--text)]">Bạn chưa tham gia nhóm nào</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Hãy tạo một nhóm mới hoặc chờ bạn bè mời vào nhóm.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const status = notifStatus[group.id];

            return (
              <div 
                key={group.id} 
                onClick={() => handleGroupClick(group)} 
                className="cursor-pointer relative"
              >
                {/* Chấm thông báo Đỏ (Chưa đọc) - Đã bỏ animate-ping */}
                {status === 'unread' && (
                  <span className="absolute -right-1 -top-1 z-10 h-4 w-4 rounded-full bg-[var(--danger)] border-2 border-[var(--background)] shadow-sm"></span>
                )}
                
                {/* Chấm thông báo Xanh (Đã đọc) */}
                {status === 'read' && (
                  <span className="absolute -right-1 -top-1 z-10 h-4 w-4 rounded-full bg-[var(--success)] border-2 border-[var(--background)] shadow-sm"></span>
                )}
                
                <GroupCard 
                  icon="👥" 
                  name={group.name} 
                  transactions={group.transaction_count || 0} 
                  amount={`₫${group.total_amount || 0}`} 
                  members={group.members ? group.members.map(m => m.charAt(0).toUpperCase()) : ["?"]} 
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Chi tiết Nhóm (Chat + Quản lý) */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[var(--background)] rounded-3xl shadow-2xl p-6">
            <button 
              onClick={() => setSelectedGroup(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]"
            >
              ✕
            </button>
            <div className="mt-4">
              <GroupDetail 
                group={selectedGroup} 
                onClose={() => setSelectedGroup(null)}
                onGroupUpdated={handleGroupUpdated} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo nhóm */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--background)] shadow-2xl p-6">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]"
            >
              ✕
            </button>
            <div className="mt-4">
              <ManageGroup 
                onGroupCreated={() => {
                  handleGroupUpdated();
                  setShowCreateModal(false); 
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default MyGroups;