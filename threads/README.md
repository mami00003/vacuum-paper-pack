# Threads 自動投稿

毎日19:00（JST）に、`posts.json` の未投稿ぶんを1本ずつThreadsへ投稿します。30本入れてあるので約1か月ぶんです。

## 中身

| ファイル | 役割 |
|---|---|
| `posts.json` | 投稿文30本。番号順に送られます |
| `state.json` | 送信済みの記録。ワークフローが自動で更新します |
| `post.mjs` | 投稿スクリプト（Node 20・依存パッケージなし） |
| `../.github/workflows/threads.yml` | 毎日の実行 |

**アクセストークンはこのリポジトリに入っていません。** GitHubのSecretsから環境変数で渡します。

---

## セットアップ（初回だけ・15分ほど）

### 1. Metaアプリを作る

https://developers.facebook.com/apps/ →「アプリを作成」

- ユースケース：**「Threads API へのアクセス」**
- 作成後、左メニューの「ユースケース」→ Threads API →「設定」で
  **`threads_basic`** と **`threads_content_publish`** を追加

### 2. Threadsアカウントを紐づける

「アプリロール」→「役割」で、自分のThreadsアカウントをテスターとして追加します。
自分のアカウントだけに投稿するなら、**アプリレビューは不要**です（開発モードのままで動きます）。

### 3. アクセストークンを取る

ユースケースの設定画面に「Threads テストユーザーの生成」やトークン生成のボタンがあります。
出てきた短期トークンを、**長期トークン（60日）**に交換します。

```
https://graph.threads.net/access_token
  ?grant_type=th_exchange_token
  &client_secret=（アプリのシークレット）
  &access_token=（短期トークン）
```

ブラウザのアドレスバーに入れて開けば、`access_token` が返ってきます。

### 4. GitHubのSecretsに貼る

リポジトリ → **Settings → Secrets and variables → Actions → New repository secret**

- Name: `THREADS_ACCESS_TOKEN`
- Secret: 3で取った長期トークン

**ここに貼ったものは、リポジトリが公開でも他人からは見えません。** ログにも出ないようにしてあります。

### 5. 動作確認

Actions タブ →「Threads 自動投稿」→ **Run workflow** →
`投稿せずに内容だけ確認する` に **チェックを入れて**実行。

ログに次の投稿文が出れば、ここまでは成功です。
チェックを外してもう一度実行すると、実際に投稿されます。

---

## 運用

- **毎日19:00（JST）に1本**。30日で一巡します
- 一巡したら「すべて投稿済みです」とログが出て止まります。`posts.json` に足すか、`state.json` の `sent` を `[]` に戻してください
- 投稿の順番を変えたいときは `posts.json` の並びを入れ替えます
- 止めたいときは Actions → ワークフロー → `Disable workflow`

### トークンは60日で切れます

切れると毎日の実行が失敗し、**GitHubから失敗通知メールが届きます。** そうしたら手順3をやり直して、Secretを更新してください。

50日ごとに更新するのがおすすめです。手順3のURLの `grant_type` を `th_refresh_token` に変えると、期限切れ前の更新ができます。

```
https://graph.threads.net/refresh_access_token
  ?grant_type=th_refresh_token
  &access_token=（いまの長期トークン）
```

---

## 注意

- **アフィリエイトリンクは貼っていません。** もしもアフィリエイトの提携可能メディアはWebサイト・ブログ・アプリ・YouTube・Instagram・X(Twitter)のいずれかで、Threadsは対象外です。投稿からはサイトへ送り、サイト上のリンクを踏んでもらう形にしています
- 引用はすべてメーカー公式サイトの逐語です。**言い換えないでください**
- APIの上限は24時間で250投稿ですが、同じリンクの連投はスパム判定されます。**1日1本**を守ってください
