const { MongoClient } = require("mongodb");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || "job_data";
const COLLECTION_NAME = "jobs";

let clientInstance = null; // Declare clientInstance outside

async function connectDB() {
  if (!clientInstance) {
    clientInstance = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000, // Add timeouts to connection
      connectTimeoutMS: 15000,
    });
  }
  return clientInstance;
}

// Refactor common logic for fetching jobs
async function fetchJobs(res, query, page = 1, limit = 10, errorMessage) {
  try {
    const client = await connectDB();
    const db = client.db(MONGODB_DATABASE);
    const collection = db.collection(COLLECTION_NAME);

    const count = await collection.countDocuments(query);
    const jobs = await collection
      .find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();

    res.json({
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      jobs: jobs,
    });
  } catch (err) {
    console.error(`${errorMessage}:`, err);
    res.status(500).json({ message: errorMessage });
  }
}

exports.getAllJobs = async (req, res) => {
  const {
    search,
    location,
    experienceLevel,
    companyLevel,
    page = 1,
    limit = 10,
  } = req.query; //add location
  const filters = {};
  const query = {};

  if (experienceLevel) {
    filters.experienceLevel = experienceLevel;
  }
  if (companyLevel) {
    filters.companyLevel = companyLevel;
  }
  if (location) {
    filters.location = { $regex: new RegExp(location, "i") };
  }
  if (search) {
    query.$or = [
      { title: { $regex: new RegExp(search, "i") } },
      { company: { $regex: new RegExp(search, "i") } },
      { description: { $regex: new RegExp(search, "i") } },
    ];
  }

  const mongoQuery = { ...query, ...filters };
  await fetchJobs(res, mongoQuery, page, limit, "Error fetching jobs");
};

exports.getJobsByExperience = async (req, res) => {
  const { level } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const query = { experienceLevel: level };
  await fetchJobs(
    res,
    query,
    page,
    limit,
    `Error fetching jobs with experience level ${level}`
  );
};

exports.getJobsByCompanyLevel = async (req, res) => {
  const { level } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const query = { companyLevel: level };
  await fetchJobs(
    res,
    query,
    page,
    limit,
    `Error fetching jobs with company level ${level}`
  );
};

exports.getJobsByTitle = async (req, res) => {
  const { title } = req.query;
  const { page = 1, limit = 10 } = req.query;

  if (!title) {
    return res
      .status(400)
      .json({ message: "Please provide a title query parameter" });
  }

  const query = { title: { $regex: new RegExp(title, "i") } };
  await fetchJobs(
    res,
    query,
    page,
    limit,
    `Error fetching jobs with title containing "${title}"`
  );
};
