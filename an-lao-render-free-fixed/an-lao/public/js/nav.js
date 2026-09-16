/* Cấu hình thanh điều hướng cho từng vai trò */

const NAV = {
  family: [
    { label: 'Chăm sóc' },
    { key: 'home',       href: '/app/family/index.html',      icon: '◆', text: 'Tổng quan' },
    { key: 'elders',     href: '/app/family/elders.html',     icon: '♡', text: 'Hồ sơ sức khoẻ' },
    { key: 'booking',    href: '/app/family/booking.html',    icon: '▣', text: 'Ca chăm sóc' },
    { key: 'caregivers', href: '/app/family/caregivers.html', icon: '◈', text: 'Tìm chăm sóc viên' },
    { label: 'Tài chính' },
    { key: 'payments',   href: '/app/family/payments.html',   icon: '₫', text: 'Thanh toán' }
  ],
  caregiver: [
    { label: 'Công việc' },
    { key: 'home',    href: '/app/caregiver/index.html',   icon: '◆', text: 'Tổng quan' },
    { key: 'shifts',  href: '/app/caregiver/shifts.html',  icon: '▣', text: 'Ca làm việc' },
    { label: 'Tài khoản' },
    { key: 'profile', href: '/app/caregiver/profile.html', icon: '◈', text: 'Hồ sơ nghề nghiệp' }
  ]
};

/** Gắn thanh bên vào trang hiện tại */
function mountNav(activeKey) {
  const user = Auth.user;
  const el = document.getElementById('sidebar');
  if (el && user) renderSidebar(el, NAV[user.role] || [], activeKey);
  return user;
}
