require("dotenv").config();
const syncDb = require("./sync-db.js");
const express = require("express");
const { Pool } = require("pg");
const cron = require("node-cron");

const port = 3000;
const authApi = "auth.truelayer.com";

const app = express();
const cors = require("cors");

app.use(cors());

const connectionString = process.env.POSTGRES_URI;
const pool = new Pool({
  connectionString,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/accounts", async (req, res) => {
  const query = `SELECT b.id, b.created_at, a.id AS account_id, a.display_name, a.provider, a.account_type, a.account_number  
                  FROM bank_connections b
                  JOIN accounts a ON b.id = a.connection_id

`;
  const bankConnections = await pool.query(query);

  return res.status(200).send(bankConnections.rows);
});

app.get("/accounts/connect", async (req, res) => {
  res.redirect(
    `https://auth.truelayer.com/?response_type=code&client_id=${process.env.TRUELAYER_CLIENT_ID}&scope=accounts%20balance%20cards%20direct_debits%20info%20offline_access%20standing_orders%20transactions&redirect_uri=${process.env.TRUELAYER_REDIRECT_URI}&providers=uk-ob-all%20uk-oauth-all`,
  );
});

app.post("/accounts/link", async (req, res) => {
  const code = req.body.code;

  const response = await fetch(`https://${authApi}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.TRUELAYER_CLIENT_ID,
      client_secret: process.env.TRUELAYER_CLIENT_SECRET,
      redirect_uri: process.env.TRUELAYER_REDIRECT_URI,
      code: code,
    }),
  });
  const tokenResponse = await response.json();
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  } = tokenResponse;

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const query =
    "INSERT INTO bank_connections(access_token, refresh_token, expires_at, created_at) VALUES($1, $2, $3, $4) RETURNING *";
  await pool.query(query, [accessToken, refreshToken, expiresAt, new Date()]);

  setImmediate(async () => {
    await syncDb({ pool });
  });

  return res.status(201).send();
});

app.get("/categories", async (req, res) => {
  const query = "SELECT * FROM category";
  const result = await pool.query(query);
  return res.status(201).send(
    result.rows.map((row) => ({
      id: row.id,
      label: row.category,
    })),
  );
});

app.get("/transactions", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  const categories = req.query.categories;

  const whereClauses = [];
  const queryParams = [];
  let paramIndex = 1;

  if (startDate) {
    whereClauses.push(`(tr.timestamp >= $${paramIndex})`);
    queryParams.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    whereClauses.push(`(tr.timestamp < $${paramIndex})`);
    queryParams.push(endDate);
    paramIndex++;
  }

  if (categories && categories !== "uncategorized") {
    const categoryList = categories.split(",").map(Number);
    if (categoryList.length > 0) {
      whereClauses.push(`tr.category_id = ANY($${paramIndex}::int[])`);
      queryParams.push(categoryList);
      paramIndex++;
    }
  } else if (categories === "uncategorized") {
    whereClauses.push(`tr.category_id IS NULL`);
  }

  const whereSQL =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const dataQuery = `SELECT tr.id, tr.transaction_id, ac.display_name, ac.provider, ac.account_type, tr.timestamp, tr.provider_merchant_name, tr.description, tr.amount, tr.category_id
                        FROM transactions tr
                        LEFT JOIN accounts ac ON tr.account_id = ac.external_id
                        ${whereSQL}
                        ORDER BY timestamp DESC 
                        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const countQuery = `SELECT COUNT(*) FROM transactions tr ${whereSQL}`;

  const dataParams = [...queryParams, limit, offset];
  const countParams = [...queryParams];

  const dataResult = await pool.query(dataQuery, dataParams);
  const countResult = await pool.query(countQuery, countParams);

  return res.status(200).send({
    page: page,
    limit: limit,
    total: countResult.rows[0].count,
    data: dataResult.rows,
  });
});

app.patch("/transactions/bulk", async (req, res) => {
  const {
    category_id: categoryId,
    provider_merchant_name: providerMerchantName,
    description,
  } = req.body;

  const query = `UPDATE transactions
                  SET category_id = $1
                  WHERE description = $2 and provider_merchant_name = $3
                  AND category_id IS NULL
                  RETURNING *`;
  const result = await pool.query(query, [
    categoryId,
    description,
    providerMerchantName,
  ]);

  return res.status(200).send({
    updated_count: result.rowCount,
    data: result.rows,
  });
});

app.patch("/transactions/:id", async (req, res) => {
  const transactionId = req.params.id;
  const categoryId = req.body.category_id;

  const query =
    "UPDATE transactions SET category_id = $1 WHERE id = $2 RETURNING *";
  await pool.query(query, [categoryId, transactionId]);
  return res.status(200).send();
});

app.get("/analytics/summary", async (req, res) => {
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  const query = `WITH all_transactions AS (
                    SELECT
                        tr.*,
                        ca.type
                    FROM transactions tr
                    LEFT JOIN category ca 
                        ON tr.category_id = ca.id
                    WHERE (tr.timestamp  >= $1)
                      AND (tr.timestamp  < $2)
                )

                SELECT
                    COALESCE(ABS(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END)), 0) AS total_spent,
                    COALESCE(ABS(SUM(CASE WHEN type = 'Income'  THEN amount ELSE 0 END)), 0) AS total_income,
                    COALESCE(ABS(SUM(CASE WHEN type = 'Savings' THEN amount ELSE 0 END)), 0) AS total_saved
                FROM all_transactions;`;
  const result = await pool.query(query, [startDate, endDate]);
  return res.status(200).send({
    total_spent: result.rows[0].total_spent,
    total_income: result.rows[0].total_income,
    total_saved: result.rows[0].total_saved,
  });
});

app.get("/analytics/category-breakdown", async (req, res) => {
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  const query = `WITH all_transactions AS (
                    SELECT
                        tr.*,
                        ca.*    
                    FROM transactions tr
                    LEFT JOIN category ca 
                        ON tr.category_id = ca.id
                    WHERE (tr.timestamp  >= $1)
                      AND (tr.timestamp  < $2)
                )

                SELECT
                    TO_CHAR(DATE_TRUNC('month', timestamp), 'MM-YYYY') AS month,
                    category,
                    type,
                    SUM(amount) AS amount
                FROM all_transactions
                GROUP BY
                    DATE_TRUNC('month', timestamp),
                    category,
                    type
                ORDER BY
                    DATE_TRUNC('month', timestamp);`;

  const response = await pool.query(query, [startDate, endDate]);

  const data = {};

  for (const row of response.rows) {
    if (!data[row.month]) {
      data[row.month] = {
        month: row.month,
        categories: [],
      };
    }

    data[row.month].categories.push({
      type: row.type,
      label: row.category,
      amount: Number(row.amount),
    });
  }
  return res.status(200).send(Object.values(data));
});

cron.schedule("0 * * * *", async () => {
  try {
    await syncDb();
  } catch (err) {
    console.error(err);
  }
});

app.listen(port, () => {
  console.log(`Spendless running on http://localhost:${port}`);
});
