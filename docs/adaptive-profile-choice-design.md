# 수업계획서 기반 적응형 선택지 설계

## 결론

현재 7단계 온보딩의 값은 `apps/web/lib/profile-options.ts`에 고정되어 있어, 실제 77개 과목이 가진 주제와 학생의 다양한 표현을 충분히 반영하지 못한다.

다만 **RAG 검색 결과나 Bedrock 응답으로 화면 선택지를 실시간 생성하는 방식은 채택하지 않는다.** 같은 입력에도 선택지가 달라질 수 있고, 실제 과목과 연결되지 않은 값이 저장되며, 모델 장애가 온보딩 장애로 이어지기 때문이다.

대신 다음 구조를 사용한다.

1. 배포 전: 강의계획서 원문에서 Bedrock으로 과목 메타데이터를 추출한다.
2. 배포 전: 스키마 검증, 표준어 정규화, 개인정보 제거, 출처 확인을 통과한 값만 선택지 taxonomy에 넣는다.
3. 런타임: 현재 카탈로그와 학생의 앞선 답변으로 taxonomy를 결정론적으로 좁힌다.
4. 추천 시: 선택값과 직접 입력을 실제 과목 메타데이터에 대조하고, Bedrock은 검증된 후보의 설명만 작성한다.

이렇게 하면 선택지는 학생에게 맞게 달라지지만, 과목과 근거는 항상 재현 가능하다.

## 현재 구현의 한계

| 현재 상태 | 사용자 문제 | 코드 위치 |
| --- | --- | --- |
| 전공 3개만 고정 | 타 학과, 복수전공, 자유전공 학생이 자신을 표현할 수 없음 | `apps/web/lib/profile-options.ts` |
| 관심분야 4개만 고정 | 건축·회계·교양 과목의 실제 관심 태그가 대부분 노출되지 않음 | `apps/web/lib/profile-options.ts` |
| 진로 4개만 고정 | 건축·회계 진로가 없고 개발 직군에 치우침 | `apps/web/lib/profile-options.ts` |
| 모든 값이 단일 문자열 | 관심·비선호를 여러 개 고를 수 없음 | `packages/db/src/schema.ts` |
| API가 고정 배열 값만 허용 | 직접 입력을 보내면 400 응답 | `apps/web/lib/profile-options.ts` |
| 추천 규칙도 고정 문구 사전 사용 | 새 선택지가 추가되어도 점수에 반영되지 않음 | `apps/web/lib/recommendations.ts` |
| RAG 메타데이터가 3개 필드뿐 | `courseId`, 과목명, 학과 외에는 선택지 생성에 쓸 구조화 정보가 없음 | `scripts/rag_indexer.py` |

현재 카탈로그에는 이미 `goalKeywords`, `interestTags`, `difficulty`, `prerequisites`, `schedule`이 있다. 첫 개선은 이 값을 활용하고, 수업계획서 재추출 때 아래 메타데이터를 보강하는 순서가 안전하다.

## 과목 메타데이터 스키마

과목마다 다음 필드를 만든다. 모든 배열 값은 선택지 taxonomy의 표준 식별자를 사용한다.

```json
{
  "courseId": "web-content-development",
  "department": "컴퓨터공학과",
  "courseType": "major",
  "subjectAreas": ["web-development", "digital-content"],
  "skills": ["html-css", "javascript", "client-server"],
  "careerPaths": ["frontend-developer", "web-publisher"],
  "activityModes": ["practice", "individual-project"],
  "assessmentModes": ["project", "exam"],
  "workload": {
    "weeklyHoursMin": 3,
    "weeklyHoursMax": 5
  },
  "difficulty": "intermediate",
  "prerequisiteCourseIds": [],
  "liberalArtsDomains": [],
  "evidence": [
    {
      "field": "activityModes",
      "value": "individual-project",
      "sourcePage": 3,
      "excerpt": "개인 프로젝트를 통해 웹프로그램을 완성한다."
    }
  ],
  "extraction": {
    "modelId": "configured-bedrock-model",
    "schemaVersion": 1,
    "confidence": 0.93,
    "reviewStatus": "approved"
  }
}
```

### 필드별 원칙

