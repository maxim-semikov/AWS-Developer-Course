#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FrontEndStack } from "../lib/front-end-stack";

const app = new cdk.App();
new FrontEndStack(app, "FrontEndStack", {
  env: {
    region: "eu-central-1",
  },
});
