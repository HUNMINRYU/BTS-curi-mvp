# CURI MVP 결정 기록

## D-1 과목 범위
**결정:** 추천용 카탈로그는 약 25과목을 지원하고, `웹컨텐츠개발`만 1~15주 풀 상세를 제공한다.

**근거:** 다과목 추천 가치를 보여 주되 모든 강의계획서를 동일 깊이로 구현하는 범위 폭발을 막는다.

## D-2 문서 출처
**결정:** 개인정보 제거 실제 파생 데이터와 표시된 가상 보충 데이터를 함께 사용한다. 실제 파생 레코드는 `actual`, 팀 생성 데이터는 `demo`를 갖는다.

## D-3 애플리케이션 구조
**현황(현재 배포):** Next.js App Router 모노리스와 Python `rag_sidecar.py` FAISS 검색 사이드카를 EC2에서 함께 실행한다. 기존 Streamlit 프로토타입은 제품에 포함하지 않는다. `rag_indexer.py`는 비공개 S3 source/provenance를 production용 로컬 bundle로 만드는 build-time 도구이며, production sidecar가 직접 호출하지는 않는다.

## D-4 데이터베이스
**결정:** 로컬과 EC2 모두 SQLite 파일을 사용한다.

## D-5 인증 (2026-09-01 개정)
**결정:** 학생·교수 역할을 구분하는 로그인과 `/signup` 계정 생성을 구현한다. 비밀번호는 서버에서 scrypt 해시로 저장하고 HttpOnly 세션 쿠키를 사용한다. 교수 가입은 server-only `CURI_PROFESSOR_SIGNUP_CODE`와 요청 코드가 일치할 때만 허용한다.

**운영 경계:** `CURI_PROFESSOR_SIGNUP_CODE`가 없거나 비어 있으면 교수 가입은 deny-closed로 HTTP 403을 반환한다. 기대하는 값은 브라우저·저장소에 넣지 않으며, 값을 교체한 뒤에는 앱 서비스 프로세스를 재시작해야 한다. 비밀번호 재설정·이메일 인증·Cognito·고급 권한 관리는 제외한다.

## D-6 RAG 검색 (배포 현황 정정)
**현황(현재 배포):** Q&A는 사전 생성된 EC2-local `index.faiss`·`chunks.jsonl` bundle을 loopback retriever로 검색한다. 현재 bundle은 458 vectors, 77 courses, Titan Text Embeddings v2 512 dimensions다. 요청 `courseId`와 정확히 같은 청크만 반환하며, production sidecar는 질의 임베딩을 위해 Bedrock Runtime만 호출한다.

**build-time source/provenance:** 비공개 versioned bucket `hackathon-e2-t01-curi-docs`의 `documents/` 아래 sanitized PDF 77개와 metadata sidecar 77개를 `scripts/rag_indexer.py`가 읽어 로컬 FAISS bundle을 만든다. production runtime은 S3를 읽지 않고 `CURI_DOCUMENT_BUCKET`도 사용하지 않는다. Bedrock Knowledge Base, `CreateKnowledgeBase`, S3 Vectors, 별도 관리형 벡터 DB는 사용하지 않는다.

**근거:** `rag_sidecar.py`는 `faiss.read_index`와 로컬 `chunks.jsonl`을 읽고 `boto3.client("bedrock-runtime")`만 만든다. S3 client와 `CURI_DOCUMENT_BUCKET` 읽기는 `rag_indexer.py`의 build-time 경로에만 있다.

## D-7 생성 모델
**결정:** `global.anthropic.claude-sonnet-5`를 Amazon Bedrock에서 호출한다. 리전은 SDK 기본 공급자 체인에서 상속한다. 근거가 없으면 모델을 호출하지 않는다.

## D-8 S3 source/provenance
**결정:** 문서 S3 bucket은 비공개(private)·versioned `hackathon-e2-t01-curi-docs`다. S3 Public Access Block의 `BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`는 모두 `true`이고, 기본 서버 측 암호화는 `AES256`, versioning 상태는 `Enabled`다. `documents/` 아래 sanitized PDF 77개와 metadata sidecar 77개가 build-time source/provenance로 존재하며, 현재 bundle은 458 vectors·77 courses·Titan v2 512 dimensions다.

**운영 경계:** build-time `scripts/rag_indexer.py`는 S3 문서와 sidecar를 읽어 로컬 FAISS bundle을 만든다. production Q&A는 `rag_sidecar.py`가 로컬 bundle을 조회하므로 S3를 요청마다 읽지 않는다. 원본 ZIP은 Git에 넣지 않으며, source 문서와 자격 증명 값도 저장소에 두지 않는다.

## D-9 수강생 팁
**결정:** 3단계 척도 3개와 선택형 준비 태그만 수집하고, 과목별 5건부터 집계를 공개한다. 자유서술과 IP를 저장하지 않는다.

## D-10 중복 제출 (2026-09-01 개정)
**결정:** 로그인한 사용자당 과목 1회를 SQLite의 `UNIQUE(course_id, user_id)`로 차단한다.

## D-11 접근성
**결정:** 시맨틱 HTML, 키보드 탐색, 포커스 표시, `aria-live`, Web Speech API 읽어주기를 핵심 동선 전체에 적용한다.

## D-12 배포 경계
**결정:** 로컬 데모 완료 전 AWS 배포를 하지 않는다. deploy/destroy, EC2 종료·재시작은 사용자 명시 승인 전 금지한다.

## D-13 추천
**결정:** 비선호 제외·전공/관심/시간 매칭은 결정론적으로 수행하고, Bedrock은 후보 3~5개의 개인화 이유만 생성한다. 모델 실패 시 후보는 유지하고 이유 생성 실패를 표시한다.

## D-14 교수 리포트
**결정:** 교수 화면은 읽기 전용이며 근거 없음 질문과 구조화 팁 집계만 표시한다. 업로드·답글·학생 식별정보는 제공하지 않는다.

## D-15 디자인 연속성
**결정:** 기존 네이비·퍼플 디자인, 학교안심 알림장 폰트, 공급된 CURI 캐릭터 자산을 새 화면에도 재사용한다.
