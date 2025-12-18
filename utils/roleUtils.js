// utils/roleUtils.js
const AVAILABLE_ROLES = ['collector', 'artist', 'admin'];

const toRoleArray = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === 'string') return [input];
  return [];
};

const ensureRolesArray = (user) => {
  if (!user) return [];
  return toRoleArray(user.roles);
};

const hasRole = (user, role) => {
  if (!role) return false;
  const normalizedRole = String(role).toLowerCase();
  return ensureRolesArray(user).some(
    (r) => String(r || '').toLowerCase() === normalizedRole
  );
};

const normalizeRolesInput = (value) => {
  const roles = toRoleArray(value)
    .map((r) => String(r || '').toLowerCase())
    .filter((r) => AVAILABLE_ROLES.includes(r));
  return Array.from(new Set(roles));
};

module.exports = {
  AVAILABLE_ROLES,
  ensureRolesArray,
  hasRole,
  normalizeRolesInput
};
