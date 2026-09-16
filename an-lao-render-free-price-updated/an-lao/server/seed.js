'use strict';
/**
 * Nap du lieu mau: 4 goi dich vu theo bang gia, mot so tai khoan demo,
 * ho so suc khoe, ca lam va danh gia de xem giao dien ngay khi chay lan dau.
 * Chay: npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

const hash = (p) => bcrypt.hashSync(p, 10);
const iso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const daysFromNow = (n, h = 8) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, 0, 0, 0);
  return d;
};

/* ============ GOI DICH VU ============ */
const PACKAGES = [
  {
    code: 'dong-hanh',
    name: 'Gói Đồng Hành',
    target: 'Người già minh mẫn, sống một mình, cần hỗ trợ hoạt động sinh hoạt hàng ngày nhẹ nhàng và bầu bạn.',
    details: 'Dọn dẹp không gian ngủ, chuẩn bị bữa ăn dinh dưỡng, nhắc nhở uống thuốc, đi dạo, trò chuyện tâm lý.',
    tasks: [
      { title: 'Dọn dẹp không gian ngủ', time: '08:00' },
      { title: 'Chuẩn bị bữa sáng dinh dưỡng', time: '08:30' },
      { title: 'Nhắc và hỗ trợ uống thuốc', time: '09:00' },
      { title: 'Đi dạo nhẹ 20 phút', time: '10:00' },
      { title: 'Trò chuyện, hỏi thăm tinh thần', time: '11:00' }
    ],
    shift_hours: 4, price_shift: 280000, price_hour: 70000, price_month: 8100000,
    price_month_max: null, price_note: 'Giá tháng áp dụng cho ca 4 giờ mỗi ngày.', sort_order: 1
  },
  {
    code: 'phuc-hoi',
    name: 'Gói Phục Hồi',
    target: 'Bệnh nhân sau tai biến, gãy xương, hoặc người suy nhược cần phục hồi.',
    details: 'Bao gồm Gói Đồng Hành, thêm hỗ trợ vệ sinh cá nhân, trở mình chống loét, vỗ rung long đờm, tập vật lý trị liệu cơ bản, theo dõi chỉ số sinh tồn.',
    tasks: [
      { title: 'Đo huyết áp và nhịp tim buổi sáng', time: '08:00' },
      { title: 'Hỗ trợ vệ sinh cá nhân', time: '08:30' },
      { title: 'Chuẩn bị bữa ăn theo chế độ bệnh lý', time: '09:00' },
      { title: 'Nhắc và hỗ trợ uống thuốc', time: '09:30' },
      { title: 'Trở mình chống loét', time: '10:00' },
      { title: 'Vỗ rung long đờm', time: '10:30' },
      { title: 'Tập vật lý trị liệu cơ bản', time: '11:00' },
      { title: 'Ghi nhận chỉ số sinh tồn cuối ca', time: '11:45' }
    ],
    shift_hours: 4, price_shift: 400000, price_hour: 100000, price_month: 11600000,
    price_month_max: null, price_note: 'Giá tháng áp dụng cho ca 4 giờ mỗi ngày.', sort_order: 2
  },
  {
    code: 'chuyen-sau',
    name: 'Gói Chuyên Sâu',
    target: 'Bệnh nhân sa sút trí tuệ (Alzheimer) nặng, ăn qua ống sonde, hoặc cần chăm sóc 24/7.',
    details: 'Túc trực 24/7 hoặc ca dài 12 giờ. Quản lý thuốc men, thay băng, thay sonde dạ dày, hút đờm, chăm sóc toàn diện tâm - thể - trí.',
    tasks: [
      { title: 'Kiểm tra chỉ số sinh tồn đầu ca', time: '07:00' },
      { title: 'Vệ sinh cá nhân toàn diện', time: '07:30' },
      { title: 'Cho ăn qua sonde theo chỉ định', time: '08:00' },
      { title: 'Quản lý và cho dùng thuốc', time: '09:00' },
      { title: 'Hút đờm', time: '10:00' },
      { title: 'Thay băng vết thương', time: '11:00' },
      { title: 'Trở mình chống loét (mỗi 2 giờ)', time: '12:00' },
      { title: 'Hoạt động kích thích nhận thức', time: '15:00' },
      { title: 'Cho ăn bữa chiều qua sonde', time: '17:00' },
      { title: 'Báo cáo tình trạng cuối ca', time: '18:45' }
    ],
    shift_hours: 12, price_shift: 1680000, price_hour: 140000, price_month: 32000000,
    price_month_max: 39000000,
    price_note: 'Thuê bao 24/7: 32 - 39 triệu cho tháng đăng ký đầu tiên; 41 - 51 triệu từ tháng thứ hai.',
    sort_order: 3
  },
  {
    code: 'thu-thuat-le',
    name: 'Gói Thủ Thuật Lẻ',
    target: 'Người bệnh cần can thiệp y tế tức thời tại nhà, không muốn tới bệnh viện.',
    details: 'Truyền dịch, tiêm thuốc, thay sonde dạ dày hoặc sonde tiểu, lấy mẫu xét nghiệm, massage trị liệu cổ vai gáy.',
    tasks: [
      { title: 'Xác nhận chỉ định của bác sĩ', time: null },
      { title: 'Kiểm tra chỉ số sinh tồn trước thủ thuật', time: null },
      { title: 'Thực hiện thủ thuật theo chỉ định', time: null },
      { title: 'Theo dõi phản ứng sau thủ thuật', time: null },
      { title: 'Ghi chú và bàn giao cho gia đình', time: null }
    ],
    shift_hours: 1, price_shift: 150000, price_hour: 150000, price_month: null,
    price_month_max: null,
    price_note: 'Chi phí dao động từ 150.000 đến 600.000 VNĐ/lần thủ thuật, tùy loại thủ thuật.',
    sort_order: 4
  }
];

