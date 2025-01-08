
export class Config {
  static readonly ACCOUNT: string = this.strict_parse_string(process.env.ACCOUNT);
  static readonly REGION: string = process.env.REGION || 'eu-west-1'; 
  static readonly ENV: string = process.env.ENVIRONMENT || 'test';
  static readonly IS_PRODUCTION: boolean = Config.ENV === 'prod';
  static readonly ACM_CERT_ARN: string = this.strict_parse_string(process.env.ACM_CERT_ARN);
  static readonly PHZ: string = this.strict_parse_string(process.env.PHZ);
  static readonly DOMAIN: string = this.strict_parse_string(process.env.DOMAIN);
  static readonly CLIENT_BUCKET: string = this.strict_parse_string(process.env.CLIENT_BUCKET);
  static readonly CLIENT_DIST: string = this.strict_parse_string(process.env.CLIENT_DIST);
  static readonly REDSHIFT_BUCKET: string = this.strict_parse_string(process.env.REDSHIFT_BUCKET);
  static readonly REDSHIFT_BACKUP_BUCKET: string = this.strict_parse_string(process.env.REDSHIFT_BACKUP_BUCKET);
  static readonly REDSHIFT_NS: string = this.strict_parse_string(process.env.REDSHIFT_NS);
  static readonly REDSHIFT_WG: string = this.strict_parse_string(process.env.REDSHIFT_WG);
  static readonly REDSHIFT_DB: string = this.strict_parse_string(process.env.REDSHIFT_DB);
  static readonly REDSHIFT_TABLE: string = this.strict_parse_string(process.env.REDSHIFT_TABLE);
  static readonly REDSHIFT_CAPACITY: number = parseInt(process.env.REDSHIFT_CAPACITY || "1");
  static readonly REDSHIFT_ADMIN_USERNAME: string = this.strict_parse_string(process.env.REDSHIFT_ADMIN_USERNAME);
  static readonly REDSHIFT_ADMIN_PW: string = this.strict_parse_string(process.env.REDSHIFT_ADMIN_PW);
  static readonly FIREHOSE_STREAM_NAME: string = this.strict_parse_string(process.env.FIREHOSE_STREAM_NAME);
  static readonly COGNITO_ID_POOL_NAME: string = this.strict_parse_string(process.env.COGNITO_ID_POOL_NAME);

  private static strict_parse_string(variable: string | undefined): string {
    if (variable == undefined) {
      throw new Error(`Variable ${variable} is undefined`);
    }

    return variable as string;
  }
}
