require("dotenv").config();
const { Pool } = require("pg");

const connectionString = process.env.POSTGRES_URI;
const authApi = "auth.truelayer.com";
const dataApi = "api.truelayer.com";

async function syncDb(opts) {
  const pool =
    opts?.pool ||
    new Pool({
      connectionString,
    });

  await createTables(pool);
  const accessTokens = await getToken(pool);
  const accountsData = await updateAccounts(accessTokens, pool);
  await updateTransactions(accountsData, pool);
  await cleanupBankConnections(pool);

  if (!opts?.pool) {
    await pool.end();
  }
}

async function createTables(pool) {
  const createBankConnectionsTableQuery = `
    CREATE TABLE IF NOT EXISTS bank_connections (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER,
      access_token  TEXT,
      refresh_token TEXT,
      expires_at    TIMESTAMP,
      created_at    TIMESTAMP
  )`;

  const createAccountsTableQuery = `
    CREATE TABLE IF NOT EXISTS accounts (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER,
        external_id       VARCHAR(255) NOT NULL, 
        provider          VARCHAR(255),
        display_name      VARCHAR(255),
        account_type      VARCHAR(255),
        account_number    VARCHAR(255),
        sort_code         VARCHAR(255),
        updated_at        TIMESTAMP,
        last_synced_at    TIMESTAMP,
        connection_id     INTEGER REFERENCES bank_connections(id),

        UNIQUE (external_id)
  )`;

  const createCategoriesTableQuery = `
  CREATE TABLE IF NOT EXISTS category (
    id             SERIAL PRIMARY KEY,
    category       VARCHAR(255) NOT NULL,
    type           VARCHAR(255) NOT NULL,

    UNIQUE(category)
  )`;

  const createFillCategoriesTableQuery = `
    INSERT INTO category (category, type)
    VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10), ($11, $12), ($13, $14), ($15, $16), ($17, $18), ($19, $20), ($21, $22)
    ON CONFLICT (category) DO NOTHING;
  `;

  const createTransactionsTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
        id                                  SERIAL PRIMARY KEY,
        normalised_provider_transaction_id  TEXT NOT NULL,
        transaction_id                      TEXT NOT NULL,
        account_id                          VARCHAR(255) NOT NULL REFERENCES accounts(external_id),
        timestamp                           TIMESTAMPTZ,
        description                         VARCHAR(255),
        transaction_type                    VARCHAR(255),
        transaction_category                VARCHAR(255),
        transaction_classification          VARCHAR(255)[],
        amount                              NUMERIC(10,2),
        currency                            CHAR(3),
        provider_merchant_name              VARCHAR(255),
        provider_category                   VARCHAR(255),
        provider_transaction_type           VARCHAR(255),
        category_id                         INTEGER REFERENCES category(id), 

        UNIQUE(normalised_provider_transaction_id)
  )`;

  await pool.query(createBankConnectionsTableQuery);
  await pool.query(createAccountsTableQuery);
  await pool.query(createCategoriesTableQuery);
  await pool.query(createFillCategoriesTableQuery, [
    "Housing",
    "Expense",
    "Groceries",
    "Expense",
    "Eating Out",
    "Expense",
    "Health",
    "Expense",
    "Material Goods",
    "Expense",
    "Transport",
    "Expense",
    "Entertainment",
    "Expense",
    "Misc",
    "Expense",
    "Income",
    "Income",
    "Transfer",
    "Transfer",
    "Savings",
    "Savings",
  ]);
  await pool.query(createTransactionsTableQuery);
}

async function getToken(pool) {
  const bankConnectionsIds = await pool.query(
    "SELECT id, refresh_token, created_at FROM bank_connections",
  );
  const bankConnections = bankConnectionsIds.rows;

  const accessTokens = [];

  for (const bankConnection of bankConnections) {
    const id = bankConnection.id;
    const refreshToken = bankConnection.refresh_token;
    const createdAt = new Date(bankConnection.created_at);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    if (createdAt < ninetyDaysAgo) {
      continue;
    }

    const response = await fetch(`https://${authApi}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: process.env.TRUELAYER_CLIENT_ID,
        client_secret: process.env.TRUELAYER_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`Failed to retrieve token:\n${JSON.stringify(result)}`);
      continue;
    }

    const {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: expiresIn,
    } = result;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const query =
      "UPDATE bank_connections SET access_token = $1, refresh_token = $2, expires_at = $3 WHERE id = $4 RETURNING *";

    await pool.query(query, [accessToken, newRefreshToken, expiresAt, id]);

    accessTokens.push({ id: id, accessToken: accessToken });
  }

  return accessTokens;
}

