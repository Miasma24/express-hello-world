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
    const userInfo = await verifyIdToken(idToken);
    const userId = userInfo.sub; // IDトークンからユーザーIDを取得
    const currentDate = new Date().toISOString().split('T')[0]; // 今日の日付（YYYY-MM-DD形式）

    const client = await pool.connect();

    // データベースでユーザーを確認
    const result = await client.query('SELECT last_access_date FROM user_access WHERE user_id = $1', [userId]);

    if (result.rows.length > 0 && result.rows[0].last_access_date === currentDate) {
      res.json({ message: 'またきてね' }); // 今日すでにアクセス済みの場合
    } else {
      // 初回または別の日にアクセスした場合、アクセス日時を更新
      await client.query(
        'INSERT INTO user_access (user_id, last_access_date) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_access_date = $2',
        [userId, currentDate]
      );
      res.json({ message: 'ようこそ！' });
    }

    client.release();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'エラーが発生しました。' });
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
