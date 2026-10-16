function requireAdmin(req, res, next) {
  const role = req.user?.role?.name;
  if (!['super_admin', 'direktur', 'manager'].includes(role)) {
    return res.status(403).json({ message: 'Kamu tidak memiliki akses admin.' });
  }
  return next();
}

module.exports = { requireAdmin };
