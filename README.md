# CURI — 학생을 이해하는 AI 학습 내비게이터

> 학생의 전공·관심·목표를 이해해 맞춤 과목을 추천하고, 수업 준비부터 실행까지 안내하는 AI 학습 내비게이터

[![Verify and deploy](https://github.com/HUNMINRYU/BTS-curi-mvp/actions/workflows/deploy-ec2.yml/badge.svg?branch=main)](https://github.com/HUNMINRYU/BTS-curi-mvp/actions/workflows/deploy-ec2.yml)

**라이브 데모: <http://13.209.117.175>** · 상태: EC2에 배포·운영 중 (`main` push 시 GitHub Actions 자동 검증·배포)

<p>
  <img src="apps/web/public/characters/curi-brand.png" alt="CURI 마스코트" width="120">
</p>

흩어진 강의계획서를 단순 요약하는 대신, 학생 프로필을 기준으로 **추천 이유 → 시간표 → 주차별 준비 → 공식 근거 Q&A → 교수 익명 리포트**까지 하나의 흐름으로 연결합니다. 2026 광주대학교 AI 해커톤 프로젝트입니다.

## 제품 흐름

```text
7단계 프로필 입력
  → 과목별 "왜 이 학생에게 맞는가" 추천 이유 (Bedrock)
  → 주간 시간표에 담기
  → 15주 로드맵과 이번 주 체크리스트로 수업 준비·실행
  → 강의계획서 근거가 있을 때만 답하는 Q&A (인용 표시)
  → 학생 데이터를 익명 집계한 교수 인사이트 리포트
```

## 심사 증거 한눈에 보기

| 주장 | 증거 |
| --- | --- |
| 실제 과목 데이터 기반 추천 | 77개 실제 과목 카탈로그 (`apps/web/data/catalog.json`) |
| 검증된 동작 | 140개 이상의 자동 테스트 (`apps/web/tests`), CI에서 typecheck → test → build 통과 후 배포 |
| 접근성 QA | 데스크톱·모바일 반응형, 마우스 없이 키보드만으로 핵심 동선 통과 ([`docs/architecture.md`](docs/architecture.md) 검증 기준) |
| 생성형 AI 활용 | Amazon Bedrock Claude로 추천 이유·Q&A 답변 생성, Titan Embeddings v2로 질의 임베딩 |
| 검색 인프라 | EC2 로컬 loopback FAISS sidecar. 현재 bundle은 458 vectors·77 courses·Titan v2 512 dimensions이며, S3는 build-time source/provenance로만 사용합니다. |
| 개인정보 보호 | 이메일·전화번호 서버 경계 마스킹, 교수 리포트 완전 익명 |
| 정직한 실패 | 근거가 없는 질문에는 모델을 호출하지 않고 `근거 없음` 반환 |

## 심사위원 클릭 순서 (3분)

배포 URL에서 아래 순서대로 클릭하면 전체 기능을 확인할 수 있습니다. 데모 계정은 `student-test`(학생), `professor-test`(교수)입니다. 비밀번호는 저장소에 두지 않으며 발표자가 별도로 보관합니다.

1. `/signup`에서 회원가입해 학생 계정을 만듭니다. 기존 상태를 보려면 `student-test`로 로그인합니다.
2. 온보딩 7스텝(전공 → 관심분야 → 목표 → 진로 → 학습 스타일 → 주간 시간 → 비선호)을 완료합니다. 상단바 포인트가 30P가 되고 "나를 아는 학생" 뱃지가 붙습니다.
3. `/recommend`에서 추천 과목과 **각 과목의 추천 이유 문장**을 확인합니다.
4. 추천 카드의 담기 버튼으로 과목을 시간표에 넣고 `/`에서 주간 시간표를 확인합니다.
5. 시간표에서 대표 과목(웹컨텐츠개발)으로 들어가 15주 로드맵과 이번 주 준비를 확인합니다.
6. 이번 주 체크리스트를 체크해 CURI 마스코트 성장 단계와 포인트 증가를 확인합니다.
7. Q&A에 `중간고사 평가 비중이 어떻게 되나요?`를 물어 강의계획서 인용이 붙은 답변을 확인하고, 이어서 `장학금 신청은 어떻게 하나요?`를 물어 **근거 없음 정직 응답**을 확인합니다.
8. 학습 팁(3척도 + 준비 태그 + 동의)을 제출해 집계가 갱신되는지 확인합니다.
9. `/profile`에서 익명 준비왕 랭킹과 `데모 데이터` 배지가 붙은 능력 변화 대시보드를 확인합니다.
10. 로그아웃 후 `professor-test`로 로그인해 `/professor`에서 근거 없음 질문 리포트, 익명 학급 현황, 우리 학급 TMI를 확인합니다. 학생 이름은 어디에도 나오지 않습니다.

## 핵심 기능

- 7단계 학생 프로필과 추천 제외 조건
- 77개 실제 과목 카탈로그 기반 추천 + Bedrock 개인화 이유
- 주간 시간표, 15주 로드맵, 이번 주 체크리스트
- 공식 문서 근거가 있을 때만 답하는 Q&A와 인용 표시
- 포인트·레벨·뱃지·익명 준비왕 랭킹
- 근거 없음 질문과 구조화 팁을 집계하는 교수 리포트

## 저장소 구조와 기술 스택

```text
apps/web      Next.js 16 · React · TypeScript (앱 + 자동 테스트)
packages/db   SQLite · better-sqlite3
scripts       데모 시드 · FAISS sidecar · S3 문서에서 로컬 bundle을 만드는 build-time 도구
infra         AWS CDK 스캐폴드(현재 실제 배포는 EC2 release 방식)
docs          PRD · 아키텍처 · 시연 대본 · 발표 자료 · 인수인계
```

현재 서비스는 Amazon EC2에서 nginx → Next.js, SQLite, 로컬 FAISS sidecar로 실행됩니다. Amazon Bedrock Claude는 추천 이유·답변 생성, Titan Text Embeddings v2는 질문 임베딩을 담당합니다. 상세 구조도는 [`docs/architecture.md`](docs/architecture.md)에 있습니다.

## 사용한 AWS 서비스

현재 운영 요청 경로와 build-time 문서 source/provenance 경계를 구분합니다.

| 서비스 | 현재 운영 및 build-time 역할 |
| --- | --- |
| Amazon EC2 (ap-northeast-2) | Next.js 단일 프로세스와 로컬 FAISS 검색 사이드카를 systemd로 실행. 앞단은 nginx |
| Amazon Bedrock — Claude Sonnet | 추천 이유 생성, 검색 근거 기반 Q&A 답변 생성 |
| Amazon Bedrock — Titan Text Embeddings v2 | Q&A 질의 임베딩과 build-time PDF 청크 임베딩. 현재 bundle은 512 dimensions를 사용 |
| Amazon S3 | **비공개(private)·versioned bucket `hackathon-e2-t01-curi-docs`:** S3 Public Access Block의 `BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets` 네 플래그가 모두 `true`이고, 기본 서버 측 암호화는 `AES256`, versioning 상태는 `Enabled`입니다. `documents/` 아래 sanitized PDF 77개와 metadata sidecar 77개를 보관합니다. build-time bundle의 source/provenance이며, production Q&A는 S3를 읽지 않고 로컬 FAISS를 조회합니다. |

사용자·세션·프로필·시간표·체크리스트·팁·Q&A 로그·포인트는 EC2 로컬 SQLite 단일 파일에 저장합니다.

## RAG 문서 원본과 현재 bundle

검증된 build-time source/provenance는 비공개(private)·versioned·AES256 암호화·public access blocked S3 bucket `hackathon-e2-t01-curi-docs`의 `documents/` prefix입니다. 이 prefix에는 개인정보를 제거한 sanitized PDF 77개와 PDF별 metadata sidecar 77개가 있습니다. 현재 production bundle은 458 vectors, 77 courses, Titan Text Embeddings v2 512 dimensions로 구성됩니다.

build-time `scripts/rag_indexer.py`는 `CURI_DOCUMENT_BUCKET`의 `documents/`에서 PDF와 `{pdf}.metadata.json` sidecar를 읽고, Titan v2 512-dimensional embeddings로 로컬 `index.faiss`와 `chunks.jsonl`을 생성합니다. production 요청에서는 `scripts/rag_sidecar.py`가 로컬 FAISS와 chunks 파일만 읽고 질의 임베딩을 위해 Bedrock Runtime만 호출합니다. 따라서 S3는 source/provenance와 build-time 입력이고, production query runtime은 S3를 읽지 않습니다.

### Build-time source staging

아래 명령은 로컬 원본 ZIP에서 sanitized PDF와 sidecar를 준비할 때의 입력 변수입니다. staging 경로는 저장소 밖이어야 합니다.

```bash
CURI_RAG_STAGING_DIR="<staging-dir-outside-repository>" \
CURI_LIBERAL_ARTS_ZIP="<liberal-arts-source-zip>" \
CURI_ARCHITECTURE_ZIP="<architecture-source-zip>" \
CURI_COMPUTER_ENGINEERING_ZIP="<computer-engineering-source-zip>" \
CURI_ACCOUNTING_TAX_ZIP="<accounting-tax-source-zip>" \
node scripts/prepare-rag-documents.mjs
```

### Build-time S3 index build

아래 절차는 source/provenance를 로컬 production bundle로 만드는 build-time 작업입니다. production 요청 처리 중에는 실행하지 않으며, 완성된 bundle을 production의 로컬 FAISS 경로에 배포합니다.

```bash
CURI_DOCUMENT_BUCKET="hackathon-e2-t01-curi-docs" \
CURI_RAG_STAGING_DIR="<staging-dir-outside-repository>" \
bash scripts/upload-rag-documents.sh

python3 -m pip install -r scripts/requirements-rag.txt

AWS_DEFAULT_REGION="<region>" \
CURI_DOCUMENT_BUCKET="hackathon-e2-t01-curi-docs" \
CURI_DOCUMENT_PREFIX="documents/" \
CURI_RAG_INDEX_PATH="<local-bundle-dir>/index.faiss" \
CURI_RAG_CHUNKS_PATH="<local-bundle-dir>/chunks.jsonl" \
python3 scripts/rag_indexer.py
```

`CURI_DOCUMENT_BUCKET`은 인덱서의 필수 CURI 변수이고, `CURI_DOCUMENT_PREFIX`, `CURI_RAG_INDEX_PATH`, `CURI_RAG_CHUNKS_PATH`는 선택 변수입니다. 인덱서는 로컬 PDF 경로를 받지 않으며 S3 `documents/`에서 PDF와 `{pdf}.metadata.json`을 읽습니다. `AWS_DEFAULT_REGION`과 AWS 자격 증명은 boto3 기본 공급자 체인에서 해석되며, 값은 저장소에 두지 않습니다.

### 교수 가입 코드 운영

`/api/signup`의 교수 가입은 server-only 환경변수 `CURI_PROFESSOR_SIGNUP_CODE`와 요청의 `professorInviteCode`를 비교합니다. 환경변수가 없거나 비어 있으면 deny-closed로 교수 가입을 닫고 HTTP 403을 반환합니다. 기대하는 코드는 브라우저나 저장소에 노출하지 않으며, 코드를 교체한 뒤에는 앱 서비스 프로세스를 재시작해야 새 설정이 적용됩니다.

## 빠른 시작

요구사항: Node.js 20.9 이상, pnpm 11.25.0

```bash
pnpm install
pnpm dev        # 개발 서버
pnpm seed       # 데모 데이터 시드 (선택)
```

빈 데이터베이스로 시연하면 학습 팁 집계와 교수 리포트가 빈 상태로 보입니다. 리허설 전에 `pnpm seed`를 한 번 실행하세요. 여러 번 실행해도 같은 결과가 유지됩니다. `CURI_APP_DB_PATH`로 대상 데이터베이스를 지정할 수 있고, 지정하지 않으면 `apps/web/.data/curi-app.sqlite`를 사용합니다.

### 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

### 프리데모 상태 초기화

데모 리허설 직전에만 사용하는 파괴적 절차입니다. 로컬 SQLite 데모 데이터가 삭제되므로 필요한 상태를 먼저 보존하고, 실제 데모 중에는 실행하지 마세요.

1. 실행 중인 로컬 개발 서버의 터미널에서 `Ctrl-C`를 눌러 `pnpm dev`를 중지합니다.
2. 서버가 완전히 멈춘 뒤에만 아래 명령으로 SQLite 데이터베이스와 WAL/SHM 사이드카를 삭제합니다.

   ```bash
   rm -f apps/web/.data/curi-app.sqlite*
   ```

3. 같은 저장소 루트에서 `pnpm dev`로 개발 서버를 다시 시작하고, 초기 온보딩과 빈 데모 상태에서 시작되는지 확인합니다.

## 배포와 롤백

EC2에 릴리스 디렉터리를 올리고 심링크를 바꾸는 방식입니다. 배포는 사용자 승인 후에만 수행합니다.

1. 저장소를 `~/curi/releases/<UTC 타임스탬프>/`로 rsync 합니다. `.git`, `node_modules`, `.next`, `.data`, `.env.local`은 제외합니다.
2. 서버에서 `pnpm install --frozen-lockfile && pnpm run build`를 실행합니다.
3. `~/curi/current` 심링크를 새 릴리스로 바꾸고 `sudo systemctl restart curi`를 실행합니다.
4. 롤백은 심링크를 이전 릴리스로 되돌리고 같은 서비스를 재시작하면 됩니다.

테스트 계정 비밀번호는 서버의 `~/curi/shared/web.env`(퍼미션 600)에 두고 systemd `EnvironmentFile`로 주입합니다. 저장소에는 넣지 않습니다.

### GitHub Actions 자동 배포

`.github/workflows/deploy-ec2.yml`은 `main` push 또는 수동 실행 시 다음 순서로 동작합니다.

1. GitHub-hosted runner에서 install → typecheck → test → build
2. 새 `~/curi/releases/<UTC 타임스탬프>/` 업로드
3. EC2에서 의존성 설치·프로덕션 build
4. `current` 심링크 전환·`curi` 서비스 재시작
5. `127.0.0.1:3000/login` smoke 실패 시 이전 심링크로 자동 롤백

GitHub repository의 Actions Secrets에 아래 값을 등록해야 합니다. 배포 job은 `production` environment에서 실행됩니다.

- `EC2_HOST`: EC2 public host/IP
- `EC2_USER`: 기본값 `ubuntu`
- `EC2_SSH_PRIVATE_KEY`: EC2 접속용 private key 전문

private key와 테스트 계정 비밀번호는 GitHub Secrets·EC2 `web.env`에만 두며 저장소에는 커밋하지 않습니다.

## 데이터 윤리

- 공개 카탈로그에는 교수 연락처를 포함하지 않습니다.
- Q&A 답변과 인용문은 이메일·전화번호를 서버 경계에서 마스킹합니다.
- 실제 강의계획서와 데모 데이터의 출처를 UI에서 구분합니다.
- 근거가 없으면 생성 모델을 호출하지 않고 정직하게 `근거 없음`을 반환합니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | 시스템 구조도와 라우트·검증 기준 |
| [`docs/decisions.md`](docs/decisions.md) | 주요 기술·제품 결정 기록 |
| [`docs/prd.md`](docs/prd.md) | 요구사항과 범위 |
| [`docs/vision.md`](docs/vision.md) | 문제 정의와 MVP 가치 |
