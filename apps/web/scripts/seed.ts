import { join } from "node:path";

import { createAppDatabase } from "@curi/db";

import { seedDemoState } from "../lib/demo-seed";

const databasePath = process.env.CURI_APP_DB_PATH
  ?? join(process.cwd(), ".data", "curi-app.sqlite");
const database = createAppDatabase(databasePath);

try {
  const result = seedDemoState(database);
  console.log(
    `CURI 데모 시드 완료: 팁 ${result.tips}건 추가, 근거 없음 질문 ${result.qaLogs}건 추가 (db=${databasePath})`,
  );
} finally {
  database.close();
}
