#!/bin/bash

set -e

print_help() {
cat << EOF
Usage: scripts/cdk.sh COMMAND FLAGS [OPTIONS] 
OPTIONS:
  [-e | --environment]  The environment of the stack. Allowed values: prod, test
  [--bootstrap]         Bootstrap the CDK environment
  [-h | --help]         Print help
EOF
}

ENV_WHITELIST=("prod" "test")
BOOTSTRAP=
export ENV=${ENV:-"test"}
FLAGS=""
COMMANDS=""
while (("$#")); do
  case "$1" in
  -e | --environment)
    ENV=$2
    
    if [[ ! $(echo ${ENV_WHITELIST[@]} | fgrep -w $ENV) ]]
    then
      echo "Environment $ENV unsupported"
      print_help
      exit 1
    fi

    shift
    shift
    ;;
  --bootstrap)
    BOOTSTRAP=1
    shift
    ;;
  -h | --help)
    print_help
    exit 0
    ;;
  -*|--*=)
    FLAGS="$FLAGS $1"
    shift
    ;;
  *)
    COMMANDS="$COMMANDS $1"
    shift
    ;;
  esac
done

[[ -f $ENV.env ]] && export $(cat $ENV.env | envsubst | xargs)

if [[ $BOOTSTRAP ]]
then
  echo "Bootstrapping the CDK environment"
  npx cdk bootstrap $ACCOUNT/$REGION --profile $PROFILE
fi

CMD="npx cdk --profile $PROFILE $COMMANDS $FLAGS"

echo "Executing $CMD"
pushd infra
exec $CMD
popd

echo "Finished"