async function updateAccounts(accessTokens, pool) {
  const accountsData = [];
  for (const connectionData of accessTokens) {
    const connectionId = connectionData.id;
    const accessToken = connectionData.accessToken;
    let response = await fetch(`https://${dataApi}/data/v1/accounts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let result = await response.json();

    if (!response.ok) {
      console.warn(
        `Failed to fetch bank accounts, falling back to card accounts endpoint:\n${JSON.stringify(result)}`,
      );
    }

    if (result.error === "endpoint_not_supported") {
      response = await fetch(`https://${dataApi}/data/v1/cards`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      result = await response.json();
    } else if (!response.ok) {
      console.error(
        `Failed to retrieve card accounts:\n${JSON.stringify(result)}`,
      );
      continue;
    }

    for (const account of result.results) {
      const externalId = account.account_id;
      const provider = account.provider.display_name;
      const displayName = account.display_name ?? null;
      const accountType = account.account_type ?? account.card_type;
      const accountNumber = account.account_number?.number ?? null;
      const sortCode = account.account_number?.sort_code ?? null;
      const updatedAt = account.update_timestamp;

      const query = `INSERT INTO accounts (external_id, provider, display_name, account_type, account_number, sort_code, updated_at, connection_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (external_id)
              DO UPDATE SET external_id = $1, provider = $2, display_name = $3, account_type = $4, account_number = $5, sort_code = $6, updated_at = $7, connection_id = $8
              RETURNING *
              `;

      const accountData = await pool.query(query, [
        externalId,
        provider,
        displayName,
        accountType,
        accountNumber,
        sortCode,
        updatedAt,
        connectionId,
      ]);

      accountsData.push({
        id: accountData.rows[0].id,
        externalId: accountData.rows[0].external_id,
        accessToken: accessToken,
        lastSynced: accountData.rows[0].last_synced_at
          ? accountData.rows[0].last_synced_at.toJSON().slice(0, 10)
          : null,
      });
    }
  }
  return accountsData;
}

async function updateTransactions(accountsData, pool) {
  for (const account of accountsData) {
    const id = account.id;
    const externalId = account.externalId;
    const syncFrom = account.lastSynced ? new Date(account.lastSynced) : null;

    const transactionData =
      syncFrom === null
        ? await fetchAllTransactions(account, pool)
        : await fetchLatestTransactions(account, syncFrom, pool);

    await upsertTransactions(externalId, transactionData, pool);

    const updateLastSyncedQuery =
      "UPDATE accounts SET last_synced_at = $1 WHERE id = $2";
    await pool.query(updateLastSyncedQuery, [new Date(), id]);
  }
}

async function fetchAllTransactions(account, pool) {
  const externalId = account.externalId;
  const accessToken = account.accessToken;
  let historicalTransactions = [];

  let toDate = new Date();
  while (true) {
    let fromDate = new Date(toDate);
    fromDate.setFullYear(fromDate.getFullYear() - 1);

    let response = await fetch(
      `https://${dataApi}/data/v1/accounts/${externalId}/transactions?to=${toDate.toISOString().split("T")[0]}&from=${fromDate.toISOString().split("T")[0]}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    let result = await response.json();

    if (!response.ok) {
      console.warn(
        `Failed to fetch bank transactions, falling back to card transactions endpoint:\n${JSON.stringify(result)}`,
      );
    }

    if (result.error === "endpoint_not_supported") {
      response = await fetch(
        `https://${dataApi}/data/v1/cards/${externalId}/transactions?to=${toDate.toISOString().split("T")[0]}&from=${fromDate.toISOString().split("T")[0]}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      result = await response.json();
    } else if (!response.ok) {
      console.error(
        `Failed to retrieve card transactions:\n${JSON.stringify(result)}`,
      );
      continue;
    }

    if (result.error === "invalid_date_range") {
      console.log(`No transactions between ${fromDate} and ${toDate}`);
      console.log(`${historicalTransactions.length} transactions found`);
      break;
    }

    historicalTransactions.push(...result.results);
    toDate = new Date(fromDate);
  }

  return historicalTransactions;
}

