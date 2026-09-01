#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { CuriInfraStack } from "../lib/infra-stack.js";

const app = new App();
new CuriInfraStack(app, "CuriInfraStack");