- `subjectAreas`, `skills`, `careerPaths`: 강의 목표·내용에서 추출한다.
- `activityModes`, `assessmentModes`: 수업 방법·평가 방법에 명시된 경우만 넣는다.
- `workload`: 명시된 시수와 과제량만 사용한다. 근거가 없으면 `null`이다.
- `difficulty`: 선수과목·학년·내용 수준을 함께 보되, 추론이면 낮은 confidence로 검수 대기한다.
- `liberalArtsDomains`: 교양 과목에만 사용한다. 예: 인문, 사회, 문화예술, 과학기술, 시민성, 의사소통.
- `evidence`: 선택지와 추천 이유가 원문으로 되돌아갈 수 있도록 필수로 저장한다.
- 교수 이메일·전화번호·개인 이름은 추출 대상이 아니며 artifact 생성 전에 제거한다.

## Bedrock 추출 파이프라인

```text
강의계획서 PDF
  → 텍스트/페이지 추출
  → Bedrock 구조화 추출(JSON)
  → 엄격한 스키마 파싱
  → 동의어 정규화
  → 실제 과목 ID 연결
  → PII 검사
  → 근거·confidence 검사
  → 검수 대기/승인
  → catalog-metadata.json + profile-taxonomy.json
  → FAISS 청크와 같은 릴리스 버전으로 배포
```

### 실패 규칙

- JSON 파싱 실패: 해당 과목의 새 메타데이터를 배포하지 않는다.
- taxonomy에 없는 표현: 자동 추가하지 않고 `unmappedTerms` 보고서에 넣는다.
- 근거 excerpt가 없는 값: 선택지와 추천 점수에 사용하지 않는다.
- confidence가 기준 미만인 값: 검수 전까지 사용하지 않는다.
- Bedrock 장애: 이전에 승인된 artifact를 유지한다.
- 과목이 0개 연결된 선택지: UI에 노출하지 않는다.

## 학생 프로필 질문 재설계

### 1. 학업 배경

**질문:** 현재 소속이나 가장 가까운 전공은 무엇인가요?

- 카탈로그에서 학과 목록을 읽어 단일 선택으로 제공한다.
- `교양`은 학과가 아니므로 전공 선택지에 넣지 않는다.
- `복수전공/융합전공`과 `기타/자유전공`을 제공한다.
- 기타를 고르면 2~30자의 직접 입력을 받는다.
- 전공은 후보를 우선 정렬할 뿐 타 학과 과목을 완전히 숨기지 않는다.

### 2. 배우고 싶은 주제

**질문:** 이번 학기에 무엇을 배우고 싶나요?

- `subjectAreas`와 `skills`에서 현재 개설 과목이 있는 값만 노출한다.
- 전공 선택 후 해당 학과와 교양에서 많이 연결된 6개를 먼저 보여준다.
- 다중 선택(최대 5개), 검색, `직접 입력`을 지원한다.
- 각 칩에 `연결 과목 N개`를 표시해 선택 결과를 예측할 수 있게 한다.
- 직접 입력은 원문을 보존하고 taxonomy와의 유사도는 추천 단계에서 계산한다.

### 3. 이번 학기 목표

**질문:** 수업을 통해 얻고 싶은 결과는 무엇인가요?

이 값은 강의계획서가 아니라 학생의 의도이므로 안정적인 공통 taxonomy를 사용한다.

- 기초 다지기
- 실무 기술 익히기
- 포트폴리오 만들기
- 진로 탐색
- 자격·시험 준비
- 학점/졸업 요건 충족

최대 2개를 선택한다. `goalKeywords`와 과목 메타데이터를 연결하는 매핑은 별도 artifact로 관리한다.

### 4. 관심 진로

**질문:** 어떤 일을 해보고 싶나요?

- 선택한 전공·주제와 연결된 `careerPaths` 상위 6개를 먼저 보여준다.
- 다중 선택(최대 3개), 검색, 직접 입력을 지원한다.
- 진로를 아직 모르면 `아직 탐색 중`을 선택할 수 있다.
- 개발 직군뿐 아니라 건축·회계·세무·콘텐츠·교육 등 현재 과목으로 뒷받침되는 진로만 노출한다.

### 5. 선호하는 수업 방식

**질문:** 어떤 방식으로 배울 때 가장 잘 맞나요?

이 값은 학생 성향이지만 실제 과목과 연결할 수 있도록 `activityModes`와 같은 표준어를 쓴다.