function seedPackages() {
  const stmt = db.prepare(`
    INSERT INTO packages (code, name, target, details, tasks, shift_hours, price_shift,
                          price_hour, price_month, price_month_max, price_note, sort_order)
    VALUES (@code, @name, @target, @details, @tasks, @shift_hours, @price_shift,
            @price_hour, @price_month, @price_month_max, @price_note, @sort_order)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name, target = excluded.target, details = excluded.details,
      tasks = excluded.tasks, shift_hours = excluded.shift_hours,
      price_shift = excluded.price_shift, price_hour = excluded.price_hour,
      price_month = excluded.price_month, price_month_max = excluded.price_month_max,
      price_note = excluded.price_note, sort_order = excluded.sort_order
  `);
  PACKAGES.forEach(p => stmt.run({ ...p, tasks: JSON.stringify(p.tasks) }));
  console.log(`✓ Đã nạp ${PACKAGES.length} gói dịch vụ`);
}

/* ============ TAI KHOAN DEMO ============ */
function seedDemo() {
  if (db.prepare("SELECT id FROM users WHERE email = 'giadinh@demo.vn'").get()) {
    console.log('• Dữ liệu demo đã tồn tại, bỏ qua');
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (role, full_name, email, phone, password_hash, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Gia dinh
  const familyId = insertUser.run('family', 'Nguyễn Thị Lan', 'giadinh@demo.vn', '0901000001',
    hash('123456'), '#1C74B8').lastInsertRowid;

  // Cham soc vien
  const caregivers = [
    { name: 'Trần Thị Hà', email: 'ha@demo.vn', phone: '0902000001', color: '#3FBFAE', exp: 6,
      bio: 'Điều dưỡng chuyên chăm sóc bệnh nhân sau tai biến, tốt nghiệp Cao đẳng Y Hà Nội.',
      spec: ['Phục hồi sau tai biến', 'Theo dõi chỉ số sinh tồn', 'Vật lý trị liệu cơ bản'],
      cert: ['Chứng chỉ hành nghề điều dưỡng', 'Chứng chỉ sơ cấp cứu'],
      city: 'Hà Nội', district: 'Cầu Giấy', lat: 21.0313, lng: 105.7996, verified: 1, days: [2,3,4,5,6] },
    { name: 'Lê Văn Minh', email: 'minh@demo.vn', phone: '0902000002', color: '#1C74B8', exp: 4,
      bio: 'Kỹ thuật viên phục hồi chức năng, có kinh nghiệm hỗ trợ người cao tuổi gãy xương.',
      spec: ['Vật lý trị liệu', 'Hỗ trợ vận động', 'Chống loét tì đè'],
      cert: ['Chứng chỉ kỹ thuật viên phục hồi chức năng'],
      city: 'Hà Nội', district: 'Đống Đa', lat: 21.0122, lng: 105.8272, verified: 1, days: [2,4,6,7] },
    { name: 'Phạm Thị Oanh', email: 'oanh@demo.vn', phone: '0902000003', color: '#E2A045', exp: 8,
      bio: 'Chăm sóc viên giàu kinh nghiệm với người sa sút trí tuệ, kiên nhẫn và ân cần.',
      spec: ['Chăm sóc Alzheimer', 'Đồng hành tinh thần', 'Chăm sóc 24/7'],
      cert: ['Chứng chỉ hành nghề điều dưỡng', 'Chứng chỉ chăm sóc người sa sút trí tuệ'],
      city: 'Hà Nội', district: 'Hai Bà Trưng', lat: 21.0047, lng: 105.8560, verified: 1, days: [2,3,4,5,6,7,8] },
    { name: 'Vũ Thị Thu', email: 'thu@demo.vn', phone: '0902000004', color: '#2C9385', exp: 3,
      bio: 'Điều dưỡng trẻ, nhiệt tình, chuyên hỗ trợ sinh hoạt hằng ngày và bầu bạn.',
      spec: ['Hỗ trợ sinh hoạt', 'Nấu ăn dinh dưỡng', 'Đồng hành tinh thần'],
      cert: ['Chứng chỉ điều dưỡng viên'],
      city: 'Hà Nội', district: 'Thanh Xuân', lat: 20.9955, lng: 105.8065, verified: 0, days: [3,5,7] }
  ];

  const cgIds = caregivers.map(c => {
    const id = insertUser.run('caregiver', c.name, c.email, c.phone, hash('123456'), c.color).lastInsertRowid;
    db.prepare(`
      INSERT INTO caregivers (user_id, bio, years_experience, specialties, certificates,
                              city, district, lat, lng, verified, available_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, c.bio, c.exp, JSON.stringify(c.spec), JSON.stringify(c.cert),
           c.city, c.district, c.lat, c.lng, c.verified, JSON.stringify(c.days));
    return id;
  });

  // Tai khoan rieng cho nguoi cao tuoi (giao dien don gian)
  const elderUserId = insertUser.run('elder', 'Nguyễn Văn Bảy', null, '0903000001',
    hash('123456'), '#E2A045').lastInsertRowid;

  // Ho so nguoi cao tuoi
  const elderId = db.prepare(`
    INSERT INTO elders (family_user_id, elder_user_id, full_name, birth_year, gender, phone, address, lat, lng, relation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(familyId, elderUserId, 'Nguyễn Văn Bảy', 1946, 'nam', '0903000001',
         '145 Nguyễn Khánh Toàn, Cầu Giấy, Hà Nội', 21.0378, 105.8020, 'Bố').lastInsertRowid;

  const elder2Id = db.prepare(`
    INSERT INTO elders (family_user_id, full_name, birth_year, gender, address, lat, lng, relation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(familyId, 'Trần Thị Mão', 1950, 'nu',
         '145 Nguyễn Khánh Toàn, Cầu Giấy, Hà Nội', 21.0378, 105.8020, 'Mẹ').lastInsertRowid;

  // Ho so suc khoe
  db.prepare(`
    INSERT INTO health_records (elder_id, blood_type, conditions, allergies, medications, habits, mobility, care_notes, next_checkup)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(elderId, 'O',
    JSON.stringify(['Tăng huyết áp', 'Di chứng tai biến nhẹ bên trái', 'Thoái hoá khớp gối']),
    JSON.stringify(['Dị ứng penicillin', 'Không ăn được hải sản']),
    JSON.stringify([
      { name: 'Amlodipin 5mg', dose: '1 viên', time: '08:00', note: 'Uống sau ăn sáng' },
      { name: 'Aspirin 81mg', dose: '1 viên', time: '08:00', note: 'Uống sau ăn sáng' },
      { name: 'Atorvastatin 20mg', dose: '1 viên', time: '20:00', note: 'Uống buổi tối' }
    ]),
    'Dậy lúc 5h30, đi bộ sân chung cư 20 phút. Ăn nhạt, ít dầu mỡ. Ngủ trưa 13h-14h30.',
    'Đi lại được với gậy chống, cần người đỡ khi lên xuống cầu thang.',
    'Tay trái yếu, cần hỗ trợ khi ăn uống. Hay quên uống thuốc buổi tối.',
    iso(daysFromNow(21, 9)).slice(0, 10));

  db.prepare(`
    INSERT INTO health_records (elder_id, blood_type, conditions, allergies, medications, habits, mobility, next_checkup)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(elder2Id, 'A',
    JSON.stringify(['Đái tháo đường type 2', 'Loãng xương']),
    JSON.stringify([]),
    JSON.stringify([{ name: 'Metformin 500mg', dose: '1 viên', time: '07:30', note: 'Uống trước ăn' }]),
    'Sinh hoạt điều độ, tự chăm sóc được phần lớn việc cá nhân.',
    'Đi lại bình thường.', iso(daysFromNow(35, 9)).slice(0, 10));

  // Nhac nho
  const remStmt = db.prepare(`
    INSERT INTO reminders (elder_id, type, title, detail, time_of_day, days) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const allDays = JSON.stringify([2, 3, 4, 5, 6, 7, 8]);
  remStmt.run(elderId, 'medicine', 'Uống thuốc huyết áp', 'Amlodipin 5mg và Aspirin 81mg, uống sau ăn sáng', '08:00', allDays);
  remStmt.run(elderId, 'exercise', 'Tập vận động tay trái', 'Nắm - mở bàn tay 20 lần, xoay cổ tay nhẹ nhàng', '09:30', allDays);
  remStmt.run(elderId, 'water', 'Uống nước', 'Uống một cốc nước ấm', '14:00', allDays);
  remStmt.run(elderId, 'medicine', 'Uống thuốc buổi tối', 'Atorvastatin 20mg', '20:00', allDays);
  remStmt.run(elderId, 'checkup', 'Tái khám tim mạch', 'Bệnh viện Lão khoa Trung ương', '09:00', JSON.stringify([]));

  // Ca lam
  const pkgPhucHoi = db.prepare("SELECT * FROM packages WHERE code = 'phuc-hoi'").get();
  const pkgDongHanh = db.prepare("SELECT * FROM packages WHERE code = 'dong-hanh'").get();

  const mkBooking = (opts) => {
    const info = db.prepare(`
      INSERT INTO bookings (code, elder_id, family_user_id, caregiver_id, package_id, mode,
                            start_at, end_at, hours, address, lat, lng, note, status, total_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(opts.code, opts.elder_id, familyId, opts.caregiver_id, opts.package_id, opts.mode,
           iso(opts.start), iso(opts.end), opts.hours,
           '145 Nguyễn Khánh Toàn, Cầu Giấy, Hà Nội', 21.0378, 105.8020,
           opts.note || null, opts.status, opts.total);

    const bid = info.lastInsertRowid;
    const pkg = db.prepare('SELECT tasks FROM packages WHERE id = ?').get(opts.package_id);
    const taskStmt = db.prepare('INSERT INTO tasks (booking_id, title, due_time, done, done_at, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    JSON.parse(pkg.tasks).forEach((t, i) => {
      const done = opts.status === 'completed' ? 1 : (opts.status === 'in_progress' && i < 3 ? 1 : 0);
      taskStmt.run(bid, t.title, t.time, done, done ? iso(opts.start) : null, i);
    });

    db.prepare('INSERT INTO payments (booking_id, amount, method, status, paid_at) VALUES (?, ?, ?, ?, ?)')
      .run(bid, opts.total, opts.payMethod || 'cash',
           opts.status === 'completed' ? 'paid' : 'pending',
           opts.status === 'completed' ? iso(opts.end) : null);
    return bid;
  };

  // Ca da hoan thanh (co danh gia)
  const doneStart = daysFromNow(-3, 8), doneEnd = daysFromNow(-3, 12);
  const doneId = mkBooking({ code: 'AL-DEMO-0001', elder_id: elderId, caregiver_id: cgIds[0],
    package_id: pkgPhucHoi.id, mode: 'shift', start: doneStart, end: doneEnd, hours: 4,
    status: 'completed', total: pkgPhucHoi.price_shift, payMethod: 'transfer',
    note: 'Bố cần hỗ trợ tập tay trái sau tai biến.' });

  db.prepare('INSERT INTO reviews (booking_id, family_user_id, caregiver_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(doneId, familyId, cgIds[0], 5, 'Chị Hà rất tận tâm, báo cáo chi tiết từng việc. Gia đình rất yên tâm.');
  db.prepare('UPDATE caregivers SET rating_avg = 5, rating_count = 1 WHERE user_id = ?').run(cgIds[0]);

  db.prepare('INSERT INTO vitals (elder_id, booking_id, systolic, diastolic, heart_rate, sleep_hours, note, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(elderId, doneId, 138, 85, 76, 6.5, 'Huyết áp hơi cao, đã nhắc ông nghỉ ngơi', cgIds[0], iso(doneStart));
  db.prepare('INSERT INTO vitals (elder_id, systolic, diastolic, heart_rate, sleep_hours, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?)')
    .run(elderId, 132, 82, 72, 7, cgIds[0], iso(daysFromNow(-2, 8)));
  db.prepare('INSERT INTO vitals (elder_id, systolic, diastolic, heart_rate, sleep_hours, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?)')
    .run(elderId, 129, 80, 74, 7.5, cgIds[0], iso(daysFromNow(-1, 8)));

  const upStmt = db.prepare('INSERT INTO updates (booking_id, author_id, type, content, created_at) VALUES (?,?,?,?,?)');
  upStmt.run(doneId, cgIds[0], 'meal', 'Ông đã ăn hết bát cháo thịt bằm và rau củ.', iso(doneStart));
  upStmt.run(doneId, cgIds[0], 'activity', 'Đã tập vận động tay trái 15 phút, ông hợp tác tốt.', iso(doneStart));
  upStmt.run(doneId, cgIds[0], 'note', 'Ông ngủ trưa ngon, tinh thần vui vẻ hơn hôm qua.', iso(doneEnd));

  // Ca dang dien ra hom nay
  const nowStart = new Date(); nowStart.setHours(8, 0, 0, 0);
  const nowEnd = new Date(); nowEnd.setHours(12, 0, 0, 0);
  const liveId = mkBooking({ code: 'AL-DEMO-0002', elder_id: elderId, caregiver_id: cgIds[0],
    package_id: pkgPhucHoi.id, mode: 'shift', start: nowStart, end: nowEnd, hours: 4,
    status: 'in_progress', total: pkgPhucHoi.price_shift, payMethod: 'card' });

  const trkStmt = db.prepare('INSERT INTO tracking_points (booking_id, lat, lng, recorded_at) VALUES (?,?,?,?)');
  [[21.0313, 105.7996], [21.0335, 105.8003], [21.0356, 105.8012], [21.0378, 105.8020]]
    .forEach(([la, ln], i) => {
      const t = new Date(nowStart); t.setMinutes(t.getMinutes() - 30 + i * 10);
      trkStmt.run(liveId, la, ln, iso(t));
    });
  upStmt.run(liveId, cgIds[0], 'activity', 'Đã tới nhà, ông đang ăn sáng.', iso(nowStart));

  // Ca sap toi da xac nhan
  mkBooking({ code: 'AL-DEMO-0003', elder_id: elder2Id, caregiver_id: cgIds[3],
    package_id: pkgDongHanh.id, mode: 'shift', start: daysFromNow(2, 14), end: daysFromNow(2, 18),
    hours: 4, status: 'confirmed', total: pkgDongHanh.price_shift, payMethod: 'cash',
    note: 'Mẹ cần người trò chuyện và đi dạo buổi chiều.' });

  // Ca dang cho cham soc vien nhan
  const openId = mkBooking({ code: 'AL-DEMO-0004', elder_id: elderId, caregiver_id: null,
    package_id: pkgPhucHoi.id, mode: 'shift', start: daysFromNow(4, 8), end: daysFromNow(4, 12),
    hours: 4, status: 'pending', total: pkgPhucHoi.price_shift, payMethod: 'transfer',
    note: 'Cần chăm sóc viên có kinh nghiệm vật lý trị liệu.' });

  db.prepare('INSERT INTO shift_applications (booking_id, caregiver_id, message) VALUES (?,?,?)')
    .run(openId, cgIds[1], 'Tôi có 4 năm kinh nghiệm phục hồi chức năng, ở gần khu vực này.');
  db.prepare('INSERT INTO shift_applications (booking_id, caregiver_id, message) VALUES (?,?,?)')
    .run(openId, cgIds[2], 'Tôi rảnh ca sáng ngày hôm đó, có thể nhận.');

  console.log('✓ Đã tạo dữ liệu demo');
  console.log('');
  console.log('  Tài khoản đăng nhập thử (mật khẩu đều là 123456):');
  console.log('  • Gia đình      : giadinh@demo.vn');
  console.log('  • Chăm sóc viên : ha@demo.vn / minh@demo.vn / oanh@demo.vn / thu@demo.vn');
  console.log('  • Người cao tuổi: 0903000001');
}

seedPackages();
seedDemo();
console.log('\n✓ Hoàn tất. Chạy `npm start` rồi mở http://localhost:3000');
