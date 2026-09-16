<div align="center">
  <img src="public/assets/logo.png" width="90" alt="An Lão">
  <h1>An Lão</h1>
  <p>Nền tảng kết nối gia đình với chăm sóc viên người cao tuổi tại nhà</p>
</div>

---

## Giới thiệu

An Lão là ứng dụng web full-stack phục vụ ba nhóm người dùng:

| Vai trò | Ai dùng | Làm được gì |
|---|---|---|
| **Gia đình** | Con cháu người cao tuổi | Lập hồ sơ sức khoẻ số, đặt ca chăm sóc, theo dõi GPS thời gian thực, thanh toán, đánh giá |
| **Người cao tuổi** | Chính các cụ | Màn hình chữ to, nút lớn, điều khiển bằng giọng nói, nhắc uống thuốc, nghe nhạc và kể chuyện |
| **Chăm sóc viên** | Điều dưỡng, chăm sóc viên | Đăng ký ca theo lịch rảnh, gợi ý lộ trình, nhật ký công việc điện tử (E-Logbook) |

---

## Cài đặt và chạy

Yêu cầu **Node.js 20 trở lên**.

```bash
# 1. Cài thư viện
npm install

# 2. Tạo file cấu hình
cp .env.example .env
#    Mở .env và đổi JWT_SECRET thành một chuỗi bí mật dài

# 3. Nạp dữ liệu mẫu (4 gói dịch vụ + tài khoản demo)
npm run seed

# 4. Khởi động
npm start
```

Mở trình duyệt tại **http://localhost:3000**

> Dùng `npm run dev` khi phát triển để server tự khởi động lại mỗi khi sửa mã.

### Tài khoản dùng thử

Mật khẩu của tất cả tài khoản đều là `123456`.

| Vai trò | Đăng nhập bằng |
|---|---|
| Gia đình | `giadinh@demo.vn` |
| Chăm sóc viên | `ha@demo.vn`, `minh@demo.vn`, `oanh@demo.vn`, `thu@demo.vn` |
| Người cao tuổi | `0903000001` |

---

## Cấu trúc thư mục

```
an-lao/
├── server/                    # Backend Node.js + Express
│   ├── index.js               # Điểm khởi động, gắn route, phục vụ file tĩnh
│   ├── db.js                  # Kết nối SQLite + toàn bộ schema (14 bảng)
│   ├── seed.js                # Nạp gói dịch vụ và dữ liệu mẫu
│   ├── utils.js               # Hàm dùng chung: tính tiền, phân quyền, sinh mã ca
│   ├── middleware/
│   │   └── auth.js            # Ký và kiểm tra JWT, chặn theo vai trò
│   └── routes/
│       ├── auth.js            # Đăng ký, đăng nhập, đổi mật khẩu
│       ├── elders.js          # Hồ sơ người cao tuổi, hồ sơ sức khoẻ, chỉ số, nhắc nhở
│       ├── caregivers.js      # Danh bạ và hồ sơ nghề nghiệp chăm sóc viên
│       ├── bookings.js        # Đặt lịch, E-Logbook, cập nhật, GPS
│       ├── packages.js        # Bảng giá và báo giá trước khi đặt
│       ├── payments.js        # Thanh toán và lịch sử chi tiêu
│       └── reviews.js         # Đánh giá sau ca
│
├── public/                    # Frontend thuần HTML/CSS/JS, không framework
│   ├── index.html             # Trang giới thiệu, bảng giá lấy từ API
│   ├── login.html
│   ├── register.html
│   ├── css/
│   │   ├── base.css           # Hệ thống thiết kế: màu, nút, form, thẻ
│   │   └── app.css            # Khung ứng dụng: thanh bên, dashboard
│   ├── js/
│   │   ├── api.js             # Lớp gọi API, quản lý token, hàm định dạng
│   │   └── nav.js             # Cấu hình thanh điều hướng theo vai trò
│   ├── assets/logo.png
│   └── app/
│       ├── family/            # index · elders · booking · booking-detail · caregivers · payments
│       ├── caregiver/         # index · shifts · logbook · profile
│       └── elder/             # index (giao diện chữ to, giọng nói)
│
├── data/                      # Nơi chứa file SQLite (tự sinh, không đẩy lên git)
├── .env.example
├── .gitignore
└── package.json
```

---

## Công nghệ sử dụng

**Backend** — Node.js, Express 5, SQLite (better-sqlite3), JWT, bcryptjs
**Frontend** — HTML, CSS, JavaScript thuần, không dùng framework nên không cần bước build
**Font** — Fraunces (tiêu đề) và Be Vietnam Pro (thân chữ)

