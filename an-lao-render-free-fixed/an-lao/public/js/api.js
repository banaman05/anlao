/* ============================================================
   Lớp gọi API và các hàm tiện ích dùng chung cho toàn bộ giao diện
   ============================================================ */

const TOKEN_KEY = 'anlao_token';
const USER_KEY  = 'anlao_user';

const Auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user()  { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  logout() { Auth.clear(); location.href = '/login.html'; },

  /** Chặn truy cập trang nếu chưa đăng nhập hoặc sai vai trò */
  guard(...roles) {
    const u = Auth.user;
    if (!Auth.token || !u) { location.href = '/login.html'; return null; }
    if (roles.length && !roles.includes(u.role)) { location.href = Auth.homeFor(u.role); return null; }
    return u;
  },

  homeFor(role) {
    if (role === 'caregiver') return '/app/caregiver/index.html';
    if (role === 'elder')     return '/app/elder/index.html';
    return '/app/family/index.html';
  }
};

/** Gọi API, tự gắn token và xử lý lỗi chung */
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    Auth.clear();
    location.href = '/login.html';
    throw new Error('Phiên đăng nhập đã hết hạn');
  }

  let data = null;
  try { data = await res.json(); } catch { /* phản hồi rỗng */ }
  if (!res.ok) throw new Error(data?.error || 'Không kết nối được máy chủ');
  return data;
}

api.get  = (p)    => api(p);
api.post = (p, b) => api(p, { method: 'POST', body: b });
api.put  = (p, b) => api(p, { method: 'PUT',  body: b });
api.del  = (p)    => api(p, { method: 'DELETE' });

/* ===================== ĐỊNH DẠNG ===================== */

const fmtMoney = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN') + ' đ');

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtTime = (s) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const fmtDateTime = (s) => (s ? `${fmtDate(s)} lúc ${fmtTime(s)}` : '—');

/** "Hôm nay", "Hôm qua", hoặc ngày cụ thể */
const fmtRelative = (s) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((that - today) / 864e5);
  if (diff === 0)  return `Hôm nay, ${fmtTime(s)}`;
  if (diff === 1)  return `Ngày mai, ${fmtTime(s)}`;
  if (diff === -1) return `Hôm qua, ${fmtTime(s)}`;
  return fmtDateTime(s);
};

const STATUS_LABEL = {
  pending:     ['Chờ nhận', 'badge-pending'],
  confirmed:   ['Đã xác nhận', 'badge-confirmed'],
  in_progress: ['Đang chăm sóc', 'badge-progress'],
  completed:   ['Hoàn thành', 'badge-completed'],
  cancelled:   ['Đã huỷ', 'badge-cancelled']
};

const statusBadge = (s) => {
  const [label, cls] = STATUS_LABEL[s] || [s, 'badge-pending'];
  return `<span class="badge ${cls}">${label}</span>`;
};

const PAY_LABEL = { pending: 'Chờ thanh toán', paid: 'Đã thanh toán', refunded: 'Đã hoàn tiền', failed: 'Thất bại' };
const PAY_METHOD = { cash: 'Tiền mặt', card: 'Thẻ tín dụng', transfer: 'Chuyển khoản' };
const MODE_LABEL = { hourly: 'Theo giờ', shift: 'Theo ca', monthly: 'Gói tháng', procedure: 'Thủ thuật lẻ' };

/** Lấy chữ cái đầu để hiển thị trong avatar */
const initials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] || '?').toUpperCase();
};

const avatar = (name, color = '#1C74B8', cls = '') =>
  `<div class="avatar ${cls}" style="background:${color}">${initials(name)}</div>`;

const stars = (n) => '★'.repeat(Math.round(n || 0)) + '☆'.repeat(5 - Math.round(n || 0));

/** Chặn XSS khi chèn dữ liệu người dùng vào HTML */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ===================== GIAO DIỆN ===================== */

function toast(message, ms = 2800) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Mở hộp thoại; trả về hàm đóng */
function openModal(html) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(bg);

  function close() {
    bg.remove();
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }

  bg.close = close;
  return bg;
}

/** Dựng thanh bên chung cho các trang trong ứng dụng */
function renderSidebar(container, links, active) {
  const u = Auth.user || {};
  const roleLabel = { family: 'Gia đình', caregiver: 'Chăm sóc viên', elder: 'Người cao tuổi', admin: 'Quản trị' };

  container.innerHTML = `
    <a href="/" class="brand">
      <img src="/assets/logo.png" alt="An Lão">
      <span>An Lão</span>
    </a>
    ${links.map(l => l.label
      ? `<div class="side-label">${l.label}</div>`
      : `<a href="${l.href}" class="side-link ${l.key === active ? 'active' : ''}">
           <span class="ic">${l.icon}</span>${l.text}
         </a>`).join('')}
    <div class="side-foot">
      <div class="side-user">
        ${avatar(u.full_name, u.avatar_color, 'avatar-sm')}
        <div>
          <div class="nm">${esc(u.full_name)}</div>
          <div class="rl">${roleLabel[u.role] || ''}</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm btn-block" onclick="Auth.logout()">Đăng xuất</button>
    </div>
  `;
}
