const puppeteer = require("puppeteer");
const { MongoClient } = require("mongodb");
require("dotenv").config(); // Load environment variables from .env
const twilio = require("twilio"); // Added Twilio library

// Environment variables for configuration
const NAUKRI_BASE_URL = process.env.NAUKRI_BASE_URL || "https://www.naukri.com";
const NAUKRI_SEARCH_URL = process.env.NAUKRI_SEARCH_URL || "/job-listings";
const NAUKRI_SEARCH_QUERIES = process.env.NAUKRI_SEARCH_QUERIES
  ? process.env.NAUKRI_SEARCH_QUERIES.split(",")
  : ["software engineer", "data analyst"]; // Default search queries
const NAUKRI_LOCATIONS = process.env.NAUKRI_LOCATIONS
  ? process.env.NAUKRI_LOCATIONS.split(",")
  : ["kolkata", "mumbai"]; // Default locations
const NAUKRI_EXPERIENCES = process.env.NAUKRI_EXPERIENCES
  ? process.env.NAUKRI_EXPERIENCES.split(",")
  : ["0", "1"]; // Default experience levels ('0' for fresher, '1' for 1 year)
const NAUKRI_PAGES_TO_SCRAPE =
  parseInt(process.env.NAUKRI_PAGES_TO_SCRAPE, 10) || 2; // Default pages to scrape
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"; // Default MongoDB URI
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || "job_data"; // Default database name
const COLLECTION_NAME = "jobs";
const MAX_JOB_AGE_DAYS = parseInt(process.env.MAX_JOB_AGE_DAYS, 10) || 30;

/**
 * Connects to the MongoDB database.
 * @returns {Promise<MongoClient>} A promise that resolves with the MongoClient instance.
 */
