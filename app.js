// モジュールのインポート
const https = require("https");
const express = require("express");

// 環境変数の取得
// ポート番号
const PORT = process.env.PORT || 3000;
// Messaging APIを呼び出すためのトークン
const TOKEN = process.env.LINE_ACCESS_TOKEN;

// Expressアプリケーションオブジェクトの生成
const app = express();

// ミドルウェアの設定
app.use(express.json());
app.use(express.urlencoded({ extended: true, }));

// ルーティングの設定-ドメインのルート
app.get("/", (_, res) => {
  res.sendStatus(200);
});

//ルーティングの設定-MessaginAPI
app.post("/webhook", (req, res) => {
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
    console.log(req.body);
    res.status(400).send("Bad request: Invalid webhook event format.");
  }
});

// リスナーの設定
app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