Chọn SQLite để dự án chạy được ngay sau `npm install` mà không cần cài thêm máy chủ cơ sở dữ liệu. Khi lên production có thể chuyển sang PostgreSQL bằng cách thay lớp truy vấn trong `server/db.js`.

---

## Các tính năng chính

### Giao diện Gia đình

- **Hồ sơ sức khoẻ số** — bệnh lý nền, dị ứng, đơn thuốc, thói quen sinh hoạt, khả năng vận động, lịch tái khám. Chăm sóc viên chỉ xem được hồ sơ khi đã được chỉ định vào ca, kiểm soát ở hàm `resolveElder` trong `routes/elders.js`.
- **Đặt lịch linh hoạt** — theo giờ, theo ca, gói tháng hoặc thủ thuật lẻ. Chi phí hiện ngay trước khi xác nhận qua endpoint `/api/packages/quote`.
- **Theo dõi thời gian thực** — bản đồ lộ trình GPS vẽ bằng SVG thuần, tự làm mới mỗi 20 giây khi ca đang diễn ra. Kèm dòng thời gian cập nhật bữa ăn, hoạt động và chỉ số sinh tồn.
- **Thanh toán minh bạch** — tiền mặt, thẻ tín dụng hoặc chuyển khoản, có trang lịch sử giao dịch đầy đủ.
- **Đánh giá sau ca** — chấm sao và nhận xét, điểm trung bình tự cập nhật vào hồ sơ chăm sóc viên và quyết định thứ tự ưu tiên khi gợi ý.

### Giao diện Người cao tuổi

- Chữ 23px trở lên, nút cao tối thiểu 64px, màu tương phản cao, không dùng chữ mảnh.
- **Điều khiển bằng giọng nói** qua Web Speech API tiếng Việt. Các câu lệnh nhận diện được: *đọc nhắc nhở*, *nghe nhạc*, *bài tập*, *gọi người nhà*, *kể chuyện*, *hôm nay ai đến*.
- Nhắc uống thuốc và lịch khám, mỗi mục có nút đọc to riêng bằng `speechSynthesis` với tốc độ chậm.
- Nhạc dân ca, radio, kể chuyện ngắn và các bài tập nhẹ.
- Thanh cố định dưới màn hình luôn có nút **Gọi người nhà** và **Gọi cấp cứu 115**.

### Giao diện Chăm sóc viên

- **Lập lịch linh hoạt** — xem ca đang cần người, lọc theo khoảng cách tính bằng công thức haversine từ vị trí đã khai báo.
- **Gợi ý lộ trình** — sắp xếp các điểm dừng trong ngày theo thứ tự thời gian và ước tính tổng quãng đường.
- **Nhật ký công việc điện tử** — checklist tự sinh khi gia đình đặt ca, ghép từ danh sách việc mặc định của gói dịch vụ và từng loại thuốc trong hồ sơ sức khoẻ. Mỗi lần tick hoàn thành, hệ thống tự ghi một dòng vào dòng thời gian gửi về gia đình.
- Cảnh báo dị ứng và bệnh lý nền hiện ngay trên màn hình nhật ký ca.
- Chia sẻ vị trí GPS trong ca qua `navigator.geolocation.watchPosition`.

---

## Bảng giá dịch vụ

| Gói | Đối tượng | Giá |
|---|---|---|
| **Đồng Hành** (cơ bản) | Người cao tuổi minh mẫn, sống một mình | 220.000 đ/ca 4h · 55.000 đ/h · 6.300.000 đ/tháng |
| **Phục Hồi** (nâng cao) | Sau tai biến, gãy xương, suy nhược | 380.000 đ/ca 4h · 95.000 đ/h · 11.000.000 đ/tháng |
| **Chuyên Sâu** (đặc biệt) | Alzheimer nặng, ăn sonde, cần 24/7 | 1.300.000 đ/ca 12h · 25–30 triệu/tháng đầu · 32–40 triệu từ tháng thứ hai |
| **Thủ Thuật Lẻ** | Can thiệp y tế tức thời tại nhà | 150.000 – 600.000 đ mỗi lần |

Giá lưu trong bảng `packages`, sửa tại `server/seed.js` rồi chạy lại `npm run seed`.

---

## Danh sách API

Mọi endpoint cần đăng nhập đều yêu cầu header `Authorization: Bearer <token>`.

### Xác thực
| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký gia đình hoặc chăm sóc viên |
| POST | `/api/auth/login` | Đăng nhập bằng email hoặc số điện thoại |
| GET | `/api/auth/me` | Thông tin tài khoản hiện tại |
| PUT | `/api/auth/me` | Cập nhật thông tin cá nhân |
| PUT | `/api/auth/password` | Đổi mật khẩu |

