// utils/userAdminSearch.js
// Helpers for admin users list: build filters and sort safely from req.query

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUserAdminFilter(q, base = {}) {
  const filter = { ...base };
  const search = (q.q || '').trim();
  if (search) {
    const rx = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [ { name: rx }, { email: rx } ];
  }
  const activeParam = (q.active || '').trim();
  if (activeParam === 'active') filter.active = true;
  if (activeParam === 'inactive') filter.active = false;

  const img = (q.img || '').trim();
  if (img === 'with') filter.profileImage = { $exists: true, $ne: '' };
  if (img === 'without') {
    filter.$or = [ ...(filter.$or || []), { profileImage: { $exists: false } }, { profileImage: '' } ];
  }
  return filter;
}

function getUserAdminSort(sortParamRaw) {
  const sortParam = (sortParamRaw || 'recent').trim();
  switch (sortParam) {
    case 'oldest': return { createdAt: 1 };
    case 'name_asc': return { name: 1 };
    case 'name_desc': return { name: -1 };
    case 'last_login': return { lastLoginAt: -1, createdAt: -1 };
    case 'recent':
    default: return { createdAt: -1 };
  }
}

module.exports = { buildUserAdminFilter, getUserAdminSort };

