// backend/api/server.js
const express = require('express');
const app = express();

app.use(express.json());

// Define your routes here
app.get('/', (req, res) => {
  res.send('Hello from Express on Vercel!');
});

// Export the Express app as a serverless function
module.exports = app;
