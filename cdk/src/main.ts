import { App, StackProps } from "aws-cdk-lib";
import { Config } from "./config";
import { FileProcStreamingStack } from "./stacks/streaming-stack";

const app = new App();
const props: StackProps = {
  env: {
    account: Config.ACCOUNT,
    region: Config.REGION
  }
}
new FileProcStreamingStack(app, FileProcStreamingStack.name, props);