async function fetchLatestTransactions(account, syncFrom, pool) {
  const externalId = account.externalId;
  const accessToken = account.accessToken;

  const currentDate = new Date().toJSON().slice(0, 10);
  syncFrom.setDate(syncFrom.getDate() - 30); // get last month of transactions incase they have updated
  const syncFromDate = syncFrom.toISOString().split("T")[0];

  let response = await fetch(
    `https://${dataApi}/data/v1/accounts/${externalId}/transactions?to=${currentDate}&from=${syncFromDate}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  let result = await response.json();

  if (!response.ok) {
    console.warn(
      `Failed to fetch bank transactions, falling back to card transactions endpoint:\n${JSON.stringify(result)}`,
    );
  }

  if (result.error === "endpoint_not_supported") {
    response = await fetch(
      `https://${dataApi}/data/v1/cards/${externalId}/transactions?to=${currentDate}&from=${syncFromDate}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    result = await response.json();
  } else if (!response.ok) {
    console.error(
      `Failed to retrieve card transactions:\n${JSON.stringify(result)}`,
    );
    return;
  }

  return result.results;
}

async function upsertTransactions(externalId, transactionData, pool) {
  for (const transaction of transactionData) {
    const normalisedProviderTransactionId =
      transaction.normalised_provider_transaction_id;
    const transactionId = transaction.transaction_id;
    const timestamp = transaction.timestamp;
    const description = transaction.description;
    const transactionType = transaction.transaction_type;
    const transactionCategory = transaction.transaction_category;
    const transactionClassification = transaction.transaction_classification;
    const amount = transaction.amount;
    const currency = transaction.currency;
    const providerMerchantName = transaction.meta?.provider_merchant_name;
    const providerCategory = transaction.meta?.provider_category;
    const providerTransactionType = transaction.meta?.provider_transaction_type;

    const categoryQuery = providerMerchantName
      ? `SELECT category_id 
          FROM transactions 
          WHERE description = $1 AND provider_merchant_name = $2
          AND category_id IS NOT NULL
          ORDER BY timestamp DESC
          LIMIT 1`
      : `SELECT category_id 
          FROM transactions 
          WHERE description = $1 AND provider_merchant_name IS NULL
          AND category_id IS NOT NULL
          ORDER BY timestamp DESC
          LIMIT 1`;

    const result = await pool.query(
      categoryQuery,
      providerMerchantName
        ? [description, providerMerchantName]
        : [description],
    );
    const categoryId = result.rows[0]?.category_id ?? null;

    const transactionQuery = `INSERT INTO transactions (normalised_provider_transaction_id, transaction_id, account_id, timestamp, description, transaction_type, transaction_category, transaction_classification, amount, currency, provider_merchant_name, provider_category, provider_transaction_type, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (normalised_provider_transaction_id)
        DO UPDATE SET normalised_provider_transaction_id = $1,
        transaction_id = $2,
        account_id = $3,
        timestamp = $4, 
        description = $5,
        transaction_type = $6,
        transaction_category = $7,
        transaction_classification = $8,
        amount = $9,
        currency = $10,
        provider_merchant_name = $11,
        provider_category = $12,
        provider_transaction_type = $13,
        category_id = COALESCE(transactions.category_id, $14)
        `;

    await pool.query(transactionQuery, [
      normalisedProviderTransactionId,
      transactionId,
      externalId,
      timestamp,
      description,
      transactionType,
      transactionCategory,
      transactionClassification,
      transactionType === "CREDIT" ? Math.abs(amount) : -Math.abs(amount),
      currency,
      providerMerchantName,
      providerCategory,
      providerTransactionType,
      categoryId,
    ]);
  }
}

async function cleanupBankConnections(pool) {
  const query = `DELETE FROM bank_connections
                 WHERE id IN (
                    SELECT b.id
                    FROM bank_connections b
                    LEFT JOIN accounts a ON b.id = a.connection_id
                    WHERE a.id IS NULL
                    )`;

  await pool.query(query);
}

module.exports = syncDb;
