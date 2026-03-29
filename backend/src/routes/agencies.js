const express = require('express');
const router  = express.Router();

// GET /api/agencies
router.get('/', async (req, res, next) => {
  try {
    // TODO: return agencies with award_count + total_obligated
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

// GET /api/agencies/:code/awards
router.get('/:code/awards', async (req, res, next) => {
  try {
    // TODO: same shape as GET /api/awards scoped to this agency
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

// GET /api/agencies/:code/vendors
router.get('/:code/vendors', async (req, res, next) => {
  try {
    // TODO: same shape as GET /api/vendors scoped to vendors who received awards from this agency
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
