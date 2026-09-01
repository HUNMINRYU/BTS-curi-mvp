# CURI

강의계획서 기반 AI 수업 내비게이터 해커톤 MVP.

**배포 URL: http://13.209.117.175** · 데모 계정: `student-test`(학생), `professor-test`(교수)
비밀번호는 저장소에 두지 않습니다. 발표자가 별도로 보관합니다.

## 심사위원 클릭 순서

배포 URL에서 아래 순서대로 클릭하면 전체 기능을 3분 안에 확인할 수 있습니다.

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

발표 대본은 [`docs/pitch.md`](docs/pitch.md), 상세 시연 대본은 [`docs/demo-script.md`](docs/demo-script.md), 구조도는 [`docs/architecture.md`](docs/architecture.md)에 있습니다.

## 사용한 AWS 서비스

데모 화면에 실제로 나타나는 서비스만 사용합니다.

| 서비스 | 용도 |
| --- | --- |
| Amazon EC2 (ap-northeast-2) | Next.js 단일 프로세스와 FAISS 검색 사이드카를 systemd로 실행. 앞단은 nginx |
| Amazon S3 | 강의계획서 PDF 원본과 sidecar 메타데이터를 비공개 `documents/` 접두사에 보관 |
| Amazon Bedrock — Claude Sonnet | 추천 이유 생성, 검색 근거 기반 Q&A 답변 생성 |
| Amazon Bedrock — Titan Text Embeddings v2 | PDF 청크 임베딩(EC2 로컬 FAISS 인덱스 구축) |

사용자·세션·프로필·시간표·체크리스트·팁·Q&A 로그·포인트는 EC2 로컬 SQLite 단일 파일에 저장합니다.

## 요구사항

- Node.js 20.9 이상
- pnpm 11.25.0

## 개발 서버

```bash
pnpm install
pnpm dev
```

## 데모 데이터 시드

빈 데이터베이스로 시연하면 학습 팁 집계와 교수 리포트가 빈 상태로 보입니다. 리허설 전에 한 번 실행하세요. 여러 번 실행해도 같은 결과가 유지됩니다.

```bash
pnpm seed
```

`CURI_APP_DB_PATH`로 대상 데이터베이스를 지정할 수 있습니다. 지정하지 않으면 `apps/web/.data/curi-app.sqlite`를 사용합니다.

## 프리데모 상태 초기화

데모 리허설 직전에만 사용하는 파괴적 절차입니다. 로컬 SQLite 데모 데이터가 삭제되므로 필요한 상태를 먼저 보존하고, 실제 데모 중에는 실행하지 마세요.

저장소 루트에서 다음 순서를 지킵니다.

1. 실행 중인 로컬 개발 서버의 터미널에서 `Ctrl-C`를 눌러 `pnpm dev`를 중지합니다.
2. 서버가 완전히 멈춘 뒤에만 아래 명령으로 SQLite 데이터베이스와 WAL/SHM 사이드카를 삭제합니다.

   ```bash
   rm -f apps/web/.data/curi-app.sqlite*
   ```

3. 같은 저장소 루트에서 개발 서버를 다시 시작합니다.

   ```bash
   pnpm dev
   ```

서버가 새 데이터베이스를 재생성하면 초기 온보딩과 빈 데모 상태에서 시작되는지 확인합니다.

## 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 배포

EC2에 릴리스 디렉터리를 올리고 심링크를 바꾸는 방식입니다. 배포는 사용자 승인 후에만 수행합니다.

1. 저장소를 `~/curi/releases/<UTC 타임스탬프>/`로 rsync 합니다. `.git`, `node_modules`, `.next`, `.data`, `.env.local`은 제외합니다.
2. 서버에서 `pnpm install --frozen-lockfile && pnpm run build`를 실행합니다.
3. `~/curi/current` 심링크를 새 릴리스로 바꾸고 `sudo systemctl restart curi`를 실행합니다.
4. 롤백은 심링크를 이전 릴리스로 되돌리고 같은 서비스를 재시작하면 됩니다.

테스트 계정 비밀번호는 서버의 `~/curi/shared/web.env`(퍼미션 600)에 두고 systemd `EnvironmentFile`로 주입합니다. 저장소에는 넣지 않습니다.
