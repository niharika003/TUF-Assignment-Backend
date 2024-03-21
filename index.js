const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Sequelize, DataTypes } = require("sequelize");
const axios = require("axios");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  ssl: true,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

const CodeSnippet = sequelize.define(
  "CodeSnippet",
  {
    username: { type: DataTypes.STRING, allowNull: false },
    language: { type: DataTypes.STRING, allowNull: false },
    stdin: { type: DataTypes.TEXT },
    stdout: { type: DataTypes.TEXT },
    source_code: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "code_snippets",
  }
);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

sequelize.sync();

app.post("/api/snippets", async (req, res) => {
  try {
    const newSnippet = await CodeSnippet.create(req.body);
    res.status(201).send(newSnippet);
  } catch (err) {
    res.status(500).send("Error saving the code snippet");
    console.error(err);
  }
});

app.get("/api/snippets", async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const perPage = parseInt(req.query.per_page, 10) || 10;

  try {
    const { count: totalItems, rows: snippets } =
      await CodeSnippet.findAndCountAll({
        attributes: [
          "id",
          "username",
          "language",
          "stdin",
          "stdout",
          [
            Sequelize.fn("LEFT", Sequelize.col("source_code"), 100),
            "source_code",
          ],
          "created_at",
        ],
        order: [["created_at", "DESC"]],
        offset: (page - 1) * perPage,
        limit: perPage,
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

const getLanguageId = (langString) => {
  const LANGUAGES = {
    JavaScript: 93,
    Python: 92,
    Java: 91,
    "C++": 54,
  };
  return LANGUAGES[langString];
};

app.post("/api/execute-code", async (req, res) => {
  const { language, source_code, stdin } = req.body;

  try {
    const judge0Response = await axios.post(
      "https://judge0-ce.p.rapidapi.com/submissions",
      {
        language_id: getLanguageId(language),
        source_code: source_code,
        stdin: stdin,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": process.env.X_RAPID_API_KEY,
          "X-RapidAPI-Host": process.env.X_RAPID_API_HOST,
        },
        params: { base64_encoded: "false" },
      }
    );

    if (judge0Response.data && judge0Response.data.token) {
      const token = judge0Response.data.token;

      const resultResponse = await axios({
        method: "GET",
        url: `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
        headers: {
          "X-RapidAPI-Key": process.env.X_RAPID_API_KEY,
          "X-RapidAPI-Host": process.env.X_RAPID_API_HOST,
        },
        params: {
          base64_encoded: "false",
        },
      });

      const { stdout } = resultResponse.data;
      res.status(200).json({ stdout });
    }
  } catch (error) {
    console.error("Error executing code:", error);
    res.status(500).json({ error: "Failed to execute the code" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
