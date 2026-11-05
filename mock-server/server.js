/**
 * Glassnik MOCK API server - FOR LOCAL TESTING ONLY.
 *
 * - Zero dependencies (plain Node.js, v18+). Run:  node mock-server/server.js
 * - Data is kept in memory and resets every time the server restarts.
 * - Implements every endpoint the mobile app calls in lib/api.ts, including the
 *   new Report / Block / Delete Account endpoints, so the app flows can be tested
 *   without the real backend.
 * - NOT a real backend: no real security, no real storage, no real uploads.
 *
 * Test account (pre-created):  test@glassnik.test  /  password123
 * Any other email/password can also be registered through the app.
 */
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SAMPLE_MP4 = 'https://www.w3schools.com/html/mov_bbb.mp4';

// ── In-memory "database" ─────────────────────────────────────────────────────
let nextId = 100;
const id = () => nextId++;
const now = () => new Date().toISOString();

const users = [
  { id: 1, email: 'test@glassnik.test', password: 'password123', username: 'testuser', displayName: 'Test User', avatarUrl: null, status: 'ACTIVE' },
  { id: 2, email: 'maya@glassnik.test', password: 'password123', username: 'maya', displayName: 'Maya (mock)', avatarUrl: null, status: 'ACTIVE' },
  { id: 3, email: 'leo@glassnik.test', password: 'password123', username: 'leo', displayName: 'Leo (mock)', avatarUrl: null, status: 'ACTIVE' },
];

const videos = [
  { id: 11, ownerId: 2, title: '[MOCK] Sunrise hike', description: '[MOCK] Sunrise hike video', city: 'Sydney', country: 'Australia', category: 'Adventure' },
  { id: 12, ownerId: 3, title: '[MOCK] Street food tour', description: '[MOCK] Street food tour video', city: 'Bangkok', country: 'Thailand', category: 'Food' },
  { id: 13, ownerId: 2, title: '[MOCK] Beach day', description: '[MOCK] Beach day video', city: 'Bali', country: 'Indonesia', category: 'Beach' },
  { id: 14, ownerId: 1, title: '[MOCK] My first Experience', description: '[MOCK] Uploaded by the test user', city: 'Darwin', country: 'Australia', category: 'City' },
].map((v) => ({ ...v, status: 'PUBLISHED', publicUrl: SAMPLE_MP4, thumbnailUrl: null, createdAt: now(), likedBy: new Set(), comments: [] }));

const sessions = new Map(); // accessToken -> userId
const refreshTokens = new Map(); // refreshToken -> userId
const follows = new Set(); // "followerId:followedId"
const blocks = new Set(); // "blockerId:blockedId"
const reports = []; // saved reports (viewable at GET /_mock/reports)
const notifications = [
  { id: 1, userId: 1, type: 'like', read: false, createdAt: now(), actorId: 2, videoId: 14, videoTitle: '[MOCK] My first Experience' },
  { id: 2, userId: 1, type: 'follow', read: false, createdAt: now(), actorId: 3 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const publicUser = (u) => u && ({ id: u.id, email: u.email, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, status: u.status });
const ownerOf = (uid) => {
  const u = users.find((x) => x.id === uid);
  return u ? { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl } : null;
};
const videoOut = (v) => ({
  id: v.id, title: v.title, description: v.description, status: v.status, publicUrl: v.publicUrl,
  thumbnailUrl: v.thumbnailUrl, createdAt: v.createdAt, likes: v.likedBy.size, likeCount: v.likedBy.size,
  commentCount: v.comments.length, viewCount: 0, owner: ownerOf(v.ownerId),
  city: v.city, country: v.country, category: v.category, place: null, source: 'MOBILE',
});
const isBlocked = (me, other) => blocks.has(`${me}:${other}`) || blocks.has(`${other}:${me}`);
const issueTokens = (uid) => {
  const accessToken = 'mock-access-' + crypto.randomBytes(8).toString('hex');
  const refreshToken = 'mock-refresh-' + crypto.randomBytes(8).toString('hex');
  sessions.set(accessToken, uid);
  refreshTokens.set(refreshToken, uid);
  return { accessToken, refreshToken };
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
  res.end(JSON.stringify(body));
}
const fail = (res, status, message) => send(res, status, { message, statusCode: status });
const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
});

