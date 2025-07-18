// src/pages/seller/SellerKeyword.jsx (오류 수정 버전)

import { Terminal } from "lucide-react";

// --- shadcn/ui 컴포넌트 임포트 ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SellerKeywordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>키워드 분석</CardTitle>
        <CardDescription>
          네이버 데이터랩 API를 연동하여 키워드 트렌드 및 관련 데이터를 분석합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>서비스 준비 중</AlertTitle>
          <AlertDescription>
            현재 페이지는 개발 중이며, 곧 서비스될 예정입니다.
          </AlertDescription> {/* <--- 이 부분이 </p>에서 </AlertDescription>으로 수정되었습니다. */}
        </Alert>
      </CardContent>
    </Card>
  );
}