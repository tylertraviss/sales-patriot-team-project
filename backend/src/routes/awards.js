const express = require('express');
const router  = express.Router();

// GET /api/awards
router.get('/', async (req, res, next) => {
  try {
    // TODO: filters: year, agency_code, naics_code, state_code, award_type, set_aside_type, extent_competed, search
    // TODO: sort: dollars_obligated | date_signed, order: asc | desc
    // TODO: pagination: page, limit
    res.json({ data: [], pagination: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