async function connectToDatabase() {
  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    return client;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

/**
 * Maps experience from Naukri string to your application's experience level schema.
 * @param {string} experience - The experience string from Naukri (e.g., "0-2 years", "5+ years").
 * @returns {string} The mapped experience level (e.g., "Entry-Level", "Senior-Level").
 */
const mapExperienceLevel = (experience) => {
  if (!experience) {
    return "Other";
  }
  const experienceParts = experience.toLowerCase().split("-");
  if (experienceParts.length > 1) {
    const minYears = parseInt(experienceParts[0].trim());
    const maxYears = parseInt(experienceParts[1].trim().replace(" years", ""));

    if (isNaN(minYears) || isNaN(maxYears)) {
      return "Other";
    }

    if (minYears === 0 && maxYears <= 2) {
      return "Entry-Level";
    } else if (minYears >= 3 && maxYears <= 5) {
      return "Mid-Level";
    } else if (minYears > 5) {
      return "Senior-Level";
    } else {
      return "Mid-Level";
    }
  } else if (experience.includes("fresher") || experience === "0") {
    return "Entry-Level";
  } else if (parseInt(experience) > 5) {
    return "Senior-Level";
  } else {
    return "Other";
  }
};

/**
 * Extracts job details from a single job listing element.
 * @param {ElementHandle} jobElement - The Puppeteer ElementHandle representing a job listing.
 * @returns {Promise<object>} A promise that resolves with the job details.
 */
async function extractJobDetails(jobElement) {
  try {
    const jobDetails = await jobElement.evaluate((el) => {
      const titleElement = el.querySelector("h2 > a.title");
      const companyElement = el.querySelector(".comp-name");
      const locationElement = el.querySelector(".locWdth");
      const experienceElement = el.querySelector(".exp"); // Changed selector
      const salaryElement = el.querySelector(".sal-wrap span"); //changed selector
      const urlElement = el.querySelector("h2 > a.title");
      const descriptionElement = el.querySelector(".job-desc");
      const skillsElement = el.querySelector(".tags-gt");
      const jobPostDayElement = el.querySelector(".job-post-day");
      const jobTypeElement = el.querySelector(".jobType span"); //added job type

      const skills = skillsElement
        ? Array.from(skillsElement.querySelectorAll(".tag-li"))
            .map((li) => li.innerText.trim())
            .join(", ")
        : null;

      return {
        title: titleElement ? titleElement.innerText.trim() : null,
        company: companyElement ? companyElement.innerText.trim() : null,
        location: locationElement ? locationElement.innerText.trim() : null,
        experience: experienceElement
          ? experienceElement.innerText.trim()
          : null, // Extract text
        salary: salaryElement ? salaryElement.innerText.trim() : null, //changed salary
        url: urlElement ? urlElement.href : null,
        description: descriptionElement
          ? descriptionElement.innerText.trim()
          : null,
        skills: skills,
        postedDate: jobPostDayElement
          ? jobPostDayElement.innerText.trim()
          : null,
        jobType: jobTypeElement ? jobTypeElement.innerText.trim() : null, //added job type
      };
    });
    return jobDetails;
  } catch (error) {
    console.error("Error extracting job details:", error);
    return {
      title: null,
      company: null,
      location: null,
      salary: null,
      url: null,
      description: null,
      skills: null,
      postedDate: null,
      jobType: null,
    };
  }
}

/**
 * Scrapes job/internship listings from Naukri.com for a given query, location and experience.
 * @param {string} query - The job search query.
 * @param {string} location - The job location.
 * @param {string} experience - The job experience.
 * @param {MongoClient} client - The MongoDB client instance.
 * @param {object} options -  Puppeteer launch options.
 */
async function scrapeNaukri(query, location, experience, client, options = {}) {
  const db = client.db(MONGODB_DATABASE);
  const collection = db.collection(COLLECTION_NAME);
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: options.headless === undefined ? "new" : options.headless, // Use provided headless option, default to true
      //slowMo: 250, // Uncomment this line to slow down the browser for better visibility
      args: [
        "--no-sandbox", // Bypass OS security restrictions (needed for some environments)
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Overcome limited resource issues
        "--disable-accelerated-2d-canvas", // try this
        "--disable-gpu",
        "--window-size=1920,1080", // Set a reasonable window size
      ],
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000); // Increase timeout for slower connections
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    ); // Set a user agent

    for (let pageNum = 1; pageNum <= NAUKRI_PAGES_TO_SCRAPE; pageNum++) {
      // Construct the search URL dynamically
      const searchUrl = `${NAUKRI_BASE_URL}/${query.replace(
        /\s+/g,
        "-"
      )}-jobs-in-${location}?k=${encodeURIComponent(
        query
      )}&l=${location}&experience=${experience}&pageNo=${pageNum}&nignbevent_src=jobsearchDeskGNB`;
      // console.log(`Scraping: ${searchUrl}`);
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      } catch (e) {
        console.error(`Error navigating to ${searchUrl}`, e);
        continue; // go to the next page.
      }

      try {
        await page.waitForSelector(".srp-jobtuple-wrapper", {
          timeout: 15000, // Increased timeout
        }); // Wait for the job listings to load
        //await page.waitForTimeout(2000); // Add a small delay
      } catch (error) {
        console.warn(
          `No job listings found on page ${pageNum} for query "${query}", location "${location}" and experience "${experience}".  Continuing...`
        );
        continue; // Go to the next page
      }

      // Get all job listing elements
      const jobElements = await page.$$(".srp-jobtuple-wrapper");
      console.log(
        `Found ${jobElements.length} job listings on page ${pageNum}`
      );

      for (const jobElement of jobElements) {
        try {
          const jobDetails = await extractJobDetails(jobElement);
          // Map the experience level
          const mappedExperienceLevel = mapExperienceLevel(
            jobDetails.experience
          );
          //console.log("Extracted job details:", jobDetails); // Log the job details
          if (jobDetails.title) {
            // Only insert if we have a title (basic validation)
            try {
              const result = await collection.updateOne(
                { url: jobDetails.url }, // Use URL as unique identifier
                {
                  $set: {
                    ...jobDetails,
                    experienceLevel: mappedExperienceLevel, // Store the mapped experience
                    dateCrawled: new Date(),
                  },
                },
                { upsert: true } // Insert if not found, update if found
              );
              if (result.upsertedCount > 0) {
                console.log(`Inserted job: ${jobDetails.title}`);
              } else {
                console.log(`Updated job: ${jobDetails.title}`);
              }
            } catch (error) {
              console.error("Error inserting/updating job:", error);
            }
          } else {
            console.warn(`Skipping job with missing title`);
          }
        } catch (error) {
          console.error("Error processing a job element", error);
          continue; // process the next job.
        }
      }
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Runs the Naukri scraper for all specified queries, locations and experiences.
 */
async function runNaukriScraper(options = {}) {
  // Added options here
  try {
    const client = await connectToDatabase();
    console.log("Connected to MongoDB");

    // Delete old jobs before scraping
    const cutoffDate = new Date(
      Date.now() - MAX_JOB_AGE_DAYS * 24 * 60 * 60 * 1000
    );
    const deleteResult = await client
      .db(MONGODB_DATABASE)
      .collection(COLLECTION_NAME)
      .deleteMany({
        $or: [
          { dateCrawled: { $lt: cutoffDate } },
          { postedDate: { $regex: /30\+ Days Ago/i } }, // Delete jobs with "30+ Days Ago"
        ],
      }); // Delete jobs older than cutoff
    console.log(`Deleted ${deleteResult.deletedCount} old jobs.`);

    for (const query of NAUKRI_SEARCH_QUERIES) {
      for (const location of NAUKRI_LOCATIONS) {
        for (const experience of NAUKRI_EXPERIENCES) {
          // Pass the headless option here.
          await scrapeNaukri(
            query.trim(),
            location.trim(),
            experience.trim(),
            client,
            {
              headless:
                options.headless === undefined ? true : options.headless, // use the value passed in, default to true
            }
          );
        }
      }
    }

    await client.close();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("An error occurred:", error); // Log the error that occurred during database connection
  }
}

//runNaukriScraper(); //removed this line.  The scraper should be called from server.js

module.exports = { runNaukriScraper };
