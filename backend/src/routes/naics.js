const express = require('express');
const router  = express.Router();

// GET /api/naics
router.get('/', async (req, res, next) => {
  try {
    // TODO: return NAICS codes with award_count + total_obligated
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

// GET /api/naics/:code/awards
router.get('/:code/awards', async (req, res, next) => {
  try {
    // TODO: same shape as GET /api/awards scoped to this NAICS code
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

// GET /api/naics/:code/vendors
router.get('/:code/vendors', async (req, res, next) => {
  try {
    // TODO: same shape as GET /api/vendors scoped to vendors in this NAICS code
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
