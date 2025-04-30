// routes/jobRoutes.js
const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");

// Define routes
router.get("/jobs", jobController.getAllJobs); // Now handles search as well
router.get("/experience/:level", jobController.getJobsByExperience);
router.get("/companyLevel/:level", jobController.getJobsByCompanyLevel);
// Remove the /title route: router.get('/title', jobController.getJobsByTitle);

module.exports = router;