// ── Routing ──────────────────────────────────────────────────────────────────
async function handle(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const m = req.method;
  const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(m) ? await readBody(req) : {};
  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  const me = sessions.get(auth) ? users.find((u) => u.id === sessions.get(auth)) : null;
  console.log(`${m} ${path}${me ? '  (as ' + me.email + ')' : ''}`);

  let r;

  // Debug helpers (mock only)
  if (m === 'GET' && path === '/_mock/reports') return send(res, 200, reports);
  if (m === 'GET' && path === '/_mock/state') {
    return send(res, 200, { users: users.map(publicUser), blocks: [...blocks], reports: reports.length, videos: videos.length });
  }

  // Auth (no token needed)
  if (m === 'POST' && path === '/auth/register') {
    const { email, password, displayName, username } = body;
    if (!email || !password) return fail(res, 400, 'Email and password are required.');
    if (users.some((u) => u.email === String(email).toLowerCase())) return fail(res, 409, 'An account with this email already exists.');
    const u = { id: id(), email: String(email).toLowerCase(), password, username: username || String(email).split('@')[0], displayName: displayName || String(email).split('@')[0], avatarUrl: null, status: 'ACTIVE' };
    users.push(u);
    return send(res, 201, { user: publicUser(u), ...issueTokens(u.id) });
  }
  if (m === 'POST' && path === '/auth/login') {
    const u = users.find((x) => x.email === String(body.email).toLowerCase() && x.password === body.password);
    if (!u) return fail(res, 401, 'Invalid email or password.');
    return send(res, 200, { user: publicUser(u), ...issueTokens(u.id) });
  }
  if (m === 'POST' && path === '/auth/refresh') {
    const uid = refreshTokens.get(body.refreshToken);
    if (!uid) return fail(res, 401, 'Invalid refresh token.');
    return send(res, 200, issueTokens(uid));
  }
  if (m === 'POST' && path === '/auth/logout') {
    refreshTokens.delete(body.refreshToken);
    return send(res, 200, { success: true });
  }

  // Feed - PUBLIC (works signed-out too, so the app can show Experiences
  // before login). Set EMPTY_FEED=1 to return an empty list for testing the
  // app's "No Experiences yet" screen.
  if (m === 'GET' && path === '/mobile/feed') {
    if (process.env.EMPTY_FEED) return send(res, 200, []);
    return send(res, 200, videos.filter((v) => v.status === 'PUBLISHED' && !(me && isBlocked(me.id, v.ownerId))).map(videoOut));
  }

  // Everything below needs a logged-in user
  if (!me) return fail(res, 401, 'Unauthorized');

  // Upload (fake: no real file is stored)
  if (m === 'POST' && path === '/videos/request-upload') {
    const v = { id: id(), ownerId: me.id, title: body.title || 'Untitled', description: body.description || '', status: 'UPLOADING', publicUrl: SAMPLE_MP4, thumbnailUrl: null, createdAt: now(), city: null, country: null, category: null, likedBy: new Set(), comments: [] };
    videos.push(v);
    return send(res, 200, { id: v.id, uploadUrl: `http://localhost:${PORT}/_mock/upload/${v.id}` });
  }
  if (m === 'PUT' && path.startsWith('/_mock/upload/')) return send(res, 200, { success: true });
  if ((r = path.match(/^\/videos\/(\d+)\/complete$/)) && m === 'POST') {
    const v = videos.find((x) => x.id === +r[1]);
    if (v) v.status = 'PUBLISHED';
    return send(res, 200, { success: true });
  }
  if ((r = path.match(/^\/videos\/(\d+)\/status$/)) && m === 'GET') {
    const v = videos.find((x) => x.id === +r[1]);
    return v ? send(res, 200, { status: 'PUBLISHED', publicUrl: v.publicUrl, thumbnailUrl: v.thumbnailUrl }) : fail(res, 404, 'Video not found');
  }

  // Profile / users
  if (m === 'GET' && path === '/me/capabilities') return send(res, 200, []);
  if (m === 'GET' && path === '/users/me') return send(res, 200, publicUser(me));
  if (m === 'PATCH' && path === '/users/me') {
    for (const k of ['displayName', 'username', 'avatarUrl']) if (body[k] !== undefined) me[k] = body[k];
    return send(res, 200, publicUser(me));
  }
  if (m === 'DELETE' && path === '/users/me') {
    // Account deletion: remove user, their videos, tokens, blocks and follows.
    const uid = me.id;
    users.splice(users.indexOf(me), 1);
    for (let i = videos.length - 1; i >= 0; i--) if (videos[i].ownerId === uid) videos.splice(i, 1);
    for (const [t, u] of sessions) if (u === uid) sessions.delete(t);
    for (const [t, u] of refreshTokens) if (u === uid) refreshTokens.delete(t);
    for (const k of [...blocks]) if (k.split(':').includes(String(uid))) blocks.delete(k);
    for (const k of [...follows]) if (k.split(':').includes(String(uid))) follows.delete(k);
    return send(res, 200, { success: true });
  }
  if (m === 'GET' && path === '/users/me/blocks') {
    const list = [...blocks].filter((k) => k.startsWith(me.id + ':')).map((k) => ownerOf(+k.split(':')[1])).filter(Boolean);
    return send(res, 200, list);
  }
  if ((r = path.match(/^\/users\/(\d+)\/videos$/)) && m === 'GET') {
    const uid = +r[1];
    const list = videos.filter((v) => v.ownerId === uid && (uid === me.id || v.status === 'PUBLISHED')).map(videoOut);
    return send(res, 200, { data: list, total: list.length });
  }
  if ((r = path.match(/^\/users\/(\d+)\/follow$/))) {
    const key = `${me.id}:${r[1]}`;
    if (m === 'POST') follows.add(key); else if (m === 'DELETE') follows.delete(key); else return fail(res, 405, 'Method not allowed');
    const count = [...follows].filter((k) => k.endsWith(':' + r[1])).length;
    return send(res, 200, { following: m === 'POST', followerCount: count });
  }
  if ((r = path.match(/^\/users\/(\d+)\/block$/))) {
    const target = +r[1];
    if (target === me.id) return fail(res, 400, 'You cannot block yourself.');
    if (!users.some((u) => u.id === target)) return fail(res, 404, 'User not found');
    if (m === 'POST') blocks.add(`${me.id}:${target}`); else if (m === 'DELETE') blocks.delete(`${me.id}:${target}`); else return fail(res, 405, 'Method not allowed');
    return send(res, 200, { success: true });
  }
  if ((r = path.match(/^\/users\/(\d+)$/)) && m === 'GET') {
    const u = users.find((x) => x.id === +r[1]);
    if (!u) return fail(res, 404, 'User not found');
    const followerCount = [...follows].filter((k) => k.endsWith(':' + u.id)).length;
    const followingCount = [...follows].filter((k) => k.startsWith(u.id + ':')).length;
    return send(res, 200, { ...publicUser(u), email: undefined, followerCount, followingCount, isFollowing: follows.has(`${me.id}:${u.id}`), isBlocked: blocks.has(`${me.id}:${u.id}`) });
  }

  // Videos
  if ((r = path.match(/^\/videos\/(\d+)\/report$/)) && m === 'POST') {
    const v = videos.find((x) => x.id === +r[1]);
    if (!v) return fail(res, 404, 'Video not found');
    if (!body.reason) return fail(res, 400, 'A reason is required.');
    reports.push({ id: id(), videoId: v.id, reporterId: me.id, reason: body.reason, details: body.details || null, createdAt: now(), status: 'PENDING' });
    return send(res, 200, { success: true });
  }
  if ((r = path.match(/^\/videos\/(\d+)\/like$/))) {
    const v = videos.find((x) => x.id === +r[1]);
    if (!v) return fail(res, 404, 'Video not found');
    if (m === 'POST') v.likedBy.add(me.id); else if (m === 'DELETE') v.likedBy.delete(me.id); else return fail(res, 405, 'Method not allowed');
    return send(res, 200, { liked: m === 'POST', likeCount: v.likedBy.size });
  }
  if ((r = path.match(/^\/videos\/(\d+)\/comments$/))) {
    const v = videos.find((x) => x.id === +r[1]);
    if (!v) return fail(res, 404, 'Video not found');
    if (m === 'GET') return send(res, 200, { comments: v.comments.filter((c) => !isBlocked(me.id, c.authorId)).map(commentOut), total: v.comments.length });
    if (m === 'POST') {
      const c = { id: id(), text: String(body.text || ''), createdAt: now(), authorId: me.id };
      v.comments.push(c);
      return send(res, 201, commentOut(c));
    }
  }
  if ((r = path.match(/^\/videos\/(\d+)$/))) {
    const idx = videos.findIndex((x) => x.id === +r[1]);
    if (idx < 0) return fail(res, 404, 'Video not found');
    if (m === 'GET') return send(res, 200, videoOut(videos[idx]));
    if (m === 'DELETE') {
      if (videos[idx].ownerId !== me.id) return fail(res, 403, 'Not your video.');
      videos.splice(idx, 1);
      return send(res, 200, { success: true });
    }
  }

  // Notifications
  if (m === 'GET' && path === '/notifications') {
    return send(res, 200, notifications.filter((n) => n.userId === me.id).map((n) => ({ id: n.id, type: n.type, read: n.read, createdAt: n.createdAt, actor: ownerOf(n.actorId), videoId: n.videoId ?? null, videoTitle: n.videoTitle ?? null })));
  }
  if (m === 'GET' && path === '/notifications/unread-count') {
    return send(res, 200, { count: notifications.filter((n) => n.userId === me.id && !n.read).length });
  }
  if (m === 'POST' && path === '/notifications/read-all') {
    notifications.filter((n) => n.userId === me.id).forEach((n) => (n.read = true));
    return send(res, 200, { success: true });
  }
  if ((r = path.match(/^\/notifications\/(\d+)\/read$/))) {
    const n = notifications.find((x) => x.id === +r[1]);
    if (n) n.read = true;
    return send(res, 200, { success: true });
  }

  return fail(res, 404, `Mock server: no route for ${m} ${path}`);
}

function commentOut(c) {
  return { id: c.id, text: c.text, createdAt: c.createdAt, author: ownerOf(c.authorId) };
}

http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(e); fail(res, 500, 'Mock server error'); });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Glassnik MOCK API running on http://localhost:${PORT}`);
  console.log('Test login: test@glassnik.test / password123   (data resets on restart)');
});