import { App, Construct, Stack } from '@aws-cdk/core';

import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';


export class SFNAthenaDemo extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const startAthenaQueryExecutionJob = new tasks.AthenaStartQueryExecution(this, 'StartAthenaQuery', {
      queryString: 'SELECT x FROM UNNEST(SEQUENCE(1, 99)) t(x)', // sfn.JsonPath.stringAt('$.queryString'),
      queryExecutionContext: {
        databaseName: 'default',
      },
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });
    const setNextTokenNull = new sfn.Pass(this, 'SetNextTokenNull', {
      result: sfn.Result.fromObject({ NextToken: null }),
      resultPath: '$.QueryResults',
    });
    const getQueryResultsJob = new tasks.AthenaGetQueryResults(this, 'GetAthenaQueryResults', {
      queryExecutionId: sfn.JsonPath.stringAt('$.QueryExecution.QueryExecutionId'),
      nextToken: sfn.JsonPath.stringAt('$.QueryResults.NextToken'),
      maxResults: 10,
      resultPath: '$.QueryResults',
    });
    const processChunk = new sfn.Pass(this, 'ProcessChunk');
    const isQueryResultsEmpty = new sfn.Choice(this, 'IsQueryResultsEmpty');
    const setNotFirst = new sfn.Pass(this, 'SetNotFirst', {
      result: sfn.Result.fromBoolean(true),
      resultPath: '$.NotFirst',
    });
    const end = new sfn.Pass(this, 'End');

    new sfn.StateMachine(this, 'StateMachine', {
      definition: sfn.Chain
        .start(startAthenaQueryExecutionJob)
        .next(setNextTokenNull)
        .next(getQueryResultsJob)
        .next(processChunk)
        .next(isQueryResultsEmpty
          .when(sfn.Condition.isNotPresent('$.QueryResults.NextToken'), end)
          .when(sfn.Condition.isNotNull('$.QueryResults.NextToken'), setNotFirst.next(getQueryResultsJob))
          .otherwise(end),
        ),
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();
const stack = new Stack(app, 'SFNAthenaDemoStack', { env: devEnv });

new SFNAthenaDemo(stack, 'SFNAthenaDemo');

app.synth();