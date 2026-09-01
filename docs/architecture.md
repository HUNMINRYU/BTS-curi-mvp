# CURI MVP 아키텍처

## 1. 시스템 경계

```text
브라우저
  └─ Next.js App Router (EC2 단일 프로세스)
       ├─ Server Components: 로드맵·이번 주 코치·팁 집계
       ├─ Route Handlers: Q&A·팁 제출
       ├─ SQLite: 팁 응답·중복 제출
       ├─ 정제 강의정보 저장소
       │    ├─ 로컬 JSON: 개발·안전한 폴백
       │    └─ Amazon S3: 배포 원본
       └─ Amazon Bedrock Runtime: 근거 기반 답변
```

사용자 계정, 관리자 화면, 외부 강의평, 외부 벡터 DB는 경계 밖이다.

## 2. 소스 구조

```text
apps/web/
  app/
    api/qa/route.ts              질문 검증·검색·Bedrock 답변
    api/tips/route.ts            팁 입력 검증·중복 차단·집계 반환
    page.tsx                     데모 단일 페이지 조립
    layout.tsx                  문서 메타데이터·랜드마크
  components/
    course-roadmap.tsx          1~15주 상태와 출처 배지
    weekly-coach.tsx            7주차 준비·체크리스트·읽어주기
    source-badge.tsx            actual/demo 표시
    qa-panel.tsx                질문·답변·근거·상태 알림
    tips-panel.tsx              집계·구조화 입력·갱신
  lib/
    course-data.ts              정제 강의정보 로드
    search.ts                   결정론적 근거 검색
    bedrock.ts                  Bedrock 호출 어댑터
    db.ts                       SQLite 연결·마이그레이션
    tips.ts                     입력 검증·집계
    types.ts                    공유 도메인 타입
  data/
    course.json                 개인정보 제거 실제 파생 데이터
    demo-supplement.json        표시된 가상 공지·준비 데이터
    demo-tips.json              12건 구조화 시드
  tests/
    search.test.ts
    tips.test.ts
    api-qa.test.ts
    api-tips.test.ts
  e2e/demo.spec.ts
scripts/
  seed.ts                       SQLite 초기화와 12건 시드
infra/
  CDK 앱 껍데기                 4단계에서는 리소스 없음
```

## 3. 핵심 타입

```ts
type SourceKind = "actual" | "demo";

type Citation = {
  id: string;
  documentName: string;
  sourceKind: SourceKind;
  week: number | null;
  excerpt: string;
};

type WeekPlan = {
  week: number;
  topic: string;
  objectives: string[];
  assignment: string | null;
  source: Citation;
};

type QaResult = {
  status: "answered" | "not_found" | "model_error";
  answer: string;
  citations: Citation[];
};

type TipInput = {
  prerequisite: 1 | 2 | 3;
  practice: 1 | 2 | 3;
  workload: 1 | 2 | 3;
  tags: string[];
  consent: true;
};

type TipAggregate = {
  count: number;
  visible: boolean;
  averages: null | {
    prerequisite: number;
    practice: number;
    workload: number;
  };
  tags: Array<{ tag: string; count: number }>;
  includesDemo: boolean;
};
```

## 4. 데이터 흐름

### 4.1 강의정보
1. 원본 `웹컨텐츠개발.pdf`에서 허용 필드만 수동 검증해 `course.json`으로 만든다.
2. 실제 파생 레코드는 `actual`, 보충 레코드는 `demo`를 갖는다.
3. 로컬은 JSON을 직접 읽는다.
4. 배포 시 정제 JSON만 S3에 업로드한다. 원본 PDF는 앱 버킷에 업로드하지 않는다.
5. EC2 앱은 S3 객체를 읽을 수 있으면 사용하고, 실패하면 빌드에 포함된 동일 JSON을 사용한다.

### 4.2 Q&A
1. `/api/qa`가 질문 길이와 형식을 검증한다.
2. `search.ts`가 정제 청크를 토큰화하고 겹치는 한국어·영문 단어 수로 정렬한다.
3. 점수가 1 이상인 최대 4개 청크만 근거로 선택한다.
4. 근거가 없으면 `not_found`를 즉시 반환한다.
5. 근거가 있으면 출처 ID가 포함된 프롬프트로 Bedrock을 호출한다.
6. 모델 오류는 `model_error`와 근거 목록을 반환한다.
7. UI는 답변 상태와 모든 출처 배지를 표시한다.

### 4.3 수강생 팁
1. 브라우저는 세션 토큰을 생성해 sessionStorage에 보관한다.
2. `/api/tips`는 토큰을 SHA-256 해시로 변환한다.
3. 입력을 검증한 뒤 SQLite 트랜잭션에서 삽입한다.
4. `(course_id, session_hash)` 충돌은 HTTP 409로 반환한다.
5. 같은 트랜잭션 이후 최신 집계를 계산해 반환한다.
6. UI는 응답 수와 집계를 재요청 없이 갱신한다.

## 5. SQLite 스키마

```sql
CREATE TABLE IF NOT EXISTS course_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  prerequisite INTEGER NOT NULL CHECK (prerequisite BETWEEN 1 AND 3),
  practice INTEGER NOT NULL CHECK (practice BETWEEN 1 AND 3),
  workload INTEGER NOT NULL CHECK (workload BETWEEN 1 AND 3),
  tags_json TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(course_id, session_hash)
);
```

자유서술·사용자 식별정보·IP는 컬럼으로 만들지 않는다.

## 6. 오류 처리
- 강의정보 파일 불일치: 앱 시작 실패. 잘못된 출처 표시보다 명시적 실패를 선택한다.
- 질문 검증 실패: HTTP 400과 필드 오류.
- 검색 근거 없음: HTTP 200, `status: not_found`; 모델 미호출.
- Bedrock 실패: HTTP 200, `status: model_error`, 근거 유지.
- 팁 입력 오류: HTTP 400.
- 중복 팁: HTTP 409.
- SQLite 쓰기 실패: HTTP 500, 기존 집계는 변경하지 않는다.
- Web Speech API 부재: 읽어주기 버튼 비활성화, 텍스트는 그대로 제공한다.

## 7. 보안·프라이버시
- AWS Access Key를 저장하지 않는다.
- EC2 인스턴스 역할의 기본 자격 증명 공급자 체인을 사용한다.
- 원본 PDF와 강의계획서 ZIP은 Git·S3 앱 버킷에서 제외한다.
- 실제 파생 데이터에 연락처·이메일·면담·민원 정보를 넣지 않는다.
- Q&A 프롬프트에 정제 공식 강의정보만 보낸다.
- 팁에는 자유서술과 직접 식별자를 받지 않는다.

## 8. 검증 경계
- 단위 테스트: 검색 순위·근거 없음·팁 검증·5건 임계치·집계
- API 테스트: Q&A 세 상태, 팁 성공·검증 실패·중복
- 로컬 브라우저: `docs/demo-script.md` 6단계
- EC2: S3 정제 JSON 읽기와 Bedrock 실제 답변
- 배포 전: 원본 ZIP·PDF·PEM·환경 파일이 빌드·Git 대상에 없는지 확인
