// models/Job.js (You might want to create a 'models' directory)
const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true, // Removes whitespace from both ends of a string
  },
  company: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: String,
    trim: true,
  },
  experienceLevel: {
    type: String,
    enum: [
      "Entry-Level",
      "Mid-Level",
      "Senior-Level",
      "Associate",
      "Executive",
      "Internship",
      "Other",
    ],
    required: false, // Making it optional for now, as some sources might not always provide this
    trim: true,
  },
  companyLevel: {
    type: String,
    enum: ["Startup", "Small", "Medium", "Large Enterprise", "Other"],
    required: false, // Similarly, making it optional
    trim: true,
  },
  jobType: {
    type: String,
    enum: [
      "Full-time",
      "Part-time",
      "Contract",
      "Temporary",
      "Remote",
      "Hybrid",
      "Other",
    ],
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
    unique: true, // Ensures that each job posting has a unique URL
  },
  postedDate: {
    type: Date,
  },
  dateCrawled: {
    type: Date,
    default: Date.now, // Automatically sets the date when the job is added to our database
  },
  // You can add more fields as needed, such as salary, skills, etc.
});

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
