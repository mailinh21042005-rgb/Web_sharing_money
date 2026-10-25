# Web Sharing Money - Ứng dụng quản lý tài chính nhóm
    * Khi thực hiện đi chơi hay mua sắm chung với nhóm bạn, sẽ có hoạt động hay món đồ mà không phải cả nhóm cùng tham gia.
    * Hay việc có nhiều người cùng chi tiền trước cho cả nhóm dễ gây bối rối khi tổng kết hoạt động chi tiêu sau một ngày dài mệt mỏi.
    => Với mong muốn tối ưu hóa thời gian khi chia tiền chi tiêu cho từng người trong quá trình thực hiện mua sắm chung, trang web của chúng mình ra đời để giúp mọi người thay vì phải tính toán thủ công cho từng món hàng mà có thể tự động hóa quá trình này <3  

## Các Tính Năng Đã Hoàn Thành

*   **Xây dựng hệ thống đăng ký và đăng nhập tài khoản:**
    *   Yêu cầu người dùng nếu chưa có tài khoản thì sẽ phải đăng ký tài khoản.
    *   Việc đăng ký sẽ được liên kết thông qua Firebase để có thể gửi OTP xác thực qua tin nhắn SMS (https://console.firebase.google.com/u/0/project/web-sharing-money)
      - Nếu tài khoản mới được đăng ký sử dụng số điện thoại/email/tên đăng nhập trùng với tài khoản đã có thì sẽ thông báo bị trùng thông tin.
      - Nếu trong quá trình đăng nhập mà không nhớ mật khẩu thì sẽ có tính năng **_Quên mật khẩu_** để người dùng đặt lại mật khẩu.
    *   Khi thực hiện đăng nhập sẽ cập nhật lại tên user và avt theo chữ cái đầu trong tên người đó.
*   **Bảo mật & Xử lý Dữ liệu:**
    *   Chuẩn hóa số điện thoại tự động sang đầu số quốc tế (`+84`) trước khi gửi lên Firebase.
    *   Mã hóa mật khẩu bằng `bcrypt` an toàn trước khi lưu vào cơ sở dữ liệu.
*   **Cơ sở dữ liệu đám mây:**
    *   Sử dụng **Azure SQL Database** giúp các thành viên trong nhóm làm việc với nhau.
    *   Thực hiện lưu thông tin bao gồm:
      - Họ đệm.
      - Tên lót.
      - Tên.
      - Tên đăng nhập.
      - Password (sẽ được lưu dưới dạng hash).
      - Vai trò của người đăng nhập (mặc định là user).

## 🛠 Hướng dẫn sử dụng trước khi dùng

*   Thực hiện pull code mới nhất về máy.
*   Sau khi pull, mở Terminal và thực hiện cd tới vị trí thư mục Web_sharing_money/backend
*   Thực hiện chạy lệnh node server.js
    **Ví dụ:** <img width="573" height="97" alt="image" src="https://github.com/user-attachments/assets/2fc62511-e29e-4f5e-ab91-b847501cba85" />
*   Mở một Terminal mới và thực hiện cd tới vị trí thư mục Web_sharing_money/frontend
*   Sau đó thực hiện chạy lệnh npm run dev
    **Ví dụ** <img width="622" height="233" alt="image" src="https://github.com/user-attachments/assets/3e2a11e5-d37d-4dcc-a68d-38d52eb27556" />

## Cấu trúc thư mục hiện tại:
*   Frontend:
    src
      pages
        Dashboard.jsx: thể hiện thông tin hiện trên giao diện chính (cả trước khi đăng nhập và sau khi đăng nhập).
        ForgotPassword.jsx: cập nhật logic để người dùng tạo lại mật khẩu khi bấm vào _**Quên mật khẩu**_
        Login.jsx: thực hiện cơ chế đăng nhập bao gồm nhập các thông tin người dùng và mật khẩu.
        Register.jsx: thực hiện cơ chế đăng ký (bao gồm các trường thông tin Họ đệm, Tên lót, Tên, Tên đăng nhập, Password) và nhập mã OTP vừa được gửi xác thực tới điện thoại.
      firebase.js: thể hiện các thông tin trong cơ chế tường lửa (mở source để xem chi tiết).
*   Backend:
    db.js: để khởi tạo kết nối với Azure SQL.
    server.js: xây dựng hệ thống api cho việc kiểm tra hoạt động, đăng ký, trùng tài khoản, đăng nhập).
