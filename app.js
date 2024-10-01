// モジュールのインポート
const https = require("https");
const express = require("express");
const { Client } = require('pg');

// 環境変数の取得
// ポート番号
const PORT = process.env.PORT || 3000;
// Messaging APIを呼び出すためのトークン
const TOKEN = process.env.LINE_ACCESS_TOKEN;

// Expressアプリケーションオブジェクトの生成
const app = express();

// PostgreSQLへの接続
const connection = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
connection.connect();

// ミドルウェアの設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ユーザーがその日にアプリを開いたかをチェックする関数
async function hasOpenedToday(userId) {
  const today = new Date().toISOString().slice(0, 10); // 今日の日付を取得
  const result = await connection.query(
    'SELECT * FROM user_access WHERE user_id = $1 AND access_date = $2',
    [userId, today]
  );
  return result.rows.length > 0; // 今日すでに開いていればtrueを返す
}

// ユーザーのアクセスを記録する関数
async function recordAccess(userId) {
  const today = new Date().toISOString().slice(0, 10); // 今日の日付を取得
  await connection.query(
    'INSERT INTO user_access (user_id, access_date) VALUES ($1, $2)',
    [userId, today]
  );
}

// ルーティングの設定-ドメインのルート
app.get("/", (_, res) => {
  res.sendStatus(200);
});

// ルーティングの設定-MessagingAPI
app.post("/webhook", async (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));
  
  // イベントが存在し、メッセージタイプかチェック
  if (req.body && req.body.events && req.body.events.length > 0 && req.body.events[0].type === "message") {
    
    const userId = req.body.events[0].source.userId; // ユーザーID取得
    
    if (await hasOpenedToday(userId)) {
      // すでにその日に開いている場合
      const replyMessage = "またきてね";
      await replyToUser(req.body.events[0].replyToken, replyMessage);
    } else {
      // まだその日に開いていない場合
      await recordAccess(userId); // アクセスを記録
      const replyMessage = "Hello, user! May I help you?";
      await replyToUser(req.body.events[0].replyToken, replyMessage);
    }

    res.sendStatus(200);
  } else {
    res.status(400).send("Bad request: Invalid webhook event format.");
  }
});

// メッセージをユーザーに返信する関数
async function replyToUser(replyToken, message) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + TOKEN,
  };
  const dataString = JSON.stringify({
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: message,
      },
    ],
  });
  const webhookOptions = {
    hostname: "api.line.me",
    path: "/v2/bot/message/reply",
    method: "POST",
    headers: headers,
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
}

// リスナーの設定
app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
