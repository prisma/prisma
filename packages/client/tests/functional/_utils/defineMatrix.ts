import { U } from 'ts-toolbelt'

import { TestSuiteMatrix } from './getTestSuiteInfo'
import { setupTestSuiteMatrix, TestSuiteMeta } from './setupTestSuiteMatrix'

type MergedMatrixParams<MatrixT extends TestSuiteMatrix> = U.IntersectOf<MatrixT[number][number]>

type SchemaCallback<MatrixT extends TestSuiteMatrix> = (suiteConfig: MergedMatrixParams<MatrixT>) => string

export interface MatrixTestHelper<MatrixT extends TestSuiteMatrix> {
  matrix: () => MatrixT
  setupTestSuite(tests: (suiteConfig: MergedMatrixParams<MatrixT>, suiteMeta: TestSuiteMeta) => void): void
  setupSchema(schemaCallback: SchemaCallback<MatrixT>): SchemaCallback<MatrixT>
}

export function defineMatrix<MatrixT extends TestSuiteMatrix>(matrix: () => MatrixT): MatrixTestHelper<MatrixT> {
  return {
    matrix,
    setupTestSuite: setupTestSuiteMatrix as MatrixTestHelper<MatrixT>['setupTestSuite'],
    setupSchema(schemaCallback) {
      return schemaCallback
    },
  }
}
