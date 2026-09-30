/**
 * Threads 自動投稿（掃除機の紙パック）
 *
 * posts.json から「まだ送っていない番号のうち、いちばん小さいもの」を1本投稿する。
 * アクセストークンは GitHub Secrets（THREADS_ACCESS_TOKEN）から環境変数で受け取る。
 * リポジトリの中にトークンを書かないこと。
 *
 * 環境変数
 *   THREADS_ACCESS_TOKEN  必須（DRY_RUN=1 のときは不要）
 *   DRY_RUN=1             投稿せず、何を送るかだけ出力する
 *   WAIT_SECONDS          コンテナ作成から公開までの待ち時間（既定 35）
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = 'https://graph.threads.net/v1.0';
const DRY = process.env.DRY_RUN === '1';
const WAIT = Number(process.env.WAIT_SECONDS || 35);
const TOKEN = process.env.THREADS_ACCESS_TOKEN || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** トークンを絶対にログに出さないための後始末 */
function scrub(s) {
  return String(s).replaceAll(TOKEN || '\u0000NEVER\u0000', '***');
}

async function api(path, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${scrub(text)}`);
  return JSON.parse(text);
}

async function main() {
  const posts = JSON.parse(await readFile(join(HERE, 'posts.json'), 'utf8'));
  const state = JSON.parse(await readFile(join(HERE, 'state.json'), 'utf8'));
  const sent = new Set(state.sent || []);

  const next = posts.find((p) => !sent.has(p.no));
  if (!next) {
    console.log('すべて投稿済みです（' + posts.length + '本）。posts.json に追記するか、state.json の sent を空にしてください。');
    return;
  }

  const len = [...next.text].length;
  if (len > 500) throw new Error(`#${next.no} が ${len} 文字（上限500）`);

  console.log(`▶ #${String(next.no).padStart(2, '0')} ${next.title}（${len}文字）`);
  console.log('---');
  console.log(next.text);
  console.log('---');

  if (DRY) {
    console.log('DRY_RUN のため投稿しません。');
    return;
  }
  if (!TOKEN) throw new Error('THREADS_ACCESS_TOKEN が設定されていません');

  // 0) トークンの確認（ここで落ちればトークン切れ）
  const meRes = await fetch(`${API}/me?fields=id,username&access_token=${encodeURIComponent(TOKEN)}`);
  const meText = await meRes.text();
  if (!meRes.ok) throw new Error(`トークンが使えません: ${meRes.status} ${scrub(meText)}`);
  const me = JSON.parse(meText);
  console.log(`アカウント: @${me.username} (${me.id})`);

  // 1) コンテナ作成
  const created = await api(`/${me.id}/threads`, { media_type: 'TEXT', text: next.text });
  console.log(`コンテナ作成: ${created.id}`);

  // 2) Meta の処理待ち（公式が30秒以上を推奨）
  console.log(`${WAIT}秒待ちます…`);
  await sleep(WAIT * 1000);

  // 3) 公開
  const published = await api(`/${me.id}/threads_publish`, { creation_id: created.id });
  console.log(`公開しました: ${published.id}`);

  // 4) 状態を更新
  state.sent = [...sent, next.no].sort((a, b) => a - b);
  state.history = [
    ...(state.history || []),
    { no: next.no, title: next.title, threadId: published.id, at: new Date().toISOString() },
  ];
  await writeFile(join(HERE, 'state.json'), JSON.stringify(state, null, 2) + '\n');

  const left = posts.length - state.sent.length;
  console.log(`残り ${left} 本`);
}

main().catch((e) => {
  console.error('失敗:', scrub(e.message));
  process.exit(1);
});
