const express = require("express");
const { runNaukriScraper } = require("./scraper"); // Import the scraper function
const { MongoClient } = require("mongodb");
const jobRoutes = require("./routes/jobRoutes"); // Import your job routes
require("dotenv").config();
const cron = require("node-cron"); // Import node-cron

const app = express();
const port = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || "job_data";
const COLLECTION_NAME = "jobs";

// Middleware to parse JSON
app.use(express.json());

// Use your job routes
app.use("/api/", jobRoutes); // Mount job routes at /jobs

// Function to start the scraper
async function startScraper() {
  try {
    console.log("Starting scraping process...");
    await runNaukriScraper({ headless: true }); //  Run headless in production
    console.log("Scraping process completed.");
  } catch (error) {
    console.error("Error during scraping:", error);
  }
}

// Schedule the scraper to run twice a day (at 00:00 and 12:00)
cron.schedule("0 0,12 * * *", async () => {
  console.log("Running scraper at 00:00 and 12:00");
  try {
    await startScraper();
    console.log("Scraping completed for this schedule.");
  } catch (error) {
    console.error("Error during scheduled scraping:", error);
  }
});

// Test route
app.get("/", (req, res) => {
  res.send("Welcome to the Naukri Scraper API");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  // Start the scraper immediately when the server starts
  startScraper();
});
