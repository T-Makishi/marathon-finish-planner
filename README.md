# RUN Finish Planner

React Native + Expo + TypeScriptで作成した、マラソン大会前の完走ペース計画アプリです。GPS計測や外部アプリ連携は行わず、大会情報、関門、ロスタイム、給水停止時間、目標ゴールタイム、高低差補正を手入力して、1kmごとの予定ラップ、通過予定時刻、関門余裕時間を計算します。

## ローカル確認

```bash
npm install
npx expo start
```

表示されたQRコードをiPhoneまたはAndroidのExpo Goで読み取ります。

Webで確認する場合:

```bash
npx expo start --web
```

`http://localhost:8081/` は開発サーバーが起動している間だけ表示できます。サーバーを止めるとブラウザには `This site can't be reached` と表示されます。

## GitHub PagesでURL共有する

このリポジトリをGitHubにpushすると、`.github/workflows/pages.yml` によりExpo Web版をビルドしてGitHub Pagesへデプロイできます。

1. GitHubにリポジトリを作成します。
2. ローカルのコードを `main` ブランチへpushします。
3. GitHubのリポジトリ設定で Pages の Source を `GitHub Actions` にします。
4. Actions の `Deploy Expo Web to GitHub Pages` が成功すると、PagesのURLが発行されます。

## 公開範囲について

GitHub Pagesは基本的にパスワード保護ではありません。そのため「URLを知っている人だけに共有する」運用はできますが、厳密なアクセス制限ではありません。

本当に利用者を制限したい場合は、次のような認証付きホスティングを使ってください。

- Cloudflare Access
- Firebase Hosting + Firebase Authentication
- Netlify/Vercelの認証・パスワード保護機能

## Web版の静的ビルド

```bash
npm run build:web
```

出力先は `dist/` です。
