// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE in the project root for license information.

import * as stringMap from '@ts-common/string-map'
import { IErrorBase } from './errors'

export type Report = {
  /**
   * This is a callback function to report validation tools result.
   */
  readonly logResult: (error: any) => void
  /**
   * This is a callback function to report validation tools exception.
   */
  readonly logError: (error: any) => void
  /**
   * This is a callback function to report an info.
   */
  readonly logInfo: (info: any) => void
}

export type Config = {
  /**
   * Current working directory.
   */
  readonly cwd: string
  /**
   * Environment variables.
   */
  readonly env: stringMap.StringMap<string>
  /**
   * Arguments
   */
  readonly args?: stringMap.StringMap<any>
}

export const defaultConfig = () => ({
  cwd: process.cwd(),
  env: process.env,
  args: {},
})

export const isAzurePipelineEnv = (): boolean => process.env.SYSTEM_PULLREQUEST_TARGETBRANCH !== undefined

/**
 * The function executes the given `tool` and prints errors to `stderr`.
 *
 * @param tool is a function which returns errors as `AsyncIterable`.
 */
// tslint:disable-next-line:no-async-without-await
export const run = async <T extends IErrorBase>(
  tool: (config: Config) => AsyncIterable<T>,
  // tslint:disable-next-line:no-console no-unbound-method
  report: Report = { logResult: console.log, logError: console.error, logInfo: console.log },
  config: Config = defaultConfig(),
): Promise<void> => {
  try {
    const errors = tool(config)
    // tslint:disable-next-line:no-let
    let errorsNumber = 0
    for await (const e of errors) {
      errorsNumber += e.level !== 'Warning' && e.level !== 'Info' ? 1 : 0
      report.logResult(e)
    }
    report.logInfo(`errors: ${errorsNumber}`)
    if (errorsNumber > 0) {
      if (isAzurePipelineEnv()) {
        console.log('##vso[task.setVariable variable=ValidationResult]failure')
      }
      // tslint:disable-next-line: no-object-mutation
      process.exitCode = 1
    } else {
      if (isAzurePipelineEnv()) {
        console.log('##vso[task.setVariable variable=ValidationResult]success')
      }
      // tslint:disable-next-line: no-object-mutation
      process.exitCode = 0
    }
    // tslint:disable-next-line:no-object-mutation
  } catch (e) {
    report.logInfo(`INTERNAL ERROR`)
    if (isAzurePipelineEnv()) {
      console.log('##vso[task.setVariable variable=ValidationResult]failure')
    }
    report.logError(e)
    // tslint:disable-next-line:no-object-mutation
    process.exitCode = 1
  }
}
