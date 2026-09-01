# CURI

강의계획서 기반 AI 수업 내비게이터 해커톤 MVP.

## 요구사항

- Node.js 20.9 이상
- pnpm 11.25.0

## 개발 서버

```bash
pnpm install
pnpm dev
```

## 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 데이터베이스

SQLite 스키마와 시드는 로컬 데모 기능 단계에서 추가한다. 별도 DB 컨테이너는 사용하지 않는다.

AWS 배포 명령은 로컬 데모 완료 후 사용자 승인 하에 추가한다.
