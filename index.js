const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Sequelize, DataTypes } = require("sequelize");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

// Sequelize connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
  }
);

// Sequelize model
const CodeSnippet = sequelize.define(
  "CodeSnippet",
  {
    username: { type: DataTypes.STRING, allowNull: false },
    language: { type: DataTypes.STRING, allowNull: false },
    stdin: { type: DataTypes.TEXT },
    source_code: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "code_snippets",
  }
);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sync Sequelize models
sequelize.sync();

// API endpoint to submit a new code snippet
app.post("/api/snippets", async (req, res) => {
  try {
    const newSnippet = await CodeSnippet.create(req.body);
    res.status(201).send(newSnippet);
  } catch (err) {
    res.status(500).send("Error saving the code snippet");
    console.error(err);
  }
}); 

// API endpoint to retrieve all code snippets
app.get("/api/snippets", async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1; // default to first page
  const perPage = parseInt(req.query.per_page, 10) || 10; // default to 10 records per page

  try {
    const { count: totalItems, rows: snippets } =
      await CodeSnippet.findAndCountAll({
        attributes: [
          "id",
          "username",
          "language",
          "stdin",
          [
            Sequelize.fn("LEFT", Sequelize.col("source_code"), 100),
            "source_code",
          ],
          "created_at",
        ],
        order: [["created_at", "DESC"]],
        offset: (page - 1) * perPage, // Skip the previous pages' worth of records
        limit: perPage, // Limit to `perPage` number of records
      });

    res.status(200).send({
      totalItems,
      totalPages: Math.ceil(totalItems / perPage),
      currentPage: page,
      records: snippets,
    });
  } catch (err) {
    res.status(500).send("Error retrieving code snippets");
    console.error(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
