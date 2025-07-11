// D:\hellopiggy\frontend\functions\index.js (Parsing Error 완벽 수정 최종본)

const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions, config} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});
const axios = require("axios");

const serviceAccount = require("./serviceAccountKey.json");

setGlobalOptions({region: "asia-northeast3"});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/**
 * 리뷰어용 커스텀 토큰 생성 함수
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
        return response.status(400).send({
          error: "이름과 전화번호는 필수입니다.",
        });
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

/**
 * 사업자 번호를 받아 국세청 API로 인증하는 함수
 */
exports.verifyBusiness = onRequest(async (request, response) => {
  cors(request, response, async () => {
    if (request.method !== "POST") {
      return response.status(405).send({error: "Method Not Allowed"});
    }

    try {
      const serviceKey = config().apikeys.business_verify;

      if (!serviceKey) {
        logger.error("국세청 API 서비스 키가 환경 변수에 설정되지 않았습니다.");
        return response.status(500).send({
          success: false,
          message: "서버 설정 오류입니다. 관리자에게 문의하세요.",
        });
      }

      const bNo = request.body.data.b_no;
      if (!bNo) {
        logger.error("사업자 번호가 누락되었습니다.");
        return response.status(400).send({
          success: false,
          message: "사업자 번호는 필수입니다.",
        });
      }

      const encodedKey = encodeURIComponent(serviceKey);
      const apiUrl = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodedKey}`;
      const requestData = {b_no: [bNo]};
      
      // ▼▼▼ 여기가 수정된 부분입니다 ▼▼▼
      // axios.post(url, data, config) 형식에 맞게 수정
      // 세 번째 인자인 config 객체 안에 headers를 넣어야 합니다.
      const apiResponse = await axios.post(
          apiUrl,
          requestData,
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
      );
      // ▲▲▲ 수정 완료 ▲▲▲

      logger.info("국세청 API 응답:", apiResponse.data);

      if (apiResponse.data?.data?.length > 0) {
        response.status(200).send({
          success: true,
          ...apiResponse.data.data[0],
        });
      } else {
        throw new Error("유효하지 않은 응답입니다.");
      }
    } catch (error) {
      const errorMessage = error.response ?
        error.response.data :
        error.message;
      logger.error("사업자 인증 중 오류 발생:", errorMessage);
      response.status(500).send({
        success: false,
        message: "사업자 인증 처리 중 서버에서 오류가 발생했습니다.",
      });
    }
  });
});