// モジュールのインポート
const https = require("https");
const express = require("express");
const { Client } = require('pg');
//const { Pool } = require('pg'); //PostgreSQL用のライブラリ
//const jwt = require('jsonwebtoken');

// 環境変数の取得
// ポート番号
const PORT = process.env.PORT || 3000;
// Messaging APIを呼び出すためのトークン
const TOKEN = process.env.LINE_ACCESS_TOKEN;

// Expressアプリケーションオブジェクトの生成
const app = express();

//PostgreSQLへの接続
const connection = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
connection.connect();

/*PostgreSQL接続設定
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,

  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
});
const client = await pool.connect();*/



//usersテーブル作成クエリ

// ミドルウェアの設定
app.use(express.json());
app.use(express.urlencoded({ extended: true, }));

// ルーティングの設定-ドメインのルート
app.get("/", (_, res) => {
  res.sendStatus(200);
});

// サーバーへのリクエスト
app.post('/check-token', async (req, res) => {
  const idToken = req.body.idToken;
  
  try {
    // トークン検証とアクセス回数確認の処理を実行
    const profile = await verifyToken(idToken);
    const userId = profile.sub;

    // 今日の日付を取得
    const today = new Date().toISOString().slice(0, 10);

    // ユーザーのアクセス履歴をデータベースで確認
    const query = 'SELECT access_date FROM user_access WHERE user_id = $1 AND access_date = $2';
    const result = await connection.query(query, [userId, today]);

    if (result.rows.length > 0) {
      // 既に今日アクセスしている場合
      return res.json({ allowed: false, message: 'またきてね' });
    }

    // 今日が初めてのアクセスの場合、データベースに新しいアクセスを登録
    const insertQuery = 'INSERT INTO user_access (user_id, access_date) VALUES ($1, $2)';
    await connection.query(insertQuery, [userId, today]);

    res.json({ allowed: true });
  } catch (error) {
    console.error('Error processing token', error);
    res.status(500).send('Internal Server Error');
  }
});

//ルーティングの設定-MessaginAPI
app.post("/webhook", (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));
  if (req.body && req.body.events && req.body.events.length > 0 && req.body.events[0].type === "message") {
    res.send("HTTP POST request sent to the webhook URL!");
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,
    };
    const dataString = JSON.stringify({
      replyToken: req.body.events[0].replyToken,
      messages: [
        {
          type: "text",
          text: "Hello, user",
        },
        {
          type: "text",
          text: "May I help you?",
        },
      ],
    });
    const webhookOptions = {
      hostname: "api.line.me",
      path: "/v2/bot/message/reply",
      method: "POST",
      headers: headers,
      body: dataString,
    };
    const request = https.request(webhookOptions, res => {
      res.on("data", d => {
        process.stdout.write(d);
      });
    });
    request.on("error", err => {
      console.error(err);
    });

    request.write(dataString);
    request.end();
  } else {
    /*console.log(req.body.destination);
    console.log(req.body.events);
    console.log(typeof req.body.destination);
    console.log(typeof req.body.events);
    console.log(req.body.events == "[]");
    console.log(req.body.events.length);*/
    if (req.body.destination != null && req.body.events.length == 0) {
      res.sendStatus(200);
    }
    else {
      res.status(400).send("Bad request: Invalid webhook event format.");
    }
  }
});

// リスナーの設定
app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
