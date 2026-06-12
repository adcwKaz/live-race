# 🏁 LIVE RACE

レースで決める、白熱のオンライン抽選ツール。
Zoomなどの定例会議・ウェビナーで主催者が画面共有しながら使う想定です。

**公開URL**: https://adcwkaz.github.io/live-race/

## 使い方

1. 参加者名を1行1名で入力(スプレッドシートからの貼り付けOK)
2. テーマとレース時間を選んで「レース開始!」
3. Zoomの「画面の共有」で共有。**「音声を共有」にチェック**を入れるとBGMも参加者に届きます
4. レース1着が当選者。景品が複数あるときは「当選者を除いて再レース」

入力した名前は外部に送信されません(ブラウザ内で完結)。

## 抽選の公平性について

当選者はレース開始時に `crypto.getRandomValues`(暗号論的乱数)で確定します。
全員の当選確率は完全に均等です。レース中の順位の入れ替わりや接戦は、
確定済みの結果から逆算して生成される「演出」であり、結果には影響しません。

## テーマ

| テーマ | 状態 |
|---|---|
| 🏇 競馬 | ✅ 利用可能(最大12名) |
| 🏎️ カーレース | 🚧 準備中 |
| 🦆 アヒルボート | 🚧 準備中 |
| 🎰 カジノルーレット | 🚧 準備中 |

## BGM

効果音はWeb Audio APIで合成しているため音源ファイル不要です。
BGMは `public/bgm/<テーマID>.mp3`(例: `keiba.mp3`)を置くとそれが再生され、
無ければチップチューン風の自動生成BGMにフォールバックします。
音源を同梱する場合は利用規約を確認し、CREDITS.md に出典を記録してください。

## 開発

```bash
npm install
npm run dev      # 開発サーバー (http://localhost:5173/live-race/)
npm run build    # 型チェック + ビルド
node e2e/smoke.mjs  # 動作確認(要: dev起動中 + Google Chrome)
```

mainブランチへのpushでGitHub Actionsが自動的にGitHub Pagesへデプロイします
(リポジトリ設定 → Pages → Source を「GitHub Actions」にしておくこと)。

設計・要件の詳細は [REQUIREMENTS.md](REQUIREMENTS.md) を参照。
