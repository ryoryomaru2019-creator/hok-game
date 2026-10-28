# BGM配置フォルダ

自作のBGM楽曲（mp3, wav, m4a, oggなど）をこのフォルダに配置できます。

## 設定方法
1. お手持ちの楽曲ファイル（例: `my_theme.mp3`）をこの `public/bgm/` フォルダに置きます。
2. `src/audio.js` 内の `this.startBGM('/bgm/my_theme.mp3')` を指定するか、ゲーム起動時に自動認識されます。
3. デフォルトではWeb Audio APIで生成した海中シンセBGMが流れるため、ファイルが無くても即座にプレイ可能です。

## Core Tune / 配信リンクの設定
`src/audio.js` の `this.musicTrack` 内にある各種URL（Spotify, Apple Music, TikTok, YouTube Music, Amazon Music）をご自身の配信URLに差し替えるだけで、ゲーム内の「配信楽曲を聴く」ボタンやNow Playing表示から直接リスナーを誘導できます。