### Người cao tuổi và hồ sơ sức khoẻ
| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET/POST | `/api/elders` | Danh sách và thêm người thân |
| GET/PUT/DELETE | `/api/elders/:id` | Chi tiết, sửa, xoá |
| GET/PUT | `/api/elders/:id/health` | Hồ sơ sức khoẻ số |
| GET/POST | `/api/elders/:id/vitals` | Chỉ số sinh tồn |
| GET/POST | `/api/elders/:id/reminders` | Nhắc nhở |
| PUT/DELETE | `/api/elders/:id/reminders/:rid` | Sửa, xoá nhắc nhở |

### Chăm sóc viên
| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/caregivers` | Danh bạ, lọc theo khu vực, chuyên môn, xác minh |
| GET | `/api/caregivers/:id` | Hồ sơ chi tiết kèm đánh giá |
| PUT | `/api/caregivers/me/profile` | Tự cập nhật hồ sơ nghề nghiệp |
| GET | `/api/caregivers/me/stats` | Thống kê thu nhập và số ca |

### Ca chăm sóc
| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET/POST | `/api/bookings` | Danh sách theo vai trò, đặt ca mới |
| GET | `/api/bookings/open` | Ca đang cần người nhận |
| GET | `/api/bookings/:id` | Chi tiết kèm checklist, cập nhật, GPS |
| PUT | `/api/bookings/:id/status` | Đổi trạng thái ca |
| POST | `/api/bookings/:id/assign` | Gia đình chọn chăm sóc viên |
| POST | `/api/bookings/:id/apply` | Chăm sóc viên đăng ký nhận ca |
| GET | `/api/bookings/:id/applications` | Danh sách người đăng ký |
| POST | `/api/bookings/:id/tasks` | Thêm đầu việc |
| PUT/DELETE | `/api/bookings/:id/tasks/:tid` | Tick hoàn thành, xoá |
| GET | `/api/bookings/:id/report` | Báo cáo cuối ca |
| POST | `/api/bookings/:id/updates` | Gửi cập nhật cho gia đình |
| GET/POST | `/api/bookings/:id/tracking` | Lộ trình GPS |

### Gói dịch vụ, thanh toán, đánh giá
| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/packages` | Bảng giá công khai |
| POST | `/api/packages/quote` | Báo giá trước khi đặt |
| GET | `/api/payments` | Lịch sử giao dịch |
| GET | `/api/payments/summary` | Tổng quan chi tiêu |
| POST | `/api/payments/:id/pay` | Xác nhận thanh toán |
| POST | `/api/reviews` | Đánh giá sau ca hoàn thành |
| GET | `/api/reviews/caregiver/:id` | Đánh giá của một chăm sóc viên |
| GET | `/api/reviews/mine` | Đánh giá mình nhận được |

---

## Đẩy lên GitHub

```bash
git init
git add .
git commit -m "An Lão: nền tảng chăm sóc người cao tuổi"
git branch -M main
git remote add origin https://github.com/<tên-tài-khoản>/an-lao.git
git push -u origin main
```

File `.gitignore` đã loại trừ `node_modules/`, `.env` và file cơ sở dữ liệu, nên chỉ mã nguồn được đẩy lên.

## Triển khai lên máy chủ

Dự án chạy được trên Render, Railway hoặc Fly.io mà không cần chỉnh sửa gì thêm:

1. Tạo service mới, trỏ tới repository vừa đẩy lên.
2. Build command: `npm install`
3. Start command: `npm start`
4. Thêm biến môi trường `JWT_SECRET` (bắt buộc đổi) và `PORT` nếu nền tảng yêu cầu.
5. Chạy `npm run seed` một lần để nạp bảng giá.

Lưu ý: SQLite lưu dữ liệu vào ổ đĩa của container, nên cần gắn thêm persistent disk nếu muốn giữ dữ liệu qua các lần triển khai lại.

---

## Hướng phát triển tiếp

- Tải ảnh bữa ăn thật thay cho mô tả bằng chữ (hiện `updates.image_url` đã có sẵn cột).
- Nối cổng thanh toán thật như VNPay hoặc MoMo, thay cho phần mô phỏng trong `routes/payments.js`.
- Thông báo đẩy khi chăm sóc viên bắt đầu ca hoặc gửi cập nhật.
- Bản đồ thật (Mapbox, Google Maps) thay cho lộ trình SVG.
- Chuyển sang PostgreSQL và thêm kiểm thử tự động.

---

<div align="center">
  <sub>Giấy phép MIT</sub>
</div>
