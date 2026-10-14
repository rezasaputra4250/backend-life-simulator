const roles = [
  { name: 'super_admin', label: 'Super Admin' },
  { name: 'komisaris', label: 'Komisaris' },
  { name: 'direktur', label: 'Direktur' },
  { name: 'manager', label: 'Manager' },
  { name: 'supervisor', label: 'Supervisor' },
  { name: 'leader', label: 'Leader' },
  { name: 'staff', label: 'Staff' },
  { name: 'operator', label: 'Operator' },
];

const roleNames = roles.map((role) => role.name);

module.exports = {
  roles,
  roleNames,
};
