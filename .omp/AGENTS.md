해커톤 MVP. 소스 오브 트루스는 docs/demo-script.md와 docs/prd.md다.
웹은 apps/web, DB는 packages/db, 인프라는 infra에 둔다.
리전은 ap-northeast-2이고 AWS 인증은 EC2 인스턴스 역할만 사용한다.
IaC는 CDK만 사용한다.
로컬 데이터는 SQLite를 사용한다.
배포는 사용자 명시 후에만 수행한다.
기능별 검증 후 별도 커밋한다.
