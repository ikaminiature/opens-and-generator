# かたち工房 — OpenSCADコード生成

登録・外部API・外部ライブラリ不要の静的Webアプリです。日本語UI、寸法単位はmm。入力値を変えるとコードが更新されます。

## iPadだけで使う（GitHub Pages）

公開後のURL： **https://ikaminiature.github.io/opens-and-generator/**

公開が完了していれば、iPadのSafariでこのURLを開くだけで使えます。PC・サーバー起動・アプリ利用のためのアカウント登録は不要です。初回表示や再読み込みにはインターネット接続が必要ですが、寸法入力・コード生成・保存はブラウザ内で処理し、入力値を外部に送信しません。

1. 円柱・円盤・直方体・中空の箱から形状を選びます。
2. mmで寸法を入力します。コードが自動更新されます。
3. 「.scad を保存」をタップし、確認画面が出たら「ダウンロード」を選びます。
4. Safariのダウンロード一覧、または「ファイル」アプリのダウンロードフォルダから `cylinder.scad` などを開けます。保存先はSafariの設定に従います。

「コードをコピー」も利用できます。コピーできない場合はコード欄を長押しして選択・コピーしてください。ホーム画面に追加する場合はSafariの共有メニューから「ホーム画面に追加」を選べます（オフライン動作を保証する機能ではありません）。

## GitHub Pagesを初めて公開する（iPadから操作可能）

この設定にはリポジトリの管理権限を持つGitHubアカウントでのログインが必要です。公開サイトを使う人のログインは不要です。

1. Safariで https://github.com/ikaminiature/opens-and-generator を開きます。
2. ファイル一覧に `index.html`、`app.js`、`generator.js`、`style.css`、`.nojekyll` があることを確認します。まだない場合は、下の「ファイルがGitHubに反映されていない場合」を先に行います。
3. リポジトリの **Settings（設定）** → **Pages** を開きます。見つからない場合は https://github.com/ikaminiature/opens-and-generator/settings/pages に直接アクセスします。必要ならSafariのメニューからデスクトップ用Webサイトを表示します。
4. **Build and deployment** の **Source** で **Deploy from a branch** を選びます。
5. **Branch** で **main**、フォルダは **/ (root)** を選び、**Save** を押します。
6. 数分待ってPages画面を再読み込みします。公開URLが表示されたら **Visit site** で開きます。**Actions** タブでも `pages build and deployment` の成功を確認できます。
7. **Enforce HTTPS** が選べる場合は有効にし、上記のHTTPS URLで開きます。

無料で公開するには公開（Public）リポジトリを使用してください。Privateの場合、無料プランではPagesを利用できないことがあります。可視性の変更はソースも公開するため、内容を確認してからGitHubの設定で判断してください。このアプリには有料サービスや有料APIはありません。

### ファイルがGitHubに反映されていない場合

作業環境からGitHubへpushできなかった場合は、作業ファイルをiPadの「ファイル」アプリに保存したうえで、GitHubのリポジトリ画面で **Add file → Upload files** を選びます。`index.html`、`style.css`、`generator.js`、`app.js`、`.nojekyll`、`README.md` をアップロードし、**Commit changes** でmainに保存してください。`.nojekyll` は空ファイルで、Jekyllによる加工を無効化します。隠しファイルのアップロードが難しい場合、このアプリの通常名の静的ファイルは `.nojekyll` なしでも公開できます。

### 404になる場合

PagesのBranchがmain、フォルダがrootであること、mainの直下に `index.html` があること、Actionsのデプロイが成功したことを確認します。公開直後は反映まで数分待ち、末尾の `/` を含むURLで再読み込みしてください。

## 開発時だけローカルで確認する

利用者には不要な手順です。開発時はリポジトリのディレクトリで次を実行します。

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

`http://localhost:8000` で開けます。GitHub PagesではGitHubがファイルを配信するため、このサーバーを起動する必要はありません。ビルド・npm install・環境変数の設定は不要です。CSSとJavaScriptは相対パスで読み込み、リポジトリ名を含むURLにも対応します。

## 形状と制約

- 円柱：直径、高さ
- 円盤：直径、高さ、中心穴の直径（0で穴なし）
- 直方体：幅、奥行き、高さ
- 中空の箱：外寸の幅・奥行き・高さ、壁厚、底面の厚さ。上面が開いた箱です。

すべての寸法は有限の正数（中心穴のみ0を許可）。穴は外径未満、壁厚の2倍は外寸の幅・奥行き未満、底厚は高さ未満が必要です。エラー中はコピー・保存できません。形状ごとの入力はページを開いている間保持され、再読み込みで初期値に戻ります。

OpenSCADでコードを開き、F6でレンダリングしてSTLを書き出し、スライサーに読み込んでください。円形の分割数は96です。最小実装には3Dプレビューやプリンターに応じた肉厚判定は含みません。

## 検証

生成ロジックのテスト（Node.js、追加依存不要）：

```sh
node tests/generator.test.cjs
```

ブラウザテストはPlaywrightとChromiumがある開発環境で、上記HTTPサーバーの起動後に実行します。

```sh
node tests/browser.cjs
```

ブラウザテストのChromiumパスは `/usr/bin/chromium` です。4形状の生成、入力検証、コピー、保存内容、画面幅を確認します。実機Safariでの最終確認は上記手順で行ってください。
