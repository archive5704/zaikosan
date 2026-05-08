# 彌榮家のざいこさん / GitHub Pages + Supabase 版

スマホのホーム画面に追加して、アプリ風に使える共有在庫管理アプリです。

## フォルダ構成

```text
index.html
manifest.webmanifest
service-worker.js
assets/
  styles.css
  app.js
  supabase.js
icons/
  icon-180.png
  icon-192.png
  icon-512.png
  icon-source.png
  favicon.png
sql/
  setup.sql
```

## 1. Supabase 側の準備

1. Supabaseで新規プロジェクトを作成します。
2. 左メニューの SQL Editor を開きます。
3. `sql/setup.sql` の中身を貼り付けて実行します。

このSQLは、以下のテーブルを作ります。

- `categories`
- `items`
- `history`

今回は要望どおり、URLを知っている人は全員、閲覧・追加・修正・削除できる設定です。

## 2. Supabase URL と anon key を入れる

`assets/supabase.js` を開き、以下を自分のSupabase情報に変更します。

```js
window.ZAIKOSAN_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-SUPABASE-ANON-KEY'
};
```

Supabaseの情報は、Supabase管理画面の Project Settings → API から確認できます。

## 3. GitHub Pages へアップロード

このZIPの中身をGitHubリポジトリにアップロードします。

GitHub Pagesの設定で、公開元を `main` ブランチの `/root` にします。

## 4. スマホのホーム画面に追加

iPhoneの場合：

1. SafariでGitHub PagesのURLを開く
2. 共有ボタンを押す
3. 「ホーム画面に追加」

Androidの場合：

1. ChromeでGitHub PagesのURLを開く
2. メニューを開く
3. 「ホーム画面に追加」

## 主な機能

- 買うものリスト自動表示
- 在庫一覧
- 在庫の登録・修正・削除
- 在庫ボタン選択式：0 / 1 / 2 と 1/4 / 1/2 / 3/4 の組み合わせ
- よく使うピン留め
- 更新者名
- 更新履歴
- カテゴリ追加・名称変更・削除
- カテゴリ削除時の移動先選択
- カテゴリ並び替え
- アルファベット読み検索・部分検索
- PWA対応
- 金色冷蔵庫アイコン入り

## 注意

この版は「URLを知っている人が全員編集できる」公開編集版です。
知らない人にURLが広がると、データを変更される可能性があります。
本人だけが編集できる運用にしたい場合は、Supabase Auth と RLS の管理者制限版に切り替えてください。


## 今回の初期データ
- カテゴリは「調味料・野菜・スパイス・粉物・乾物」の5種類を初期登録しています。
- 在庫一覧と買うものリストがすぐ確認できるよう、初期食材データを入れています。
- ホーム画面の表示名は「ざいこさん」です。
