const express = require('express');
const router  = express.Router();

// GET /api/vendors
router.get('/', async (req, res, next) => {
  try {
    // TODO: filters: search, state_code, country_code, small_business_flag, parent_cage
    // TODO: sort: name | annual_revenue | number_of_employees, order: asc | desc
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/:cage_code
router.get('/:cage_code', async (req, res, next) => {
  try {
    // TODO: return single vendor with award_count + total_obligated
    res.json({});
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/:cage_code/awards
router.get('/:cage_code/awards', async (req, res, next) => {
  try {
    // TODO: same shape as GET /api/awards scoped to this vendor
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
