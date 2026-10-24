import { useState } from "react";
import GroupCard from "../components/GroupCard";
import DebtCard from "../components/DebtCard";
import ActivityItem from "../components/ActivityItem";
import StatCard from "../components/StatCard";

function Dashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [userName, setUserName] = useState("Linh");
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* Welcome */}
      <section className="mb-10 overflow-hidden rounded-[32px] bg-[var(--primary-soft)] px-7 py-8 md:px-10 md:py-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-sm font-medium text-[var(--text-muted)]">
              Chủ nhật, 18 tháng 10
            </p>

            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-[var(--text)] md:text-4xl">
              {isLoggedIn
                ? `Chào ${userName}, hôm nay chia tiền thật nhẹ nhàng nhé ✨`
                : "Hãy đăng nhập để mở khóa toàn bộ tính năng nha ✨"}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
              {isLoggedIn
                ? "Theo dõi các khoản chi tiêu và công nợ bạn một cách đơn giản."
                : "Đăng nhập ngay để quản lý nhóm và các khoản chia tiền dễ dàng."}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button className="rounded-full border border-[var(--border)] bg-[var(--button-secondary)] px-5 py-3 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]">
              + Thêm chi tiêu
            </button>

            <button className="rounded-full bg-[var(--button-primary)] px-5 py-3 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]">
              + Tạo nhóm mới
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bạn cần trả"
          amount="₫125.000"
          description="Cho 2 người"
          icon="↗"
          variant="pink"
        />

        <StatCard
          title="Mọi người nợ bạn"
          amount="₫280.000"
          description="Từ 3 người"
          icon="↓"
          variant="green"
        />

        <StatCard
          title="Chi tiêu tháng này"
          amount="₫1.450.000"
          description="+12% so với tháng trước"
          icon="◌"
          variant="yellow"
        />

        <StatCard
          title="Nhóm đang hoạt động"
          amount="3"
          description="Nhóm của bạn"
          icon="♡"
          variant="white"
        />
      </section>

      {/* Main content */}
      <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Groups */}
        <div>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text)]">
                Nhóm gần đây
              </h2>

              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Những nhóm bạn thường xuyên sử dụng
              </p>
            </div>

            <button className="text-sm font-semibold text-[var(--primary)] transition hover:opacity-80">
              Xem tất cả →
            </button>
          </div>

          <div className="grid gap-4">
            <GroupCard
              icon="💕"
              name="Hội bạn thân"
              transactions="12"
              amount="₫450.000"
              members={["L", "N", "C"]}
            />

            <GroupCard
              icon="🏠"
              name="Ở ghép vui vẻ"
              transactions="8"
              amount="₫820.000"
              members={["L", "M", "N", "C"]}
            />

            <GroupCard
              icon="🌴"
              name="Team đi Đà Lạt"
              transactions="5"
              amount="₫1.280.000"
              members={["L", "A", "T"]}
            />
          </div>
        </div>

        {/* Debt */}
        <div>
          <DebtCard />
        </div>
      </section>

      {/* Recent activity */}
      <section className="mt-10 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text)]">
              Hoạt động gần đây
            </h2>

            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Các khoản chi tiêu mới nhất
            </p>
          </div>

          <button className="text-sm font-semibold text-[var(--primary)] transition hover:opacity-80">
            Xem lịch sử →
          </button>
        </div>

        <div className="mt-4">
          <ActivityItem
            icon="🍜"
            name="Lẩu cuối tuần"
            person="Linh đã trả"
            date="Hôm nay"
            amount="₫600.000"
          />

          <ActivityItem
            icon="🛒"
            name="Hóa đơn siêu thị"
            person="Nọc đã trả"
            date="Hôm qua"
            amount="₫420.000"
          />

          <ActivityItem
            icon="☕"
            name="Cà phê và bánh"
            person="Nhi đã trả"
            date="16/10/2026"
            amount="₫120.000"
          />
        </div>
      </section>
    </main>
  );
}

export default Dashboard;