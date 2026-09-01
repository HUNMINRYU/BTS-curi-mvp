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

## 데이터베이스

SQLite 스키마와 시드는 로컬 데모 기능 단계에서 추가한다. 별도 DB 컨테이너는 사용하지 않는다.

AWS 배포 명령은 로컬 데모 완료 후 사용자 승인 하에 추가한다.
