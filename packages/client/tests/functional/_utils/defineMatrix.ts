import { U } from 'ts-toolbelt'

import { TestSuiteMatrix } from './getTestSuiteInfo'
import { setupTestSuiteMatrix, TestSuiteMeta } from './setupTestSuiteMatrix'
import { ClientMeta, MatrixOptions } from './types'

type MergedMatrixParams<MatrixT extends TestSuiteMatrix> = U.IntersectOf<MatrixT[number][number]>

type SchemaCallback<MatrixT extends TestSuiteMatrix> = (suiteConfig: MergedMatrixParams<MatrixT>) => string

type DefineMatrixOptions<MatrixT extends TestSuiteMatrix> = {
  /** Allows to exclude certain matrix dimensions from tests */
  exclude?: (config: MergedMatrixParams<MatrixT>) => boolean
}

export interface MatrixTestHelper<MatrixT extends TestSuiteMatrix> {
  matrix: () => MatrixT

  matrixOptions?: DefineMatrixOptions<MatrixT>
  /**
   * Function for defining test suite. Must be used in your `tests.ts` file.
   *
   * @param tests tests factory function. Receives all matrix parameters, used for this suite as a moment
   * and generic suite metadata as an arguments
   */
  setupTestSuite(
    tests: (suiteConfig: MergedMatrixParams<MatrixT>, suiteMeta: TestSuiteMeta, clientMeta: ClientMeta) => void,
    options?: MatrixOptions,
  ): void

  /**
   * Function for defining test schema. Must be used in your `prisma/_schema.ts`. Return value
   * of this function should be used as a default export of that module.
   *
   * @param schemaCallback schema factory function. Receives all matrix parameters, used for the
   * specific test suite at the moment.
   */
  setupSchema(schemaCallback: SchemaCallback<MatrixT>): SchemaCallback<MatrixT>
}

/**
 * Helper function for defining test matrix in a strongly typed way.
 * Should be used in your _matrix.ts file. Returns a helper class, that can later be used
 * for defining schema and test suite itself, while providing autocomplete and type checking
 * for matrix parameters.
 * @param matrix matrix factory function
 * @returns helper for defining the suite and the prisma schema
 */
export function defineMatrix<MatrixT extends TestSuiteMatrix>(
  matrix: () => MatrixT,
  options?: DefineMatrixOptions<MatrixT>,
): MatrixTestHelper<MatrixT> {
  return {
    matrix,
    matrixOptions: options,
    setupTestSuite: setupTestSuiteMatrix as MatrixTestHelper<MatrixT>['setupTestSuite'],
    setupSchema(schemaCallback) {
      return schemaCallback
    },
  }
}