- 강의 중심
- 실습 중심
- 개인 프로젝트
- 팀 프로젝트
- 토론/발표
- 현장·사례 분석

최대 2개를 선택한다. 해당 방식이 명시된 과목 수를 함께 표시한다.

### 6. 주당 투자 가능 시간

**질문:** 수업 외 학습에 일주일 몇 시간을 쓸 수 있나요?

- 고정 문구 대신 숫자 범위 또는 1시간 단위 slider를 사용한다.
- 저장값은 표시 문구가 아니라 정수 시간이다.
- 과목의 workload가 없으면 시간 조건으로 탈락시키지 않고 `정보 없음`으로 처리한다.

### 7. 피하고 싶은 조건

**질문:** 가능하면 피하고 싶은 수업 조건이 있나요?

- `activityModes`, `assessmentModes`, `difficulty`, workload에서 실제 과목과 연결된 값만 제공한다.
- 예: 발표 비중 큼, 팀 프로젝트, 시험 중심, 수학 활용, 주당 6시간 이상.
- 다중 선택(최대 5개)과 직접 입력을 지원한다.
- 비선호는 기본적으로 감점이다. 사용자가 `반드시 제외`로 지정한 조건만 필터로 사용한다.

### 8. 교양 탐색

**질문:** 전공 외에 탐색하고 싶은 교양 주제가 있나요?

- `교양도 추천받기` toggle을 제공한다.
- 교양을 켜면 `liberalArtsDomains` 상위 선택지와 자유 검색을 제공한다.
- 학생이 `환경과 기술의 관계`, `글쓰기`, `K-문화`처럼 자연어로 직접 입력할 수 있다.
- 교양 추천에는 학과 일치 100점 규칙을 적용하지 않는다.
- 직접 입력과 교양 과목의 `subjectAreas`, `skills`, 요약 임베딩을 비교해 후보를 만든다.

## 적응형 선택지 생성 규칙

런타임 deep module의 외부 interface는 다음 두 동작으로 제한한다.

```text
getChoiceSet(partialProfile, catalogVersion) -> ProfileChoiceSet
recommendCourses(completedProfile, catalogVersion) -> RecommendationResult
```

호출자는 Bedrock prompt, taxonomy 정규화, 과목 수 계산을 알 필요가 없다.

`getChoiceSet`은 다음 순서로 동작한다.

1. 현재 배포된 taxonomy와 과목 메타데이터를 읽는다.
2. 앞 단계 답변과 충돌하는 과목을 제거하지 말고 우선순위만 낮춘다.
3. 실제 연결 과목 수가 1개 이상인 선택지만 남긴다.
4. 관련도, 연결 과목 수, 표준 label 순으로 결정론적 정렬을 한다.
5. 상위 6개와 전체 검색 결과를 나눠 반환한다.
6. 각 값에 `courseCount`, `whyShown`, `source`를 포함한다.

Bedrock 호출은 `getChoiceSet`에 없다. 선택지 생성이 모델 응답 속도와 장애에 의존하지 않게 한다.

## 저장 모델

현재 `user_profile`의 단일 문자열 7개를 그대로 확장하면 의미가 섞인다. 새 모델은 다음을 구분해야 한다.

```json
{
  "academicBackground": {
    "departmentId": "computer-engineering",
    "customDepartment": null
  },
  "subjectInterestIds": ["artificial-intelligence", "web-development"],
  "subjectInterestText": "교육용 AI 서비스",
  "goalIds": ["practical-skill", "portfolio"],
  "careerPathIds": ["frontend-developer"],
  "careerPathText": null,
  "preferredActivityIds": ["practice", "individual-project"],
  "weeklyHours": 5,
  "avoidances": [
    { "id": "team-project", "strength": "prefer-not" }
  ],
  "liberalArts": {
    "enabled": true,
    "domainIds": ["science-technology"],
    "interestText": "기술이 사회에 미치는 영향"
  },
  "taxonomyVersion": 1
}
```

저장 API는 제출된 문자열이 아니라 해당 taxonomy version에서 유효한 ID인지 한 번 파싱한다. 직접 입력은 길이·문자 정규화만 검사하고 별도 필드에 저장한다.

## 추천 점수

