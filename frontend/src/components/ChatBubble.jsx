import React from 'react';

function ChatBubble({ message, isMe }) {
  // Lấy các thuộc tính từ đối tượng message
  const { sender, text, created_at, avatar } = message;
  
  // Định dạng lại thời gian hiển thị (ví dụ: 14:30)
  const timeString = created_at ? new Date(created_at).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }) : "Vừa xong";

  return (
    <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
      {/* Avatar người gửi (Chỉ hiện nếu KHÔNG phải là mình) */}
      {!isMe && (
        <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--avatar-background)] text-xs font-bold text-[var(--avatar-text)] mt-auto mb-5 shadow-sm">
          {avatar || (sender ? sender.charAt(0).toUpperCase() : "U")}
        </div>
      )}

      {/* Khung nội dung tin nhắn */}
      <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
        {/* Tên người gửi (Chỉ hiện nếu KHÔNG phải là mình) */}
        {!isMe && (
          <span className="mb-1 ml-1 text-xs text-[var(--text-muted)]">
            {sender}
          </span>
        )}

        {/* Bong bóng Chat */}
        <div
          className={`px-4 py-2.5 text-sm shadow-sm ${
            isMe
              ? "bg-[var(--primary)] text-[var(--primary-text)] rounded-2xl rounded-br-sm" 
              : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-2xl rounded-bl-sm"
          }`}
        >
          {text}
        </div>

        {/* Thời gian gửi tin */}
        <span className="mt-1 text-[10px] text-[var(--text-soft)]">
          {timeString}
        </span>
      </div>
    </div>
  );
}

export default ChatBubble;