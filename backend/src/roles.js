const ROLE_ALIASES = {
  ops_admin: 'ops_admin',
  operations_admin: 'ops_admin',
  operation_admin: 'ops_admin',
  operations: 'ops_admin',
  op_admin: 'ops_admin',
  opsadmin: 'ops_admin',
  ops: 'ops_admin',
  system_admin: 'system_admin',
  systemadmin: 'system_admin',
  sys_admin: 'system_admin',
  sysadmin: 'system_admin',
  admin: 'system_admin',
  medical_admin: 'medical_admin',
  medicaladmin: 'medical_admin',
  med_admin: 'medical_admin',
  medadmin: 'medical_admin',
  mother: 'mother',
  mom: 'mother',
  patient: 'mother',
  user: 'mother',
  doctor: 'doctor',
  pharmacist: 'pharmacist',
  nutritionist: 'nutritionist',
  merchandiser: 'merchandiser'
};

export const CANONICAL_ROLES = new Set([
  'mother',
  'doctor',
  'pharmacist',
  'nutritionist',
  'merchandiser',
  'medical_admin',
  'ops_admin',
  'system_admin'
]);

export const normalizeRoleValue = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  const cleaned = raw.replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[cleaned] || cleaned;
};

export const isAllowedRole = (value) => {
  const normalized = normalizeRoleValue(value);
  return normalized ? CANONICAL_ROLES.has(normalized) : false;
};

const addRoleOption = (set, role) => {
  if (!role) return;
  set.add(role);
  if (role.includes('_')) {
    set.add(role.replace(/_/g, '-'));
  }
};

export const getRoleFilterOptions = (value) => {
  const normalized = normalizeRoleValue(value);
  if (!normalized) return [];
  if (!CANONICAL_ROLES.has(normalized)) {
    return [normalized];
  }

  const options = new Set();
  addRoleOption(options, normalized);

  Object.entries(ROLE_ALIASES).forEach(([alias, canonical]) => {
    if (canonical === normalized) {
      addRoleOption(options, alias);
    }
  });

  return Array.from(options);
};

export const getRoleFilterOptionsFromInput = (value) => {
  if (!value) return [];
  const rawValues = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  const options = new Set();
  rawValues.forEach((role) => {
    getRoleFilterOptions(role).forEach((opt) => options.add(opt));
  });
  return Array.from(options);
};