Bedrock이 후보를 처음부터 고르게 하지 않는다.

1. 필수 제외 조건 적용
2. 전공/교양 탐색 모드 분리
3. 주제·기술 일치
4. 목표와 과목 산출물 일치
5. 진로 연결
6. 수업 방식 일치
7. 학습량 적합
8. 비선호 감점
9. 상위 15개만 Bedrock에 전달
10. Bedrock은 후보 중 3~5개를 고르고, 이미 계산된 대응 관계로 추천 이유를 작성

추천 응답에는 `matchedPreferences`, `tradeoffs`, `metadataVersion`을 기계가 읽는 값으로 포함한다. 모델의 자연어가 이 값을 바꿀 수 없다.

## 사용자 시나리오 점검

### 컴퓨터공학 학생, 교육용 AI 관심

- 전공을 고르면 AI·웹·데이터 주제가 먼저 보인다.
- `교육용 AI 서비스`를 직접 입력할 수 있다.
- AI와 웹 과목이 함께 후보가 되고, 단순 학과 일치만으로 데이터베이스 과목이 최상위가 되지 않는다.

### 건축학 학생, 발표 비선호

- 건축 관련 진로와 활동 방식이 먼저 보인다.
- 발표가 일부 포함된 과목은 감점하고, `반드시 제외`일 때만 제거한다.
- 발표 정보가 강의계획서에 없으면 임의로 제외하지 않는다.

### 다른 학과 학생, 교양만 탐색

- 기타 학과를 직접 입력한다.
- `교양도 추천받기`에서 관심 주제를 자연어로 쓴다.
- 교양 후보에는 학과 일치 점수를 적용하지 않는다.

### 아직 진로가 없는 학생

- `아직 탐색 중`을 선택한다.
- 진로 점수는 0으로 두고 주제·목표·방식으로 추천한다.
- 입력하지 않았다는 이유로 임의의 진로를 추론하지 않는다.

## 구현 순서

### A. 제출 전 가능한 최소 개선

범위: 기존 catalog만 사용하며 DB migration과 PDF 재추출은 하지 않는다.

1. 전공 선택지를 catalog의 학과에서 생성하고 `기타/자유전공`을 추가한다.
2. 관심분야 선택지를 `interestTags`에서 생성하되, 학과 선택에 따라 상위 항목을 정렬한다.
3. 교양 포함 toggle과 교양 관심 직접 입력 한 칸을 추가한다.
4. 기존 추천 점수에 교양 탐색 모드와 직접 입력 매칭을 추가한다.

이 단계도 프로필 저장 스키마·API·UI·추천·테스트·배포를 함께 바꿔야 하므로 단순 문구 수정이 아니다.

### B. 제출 후 완전한 구현

1. 과목 메타데이터 추출 JSON schema와 검수 report를 만든다.
2. Bedrock 추출을 RAG 인덱스 생성 전 단계에 연결한다.
3. taxonomy 생성기와 버전 artifact를 만든다.
4. 프로필 v2 저장 migration을 적용한다.
5. 적응형 선택지 endpoint와 온보딩 UI를 만든다.
6. 추천 점수를 새 메타데이터로 교체한다.
7. 실제 77개 강의계획서를 재추출·검수한다.
8. 모바일·키보드·빈 결과·Bedrock 장애·이전 프로필 migration을 E2E 검증한다.

## 의사결정

권장안은 **현재 제출본에는 동작 중인 7단계 흐름을 유지하고, 위 설계를 제출 후 v2로 구현하는 것**이다.

이유:

- 현재 제출본은 141개 테스트, production build, 실제 EC2 배포가 통과한 상태다.
- 선택지 v2는 UI 변경이 아니라 데이터 artifact, DB migration, API, 추천 점수, Bedrock 추출 파이프라인을 함께 바꾸는 기능이다.
- 마감 직전에 일부만 바꾸면 직접 입력이 저장은 되지만 추천에 반영되지 않는 죽은 기능이 생길 가능성이 높다.
- 심사에서는 현재 기능을 안정적으로 시연하고, 발표에서 `현재 고정 taxonomy → 수업계획서 기반 적응형 taxonomy`를 확장 계획으로 설명하는 편이 정직하고 안전하다.

제출 전에 구현해야 한다면 A만 수행하고, B는 별도 범위로 유지한다.
