import { U } from 'ts-toolbelt'

import { TestSuiteMatrix } from './getTestSuiteInfo'
import { ProviderFlavors, Providers, RelationModes } from './providers'
import { setupTestSuiteMatrix, TestCallbackSuiteMeta } from './setupTestSuiteMatrix'
import { ClientMeta, MatrixOptions } from './types'

type MergedMatrixParams<MatrixT extends TestSuiteMatrix> = U.IntersectOf<MatrixT[number][number]>

type SchemaCallback<MatrixT extends TestSuiteMatrix> = (suiteConfig: MergedMatrixParams<MatrixT>) => string

type DefineMatrixOptions<MatrixT extends TestSuiteMatrix> = {
  /** Allows to exclude certain matrix dimensions from tests */
  exclude?: (config: MergedMatrixParams<MatrixT>) => boolean
}

/**
 * Tests factory function. Receives all matrix parameters, used for this suite as a moment
 * and generic suite metadata as an arguments.
 *
 * @param setupDatabase Manually setup the database of a test. Can only be called if `skipDb` is true.
 */
type TestsFactoryFn<MatrixT extends TestSuiteMatrix> = (
  suiteConfig: MergedMatrixParams<MatrixT> & {
    provider: Providers
    providerFlavor?: ProviderFlavors
    relationMode?: RelationModes
  },
  suiteMeta: TestCallbackSuiteMeta,
  clientMeta: ClientMeta,
) => void

export interface MatrixTestHelper<MatrixT extends TestSuiteMatrix> {
  matrix: () => MatrixT

  matrixOptions?: DefineMatrixOptions<MatrixT>
  /**
   * Function for defining test suite. Must be used in your `tests.ts` file.
   *
   * @param tests tests factory function. Receives all matrix parameters, used for this suite as a moment
   * and generic suite metadata as an arguments
   */
  setupTestSuite(tests: TestsFactoryFn<MatrixT>, options?: MatrixOptions): void

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
