
export class Config {
  static readonly ACCOUNT: string = this.strict_parse_string(process.env.ACCOUNT);
  static readonly REGION: string = process.env.REGION || 'eu-west-1'; 
  static readonly ENV: string = process.env.ENVIRONMENT || 'test';
  static readonly IS_PRODUCTION: boolean = Config.ENV === 'prod';
  static readonly FILE_UPLOAD_BUCKET: string = this.strict_parse_string(process.env.FILE_UPLOAD_BUCKET);
  static readonly RECORDING_TABLE: string = process.env.RECORDING_TABLE || 'canvastream.Recording';
  static readonly FILE_HANDLER_DIST: string = this.strict_parse_string(process.env.FILE_HANDLER_DIST);

  private static strict_parse_string(variable: string | undefined): string {
    if (variable == undefined) {
      throw new Error(`Variable ${variable} is undefined`);
    }

    return variable as string;
  }
}
