const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/permission.middleware');
const adminController = require('../controllers/admin.controller');
const planAdminController = require('../controllers/planAdmin.controller');
const {
    adminLimiter
} = require("../middlewares/rateLimit.middleware");
router.use(adminLimiter);
// =====================================
// ARTIST MANAGEMENT
// =====================================
router.get('/artists/pending', authMiddleware, requireAdmin, adminController.getPendingArtists);

router.patch('/artists/:userId/approve', authMiddleware, requireAdmin, adminController.approveArtist);

router.patch('/artists/:userId/reject', authMiddleware, requireAdmin, adminController.rejectArtist);

// =====================================
// USER MANAGEMENT
// =====================================
router.patch('/users/:userId/ban', authMiddleware, requireAdmin, adminController.banUser);

router.patch('/users/:userId/unban', authMiddleware, requireAdmin, adminController.unbanUser);

// =====================================
// PLAN CATALOG (manual Stripe resync — recovery path, see planAdmin.controller.js)
// =====================================
router.get('/plans/cache', authMiddleware, requireAdmin, planAdminController.getPlanCacheStatus);

router.post('/plans/resync', authMiddleware, requireAdmin, planAdminController.resyncProduct);

router.post('/plans/resync-all', authMiddleware, requireAdmin, planAdminController.resyncAllProducts);

module.exports = router;