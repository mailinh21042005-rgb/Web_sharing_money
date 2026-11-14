import ThemeToggle from "./ThemeToggle";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("https://web-sharing-money.onrender.com");

function Navbar() {
  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  });
  const [hasNewNotif, setHasNewNotif] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Bật socket thông báo khi user đã đăng nhập
  useEffect(() => {
    if (user && user.id) {
      socket.emit("userLogin", user.id);

      // Nhận thông báo Real-time
      const handleNotification = (data) => {
        alert("🔔 " + data.message);
        setHasNewNotif(true);
      };

      socket.on("newNotification", handleNotification);

      return () => {
        socket.off("newNotification", handleNotification);
      };
    }
  }, [user]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = user?.ten || "";
  const isLoggedIn = Boolean(user);

  // Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsDropdownOpen(false);
    navigate("/login");
  };

  const avatarLetter = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <nav className="relative flex items-center justify-between px-6 py-5 lg:px-10">
      {/* Logo */}
      <Link to="/" className="flex shrink-0 items-center gap-3 transition hover:opacity-80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-lg text-[var(--primary-text)]">
            ✦
          </div>
          <span className="hidden text-xl font-semibold tracking-tight text-[var(--primary)] sm:block">
            Share Money
          </span>
        </div>
      </Link>

      {/* Desktop Navigation (Chỉ hiện trên màn hình rất lớn - Máy tính) */}
      <div className="hidden xl:flex items-center gap-6 lg:gap-8">
        <Link to="/" className="text-sm font-semibold text-[var(--primary)] transition hover:opacity-80 whitespace-nowrap">
          Trang chủ
        </Link>
        <Link to="/groups" className="text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--primary)] whitespace-nowrap">
          Nhóm của tôi
        </Link>
        <Link 
          to="/notifications" 
          onClick={() => setHasNewNotif(false)} 
          className="relative text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--primary)] whitespace-nowrap"
        >
          Thông báo
          {hasNewNotif && (
            <span className="absolute -right-2 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--danger)]"></span>
            </span>
          )}
        </Link>
        <Link to="/scan-bill" className="text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--primary)] whitespace-nowrap">
          Quét bill
        </Link>
        <Link to="/minigames" className="text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--primary)] whitespace-nowrap">
          Minigame
        </Link>
      </div>

      {/* Control Area (Theme + User) */}
      <div className="flex shrink-0 items-center gap-3">
        <ThemeToggle />
        
        {isLoggedIn ? (
          <div className="relative flex items-center gap-3" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 transition hover:opacity-80 focus:outline-none sm:gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--avatar-background)] font-semibold text-[var(--avatar-text)] shadow-sm">
                {avatarLetter}
              </div>
              <span className="hidden text-sm font-medium text-[var(--text)] sm:block whitespace-nowrap max-w-[100px] truncate">
                {userName}
              </span>
            </button>

            {/* Dropdown Avatar Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 shadow-lg z-50">
                
                {/* Mobile/Tablet Navigation Links (Chỉ hiện khi màn hình nhỏ hơn Máy tính) */}
                <div className="xl:hidden">
                  <Link to="/" onClick={() => setIsDropdownOpen(false)} className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-soft)]">
                    🏠 Trang chủ
                  </Link>
                  <Link to="/groups" onClick={() => setIsDropdownOpen(false)} className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-soft)]">
                    👥 Nhóm của tôi
                  </Link>
                  <Link 
                    to="/notifications" 
                    onClick={() => { setHasNewNotif(false); setIsDropdownOpen(false); }} 
                    className="relative flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                  >
                    <span>🔔 Thông báo</span>
                  </Link>
                  <Link to="/scan-bill" onClick={() => setIsDropdownOpen(false)} className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-soft)]">
                    🧾 Quét bill
                  </Link>
                  <Link to="/minigames" onClick={() => setIsDropdownOpen(false)} className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-soft)]">
                    🎮 Minigame
                  </Link>
                  <div className="mx-4 my-1 h-px bg-[var(--border)]"></div>
                </div>

                {/* Account Links (Luôn hiện) */}
                <Link 
                  to="/friends" 
                  onClick={() => setIsDropdownOpen(false)}
                  className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                >
                  🤝 Bạn bè
                </Link>
                <div className="mx-4 my-1 h-px bg-[var(--border)]"></div>
                <button 
                  onClick={handleLogout} 
                  className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                >
                  🚪 Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button onClick={() => navigate("/register")} className="hidden text-sm font-medium text-[var(--text)] transition hover:opacity-80 sm:block whitespace-nowrap">
              Đăng ký
            </button>
            <button onClick={() => navigate("/login")} className="rounded-full bg-[var(--button-primary)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-text)] transition hover:opacity-80 whitespace-nowrap">
              Đăng nhập
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;