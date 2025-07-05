// functions/index.js (서비스 계정 키 파일 사용 최종 버전)

const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

// ▼▼▼ 1. 서비스 계정 키 파일을 불러옵니다. ▼▼▼
const serviceAccount = require("./serviceAccountKey.json");

// 모든 함수에 글로벌 옵션 적용 (서울 리전)
setGlobalOptions({region: "asia-northeast3"});

// ▼▼▼ 2. Admin SDK를 키 파일의 정보로 초기화합니다. ▼▼▼
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/**
 * 이름과 전화번호를 받아 커스텀 인증 토큰을 생성하는 함수
 */
exports.createCustomToken = onRequest((request, response) => {
  cors(request, response, async () => {
    if (request.method !== "POST") {
      return response.status(405).send({error: "Method Not Allowed"});
    }

    try {
      const {name, phone} = request.body.data;

      if (!name || !phone) {
        logger.error("이름 또는 전화번호가 누락되었습니다.", {body: request.body});
        return response.status(400).send({error: "이름과 전화번호는 필수입니다."});
      }

      const uid = `${name.trim()}_${phone.trim().replace(/-/g, "")}`;
      const customToken = await admin.auth().createCustomToken(uid);

      logger.info(`커스텀 토큰 생성 성공: uid=${uid}`);
      response.status(200).send({data: {token: customToken, uid: uid}});
    } catch (error) {
      logger.error("커스텀 토큰 생성 중 오류 발생:", error);
      response.status(500).send({error: "서버에서 오류가 발생했습니다."});
    }
  });
});
