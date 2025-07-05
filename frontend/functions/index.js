// functions/index.js (최종 수정 버전)

const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

// 모든 함수에 글로벌 옵션 적용 (서울 리전)
setGlobalOptions({region: "asia-northeast3"});

admin.initializeApp();

/**
 * 이름과 전화번호를 받아 커스텀 인증 토큰을 생성하는 함수
 */
exports.createCustomToken = onRequest(async (request, response) => {
  // CORS 프리플라이트 요청을 처리합니다.
  cors(request, response, async () => {
    try {
      // POST 요청이 아닐 경우
      if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
      }

      const {name, phone} = request.body.data;

      if (!name || !phone) {
        logger.error("이름 또는 전화번호가 누락되었습니다.", request.body);
        return response.status(400).send({error: "이름과 전화번호는 필수입니다."});
      }

      // 사용자 고유 ID (uid)를 이름과 전화번호로 생성
      const uid = `${name.trim()}_${phone.trim().replace(/-/g, "")}`;

      // 이 uid로 커스텀 토큰 생성
      const customToken = await admin.auth().createCustomToken(uid);

      logger.info(`커스텀 토큰 생성 성공: uid=${uid}`);

      // 성공적으로 토큰을 클라이언트에 반환
      response.status(200).send({data: {token: customToken, uid: uid}});
    } catch (error) {
      logger.error("커스텀 토큰 생성 중 오류 발생:", error);
      response.status(500).send({error: "서버에서 오류가 발생했습니다."});
    }
  });
});
