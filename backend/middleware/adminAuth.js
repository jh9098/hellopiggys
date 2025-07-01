/**
 * 관리자 인증 미들웨어
 * -------------------------------------------
 * 1) 요청 헤더에 'Authorization: Bearer <ID_TOKEN>' 있어야 함
 * 2) Firebase Admin SDK로 ID 토큰 유효성 검증
 * 3) 다음 두 조건 중 하나라도 만족하면 통과
 *    - 토큰의 custom claim  { admin: true }
 *    - 토큰에 포함된 email 이 .env 의 ADMIN_EMAILS 목록에 포함
 * 4) 실패 시 401(토큰 없음/잘못됨) 또는 403(관리자 아님) 반환
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

export default async function adminAuth(req, res, next) {
  try {
    /* 1) 헤더에서 토큰 추출 */
    const authHeader = req.headers['authorization'] || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: 'missing Authorization header' });
    }
    const idToken = match[1];

    /* 2) 토큰 검증 */
    const decoded = await admin.auth().verifyIdToken(idToken);

    /* 3-A) custom claim admin === true */
    if (decoded.admin === true) {
      req.user = decoded;
      return next();
    }

    /* 3-B) email 화이트리스트 */
    if (decoded.email && ADMIN_EMAILS.includes(decoded.email)) {
      req.user = decoded;
      return next();
    }

    return res.status(403).json({ error: 'forbidden – admin only' });
  } catch (err) {
    console.error('[adminAuth] verifyIdToken failed:', err.message);
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}
